# обновлённый файл обработчика (замените старый)
import json
import time
import uuid
import signal
import sys
import gc
import logging
import traceback
import os
import faulthandler, sys

faulthandler.enable()

import pika
from minio import Minio
import torch
import numpy as np
import open3d as o3d
from Pointnet_Pointnet2_pytorch.models.pointnet2_sem_seg import get_model
import torch.nn.functional as F
from scipy.spatial import KDTree
from collections import defaultdict
import pandas as pd
from torch.utils.data import Dataset, DataLoader

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MinIO client
minio_client = Minio(
  "minio:9000",
  access_key="root",
  secret_key="minio_password",
  secure=False
)

# Создаём папку для временных файлов
os.makedirs("/tmp/files", exist_ok=True)


class RobustRabbitMQClient:
  def __init__(self):
    self.connection = None
    self.channel = None

  def connect(self):
    """Установка соединения с RabbitMQ"""
    try:
      parameters = pika.ConnectionParameters(
        host='rabbitmq',
        heartbeat=7200,  # 10 минут
        blocked_connection_timeout=300,
        connection_attempts=3,
        retry_delay=5
      )
      self.connection = pika.BlockingConnection(parameters)
      self.channel = self.connection.channel()

      # exchange + очередь для задач
      self.channel.exchange_declare(
        exchange="pcd_files",
        exchange_type="fanout",
        durable=True,
      )
      self.channel.queue_declare(queue="file_metadata_queue", durable=True)
      self.channel.queue_bind(exchange="pcd_files", queue="file_metadata_queue")

      # очередь для отмен
      self.channel.queue_declare(queue="cancel_queue", durable=True)

      logger.info("Connected to RabbitMQ successfully")
      return True

    except Exception as e:
      logger.error(f"Failed to connect to RabbitMQ: {e}")
      return False

  def safe_publish(self, routing_key, body, correlation_id=None):
    """Безопасная отправка сообщения с переподключением при необходимости"""
    try:
      if not self.connection or self.connection.is_closed:
        self.connect()

      properties = None
      if correlation_id:
        properties = pika.BasicProperties(correlation_id=correlation_id)

      self.channel.basic_publish(
        exchange='',
        routing_key=routing_key,
        properties=properties,
        body=body
      )
      return True

    except Exception as e:
      logger.error(f"Failed to publish message: {e}")
      return False

  def safe_ack(self, delivery_tag):
    """Безопасное подтверждение сообщения"""
    try:
      if self.channel and self.connection and not self.connection.is_closed:
        self.channel.basic_ack(delivery_tag=delivery_tag)
        return True
    except Exception as e:
      logger.error(f"Failed to ack message: {e}")
    return False


# Глобальный клиент RabbitMQ
rabbitmq_client = RobustRabbitMQClient()

# Глобальные модели для переиспользования
global_dynamic_model = None
global_segmentation_model = None
global_device = None

# Константы из inference_combined.py
UTM_OFFSET = np.array([627285, 4841948, 0])


class TaskCancelledException(Exception):
  pass


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
      x_min, x_max = x_edges[i], x_edges[i + 1]
      y_min, y_max = y_edges[j], y_edges[j + 1]

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
    high_prob_mask = all_dynamic_probs[candidate_indices] < 0.65  # 0.65
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


def check_memory_usage():
  """Упрощенная проверка памяти без psutil"""
  try:
    # Простая альтернатива для Linux
    if os.path.exists("/proc/meminfo"):
      with open("/proc/meminfo", "r") as f:
        for line in f:
          if line.startswith("MemAvailable:"):
            available = int(line.split()[1])
            logger.info(f"Available memory: {available} kB")
            return available
  except:
    pass
  logger.info("Memory check not available")
  return None


def optimize_memory():
  """Оптимизация использования памяти"""
  gc.collect()
  if torch.cuda.is_available():
    torch.cuda.empty_cache()


def safe_model_load(model_path, device):
  """Безопасная загрузка модели с обработкой ошибок"""
  try:
    model = get_model(num_classes=2).to(device)

    # Пробуем разные способы загрузки
    try:
      checkpoint = torch.load(model_path, map_location=device, weights_only=True)
    except:
      checkpoint = torch.load(model_path, map_location=device)

    model.load_state_dict(checkpoint)
    model.eval()
    del checkpoint
    optimize_memory()

    logger.info("Model loaded successfully")
    return model

  except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise


def get_or_load_dynamic_model(model_path, device):
  """Получить или загрузить модель динамика/статика (переиспользование)"""
  global global_dynamic_model, global_device

  if global_dynamic_model is None or global_device != device:
    logger.info("Loading dynamic model...")
    global_dynamic_model = get_model(num_classes=2).to(device)
    global_dynamic_model.load_state_dict(torch.load(model_path, map_location=device))
    global_dynamic_model.eval()
    global_device = device
    optimize_memory()
    logger.info("Dynamic model loaded and cached")

  return global_dynamic_model


def get_or_load_segmentation_model(model_path, device):
  """Получить или загрузить модель сегментации (переиспользование)"""
  global global_segmentation_model, global_device

  if global_segmentation_model is None or global_device != device:
    logger.info("Loading segmentation model...")
    global_segmentation_model = get_model(num_classes=4).to(device)
    global_segmentation_model.load_state_dict(torch.load(model_path, map_location=device))
    global_segmentation_model.eval()
    global_device = device
    optimize_memory()
    logger.info("Segmentation model loaded and cached")

  return global_segmentation_model


def check_cancel_for_task(channel, cancel_queue, task_id):
  """
  Проверяет cancel_queue. Возвращает True, если нужно отменить текущую задачу.
  Поддерживает:
    - сообщения JSON {"id": "..."} (сравниваем с task_id)
    - сообщения без id (любой payload) -> глобальная отмена
    - текстовые сообщения 'cancel', 'stop' и т.п.
  """
  if channel is None:
    return False
  try:
    while True:
      method_frame, header_frame, body = channel.basic_get(cancel_queue, auto_ack=True)
      if method_frame is None:
        break
      # попробуем JSON
      try:
        msg = json.loads(body)
        if isinstance(msg, dict):
          # если есть id — сравниваем
          if 'id' in msg:
            if msg.get('id') == task_id:
              logger.info(f"Cancellation for id {task_id} received")
              return True
            else:
              # not ours -> ignore
              continue
          else:
            # JSON но без id -> глобальная отмена
            logger.info("Cancel message without id -> treat as global cancel")
            return True
        else:
          # JSON, но не dict -> treat as cancel
          logger.info("Cancel message (non-dict JSON) -> treat as global cancel")
          return True
      except Exception:
        # не JSON: проверим текст
        try:
          text = body.decode() if isinstance(body, (bytes, bytearray)) else str(body)
        except Exception:
          text = str(body)
        if text.strip().lower() in ("cancel", "stop", "kill"):
          logger.info("Cancel text message received -> global cancel")
          return True
        # иначе игнорируем (можно логировать)
        logger.info(f"Ignoring unknown cancel payload: {text}")
        continue
    return False
  except Exception as e:
    logger.warning(f"Failed to check cancel queue: {e}")
    return False


def run_combined_inference_with_cancel(
  ply_file_path,
  dynamic_model_path,
  segmentation_model_path,
  output_file_path=None,
  device=('cuda' if torch.cuda.is_available() else "cpu"),
  dynamic_threshold=0.5,
  car_threshold=0.55,
  voxel_size=0.1,
  check_cancel_callback=None
):
  """
  Запускает обе модели и объединяет результаты с поддержкой отмены.
  """
  if device == 'cuda' and not torch.cuda.is_available():
    device = 'cpu'
    logger.info("CUDA недоступна, используется CPU")

  logger.info(f"Входной файл: {ply_file_path}")
  logger.info(f"Выходной файл: {output_file_path}")
  logger.info(f"Модель динамика: {dynamic_model_path}")
  logger.info(f"Модель сегментации: {segmentation_model_path}")
  logger.info(f"Устройство: {device}")
  logger.info(f"Порог динамики: {dynamic_threshold}")
  logger.info(f"Порог машин: {car_threshold}")
  logger.info(f"Размер вокселя: {voxel_size}")

  # Проверка существования файлов
  if not os.path.exists(ply_file_path):
    raise FileNotFoundError(f"Входной файл не найден: {ply_file_path}")
  if not os.path.exists(dynamic_model_path):
    raise FileNotFoundError(f"Модель динамика не найдена: {dynamic_model_path}")
  if not os.path.exists(segmentation_model_path):
    raise FileNotFoundError(f"Модель сегментации не найдена: {segmentation_model_path}")

  # Проверка отмены перед началом
  if check_cancel_callback and check_cancel_callback():
    logger.info("Cancellation detected before processing")
    raise TaskCancelledException()

  # Загрузка и downsample
  logger.info("Загрузка и downsample...")
  pcd = o3d.io.read_point_cloud(ply_file_path)
  original_points = len(pcd.points)
  pcd = pcd.voxel_down_sample(voxel_size=voxel_size)
  logger.info(f"Точек: {original_points:,} -> {len(pcd.points):,}")

  logger.info("[1/3] Модель динамика/статика...")
  pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.2, max_nn=30))

  model_dynamic = get_or_load_dynamic_model(dynamic_model_path, device)

  points = np.asarray(pcd.points)
  colors = np.asarray(pcd.colors) if pcd.has_colors() else np.ones((len(points), 3)) * 0.5

  # Уменьшаем размер батча для экономии памяти
  batch_size = 50000 if len(points) > 500000 else 100000
  dynamic_dataset = DynamicStaticDataset(pcd, batch_size=batch_size)
  all_dynamic_probs = []

  with torch.no_grad():
    for i in range(len(dynamic_dataset)):
      # Проверка отмены перед каждым батчем
      if check_cancel_callback and check_cancel_callback():
        logger.info(f"Cancellation detected at dynamic batch {i + 1}/{len(dynamic_dataset)}")
        raise TaskCancelledException()

      logger.info(f"Обработано {i + 1}/{len(dynamic_dataset)}")
      features = dynamic_dataset[i]
      features = features.unsqueeze(0).permute(0, 2, 1).to(device)

      pred, _ = model_dynamic(features)
      probas = F.softmax(pred, dim=2)
      dynamic_probs = probas[0, :, 1].cpu().numpy()
      all_dynamic_probs.append(dynamic_probs)

      # Очистка памяти после каждого батча
      del features, pred, probas
      optimize_memory()

  all_dynamic_probs = np.concatenate(all_dynamic_probs)
  pred_labels_dynamic = (all_dynamic_probs > dynamic_threshold).astype(int)
  pred_labels_dynamic = restore_gaps_like_visual(points, pred_labels_dynamic, all_dynamic_probs)

  # Очищаем динамическую модель и промежуточные данные
  del model_dynamic, all_dynamic_probs
  optimize_memory()

  logger.info("[2/3] Модель сегментации классов...")

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

  model_segmentation = get_or_load_segmentation_model(segmentation_model_path, device)

  all_predictions = []

  with torch.no_grad():
    for i, batch_data in enumerate(seg_loader):
      # Проверка отмены перед каждым батчем
      if check_cancel_callback and check_cancel_callback():
        logger.info(f"Cancellation detected at segmentation batch {i + 1}/{len(seg_loader)}")
        raise TaskCancelledException()

      if ((i + 1) % 10 == 0):
        logger.info(f"Обработано {(i + 1) // 10}/{len(seg_loader) // 10}")
      points_batch, actual_size = batch_data
      points_batch = points_batch.transpose(2, 1).to(device)
      actual_size = actual_size.item()

      preds, _ = model_segmentation(points_batch)

      pred_probs = torch.softmax(preds, dim=2)
      pred_choice = apply_car_threshold(pred_probs, car_class=1, threshold=car_threshold)

      pred_numpy = pred_choice.cpu().numpy().flatten()[:actual_size]
      all_predictions.extend(pred_numpy)

      # Очистка памяти после каждого батча
      del points_batch, preds, pred_probs, pred_choice
      optimize_memory()

  all_predictions = np.array(all_predictions)

  # Синхронизация размеров
  if len(all_predictions) != len(pred_labels_dynamic) or len(all_predictions) != len(points):
    min_len = min(len(all_predictions), len(pred_labels_dynamic), len(points))
    all_predictions = all_predictions[:min_len]
    pred_labels_dynamic = pred_labels_dynamic[:min_len]
    points = points[:min_len]
    colors = colors[:min_len]

  car_points = np.sum(all_predictions == 1)
  logger.info(f"Модель сегментации определила как машины: {car_points:,} точек")

  # Очищаем модель сегментации
  del model_segmentation, seg_dataset, seg_loader
  optimize_memory()

  logger.info("[3/3] Объединение результатов...")
  is_dynamic = pred_labels_dynamic == 1
  is_car = all_predictions == 1

  remove_mask = is_dynamic | is_car
  keep_mask = ~remove_mask

  points_final = points[keep_mask]
  colors_final = colors[keep_mask]

  output_pcd = o3d.geometry.PointCloud()
  output_pcd.points = o3d.utility.Vector3dVector(points_final)
  output_pcd.colors = o3d.utility.Vector3dVector(colors_final)

  if output_file_path is None:
    base_name = ply_file_path.split('.')[0]
    output_file_path = f"{base_name}_combined_filtered.ply"

  o3d.io.write_point_cloud(output_file_path, output_pcd)

  logger.info(f"Сохранено: {output_file_path}")
  logger.info(f"Итоговое количество точек: {len(points_final):,}")

  # Финальная очистка памяти
  del pcd, points, colors, pred_labels_dynamic, output_pcd
  optimize_memory()

  return output_file_path


def process_file_safe(data, delivery_tag=None, reply_to=None, correlation_id=None):
  """Безопасная обработка файла. Принимает delivery_tag, reply_to и correlation_id для ответа/ack."""
  input_path = None
  output_path = None

  task_id = data.get('id', 'unknown')

  try:
    logger.info("Starting file processing")
    start_time = time.time()

    minio_key = data['minio_key']
    filename = data['filename']

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    logger.info(f"Using device: {device}")

    dynamic_model_path = "best_model.pth"
    segmentation_model_path = "seg_model_10.pth"

    if not os.path.exists(dynamic_model_path):
      raise FileNotFoundError(f"Dynamic model file {dynamic_model_path} not found")
    if not os.path.exists(segmentation_model_path):
      raise FileNotFoundError(f"Segmentation model file {segmentation_model_path} not found")

    new_key = f"processed/{uuid.uuid4()}.ply"

    input_path = f"/tmp/files/{filename}"
    output_path = f"/tmp/files/{uuid.uuid4()}_processed.ply"

    os.makedirs(os.path.dirname(input_path), exist_ok=True)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Скачивание файла
    logger.info(f"Downloading file {minio_key} from MinIO")
    minio_client.fget_object("defaultbucket", minio_key, input_path)

    file_size = os.path.getsize(input_path) / (1024 * 1024)
    logger.info(f"File size: {file_size:.2f} MB")

    # Проверяем доступную память перед обработкой
    available_memory = check_memory_usage()
    if available_memory and available_memory < 500000:  # Меньше ~500MB
      logger.warning(f"Low memory detected: {available_memory} kB")
      optimize_memory()

    # Определяем callback для проверки отмены (замыкание)
    def cancel_check():
      # использование rabbitmq_client.channel для basic_get на cancel_queue
      try:
        return check_cancel_for_task(rabbitmq_client.channel, "cancel_queue", task_id)
      except Exception as e:
        logger.warning(f"cancel_check failed: {e}")
        return False

    # Обработка с новой логикой (две модели)
    result_path = run_combined_inference_with_cancel(
      input_path,
      dynamic_model_path,
      segmentation_model_path,
      output_file_path=output_path,
      device=device,
      dynamic_threshold=0.4,
      car_threshold=0.55,
      voxel_size=0.1,
      check_cancel_callback=cancel_check
    )

    if not os.path.exists(result_path):
      raise FileNotFoundError(f"Output file not created at {result_path}")

    # Загрузка результата
    logger.info("Uploading result to MinIO")
    minio_client.fput_object("defaultbucket", new_key, result_path)

    result_data = data.copy()
    result_data['minio_key'] = new_key
    result_data['status'] = 'done'

    # Очистка временных файлов
    for path in [input_path, output_path]:
      if path and os.path.exists(path):
        try:
          os.remove(path)
        except Exception as cleanup_error:
          logger.warning(f"Failed to clean up {path}: {cleanup_error}")

    total_time = time.time() - start_time
    logger.info(f"Total processing time: {total_time:.1f} seconds")

    return result_data

  except TaskCancelledException:
    logger.info(f"Task {task_id} was cancelled during processing.")
    # очистка временных файлов при отмене
    for path in [input_path, output_path]:
      if path and os.path.exists(path):
        try:
          os.remove(path)
        except Exception:
          pass
    # Вернём специальный ответ для callback
    return {'id': task_id, 'status': 'cancelled', 'minio_key': data.get('minio_key', '')}

  except Exception as e:
    logger.error(f"Error in process_file: {e}")
    logger.error(traceback.format_exc())
    # Очистка при ошибке
    for path in [input_path, output_path]:
      if path and os.path.exists(path):
        try:
          os.remove(path)
        except Exception:
          pass
    raise


def callback(ch, method, properties, body):
  """Callback с улучшенной обработкой ошибок и поддержкой отмен."""
  global rabbitmq_client

  delivery_tag = method.delivery_tag
  reply_to = properties.reply_to
  correlation_id = properties.correlation_id

  try:
    logger.info(" [x] Received message")
    data = json.loads(body)
    logger.info(f"Processing task ID: {data.get('id', 'unknown')}")

    # ВАЖНО: НЕ делаем ack сразу. Ack будет в конце — после успешной обработки или после отмены.
    processed_data = process_file_safe(data, delivery_tag=delivery_tag, reply_to=reply_to,
                                       correlation_id=correlation_id)

    # Отправляем результат (включая cancelled)
    logger.info("Sending result back")
    success = rabbitmq_client.safe_publish(
      routing_key=reply_to,
      body=json.dumps(processed_data),
      correlation_id=correlation_id
    )

    if success:
      logger.info(" [x] Processing completed successfully (or cancelled)")
      # теперь ack исходное сообщение — задача полностью обработана (включая отмену)
      if not rabbitmq_client.safe_ack(delivery_tag):
        logger.warning("Failed to ack message after processing")
    else:
      logger.error(" [x] Processing completed but failed to send result")
      # В этом случае можно решить: ack или не ack? Оставим не-ack, чтобы upstream мог переотправить.
      # rabbitmq_client.safe_ack(delivery_tag)

  except Exception as e:
    logger.error(f"Error in callback: {e}")
    logger.error(traceback.format_exc())

    # Попробуем отправить ошибку (если data доступна)
    try:
      error_response = {
        'error': str(e),
        'minio_key': data.get('minio_key', '') if 'data' in locals() else ''
      }
      rabbitmq_client.safe_publish(
        routing_key=reply_to or '',
        body=json.dumps(error_response),
        correlation_id=correlation_id
      )
    except Exception as pub_err:
      logger.warning(f"Failed to publish error response: {pub_err}")

    # Наконец, ack чтобы не застрять в очереди (или можно сделать requeue)
    try:
      rabbitmq_client.safe_ack(delivery_tag)
    except Exception:
      pass


def main():
  """Основная функция с обработкой ошибок"""
  global rabbitmq_client

  def signal_handler(sig, frame):
    logger.info('Received shutdown signal, exiting gracefully...')
    try:
      if rabbitmq_client.connection and not rabbitmq_client.connection.is_closed:
        rabbitmq_client.connection.close()
    except:
      pass
    sys.exit(0)

  signal.signal(signal.SIGINT, signal_handler)
  signal.signal(signal.SIGTERM, signal_handler)

  try:
    # Подключаемся к RabbitMQ
    if not rabbitmq_client.connect():
      logger.error("Failed to connect to RabbitMQ, exiting")
      sys.exit(1)

    # QoS: брать по одной задаче — чтобы не забирать N задач сразу
    rabbitmq_client.channel.basic_qos(prefetch_count=1)

    # Начинаем потребление сообщений
    logger.info('Waiting for messages...')
    rabbitmq_client.channel.basic_consume(
      queue="file_metadata_queue",
      on_message_callback=callback,
      auto_ack=False  # Ручное подтверждение
    )
    rabbitmq_client.channel.start_consuming()

  except Exception as e:
    logger.error(f"Fatal error in main: {e}")
    logger.error(traceback.format_exc())
    sys.exit(1)


if __name__ == "__main__":
  main()
