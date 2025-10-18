## Базовый образ с PyTorch (CUDA не нужен? -> возьмём CPU-only)
#FROM pytorch/pytorch:latest
#
## Устанавливаем системные зависимости
#RUN apt-get update && apt-get install -y \
#    python3-dev \
#    build-essential \
#    libgl1 \
#    libglib2.0-0 \
#    && rm -rf /var/lib/apt/lists/*
#
## Устанавливаем Python зависимости
#RUN pip install --no-cache-dir \
#    pika \
#    minio \
#    numpy \
#    matplotlib \
#    scipy \
#    open3d \
#    "torch==2.2.0" "torchvision==0.17.0"
#
## Копируем файлы в контейнер
#WORKDIR /app
#COPY cv_worker/worker.py .
#COPY cv_worker/best_model.pth .
#
## Если у тебя локально есть папка Pointnet_Pointnet2_pytorch, то нужно тоже скопировать
## (иначе Python не найдёт import Pointnet_Pointnet2_pytorch)
#COPY cv_worker/Pointnet_Pointnet2_pytorch ./Pointnet_Pointnet2_pytorch
#
## Запуск воркера
#CMD ["python", "worker.py"]
# Используем более легкий базовый образ
#FROM python:3.9-slim
#
## Устанавливаем только необходимые системные зависимости
#RUN apt-get update && apt-get install -y \
#    libgl1 \
#    libglib2.0-0 \
#    && rm -rf /var/lib/apt/lists/* \
#    && apt-get clean
#
## Устанавливаем Python зависимости оптимальным способом
#RUN pip install --no-cache-dir --upgrade pip && \
#    pip install --no-cache-dir \
#    torch==2.2.0 torchvision==0.17.0 --index-url https://download.pytorch.org/whl/cpu \
#    pika==4.1.0 \
#    minio==7.1.0 \
#    numpy==1.24.0 \
#    matplotlib==3.7.0 \
#    scipy==1.10.0 \
#    open3d==0.17.0
#
## Копируем только необходимые файлы
#WORKDIR /app
#COPY cv_worker/worker.py .
#COPY cv_worker/best_model.pth .
#COPY cv_worker/Pointnet_Pointnet2_pytorch ./Pointnet_Pointnet2_pytorch
#
## Создаем директорию для временных файлов
#RUN mkdir -p /tmp/files
#
## Запуск воркера
#CMD ["python", "worker.py"]
# Используем более легкий базовый образ
#FROM python:3.9-slim
#
#RUN apt-get update && apt-get install -y \
#    libgl1 \
#    libglib2.0-0 \
#    libgomp1 \
#    && rm -rf /var/lib/apt/lists/* \
#    && apt-get clean
#
## Для ARM архитектуры используем conda или более новые версии
#RUN pip install --no-cache-dir --upgrade pip && \
#    pip install --no-cache-dir \
#    torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu \
#    pika numpy matplotlib scipy open3d minio psutil
#
#WORKDIR /app
#COPY cv_worker/worker.py .
#COPY cv_worker/best_model.pth .
#COPY cv_worker/Pointnet_Pointnet2_pytorch ./Pointnet_Pointnet2_pytorch
#RUN mkdir -p /tmp/files
#
#CMD ["python", "worker.py"]

FROM python:3.9-slim

# Системные зависимости
RUN apt-get update && apt-get install -y \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Обновляем pip
RUN pip install --no-cache-dir --upgrade pip

# PyTorch (CPU)
RUN pip install --no-cache-dir \
        torch==2.2.0 torchvision==0.17.0 \
        --index-url https://download.pytorch.org/whl/cpu

# Остальные пакеты (фиксированные версии)
RUN pip install --no-cache-dir \
        pika==1.3.2 \
        minio==7.2.8 \
        numpy==1.26.4 \
        matplotlib==3.8.4 \
        scipy==1.13.1 \
        open3d==0.18.0 \
        psutil==6.0.0

# Копируем приложение
WORKDIR /app
COPY worker.py .
COPY best_model.pth .
COPY Pointnet_Pointnet2_pytorch ./Pointnet_Pointnet2_pytorch
RUN mkdir -p /tmp/files

# Устанавливаем переменные окружения для оптимизации памяти
ENV PYTHONUNBUFFERED=1
ENV OMP_NUM_THREADS=2
ENV MKL_NUM_THREADS=2
ENV NUMEXPR_NUM_THREADS=2

# Ограничиваем использование памяти Python
ENV PYTHONHASHSEED=0

CMD ["python", "-u", "worker.py"]