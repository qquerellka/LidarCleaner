# ⚡ LidarCleaner Quick Start Guide
---

## 📋 Содержание

- [Системные требования](#-системные-требования)
- [Установка зависимостей](#-установка-зависимостей)
- [Быстрый запуск](#-быстрый-запуск)
- [Первое использование](#-первое-использование)
- [Базовые операции](#-базовые-операции)
- [Часто задаваемые вопросы](#-часто-задаваемые-вопросы)

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
docker-compose up -d --build

# Проверьте что запустилось
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

---

## 📂 Первое использование

### Открытие файла

**Способ 1: Кнопка "Open PCD File"**
1. Нажмите кнопку **"Open PCD File"** в левом меню
2. Выберите `.pcd` или `.ply` файл
3. Дождитесь загрузки

**Способ 2: Drag & Drop**
1. Перетащите файл `.pcd` или `.ply` в окно приложения
2. Файл загрузится автоматически

**Способ 3: Горячая клавиша**
- Нажмите `Ctrl+O`

**Способ 4: Недавние файлы**
1. Нажмите стрелку рядом с "Open PCD File"
2. Выберите из списка недавних

---

## 🎮 Базовые операции

### Навигация в 3D

| Действие | Управление |
|----------|-----------|
| **Вращение камеры** | `ЛКМ` + движение мыши |
| **Панорамирование** | `ПКМ` + движение мыши |
| **Масштабирование** | `Колесо мыши` |
| **Сброс камеры** | Кнопка "Reset Camera" |
| **Вид сверху** | Кнопка "Top View" |
| **Вид спереди** | Кнопка "Front View" |
| **Вид сбоку** | Кнопка "Side View" |

### Выделение точек

#### Box Selection (прямоугольник)
1. Нажмите `B` или выберите "Box" в меню
2. Зажмите `ЛКМ` и тащите мышь
3. Отпустите — точки в прямоугольнике выделены

#### Brush Selection (кисть)
1. Нажмите `V` или выберите "Brush" в меню
2. Используйте `[` и `]` для изменения размера
3. Кликайте `ЛКМ` по точкам для выделения

#### Модификаторы
- `Ctrl + клик` — Добавить к выделению
- `Alt + клик` — Убрать из выделения
- `Ctrl + A` — Выделить все
- `Escape` — Снять выделение

### Операции с выделением

| Клавиша | Действие |
|---------|----------|
| `Delete` / `Backspace` | Удалить выделенное |
| `H` | Скрыть выделенное |
| `Alt + H` | Показать все скрытые |
| `I` | Изолировать (скрыть невыделенное) |
| `Ctrl + I` | Инвертировать выделение |
| `Ctrl + Z` | Отменить |
| `Ctrl + Shift + Z` | Повторить |

---

## 🤖 AI-обработка (Auto Clean)

### Автоматическое удаление динамических объектов

1. Нажмите кнопку **"Auto Clean"** в правом меню
2. Дождитесь обработки (~5-15 минут для больших файлов)
3. Результат загрузится автоматически

**Что удаляется:**
- 🚗 Автомобили
- 🚶 Люди
- 📦 Временные объекты

**Что остается:**
- 🏢 Здания
- 🛣️ Дороги
- 🌳 Деревья (статические)
- 🚏 Столбы и знаки

---

## 📏 Измерение расстояний

1. Нажмите `M` или кнопку "Measurement Tool"
2. Кликните на первую точку
3. Кликните на вторую точку
4. Расстояние отобразится на экране

Для очистки точек: нажмите `Escape` или `M` снова

---

## 💾 Экспорт результата

1. Нажмите **"Export"** в правом меню
2. Выберите формат:
   - **PLY (Binary)** — рекомендуется (меньше размер)
   - **PLY (ASCII)** — текстовый формат
   - **PCD** — Point Cloud Data формат
3. Выберите место сохранения
4. Готово!

Или используйте `Ctrl+S` для быстрого сохранения.

---

## ⌨️ Топ-10 горячих клавиш

| Клавиша | Действие |
|---------|----------|
| `Ctrl+O` | Открыть файл |
| `B` | Box Selection |
| `V` | Brush Selection |
| `Delete` | Удалить выделенное |
| `H` | Скрыть выделенное |
| `I` | Изолировать выделение |
| `Ctrl+Z` | Отменить |
| `M` | Измерение расстояния |
| `?` | Показать все горячие клавиши |
| `Escape` | Отмена/снятие выделения |

**Полный список:** нажмите `?` в приложении

---

## 🐛 Часто задаваемые вопросы

### Файл не открывается

**Проблема:** Файл открывается, но 0 точек

**Решение:**
1. Проверьте формат файла (должен быть PCD или PLY)
2. Проверьте размер (макс 2GB)
3. Попробуйте сбросить камеру

### Приложение тормозит

**Решение:**
1. Уменьшите размер точек
2. Используйте "Fixed Color" вместо "Vertex Colors"
3. Закройте другие приложения

### Backend не отвечает

**Решение:**
```bash
cd backend
docker-compose restart
curl http://localhost:8000/health
```

### Electron окно не открывается

**Решение:**
```bash
pkill -f electron
pkill -f node
cd frontend
npm run dev
```

---

## 🛑 Остановка приложения

```bash
# 1. Нажмите Ctrl+C в терминале с фронтендом

# 2. Остановите бэкенд
cd backend
docker-compose down

# 3. Проверьте что всё остановлено
docker ps
```

---

## 💡 Полезные команды

```bash
# Посмотреть логи бэкенда
cd backend && docker-compose logs -f

# Пересобрать бэкенд
cd backend && docker-compose up --build -d

# Очистить всё (осторожно! удалит данные)
cd backend && docker-compose down -v

# Посмотреть запущенные контейнеры
docker ps

# Освободить место (удалить неиспользуемые образы)
docker system prune -a
```

---

## 📚 Что дальше?

### Изучите документацию

- **[README.md](README.md)** — полная документация проекта
- **[docs/user-guide/faq.md](docs/user-guide/faq.md)** — ответы на вопросы
- **[docs/user-guide/troubleshooting.md](docs/user-guide/troubleshooting.md)** — решение проблем

### Изучите продвинутые функции

- Minimap (2D карта)
- Quick Actions Toolbar (быстрые действия)
- History (история изменений)
- Measurement Tool (инструмент измерения)

### Присоединитесь к сообществу

- 🐛 [GitHub Issues](https://github.com/qquerellka/LidarCleaner/issues)
- 💬 [Discussions](https://github.com/qquerellka/LidarCleaner/discussions)

---

## 🎉 Поздравляем!

Вы готовы работать с LidarCleaner! 

Если возникнут вопросы, смотрите [FAQ](docs/user-guide/faq.md) или создайте [Issue](https://github.com/qquerellka/LidarCleaner/issues).

---

<div align="center">

**Удачной работы с облаками точек! 🚀**

[🏠 На главную](README.md) | [📚 Документация](docs/INDEX.md)

</div>
