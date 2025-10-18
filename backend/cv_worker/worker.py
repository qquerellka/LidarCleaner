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
                heartbeat=600,  # 10 минут
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

# Глобальная модель для переиспользования
global_model = None
global_device = None

class TaskCancelledException(Exception):
    pass

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

def get_or_load_model(model_path, device):
    """Получить или загрузить модель (переиспользование)"""
    global global_model, global_device

    if global_model is None or global_device != device:
        logger.info("Loading model...")
        global_model = get_model(num_classes=2).to(device)
        global_model.load_state_dict(torch.load(model_path, map_location=device))
        global_model.eval()
        global_device = device
        optimize_memory()
        logger.info("Model loaded and cached")

    return global_model

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


def remove_dynamic_points_with_threshold(ply_file_path, model_path, output_file_path=None,
                                          threshold=0.5, device=('cuda' if torch.cuda.is_available() else "cpu"), voxel_size=0.1,
                                          use_downsample=True, edge_distance_threshold=6.0,
                                          z_upper_static_threshold=6.5, ground_height_threshold=0.55, grid_divisions=25,
                                          check_cancel_callback=None):
    """
    Добавлен аргумент check_cancel_callback() -> bool:
    если он задан и возвращает True — выбрасываем TaskCancelledException
    """
    model = get_or_load_model(model_path, device)

    pcd = o3d.io.read_point_cloud(ply_file_path)

    if use_downsample:
        pcd = pcd.voxel_down_sample(voxel_size)
        logger.info(f"Downsample включён, voxel_size={voxel_size}")
    else:
        logger.info("Downsample отключён")

    pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.2, max_nn=30))

    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors) if pcd.has_colors() else np.ones((len(points), 3)) * 0.5
    normals = np.asarray(pcd.normals)

    logger.info(f"Загружено точек после препроцессинга: {len(points)}")
    logger.info(f"Используемый порог: {threshold}")

    # Адаптивный размер батча в зависимости от размера файла
    if len(points) > 1000000:
        batch_size = 50000  # Меньший батч для больших файлов
        pcd = pcd.voxel_down_sample(voxel_size)
        points = np.asarray(pcd.points)
        colors = np.asarray(pcd.colors) if pcd.has_colors() else np.ones((len(points), 3)) * 0.5
        normals = np.asarray(pcd.normals)
        logger.info(f"Large file detected, using batch_size={batch_size}, voxel_size={voxel_size}")
    else:
        batch_size = 100000

    all_dynamic_probs = []
    total_batches = (len(points) + batch_size - 1) // batch_size

    for batch_idx in range(total_batches):
        # -- проверяем отмену *перед* обработкой батча --
        if check_cancel_callback is not None:
            try:
                if check_cancel_callback():
                    logger.info(f"Cancellation detected before batch {batch_idx+1}/{total_batches}")
                    raise TaskCancelledException()
            except TaskCancelledException:
                raise
            except Exception as e:
                logger.warning(f"check_cancel_callback failed: {e}")

        start_idx = batch_idx * batch_size
        end_idx = min((batch_idx + 1) * batch_size, len(points))

        batch_points = points[start_idx:end_idx]
        batch_colors = colors[start_idx:end_idx]
        batch_normals = normals[start_idx:end_idx]

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

        features = np.hstack([xyz_normalized, rgb_normalized, batch_normals])

        features_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0)
        features_tensor = features_tensor.permute(0, 2, 1).to(device)

        with torch.no_grad():
            pred, _ = model(features_tensor)
            probas = F.softmax(pred, dim=2)
            dynamic_probs = probas[0, :, 1].cpu().numpy()
            all_dynamic_probs.append(dynamic_probs)

        # Очистка памяти после каждого батча
        del features_tensor, pred, probas, features
        optimize_memory()

        logger.info(f"Обработан батч {batch_idx + 1}/{total_batches}")

    all_dynamic_probs = np.concatenate(all_dynamic_probs)

    pred_labels = (all_dynamic_probs > threshold).astype(int)

    # ---------- (далее без изменений логики пост-обработки) ----------
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

            dynamic_in_cell = cell_mask & (pred_labels == 1)

            if np.sum(dynamic_in_cell) > 0:
                min_z_cell = np.min(points[dynamic_in_cell, 2])
            else:
                min_z_cell = np.min(points[cell_mask, 2])

            ground_in_cell = cell_mask & (points[:, 2] < (min_z_cell + ground_height_threshold))
            ground_mask[ground_in_cell] = True

    pred_labels[ground_mask] = 0

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

    non_ground_dynamic_idx = np.where((pred_labels == 1) & (~ground_mask))[0]

    if len(non_ground_dynamic_idx) > 0 and np.sum(is_boundary) > 0:
      boundary_idx = np.where(is_boundary)[0]
      boundary_tree = KDTree(points[boundary_idx, :2])
      dists_to_boundary, _ = boundary_tree.query(points[non_ground_dynamic_idx, :2])
      edge_mask = dists_to_boundary < edge_distance_threshold

      candidate_indices = non_ground_dynamic_idx[edge_mask]
      high_prob_mask = all_dynamic_probs[candidate_indices] < 0.6
      pred_labels[candidate_indices[high_prob_mask]] = 2

    if z_upper_static_threshold is not None:
        min_z = np.min(points[:, 2])
        upper_mask = points[:, 2] > (min_z + z_upper_static_threshold)
        pred_labels[upper_mask] = 2

    logger.info(f"Статических точек: {np.sum(pred_labels == 0)}")
    logger.info(f"Динамических точек: {np.sum(pred_labels == 1)}")

    static_mask = (pred_labels == 0) | (pred_labels == 2)
    points_static = points[static_mask]
    colors_static = colors[static_mask]

    visualized_pcd = o3d.geometry.PointCloud()
    visualized_pcd.points = o3d.utility.Vector3dVector(points_static)
    visualized_pcd.colors = o3d.utility.Vector3dVector(colors_static)

    if output_file_path is None:
        base_name = ply_file_path.split('.')[0]
        output_file_path = f"{base_name}_threshold_{threshold}.ply"

    o3d.io.write_point_cloud(output_file_path, visualized_pcd)
    logger.info(f"Результат сохранен в: {output_file_path}")

    # Финальная очистка памяти
    del pcd, points, colors, normals, all_dynamic_probs, pred_labels, visualized_pcd
    optimize_memory()

    # ВАЖНО: возвращаем путь к обработанному файлу
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

        model_path = "best_model.pth"
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file {model_path} not found")

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

        # Обработка (передаём check_cancel_callback)
        result_path = remove_dynamic_points_with_threshold(
            input_path,
            model_path,
            voxel_size=0.05,
            output_file_path=output_path,
            threshold=0.4,
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
        processed_data = process_file_safe(data, delivery_tag=delivery_tag, reply_to=reply_to, correlation_id=correlation_id)

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
