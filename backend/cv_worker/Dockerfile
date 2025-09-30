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
FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Для ARM архитектуры используем conda или более новые версии
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu \
    pika numpy matplotlib scipy open3d minio

WORKDIR /app
COPY cv_worker/worker.py .
COPY cv_worker/best_model.pth .
COPY cv_worker/Pointnet_Pointnet2_pytorch ./Pointnet_Pointnet2_pytorch
RUN mkdir -p /tmp/files

CMD ["python", "worker.py"]