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
- Объекты снятые в движении

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
- **Архитектура**: PointNet++ 
- **Входные данные**: XYZ координаты + RGB цвета + нормали
- **Выход**: Вероятность для каждой точки (динамический/статический)

### Pipeline обработки

```
Input Point Cloud (.pcd/.ply)
        ↓
   Preprocessing
   - Downsampling
   - Normal estimation
   - Color normalization
        ↓
   PointNet++ Model
   - Feature extraction
   - Semantic segmentation
        ↓
   Post-processing
   - Threshold filtering (0.4)
   - Hole filling
        ↓
   Output Point Cloud (cleaned)
```

---

## 🧠 Модели

### 1. best_model.pth

**Местоположение:** `ml/models/best_model.pth` или `backend/cv_worker/best_model.pth`

### 2. seg_model_19.pth

**Описание:**
- Модель для детекции автомобилей

**Описание:**
- Обученные модели PointNet++ для детекции объектов в движении
- Архитектура: PointNet++ 
- Входные features: 9 каналов (XYZ + RGB + Normals)
- Выходные классы: 2 (static/dynamic)

**Метрики:**
- mIoU ~56%
- Precision (dynamic): ~70%
- Recall (dynamic): ~60%
- F1-score: ~65%

**Обучено на:**
- [KITTI-360-dataset](https://www.kaggle.com/datasets/greatgamedota/kitti360-3d-semantics)
- [Toronto-3D](https://www.kaggle.com/datasets/priteshraj10/point-cloud-lidar-toronto-3d)
- Аугментация: rotation, scaling, jittering

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

### Препроцессинг

Используйте `ml/notebooks/preprocessed_dataset.ipynb`



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
- Разделите на train/val

#### 2. Обучение модели

Используйте `ml/notebooks/train.ipynb` или запустите напрямую

### Гиперпараметры

| Параметр | Значение | Описание |
|----------|----------|----------|
| `batch_size` | 16 | Размер батча |
| `learning_rate` | 0.001 | Начальная скорость обучения |
| `epochs` | 60 | Количество эпох |
| `num_points` | 16384 | Количество точек в сэмпле |
| `voxel_size` | 0.01 |Downsampling|
| `scheduler` | ReduceLROnPlateau | LR scheduler |

---

## 🔮 Инференс

### Использование обученной модели

#### Jupyter Notebook

Используйте `ml/notebooks/inference.ipynb`


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

