import json
import time
import uuid

import pika
from minio import Minio
import os
import torch
import numpy as np
import open3d as o3d
from Pointnet_Pointnet2_pytorch.models.pointnet2_sem_seg import get_model
import torch.nn.functional as F
import matplotlib.pyplot as plt
from scipy.spatial import KDTree
from collections import defaultdict

# MinIO client
minio_client = Minio(
    "minio:9000",
    access_key="root",
    secret_key="minio_password",
    secure=False
)

# Создаём папку для временных файлов
os.makedirs("/tmp/files", exist_ok=True)

# RabbitMQ connection
connection = pika.BlockingConnection(pika.ConnectionParameters('rabbitmq'))
channel = connection.channel()

channel.exchange_declare(
    exchange="pcd_files",
    exchange_type="fanout",
    durable=True,
)
channel.queue_declare(queue="file_metadata_queue", durable=True)
channel.queue_bind(exchange="pcd_files", queue="file_metadata_queue")

def visualize_dynamic_points_with_threshold(ply_file_path, model_path, output_file_path=None,
                                          threshold=0.5, device=('cuda' if torch.cuda.is_available() else "cpu"), voxel_size=0.001,
                                          use_downsample=True, edge_distance_threshold=5.0,
                                          z_upper_static_threshold=5.0):
    model = get_model(num_classes=2).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()

    pcd = o3d.io.read_point_cloud(ply_file_path)

    if use_downsample:
        pcd = pcd.voxel_down_sample(voxel_size)
        print(f"Downsample включён, voxel_size={voxel_size}")
    else:
        print("Downsample отключён")

    pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.2, max_nn=30))

    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors) if pcd.has_colors() else np.ones((len(points), 3)) * 0.5
    normals = np.asarray(pcd.normals)

    print(f"Загружено точек после препроцессинга: {len(points)}")
    print(f"Используемый порог: {threshold}")

    batch_size = 200000
    all_dynamic_probs = []

    total_batches = (len(points) + batch_size - 1) // batch_size

    for batch_idx in range(total_batches):
        start_idx = batch_idx * batch_size
        end_idx = min((batch_idx + 1) * batch_size, len(points))

        batch_points = points[start_idx:end_idx]
        batch_colors = colors[start_idx:end_idx]
        batch_normals = normals[start_idx:end_idx]

        xyz = batch_points.copy()
        xyz_mean = np.mean(xyz, axis=0, keepdims=True)
        xyz_centered = xyz - xyz_mean

        xyz_max = np.max(np.abs(xyz_centered))
        if xyz_max > 0:
            xyz_normalized = xyz_centered / (xyz_max + 1e-8)
        else:
            xyz_normalized = xyz_centered

        rgb = batch_colors.copy()
        if np.max(rgb) > 1.0:
            rgb = rgb / 255.0

        rgb_normalized = (rgb - np.mean(rgb, axis=0, keepdims=True)) / (np.std(rgb, axis=0, keepdims=True) + 1e-8)

        features = np.hstack([xyz_normalized, rgb_normalized, batch_normals])

        features_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0)
        features_tensor = features_tensor.permute(0, 2, 1).to(device)

        with torch.no_grad():
            pred, _ = model(features_tensor)
            probas = F.softmax(pred, dim=2)
            dynamic_probs = probas[0, :, 1].cpu().numpy()
            all_dynamic_probs.append(dynamic_probs)

        print(f"Обработан батч {batch_idx + 1}/{total_batches}")

    all_dynamic_probs = np.concatenate(all_dynamic_probs)

    pred_labels = (all_dynamic_probs > threshold).astype(int)

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
    print(f"Оценочное среднее расстояние до ближайшего соседа: {avg_nn_dist}")

    grid_size = max(avg_nn_dist * 2.0, 1e-6)
    print(f"Размер ячейки грида: {grid_size}")

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

    print(f"Количество граничных точек: {np.sum(is_boundary)}")

    dynamic_idx = np.where(pred_labels == 1)[0]
    if len(dynamic_idx) > 0 and np.sum(is_boundary) > 0:
        boundary_idx = np.where(is_boundary)[0]
        boundary_tree = KDTree(points[boundary_idx, :2])
        dists_to_boundary, _ = boundary_tree.query(points[dynamic_idx, :2])
        edge_mask = dists_to_boundary < edge_distance_threshold
        pred_labels[dynamic_idx[edge_mask]] = 2

    if z_upper_static_threshold is not None:
        min_z = np.min(points[:, 2])
        upper_mask = points[:, 2] > (min_z + z_upper_static_threshold)
        pred_labels[upper_mask] = 0

    print(f"Статических точек (p < {threshold}): {np.sum(pred_labels == 0)}")
    print(f"Динамических точек (p > {threshold}): {np.sum(pred_labels == 1)}")
    print(f"Спорных точек (на краю): {np.sum(pred_labels == 2)}")
    print(f"Процент динамических точек: {np.sum(pred_labels == 1) / len(pred_labels) * 100:.1f}%")

    new_colors = colors.copy()
    dynamic_mask = pred_labels == 1
    edge_dynamic_mask = pred_labels == 2
    new_colors[dynamic_mask] = [1.0, 0.0, 0.0]
    new_colors[edge_dynamic_mask] = [0.0, 1.0, 0.0]

    visualized_pcd = o3d.geometry.PointCloud()
    visualized_pcd.points = o3d.utility.Vector3dVector(points)
    visualized_pcd.colors = o3d.utility.Vector3dVector(new_colors)

    if output_file_path is None:
        base_name = ply_file_path.split('.')[0]
        output_file_path = f"{base_name}_threshold_{threshold}.ply"

    o3d.io.write_point_cloud(output_file_path, visualized_pcd)
    print(f"Результат сохранен в: {output_file_path}")

    return visualized_pcd, pred_labels, all_dynamic_probs


def process_file(data):
    minio_key = data['minio_key']
    filename = data['filename']

    # Новый ключ для MinIO
    new_key = f"processed/{uuid.uuid4()}.bin"

    # Локальные пути
    input_path = f"/tmp/files/{filename}"
    output_path = f"/tmp/files/{uuid.uuid4()}_processed.ply"  # сохраняем в отдельный файл

    # Скачиваем файл из MinIO
    minio_client.fget_object("defaultbucket", minio_key, input_path)

    visualized_pcd, labels, probs = visualize_dynamic_points_with_threshold(
        input_path,
        "best_model.pth",
        output_file_path=output_path,  # <--- указываем свой путь
        threshold=0.7
    )

    # Загружаем обратно в MinIO
    minio_client.fput_object("defaultbucket", new_key, output_path)

    # Обновляем minio_key в ответе
    data['minio_key'] = new_key
    return data


def callback(ch, method, properties, body):
    print(" [x] Received:", body.decode())
    data = json.loads(body)
    processed_data = process_file(data)

    print(" [x] Processed:", processed_data)

    # Отправляем результат в reply queue
    ch.basic_publish(
        exchange='',
        routing_key=properties.reply_to,
        properties=pika.BasicProperties(correlation_id=properties.correlation_id),
        body=json.dumps(processed_data)
    )
    ch.basic_ack(delivery_tag=method.delivery_tag)

channel.basic_consume(queue="file_metadata_queue", on_message_callback=callback)
print('Waiting for messages...')
channel.start_consuming()