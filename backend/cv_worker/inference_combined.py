import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import os
import open3d as o3d
from scipy.spatial import KDTree
from collections import defaultdict
import sys

sys.path.append('Pointnet_Pointnet2_pytorch')
from Pointnet_Pointnet2_pytorch.models.pointnet2_sem_seg import get_model

UTM_OFFSET = np.array([627285, 4841948, 0])

class SegmentationDataset(Dataset):
    """Датасет для модели классификации (Road/Car/Building/Other)"""
    def __init__(self, df, num_points=4096, mean=None, std=None, height_stats=None):
        self.df = df.reset_index(drop=True)
        self.num_points = num_points
        self.mean = mean if mean is not None else np.zeros(3)
        self.std = std if std is not None else np.ones(3)
        self.height_mean = height_stats['mean'] if height_stats else 0.0
        self.height_std = height_stats['std'] if height_stats else 1.0

    def __len__(self):
        return int(np.ceil(len(self.df) / self.num_points))
    
    def __getitem__(self, idx):
        start_idx = idx * self.num_points
        end_idx = min(start_idx + self.num_points, len(self.df))
        batch_df = self.df.iloc[start_idx:end_idx]
        
        actual_size = len(batch_df)
        
        coords = batch_df[['x', 'y', 'z']].values
        std_safe = np.where(self.std == 0, 1.0, self.std)
        point_cloud = (coords - self.mean) / std_safe
        
        rgb = batch_df[['red', 'green', 'blue']].values / 255.0
        
        intensity = batch_df['intensity'].values
        height = batch_df['height'].values
        verticality = batch_df['verticality'].values
        
        features = np.zeros((self.num_points, 9), dtype=np.float32)
        features[:actual_size, 0:3] = point_cloud[:, :3]
        features[:actual_size, 3:6] = rgb
        features[:actual_size, 6] = (height - self.height_mean) / (self.height_std + 1e-6)
        features[:actual_size, 7] = intensity
        features[:actual_size, 8] = verticality
        
        return torch.tensor(features, dtype=torch.float32), actual_size

class DynamicStaticDataset(Dataset):
    """Датасет для модели статика/динамика"""
    def __init__(self, pcd, batch_size=200000):
        self.points = np.asarray(pcd.points)
        self.colors = np.asarray(pcd.colors) if pcd.has_colors() else np.ones((len(self.points), 3)) * 0.5
        self.normals = np.asarray(pcd.normals)
        self.batch_size = batch_size
        
    def __len__(self):
        return int(np.ceil(len(self.points) / self.batch_size))
    
    def __getitem__(self, idx):
        start_idx = idx * self.batch_size
        end_idx = min((idx + 1) * self.batch_size, len(self.points))
        
        batch_points = self.points[start_idx:end_idx]
        batch_colors = self.colors[start_idx:end_idx]
        batch_normals = self.normals[start_idx:end_idx]
        
        # Нормализация координат
        xyz = batch_points.copy()
        xyz_mean = np.mean(xyz, axis=0, keepdims=True)
        xyz_centered = xyz - xyz_mean
        xyz_max = np.max(np.abs(xyz_centered))
        if xyz_max > 0:
            xyz_normalized = xyz_centered / (xyz_max + 1e-8)
        else:
            xyz_normalized = xyz_centered
        
        # Нормализация цветов
        rgb = batch_colors.copy()
        if np.max(rgb) > 1.0:
            rgb = rgb / 255.0
        rgb_normalized = (rgb - np.mean(rgb, axis=0, keepdims=True)) / (np.std(rgb, axis=0, keepdims=True) + 1e-8)
        
        # Объединяем признаки: xyz (3) + rgb (3) + normals (3) = 9
        features = np.hstack([xyz_normalized, rgb_normalized, batch_normals])
        
        return torch.tensor(features, dtype=torch.float32)

def apply_car_threshold(pred_probs, car_class=1, threshold=0.55):
    """Применяет порог уверенности для класса машин"""
    pred_labels = pred_probs.argmax(dim=2)
    car_prob = pred_probs[:, :, car_class]
    
    predicted_as_car = (pred_labels == car_class)
    low_confidence_car = car_prob < threshold
    need_reclassify = predicted_as_car & low_confidence_car
    
    if need_reclassify.any():
        probs_without_car = pred_probs.clone()
        probs_without_car[:, :, car_class] = -float('inf')
        
        second_best = probs_without_car.argmax(dim=2)
        pred_labels[need_reclassify] = second_best[need_reclassify]
    
    return pred_labels

def restore_gaps_like_visual(points, pred_labels_dynamic, all_dynamic_probs, 
                              ground_height_threshold=0.55, grid_divisions=25,
                              edge_distance_threshold=6.0, z_upper_static_threshold=6.5):
    """
    Восстанавливает пробелы как в inference_visual.ipynb:
    - Определяет землю
    - Находит граничные точки
    - Обрабатывает спорные точки
    """
    
    # 1. Определение земли через грид
    min_x, min_y = np.min(points[:, 0]), np.min(points[:, 1])
    max_x, max_y = np.max(points[:, 0]), np.max(points[:, 1])
    
    x_edges = np.linspace(min_x, max_x, grid_divisions + 1)
    y_edges = np.linspace(min_y, max_y, grid_divisions + 1)
    
    ground_mask = np.zeros(len(points), dtype=bool)
    
    for i in range(grid_divisions):
        for j in range(grid_divisions):
            x_min, x_max = x_edges[i], x_edges[i+1]
            y_min, y_max = y_edges[j], y_edges[j+1]
            
            cell_mask = (points[:, 0] >= x_min) & (points[:, 0] < x_max) & \
                       (points[:, 1] >= y_min) & (points[:, 1] < y_max)
            
            if np.sum(cell_mask) == 0:
                continue
            
            dynamic_in_cell = cell_mask & (pred_labels_dynamic == 1)
            
            if np.sum(dynamic_in_cell) > 0:
                min_z_cell = np.min(points[dynamic_in_cell, 2])
            else:
                min_z_cell = np.min(points[cell_mask, 2])
            
            ground_in_cell = cell_mask & (points[:, 2] < (min_z_cell + ground_height_threshold))
            ground_mask[ground_in_cell] = True
    
    # 2. Поиск граничных точек
    num_samples = min(1000, len(points))
    if num_samples > 0:
        np.random.seed(0)
        sample_idx = np.random.choice(len(points), num_samples, replace=False)
        sample_points_xy = points[sample_idx, :2]
        tree_sample = KDTree(sample_points_xy)
        dists, _ = tree_sample.query(sample_points_xy, k=2)
        avg_nn_dist = np.mean(dists[:, 1]) if num_samples > 1 else 0.0
    else:
        avg_nn_dist = 0.0
    
    grid_size = max(avg_nn_dist * 2.0, 1e-6)
    
    cell_points = defaultdict(list)
    for i in range(len(points)):
        p = points[i, :2]
        ix = int(p[0] / grid_size)
        iy = int(p[1] / grid_size)
        cell_points[(ix, iy)].append(i)
    
    occupied_cells = set(cell_points.keys())
    
    boundary_cells = set()
    for cell in occupied_cells:
        ix, iy = cell
        is_bound = False
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                neigh = (ix + dx, iy + dy)
                if neigh not in occupied_cells:
                    is_bound = True
                    break
            if is_bound:
                break
        if is_bound:
            boundary_cells.add(cell)
    
    is_boundary = np.zeros(len(points), dtype=bool)
    for cell in boundary_cells:
        for i in cell_points[cell]:
            is_boundary[i] = True
    
    # 3. Обработка спорных точек
    non_ground_dynamic_idx = np.where((pred_labels_dynamic == 1) & (~ground_mask))[0]
    
    if len(non_ground_dynamic_idx) > 0 and np.sum(is_boundary) > 0:
        boundary_idx = np.where(is_boundary)[0]
        boundary_tree = KDTree(points[boundary_idx, :2])
        dists_to_boundary, _ = boundary_tree.query(points[non_ground_dynamic_idx, :2])
        edge_mask = dists_to_boundary < edge_distance_threshold
        
        candidate_indices = non_ground_dynamic_idx[edge_mask]
        high_prob_mask = all_dynamic_probs[candidate_indices] < 0.65 #0.65
        restore_indices = candidate_indices[high_prob_mask]
        pred_labels_dynamic[restore_indices] = 0
    
    # 4. Верхние точки -> статика
    if z_upper_static_threshold is not None:
        min_z = np.min(points[:, 2])
        upper_mask = points[:, 2] > (min_z + z_upper_static_threshold)
        pred_labels_dynamic[upper_mask] = 0
    
    # Применяем маску земли
    pred_labels_dynamic[ground_mask] = 0
    
    return pred_labels_dynamic

def run_combined_inference(
    input_ply: str,
    model_dynamic_path: str,
    model_segmentation_path: str,
    output_ply: str,
    device: str = 'cuda',
    dynamic_threshold: float = 0.5,
    car_threshold: float = 0.55,
    voxel_size: float = 0.1
):
    """
    Запускает обе модели и объединяет результаты.
    
    Args:
        input_ply (str): Путь к входному PLY файлу
        model_dynamic_path (str): Путь к модели статика/динамика (.pth)
        model_segmentation_path (str): Путь к модели сегментации классов (.pth)
        output_ply (str): Путь к выходному PLY файлу
        device (str): Устройство для вычислений ('cuda' или 'cpu')
        dynamic_threshold (float): Порог для динамических точек (0.0-1.0)
        car_threshold (float): Порог уверенности для класса машин (0.0-1.0)
        voxel_size (float): Размер вокселя для downsample
    """
    if device == 'cuda' and not torch.cuda.is_available():
        device = 'cpu'
        print("CUDA недоступна, используется CPU")
    
    print(f"Входной файл: {input_ply}")
    print(f"Выходной файл: {output_ply}")
    print(f"Модель динамика: {model_dynamic_path}")
    print(f"Модель сегментации: {model_segmentation_path}")
    print(f"Устройство: {device}")
    print(f"Порог динамики: {dynamic_threshold}")
    print(f"Порог машин: {car_threshold}")
    print(f"Размер вокселя: {voxel_size}")
    
    # Проверка существования файлов
    if not os.path.exists(input_ply):
        raise FileNotFoundError(f"Входной файл не найден: {input_ply}")
    if not os.path.exists(model_dynamic_path):
        raise FileNotFoundError(f"Модель динамика не найдена: {model_dynamic_path}")
    if not os.path.exists(model_segmentation_path):
        raise FileNotFoundError(f"Модель сегментации не найдена: {model_segmentation_path}")
    
    # Загрузка и downsample
    print("\nЗагрузка и downsample...")
    pcd = o3d.io.read_point_cloud(input_ply)
    original_points = len(pcd.points)
    pcd = pcd.voxel_down_sample(voxel_size=voxel_size)
    print(f"Точек: {original_points:,} -> {len(pcd.points):,}")
    
    print("\n[1/3] Модель динамика/статика...")
    pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.2, max_nn=30))
    
    model_dynamic = get_model(num_classes=2).to(device)
    model_dynamic.load_state_dict(torch.load(model_dynamic_path, map_location=device))
    model_dynamic.eval()
    dynamic_dataset = DynamicStaticDataset(pcd, batch_size=200000)
    all_dynamic_probs = []
    
    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors) if pcd.has_colors() else np.ones((len(points), 3)) * 0.5
    
    with torch.no_grad():
        for i in range(len(dynamic_dataset)):
            print(f"Обработано {i+1}/{len(dynamic_dataset)}")
            features = dynamic_dataset[i]
            features = features.unsqueeze(0).permute(0, 2, 1).to(device)
            
            pred, _ = model_dynamic(features)
            probas = F.softmax(pred, dim=2)
            dynamic_probs = probas[0, :, 1].cpu().numpy()
            all_dynamic_probs.append(dynamic_probs)
    
    all_dynamic_probs = np.concatenate(all_dynamic_probs)
    pred_labels_dynamic = (all_dynamic_probs > dynamic_threshold).astype(int)
    pred_labels_dynamic = restore_gaps_like_visual(points, pred_labels_dynamic, all_dynamic_probs)
    
    print("[2/3] Модель сегментации классов...")
    
    points_normalized = points - UTM_OFFSET
    df = pd.DataFrame({
        'x': points_normalized[:, 0],
        'y': points_normalized[:, 1],
        'z': points_normalized[:, 2],
        'red': (colors[:, 0] * 255).astype(int),
        'green': (colors[:, 1] * 255).astype(int),
        'blue': (colors[:, 2] * 255).astype(int)
    })
    
    df['intensity'] = (0.299 * df['red'] + 
                       0.587 * df['green'] + 
                       0.114 * df['blue']) / 255.0
    
    normalization_params = {
        'train_mean': np.array([243.23726422, 578.65970616, 138.09046971]),
        'train_std': np.array([78.09689845, 250.97915849, 4.22555828]),
        'height_stats': {
            'mean': 21.401,
            'std': 4.226
        },
        'global_z_min': 116.689003
    }
    
    inference_global_z_min = normalization_params['global_z_min']
    df['height'] = df['z'] - inference_global_z_min
    df['verticality'] = 0.5
    
    seg_dataset = SegmentationDataset(
        df, 
        num_points=4096,
        mean=normalization_params['train_mean'], 
        std=normalization_params['train_std'],
        height_stats=normalization_params['height_stats']
    )
    seg_loader = DataLoader(seg_dataset, batch_size=1, shuffle=False)
    
    model_segmentation = get_model(num_classes=4).to(device)
    model_segmentation.load_state_dict(torch.load(model_segmentation_path, map_location=device))
    model_segmentation.eval()
    
    all_predictions = []
    
    with torch.no_grad():
        for i, batch_data in enumerate(seg_loader):
            if ((i+1)%10 == 0):
                print(f"Обработано {(i+1)//10}/{len(seg_loader)//10}")
            points_batch, actual_size = batch_data
            points_batch = points_batch.transpose(2, 1).to(device)
            actual_size = actual_size.item()
            
            preds, _ = model_segmentation(points_batch)
            
            pred_probs = torch.softmax(preds, dim=2)
            pred_choice = apply_car_threshold(pred_probs, car_class=1, threshold=car_threshold)
            
            pred_numpy = pred_choice.cpu().numpy().flatten()[:actual_size]
            all_predictions.extend(pred_numpy)
    
    all_predictions = np.array(all_predictions)
    
    # Синхронизация размеров
    if len(all_predictions) != len(pred_labels_dynamic) or len(all_predictions) != len(points):
        min_len = min(len(all_predictions), len(pred_labels_dynamic), len(points))
        all_predictions = all_predictions[:min_len]
        pred_labels_dynamic = pred_labels_dynamic[:min_len]
        points = points[:min_len]
        colors = colors[:min_len]

    car_points = np.sum(all_predictions == 1)
    print(f"Модель сегментации определила как машины: {car_points:,} точек")
    
    print("[3/3] Объединение результатов...")
    is_dynamic = pred_labels_dynamic == 1
    is_car = all_predictions == 1
    
    remove_mask = is_dynamic | is_car
    keep_mask = ~remove_mask
    
    points_final = points[keep_mask]
    colors_final = colors[keep_mask]
    
    output_pcd = o3d.geometry.PointCloud()
    output_pcd.points = o3d.utility.Vector3dVector(points_final)
    output_pcd.colors = o3d.utility.Vector3dVector(colors_final)
    o3d.io.write_point_cloud(output_ply, output_pcd)
    
    print(f"Сохранено: {output_ply}")
    print(f"Итоговое количество точек: {len(points_final):,}")

if __name__ == '__main__':
    run_combined_inference(
        input_ply="/Users/vadim/Desktop/hackatons/lct/samples/1/combined_scene.ply",
        model_dynamic_path="/Users/vadim/Desktop/hackatons/lct/best_model.pth",
        model_segmentation_path="/Users/vadim/Desktop/hackatons/lct/seg_model_10.pth",
        output_ply="output_filtered.ply",
        device="cuda",
        dynamic_threshold=0.4,
        car_threshold=0.4,
        voxel_size=0.1
    )