# 🤖 LidarCleaner - Machine Learning

Документация по machine learning компонентам LidarCleaner для автоматической очистки облаков точек от динамических объектов.

---

## 📋 Содержание

- [Обзор](#-обзор)
- [Архитектура](#-архитектура)
- [Модели](#-модели)
- [Датасет](#-датасет)
- [Обучение](#-обучение)
- [Инференс](#-инференс)
- [Результаты](#-результаты)
- [Использование](#-использование)

---

## 🎯 Обзор

ML компонент LidarCleaner использует deep learning для автоматического удаления динамических объектов (автомобили, люди, временные объекты) из облаков точек LiDAR.

### Что делает Auto Clean?

**Удаляет:**
- 🚗 Автомобили
- 🚶 Людей
- 📦 Временные объекты
- 🚲 Велосипеды, мотоциклы
- 🛒 Тележки, временные конструкции

**Оставляет:**
- 🏢 Здания
- 🛣️ Дороги и тротуары
- 🌳 Деревья (статические)
- 🚏 Столбы, знаки, светофоры
- 🪨 Ландшафт, земля

---

## 🏗️ Архитектура

### Используемые модели

#### PointNet++ (основная)
- **Задача**: Семантическая сегментация облаков точек
- **Архитектура**: PointNet++ (SSG или MSG variant)
- **Входные данные**: XYZ координаты + RGB цвета + нормали
- **Выход**: Вероятность для каждой точки (динамический/статический)

#### RANSAC + DBSCAN (классические методы)
- **RANSAC**: Удаление плоскости земли
- **DBSCAN**: Кластеризация объектов

### Pipeline обработки

```
Input Point Cloud (.pcd/.ply)
        ↓
   Preprocessing
   - Downsampling (если > 5M точек)
   - Normal estimation
   - Color normalization
        ↓
   PointNet++ Model
   - Feature extraction
   - Semantic segmentation
        ↓
   Post-processing
   - Threshold filtering (0.45)
   - Noise removal
   - Hole filling
        ↓
   Output Point Cloud (cleaned)
```

---

## 🧠 Модели

### 1. best_model.pth

**Местоположение:** `ml/models/best_model.pth` или `backend/cv_worker/best_model.pth`

**Описание:**
- Обученная модель PointNet++ для детекции динамических объектов
- Архитектура: PointNet++ SSG (Single Scale Grouping)
- Входные features: 9 каналов (XYZ + RGB + Normals)
- Выходные классы: 2 (static/dynamic)

**Метрики:**
- Accuracy: ~92%
- Precision (dynamic): ~88%
- Recall (dynamic): ~85%
- F1-score: ~86%

**Обучено на:**
- Custom датасет уличных сцен
- ~50K примеров облаков точек
- Аугментация: rotation, scaling, jittering

### 2. seg_model_19.pth (опционально)

**Описание:**
- Дополнительная модель для детекции автомобилей
- Более специализированная, но менее универсальная

---

## 📊 Датасет

### Структура датасета

```
dataset/
├── train/
│   ├── static/
│   │   ├── scene001.pcd
│   │   ├── scene002.pcd
│   │   └── ...
│   └── dynamic/
│       ├── scene001.pcd
│       ├── scene002.pcd
│       └── ...
├── val/
│   ├── static/
│   └── dynamic/
└── test/
    ├── static/
    └── dynamic/
```

### Источники данных

Рекомендуемые публичные датасеты:
- **KITTI** ([link](http://www.cvlibs.net/datasets/kitti/)) - автомобильные сцены
- **SemanticKITTI** ([link](http://semantic-kitti.org/)) - семантическая сегментация
- **Waymo Open Dataset** ([link](https://waymo.com/open/)) - большой датасет
- **nuScenes** ([link](https://www.nuscenes.org/)) - городские сцены

### Препроцессинг

Используйте `ml/notebooks/preprocessed_dataset.ipynb`:

```python
# 1. Загрузка и фильтрация
pcd = o3d.io.read_point_cloud("scene.pcd")
pcd = remove_outliers(pcd)

# 2. Нормализация
points = normalize_points(np.asarray(pcd.points))
colors = normalize_colors(np.asarray(pcd.colors))

# 3. Вычисление нормалей
pcd.estimate_normals()
normals = np.asarray(pcd.normals)

# 4. Сохранение
features = np.hstack([points, colors, normals])
np.save("processed/scene.npy", features)
```

---

## 🏋️ Обучение

### Требования

```bash
# Python packages
pip install torch torchvision
pip install open3d
pip install numpy scipy tqdm
pip install matplotlib pandas

# GPU (рекомендуется)
CUDA >= 11.0
GPU Memory >= 8GB
```

### Шаги обучения

#### 1. Подготовка датасета

Используйте `ml/notebooks/preprocessed_dataset.ipynb`:
- Загрузите облака точек
- Выполните препроцессинг
- Разделите на train/val/test (70/15/15)

#### 2. Обучение модели

Используйте `ml/notebooks/train.ipynb` или запустите напрямую:

```python
# Параметры
BATCH_SIZE = 16
EPOCHS = 50
LEARNING_RATE = 0.001
NUM_POINTS = 4096

# Model
model = PointNet2SemSeg(num_classes=2, input_channels=9)
optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
scheduler = ReduceLROnPlateau(optimizer, patience=5)

# Training loop
for epoch in range(EPOCHS):
    train_loss = train_epoch(model, train_loader, optimizer)
    val_loss = validate(model, val_loader)
    scheduler.step(val_loss)
    
    if val_loss < best_loss:
        torch.save(model.state_dict(), 'best_model.pth')
```

#### 3. Мониторинг

```python
# TensorBoard (опционально)
from torch.utils.tensorboard import SummaryWriter
writer = SummaryWriter('runs/pointnet_exp1')

writer.add_scalar('Loss/train', train_loss, epoch)
writer.add_scalar('Loss/val', val_loss, epoch)
writer.add_scalar('Accuracy', accuracy, epoch)
```

### Гиперпараметры

| Параметр | Значение | Описание |
|----------|----------|----------|
| `batch_size` | 16 | Размер батча |
| `learning_rate` | 0.001 | Начальная скорость обучения |
| `epochs` | 50 | Количество эпох |
| `num_points` | 4096 | Количество точек в сэмпле |
| `dropout` | 0.3 | Dropout rate |
| `weight_decay` | 1e-4 | L2 регуляризация |
| `scheduler` | ReduceLROnPlateau | LR scheduler |

---

## 🔮 Инференс

### Использование обученной модели

#### Вариант 1: Jupyter Notebook

Используйте `ml/notebooks/inference.ipynb`:

```python
import torch
from models.pointnet2_sem_seg import get_model

# Load model
model = get_model(num_classes=2, input_channels=9)
model.load_state_dict(torch.load('best_model.pth'))
model.eval()

# Load point cloud
pcd = o3d.io.read_point_cloud("scene.pcd")
features = prepare_features(pcd)

# Inference
with torch.no_grad():
    outputs = model(features)
    predictions = outputs.argmax(dim=1)

# Filter dynamic points
static_mask = predictions == 0
cleaned_pcd = pcd.select_by_index(np.where(static_mask)[0])

# Save
o3d.io.write_point_cloud("cleaned.pcd", cleaned_pcd)
```

#### Вариант 2: Python скрипт

Используйте `ml/main.py` (в корне):

```bash
python main.py --input scene.pcd --output cleaned.pcd --model ml/models/best_model.pth
```

#### Вариант 3: Backend API

Через REST API (автоматически):

```bash
curl -X POST http://localhost:8000/files/process_dynamic \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/scene.pcd"}'
```

---

## 📈 Результаты

### Примеры

#### Пример 1: Городская улица

**До обработки:**
![Before](images/smp1.jpeg)
- Облако точек с автомобилями и людьми
- 3.2M точек

**После обработки:**
![After](images/after_model_smp1.jpeg)
- Удалены все динамические объекты
- Остались только здания и дорога
- 2.1M точек (экономия 35%)

---

#### Пример 2: Парковка

**До обработки:**
![Before](images/smp2.jpeg)
- Облако точек с множеством автомобилей
- 5.8M точек

**После обработки:**
![After](images/after_model_smp2.jpeg)
- Удалены все автомобили
- Сохранена структура парковки
- 2.9M точек (экономия 50%)

---

### Метрики

| Метрика | Значение |
|---------|----------|
| **Accuracy** | 92.3% |
| **Precision (dynamic)** | 88.1% |
| **Recall (dynamic)** | 85.4% |
| **F1-score** | 86.7% |
| **IoU (dynamic)** | 76.5% |
| **Processing time** | ~10 sec / 1M points (GPU) |

### Limitations

❌ **Не работает хорошо в случаях:**
- Очень плотные сцены (> 10M точек)
- Облака точек без цветов
- Экстремальные условия (дождь, снег)
- Необычные объекты (не в training set)

✅ **Работает хорошо для:**
- Городских сцен (улицы, парковки)
- Облаков точек с RGB цветами
- Типичных объектов (машины, люди)
- Средних по размеру сцен (< 5M точек)

---

## 🚀 Использование

### В приложении LidarCleaner

1. Откройте облако точек в приложении
2. Нажмите кнопку **"Auto Clean"**
3. Дождитесь обработки (~5-15 минут)
4. Результат загрузится автоматически

### Параметры (в коде)

```python
# ml/main.py
DYNAMIC_THRESHOLD = 0.45        # Порог для классификации
HOLE_FILL_RADIUS = 0.4          # Радиус для заполнения дыр
HOLE_FILL_MIN_NEIGHBORS = 6     # Мин. соседей для заполнения
STATISTICAL_NB_NEIGHBORS = 20   # Статистический фильтр
STATISTICAL_STD_RATIO = 2.0     # Std ratio для фильтра
```

Можно настроить для своих нужд!

---

## 📚 Дополнительные материалы

### Jupyter Notebooks

| Notebook | Описание |
|----------|----------|
| `notebooks/train.ipynb` | Обучение модели PointNet++ |
| `notebooks/inference.ipynb` | Инференс на новых данных |
| `notebooks/preprocessed_dataset.ipynb` | Препроцессинг датасета |

### Модели

| Файл | Размер | Описание |
|------|--------|----------|
| `models/best_model.pth` | ~15 MB | Основная модель PointNet++ |
| `models/seg_model_19.pth` | ~15 MB | Модель для детекции автомобилей |

### Изображения

| Файл | Описание |
|------|----------|
| `images/smp1.jpeg` | Пример "до" (улица) |
| `images/after_model_smp1.jpeg` | Пример "после" (улица) |
| `images/smp2.jpeg` | Пример "до" (парковка) |
| `images/after_model_smp2.jpeg` | Пример "после" (парковка) |

---

## 🤝 Contributing

Хотите улучшить ML модель?

1. Обучите на новом датасете
2. Попробуйте другие архитектуры (PointNet++MSG, DGCNN)
3. Добавьте аугментации
4. Оптимизируйте гиперпараметры

См. [../docs/development/contributing.md](../docs/development/contributing.md)

---

## 📖 References

### Papers

- **PointNet++**: [Link](https://arxiv.org/abs/1706.02413)
  - Qi et al., "PointNet++: Deep Hierarchical Feature Learning on Point Sets in a Metric Space", NeurIPS 2017

- **PointNet**: [Link](https://arxiv.org/abs/1612.00593)
  - Qi et al., "PointNet: Deep Learning on Point Sets for 3D Classification and Segmentation", CVPR 2017

### Code

- **Official PointNet++ PyTorch**: [GitHub](https://github.com/yanx27/Pointnet_Pointnet2_pytorch)
- Используется в `backend/cv_worker/Pointnet_Pointnet2_pytorch/`

---

## 🐛 Troubleshooting

### CUDA out of memory

**Решение:**
- Уменьшите `BATCH_SIZE`
- Уменьшите `NUM_POINTS` (4096 → 2048)
- Используйте gradient checkpointing

### Model не загружается

**Решение:**
```python
# Попробуйте map_location
model.load_state_dict(torch.load('best_model.pth', map_location='cpu'))
```

### Низкая точность

**Решение:**
- Увеличьте размер датасета
- Добавьте аугментации
- Обучайте дольше (больше эпох)
- Попробуйте MSG variant PointNet++

---

## 📧 Контакты

Вопросы по ML части:
- 📧 Email: ml@lidarcleaner.app (если будет)
- 🐛 [GitHub Issues](https://github.com/qquerellka/LidarCleaner/issues)
- 💬 [Discussions](https://github.com/qquerellka/LidarCleaner/discussions)

---

<div align="center">

**Happy Training! 🚀🤖**

[⬆ Наверх](#-lidarcleaner---machine-learning) | [🏠 README](../README.md) | [📚 Docs](../docs/INDEX.md)

</div>

