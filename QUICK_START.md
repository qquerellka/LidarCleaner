# ⚡ LidarCleaner Quick Start Guide


## 📋 Содержание

- [Системные требования](#-системные-требования)
- [Установка зависимостей](#-установка-зависимостей)
- [Быстрый запуск](#-быстрый-запуск)

---

## 📊 Системные требования

### Минимальные
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Disk**: 10 GB свободного места
- **OS**: Linux (Ubuntu 20.04+, Arch Linux), Windows 10+, macOS 10.13+

### Рекомендуемые
- **CPU**: 4 ядра
- **RAM**: 8-16 GB
- **Disk**: 20 GB свободного места
- **GPU**: NVIDIA (для обработки больших файлов)

---

## 🔧 Установка зависимостей

### Linux (Ubuntu/Debian)

```bash
# 1. Установка Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# 2. ⚠️ ВАЖНО: Добавить текущего пользователя в группу docker
# Это необходимо для работы Docker без sudo
sudo usermod -aG docker $USER

# 3. ⚠️ ВАЖНО: Перелогиниться для применения изменений группы
# Выберите ОДИН из способов:

# Способ 1: Активировать группу в текущей сессии (временно)
newgrp docker

# Способ 2: Перелогиниться полностью (рекомендуется)
# Выйдите из системы и войдите заново, или выполните:
# sudo reboot

# 4. Проверить Docker (должно работать БЕЗ sudo)
docker --version
docker-compose --version
docker ps  # Не должно быть ошибки "permission denied"

# 5. Установка Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 6. Проверить Node.js
node --version
npm --version
```

**⚠️ Важно для Ubuntu/Debian пользователей:**

Если вы видите ошибку `permission denied while trying to connect to the Docker daemon socket`, это значит что ваш пользователь не в группе `docker`. Выполните:

```bash
# Проверить группы текущего пользователя
groups

# Если "docker" нет в списке, добавьте и перелогиньтесь
sudo usermod -aG docker $USER
# Затем перелогиньтесь или выполните: newgrp docker
```

### Arch Linux

```bash
# 1. Установка Docker
sudo pacman -S docker docker-compose

# 2. Включить и запустить Docker
sudo systemctl enable docker
sudo systemctl start docker

# 3. ⚠️ ВАЖНО: Добавить пользователя в группу docker
# Это необходимо для работы Docker без sudo
sudo usermod -aG docker $USER

# 4. ⚠️ ВАЖНО: Перелогиниться для применения изменений группы
# Выберите ОДИН из способов:

# Способ 1: Активировать группу в текущей сессии (временно)
newgrp docker

# Способ 2: Перелогиниться полностью (рекомендуется)
# Выйдите из системы и войдите заново

# 5. Установка Node.js
sudo pacman -S nodejs npm

# 6. Проверить версии (должно работать БЕЗ sudo)
docker --version
docker-compose --version
docker ps  # Не должно быть ошибки "permission denied"
node --version
```

**⚠️ Важно для Arch Linux пользователей:**

После добавления пользователя в группу `docker`, необходимо перелогиниться. Проверьте, что Docker работает без sudo:

```bash
# Проверить группы текущего пользователя
groups

# Убедитесь что "docker" есть в списке
# Проверьте что Docker daemon запущен
sudo systemctl status docker

# Попробуйте выполнить команду без sudo
docker ps
```

### Windows

1. Установите [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Установите [Node.js LTS](https://nodejs.org/)
3. Перезагрузите компьютер

### macOS

```bash
# 1. Установите Docker Desktop for Mac
# Скачайте с https://docs.docker.com/desktop/install/mac-install/

# 2. Установите Node.js через Homebrew
brew install node

# 3. Проверьте установку
docker --version
node --version
```

---

## ✅ Проверка готовности

Выполните эти команды, чтобы убедиться что всё установлено:

```bash
# 1. Docker
docker --version
# ✓ Ожидается: Docker version 20.x.x или выше

# 2. Docker Compose
docker-compose --version
# ✓ Ожидается: docker-compose version 1.29.x или выше

# 3. Node.js
node --version
# ✓ Ожидается: v18.x.x или v20.x.x

# 4. npm
npm --version
# ✓ Ожидается: 8.x.x или выше

# 5. Docker daemon
docker info
# ✓ Должно показать информацию о Docker (без ошибок)
```

Если хотите автоматизировать проверку:
```bash
./check-dependencies.sh
```

---

## 🚀 Быстрый запуск

### Вариант 1: Автоматический запуск (рекомендуется)

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/qquerellka/LidarCleaner.git
cd LidarCleaner

# 2. Дайте права на выполнение скрипту
chmod +x start-lidarcleaner.sh

# 3. Запустите приложение
./start-lidarcleaner.sh

# 4. Выберите режим:
#    1 - Development (для разработки, с hot-reload)
#    2 - Production (для использования, оптимизированная сборка)
```

При первом запуске скрипт:
1. ✅ Проверит наличие Docker
2. ✅ Запустит backend-сервисы (PostgreSQL, MinIO, RabbitMQ, Go)
3. ✅ Установит frontend-зависимости
4. ✅ Откроет приложение автоматически

**Готово! Приложение откроется автоматически. 🎉**

---

### Вариант 2: Ручной запуск

#### Backend

```bash
# Перейдите в директорию backend
cd backend

# Запустите все сервисы
docker-compose up --build

# Проверьте что запустилось в новом терминале
curl http://localhost:8000/health
# Ожидается: {"status":"ok","timestamp":"..."}

# Проверьте логи
docker-compose logs -f app
```

#### Frontend

```bash
# В новом терминале, перейдите в директорию frontend
cd frontend

# Установите зависимости
npm install

# Запустите в режиме разработки
npm run dev

# Или для production
npm run build
npm run package
```
</div>
