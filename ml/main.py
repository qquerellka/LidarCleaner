import open3d as o3d
import numpy as np
import torch
import torch.nn.functional as F
from scipy.spatial import cKDTree
from tqdm import tqdm
from Pointnet_Pointnet2_pytorch.models.pointnet2_sem_seg import get_model

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DYNAMIC_MODEL_PATH = r"C:\Users\prive\Desktop\prog\huckfuck\best_model.pth"
CAR_MODEL_PATH = r"C:\Users\prive\Desktop\prog\huckfuck\seg_model_19.pth"
DYNAMIC_THRESHOLD = 0.45
HOLE_FILL_RADIUS = 0.4
HOLE_FILL_MIN_NEIGHBORS = 6

# Параметры фильтрации шумов
STATISTICAL_NB_NEIGHBORS = 20
STATISTICAL_STD_RATIO = 2.0
RADIUS_OUTLIER_NB_POINTS = 16
RADIUS_OUTLIER_RADIUS = 0.05

FLOOR_HEIGHT_PERCENTILE = 5
FLOOR_HEIGHT_TOLERANCE = 0.07
FLOOR_NORMAL_Z_THRESHOLD = 0.85

def prepare_dynamic_features(points, colors, normals):
    xyz = points - points.mean(axis=0, keepdims=True)
    xyz /= (np.std(xyz, axis=0, keepdims=True) + 1e-8)
    if colors.max() > 1.0:
        colors = colors / 255.0
    rgb = (colors - colors.mean(axis=0, keepdims=True)) / (colors.std(axis=0, keepdims=True) + 1e-8)
    return np.hstack([xyz, rgb, normals]).astype(np.float32)

def prepare_car_features(points):
    xyz = points - points.mean(axis=0, keepdims=True)
    xyz /= (np.std(xyz, axis=0, keepdims=True) + 1e-8)
    feats = np.ones((len(points), 9), dtype=np.float32)
    feats[:, :3] = xyz
    return feats

def remove_noise(pcd):
    """Удаление шумов с помощью статистического и радиусного фильтров"""
    print("Removing noise...")
    
    # Статистический фильтр
    pcd_stat, stat_inlier_ind = pcd.remove_statistical_outlier(
        nb_neighbors=STATISTICAL_NB_NEIGHBORS,
        std_ratio=STATISTICAL_STD_RATIO
    )
    print(f"Statistical filter: {len(pcd.points)} -> {len(pcd_stat.points)} points")
    
    # Радиусный фильтр
    # pcd_clean, radius_inlier_ind = pcd_stat.remove_radius_outlier(
    #     nb_points=RADIUS_OUTLIER_NB_POINTS,
    #     radius=RADIUS_OUTLIER_RADIUS
    # )
    # print(f"Radius filter: {len(pcd_stat.points)} -> {len(pcd_clean.points)} points")
    
    return pcd_stat

def run_pointnet(model_path, num_classes, features, return_probs=False):
    model = get_model(num_classes=num_classes).to(DEVICE)
    state = torch.load(model_path, map_location=DEVICE)
    model.load_state_dict(state)
    model.eval()
    outputs = []
    chunk_size = 16384
    num_chunks = (len(features) + chunk_size - 1) // chunk_size
    with torch.no_grad():
        for start in tqdm(range(0, len(features), chunk_size), 
                         total=num_chunks,
                         desc=f"Inference ({num_classes} classes)"):
            chunk = torch.from_numpy(features[start:start + chunk_size]).unsqueeze(0).permute(0, 2, 1).to(DEVICE)
            logits, _ = model(chunk)
            probs = F.softmax(logits, dim=2)[0].cpu().numpy()
            outputs.append(probs)
    probs = np.concatenate(outputs, axis=0)
    return probs if return_probs else probs.argmax(axis=1)

def fill_removed_points(points, colors, keep_mask):
    kept_pts = points[keep_mask]
    kept_col = colors[keep_mask]
    removed_pts = points[~keep_mask]
    if len(removed_pts) == 0:
        return kept_pts, kept_col
    tree = cKDTree(kept_pts[:, :2])
    idx_list = tree.query_ball_point(removed_pts[:, :2], r=HOLE_FILL_RADIUS)
    filled_pts = []
    filled_col = []
    for base_pt, idxs in tqdm(zip(removed_pts, idx_list),
                              total=len(removed_pts),
                              desc="Filling holes"):
        if len(idxs) < HOLE_FILL_MIN_NEIGHBORS:
            continue
        neighbor_pts = kept_pts[idxs]
        neighbor_col = kept_col[idxs]
        mean_height = neighbor_pts[:, 2].mean()
        filled_pt = base_pt.copy()
        filled_pt[2] = mean_height
        filled_pts.append(filled_pt)
        filled_col.append(neighbor_col.mean(axis=0))
    if filled_pts:
        kept_pts = np.vstack([kept_pts, np.array(filled_pts)])
        kept_col = np.vstack([kept_col, np.array(filled_col)])
    return kept_pts, kept_col

def process_scene(input_ply, output_ply):
    pcd = o3d.io.read_point_cloud(input_ply)
    if not pcd.has_colors():
        pcd.colors = o3d.utility.Vector3dVector(np.ones((len(pcd.points), 3)) * 0.5)

    
    
    pcd.estimate_normals(o3d.geometry.KDTreeSearchParamHybrid(radius=0.2, max_nn=30))

    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors)
    normals = np.asarray(pcd.normals)

    floor_height = np.percentile(points[:, 2], FLOOR_HEIGHT_PERCENTILE)
    floor_mask = (
        (points[:, 2] <= floor_height + FLOOR_HEIGHT_TOLERANCE) &
        (np.abs(normals[:, 2]) >= FLOOR_NORMAL_Z_THRESHOLD)
    )

    dyn_feats = prepare_dynamic_features(points, colors, normals)
    dyn_probs = run_pointnet(DYNAMIC_MODEL_PATH, num_classes=2, features=dyn_feats, return_probs=True)
    dynamic_mask = dyn_probs[:, 1] > DYNAMIC_THRESHOLD

    car_feats = prepare_car_features(points)
    car_labels = run_pointnet(CAR_MODEL_PATH, num_classes=9, features=car_feats, return_probs=False)
    car_mask = car_labels == 7

    keep_mask = (~(dynamic_mask | car_mask)) | floor_mask
    filtered_points = points[keep_mask]
    filtered_colors = colors[keep_mask]

    out_pcd = o3d.geometry.PointCloud()
    out_pcd.points = o3d.utility.Vector3dVector(filtered_points)
    out_pcd.colors = o3d.utility.Vector3dVector(np.clip(filtered_colors, 0.0, 1.0))
    # out_pcd = remove_noise(out_pcd)
    o3d.io.write_point_cloud(output_ply, out_pcd)
    print(f"Saved cleaned scene to: {output_ply}")

if __name__ == "__main__":
    # Load and subsample to first 25% of points
    pcd_full = o3d.io.read_point_cloud(r"C:\Users\prive\Desktop\prog\huckfuck\combined_scene_1.ply")
    total_points = len(pcd_full.points)
    subset_size = int(total_points * 0.25)
    
    # Create subsampled point cloud
    pcd_subset = o3d.geometry.PointCloud()
    pcd_subset.points = o3d.utility.Vector3dVector(np.asarray(pcd_full.points)[:subset_size])
    if pcd_full.has_colors():
        pcd_subset.colors = o3d.utility.Vector3dVector(np.asarray(pcd_full.colors)[:subset_size])
    
    # Save subset temporarily
    temp_input = r"C:\Users\prive\Desktop\prog\huckfuck\temp_subset.ply"
    o3d.io.write_point_cloud(temp_input, pcd_subset)
    
    print(f"Processing {subset_size} points (25% of {total_points})")
    
    process_scene(
        input_ply=temp_input,
        output_ply=r"C:\Users\prive\Desktop\prog\huckfuck\output_scene_cleaned.ply"
    )