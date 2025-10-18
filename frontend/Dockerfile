# Multi-stage build для Electron приложения LidarCleaner

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-bullseye AS builder

# Установка системных зависимостей для сборки Electron
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    libgconf-2-4 \
    libnss3 \
    && rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# ============================================
# Stage 2: Runtime (опционально, для разработки с X11)
# ============================================
FROM node:20-bullseye-slim AS runtime

# Установка runtime зависимостей для Electron
RUN apt-get update && apt-get install -y \
    xvfb \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libatspi2.0-0 \
    libdrm2 \
    libgbm1 \
    libxcb-dri3-0 \
    libasound2 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем package.json и собранные файлы
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-electron ./dist-electron
COPY --from=builder /app/public ./public

# Переменные окружения
ENV NODE_ENV=production
ENV DISPLAY=:99

# Точка входа (для запуска с виртуальным дисплеем)
CMD ["npm", "run", "preview"]

# ============================================
# Stage 3: Build distribution (AppImage, .deb и т.д.)
# ============================================
FROM node:20-bullseye AS dist-builder

# Установка зависимостей для electron-builder
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    rpm \
    fakeroot \
    dpkg \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем всё из builder
COPY --from=builder /app ./

# Установка electron-builder если нужно
RUN npm install -g electron-builder

# Команда для сборки дистрибутива
# Раскомментируйте нужный формат:
# RUN electron-builder --linux AppImage
# RUN electron-builder --linux deb
# RUN electron-builder --linux rpm
# RUN electron-builder --linux tar.gz

# По умолчанию просто копируем собранные файлы
CMD ["echo", "Build completed. Use electron-builder to create distribution."]

