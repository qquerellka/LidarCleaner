<div align="center">

# 🌟 LidarCleaner

**Профессиональный редактор облаков точек для LiDAR данных**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-30.0-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.180-000000?logo=three.js)](https://threejs.org/)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://golang.org/)

[Быстрый старт](#-быстрый-старт) • [Возможности](#-возможности) • [Архитектура](#-архитектура) • [Документация](#-документация) • [API](#-api)

![schema](assets/schema.png)

</div>

---

## 📋 Содержание

- [О проекте](#-о-проекте)
- [Возможности](#-возможности)
- [Требования](#-требования)
- [Быстрый старт](#-быстрый-старт)
- [Архитектура](#-архитектура)
- [Горячие клавиши](#-горячие-клавиши)
- [API Backend](#-api-backend)
- [Разработка](#-разработка)
- [Сборка для продакшн](#-сборка-для-продакшн)
- [Структура проекта](#-структура-проекта)
- [Технологии](#-технологии)
- [Устранение неполадок](#-устранение-неполадок)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Лицензия](#-лицензия)

---

## 🎯 О проекте

**LidarCleaner** — это мощный desktop-инструмент для работы с облаками точек в форматах **PCD** и **PLY**. Приложение предназначено для:

- 🔍 **Визуализации** больших облаков точек (миллионы точек)
- ✂️ **Редактирования** - удаление, скрытие, изоляция точек
- 🤖 **Автоматической очистки** - удаление динамических объектов с помощью AI
- 💾 **Экспорта** в оптимизированных форматах
- 📊 **Измерений** расстояний между точками
- 🎨 **Кастомизации** цветов и отображения

---

## ✨ Возможности

### 🖼️ Визуализация

- **Поддержка форматов**: PCD (Point Cloud Data), PLY (Polygon File Format)
- **Режимы отображения**: цвета вершин, фиксированный цвет, высота
- **Элементы сцены**: оси координат, сетка, ограничивающая рамка
- **Камера**: свободное вращение, панорамирование, масштабирование
- **Виды**: Сверху, Спереди, Сбоку, Сброс камеры
- **Minimap**: 2D карта для быстрой навигации

### ✏️ Редактирование

- **Инструменты выделения**:
  - **Box Selection** - прямоугольное выделение (B)
  - **Brush Selection** - кисть с настраиваемым размером ([/])
  
- **Операции**:
  - Удаление точек (Delete/Backspace)
  - Скрытие/показ точек (H)
  - Изоляция выделения (I)
  - Инвертирование выделения (Ctrl+I)
  - Отмена/Повтор (Ctrl+Z / Ctrl+Shift+Z)

- **Модификаторы**:
  - Ctrl - добавить к выделению
  - Alt - убрать из выделения

### 🤖 AI-обработка

- **Автоудаление динамики** - удаление движущихся объектов (машины, люди)
- **Прогресс обработки** - визуальный индикатор с временем
- **Фоновая обработка** - работа продолжается в фоне

### 📏 Инструменты

- **Измерение расстояний** - точное определение дистанции между точками (M)
- **Сохранение видов** - запоминание позиций камеры (Alt+1..5)
- **Блокировка камеры** - фиксация камеры для точного выделения (Ctrl hold)

### 🎨 Интерфейс

- **Темная/Светлая тема** - переключение цветовой схемы
- **Компактное меню** - все инструменты под рукой
- **Контекстные меню** - быстрый доступ к действиям
- **Уведомления** - информация о процессах
- **Недавние файлы** - быстрый доступ к последним проектам

### 💾 Экспорт

- **PLY** - стандартный формат с цветами
- **PLY (Binary)** - оптимизированный бинарный формат
- **PCD** - Point Cloud Data формат

---

## 📦 Требования

### Backend

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **8GB RAM** (рекомендуется 16GB для больших файлов)
- **Свободное место**: ~10GB для образов и данных

### Frontend

- **Node.js** >= 18.0
- **npm** >= 9.0
- **ОС**: Linux (Wayland/X11), Windows, macOS

---

## 🚀 Быстрый старт

### Вариант 1: Единый скрипт запуска (рекомендуется)

```bash
# Клонируйте репозиторий
git clone https://github.com/your-org/LidarCleaner.git
cd LidarCleaner

# Запустите приложение
./start-lidarcleaner.sh
```

При первом запуске:
1. Скрипт проверит наличие Docker
2. Запустит backend-сервисы (PostgreSQL, MinIO, RabbitMQ, Go)
3. Установит frontend-зависимости
4. Предложит выбрать режим:
   - **1 - Development** (с hot-reload и DevTools)
   - **2 - Production** (оптимизированная сборка)

### Вариант 2: Ручной запуск

#### Backend

```bash
cd backend
docker-compose up -d --build

# Проверка здоровья
curl http://localhost:8000/health
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron App                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Renderer Process                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │   React UI   │  │  Three.js    │  │   Redux    │  │  │
│  │  │   (Mantine)  │  │   (Scene)    │  │  (State)   │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │  │
│  │         │                 │                 │         │  │
│  │         └─────────────────┴─────────────────┘         │  │
│  │                          │                            │  │
│  │                     IPC Bridge                        │  │
│  └──────────────────────────┼────────────────────────────┘  │
│  ┌──────────────────────────┼────────────────────────────┐  │
│  │                  Main Process                          │  │
│  │  ┌──────────────┐  ┌────┴──────┐  ┌───────────────┐  │  │
│  │  │  Window Mgmt │  │ File I/O  │  │   Backend IPC │  │  │
│  │  └──────────────┘  └───────────┘  └───────┬───────┘  │  │
│  └────────────────────────────────────────────┼──────────┘  │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                            HTTP/REST
                                                  │
┌─────────────────────────────────────────────────┼───────────┐
│                    Backend (Go)                 │           │
│  ┌──────────────────────────────────────────────▼────────┐  │
│  │              Gin HTTP Server                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │ File Upload  │  │   Process    │  │   Health   │  │  │
│  │  │   Handler    │  │   Dynamic    │  │   Check    │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────┘  │  │
│  └─────────┼──────────────────┼──────────────────────────┘  │
│            │                  │                             │
│  ┌─────────▼─────┐   ┌────────▼──────┐   ┌──────────────┐  │
│  │    MinIO      │   │   RabbitMQ    │   │  PostgreSQL  │  │
│  │  (S3 Storage) │   │  (Task Queue) │   │  (Metadata)  │  │
│  └───────────────┘   └───────────────┘   └──────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              CV Worker (Python/Go)                    │  │
│  │     Обработка облаков точек, удаление динамики       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Технологический стек

#### Frontend
- **Electron 30** - Desktop framework
- **React 18** - UI библиотека
- **Redux Toolkit** - State management
- **Three.js** - 3D рендеринг
- **Mantine UI** - Component library
- **TypeScript** - Type safety
- **Vite** - Build tool

#### Backend
- **Go 1.23** - Основной язык
- **Gin** - HTTP framework
- **PostgreSQL 15** - База данных
- **MinIO** - S3-совместимое хранилище
- **RabbitMQ** - Очередь задач
- **Docker** - Контейнеризация

---

## ⌨️ Горячие клавиши

### Навигация
| Клавиша | Действие |
|---------|----------|
| `Колесо мыши` | Масштабирование |
| `ЛКМ + движение` | Вращение камеры |
| `ПКМ + движение` | Панорамирование |
| `Alt + 1..5` | Сохранить вид |
| `1..5` | Загрузить вид |
| `Ctrl + Hold` | Заблокировать камеру |

### Выделение
| Клавиша | Действие |
|---------|----------|
| `B` | Прямоугольное выделение (Box) |
| `V` | Кисть (Brush) |
| `[` / `]` | Уменьшить/Увеличить кисть |
| `Ctrl + ЛКМ` | Добавить к выделению |
| `Alt + ЛКМ` | Убрать из выделения |
| `Ctrl + A` | Выделить все |
| `Ctrl + I` | Инвертировать выделение |
| `Escape` | Снять выделение |

### Редактирование
| Клавиша | Действие |
|---------|----------|
| `Delete` / `Backspace` | Удалить выделенное |
| `H` | Скрыть выделенное |
| `Alt + H` | Показать все |
| `I` | Изолировать (скрыть невыделенное) |
| `Ctrl + Z` | Отменить |
| `Ctrl + Shift + Z` | Повторить |

### Инструменты
| Клавиша | Действие |
|---------|----------|
| `M` | Измерение расстояния |
| `Alt + Колесо` | Изменить размер точек |
| `?` | Показать помощь |

### Файлы
| Клавиша | Действие |
|---------|----------|
| `Ctrl + O` | Открыть файл |
| `Ctrl + S` | Сохранить |
| `Ctrl + Alt + S` | Сохранить как |

---

## 🌐 API Backend

### Base URL
```
http://localhost:8000
```

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-10-18T00:00:00Z"
}
```

---

#### Upload File
```http
POST /files/upload_file
Content-Type: multipart/form-data
```

**Parameters:**
- `file` (formData) - PCD или PLY файл

**Response:**
```json
{
  "file_id": "uuid-here",
  "filename": "pointcloud.pcd",
  "size": 12345678,
  "uploaded_at": "2024-10-18T00:00:00Z"
}
```

---

#### Process Dynamic Objects
```http
POST /files/process_dynamic
Content-Type: application/json
```

**Body:**
```json
{
  "file_path": "/path/to/pointcloud.pcd"
}
```

**Response:**
```json
{
  "task_id": "task-uuid",
  "status": "processing",
  "estimated_time": 900
}
```

---

#### Get Processing Status
```http
GET /files/process_status/:task_id
```

**Response:**
```json
{
  "task_id": "task-uuid",
  "status": "completed",
  "progress": 100,
  "result_path": "/path/to/cleaned.pcd"
}
```

---

## 🛠️ Разработка

### Структура Frontend

```
frontend/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point
│   │   ├── window.ts   # Window management
│   │   ├── menu.ts     # Application menu
│   │   └── ipc/        # IPC handlers
│   │       ├── dialogs.ts
│   │       ├── backend.ts
│   │       └── ...
│   └── renderer/       # React app
│       ├── main.tsx    # React entry
│       ├── App.tsx
│       ├── components/ # Reusable components
│       ├── features/   # Feature modules
│       │   ├── FileLoader/
│       │   ├── SceneControls/
│       │   └── EditControls/
│       ├── store/      # Redux store
│       ├── three/      # Three.js integration
│       │   ├── Scene3D.tsx
│       │   └── hooks/  # Custom Three.js hooks
│       └── utils/      # Utilities
├── dist-electron/      # Compiled electron code
└── package.json
```

### Структура Backend

```
backend/
├── cmd/
│   └── app/
│       └── main.go     # Entry point
├── internal/
│   ├── handlers/       # HTTP handlers
│   │   ├── health.go
│   │   ├── files.go
│   │   └── process.go
│   ├── services/       # Business logic
│   ├── models/         # Data models
│   └── config/         # Configuration
├── pkg/                # Shared packages
├── docker-compose.yml
└── Dockerfile
```

### Запуск в режиме разработки

```bash
# Terminal 1: Backend
cd backend
docker-compose up

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Отладка

**Frontend DevTools:**
- Автоматически открываются в dev режиме
- `Ctrl+Shift+I` - Toggle DevTools

**Backend Logs:**
```bash
cd backend
docker-compose logs -f app
```

### Линтинг и форматирование

**Frontend:**
```bash
cd frontend
npm run lint
npm run format
```

**Backend:**
```bash
cd backend
go fmt ./...
go vet ./...
golangci-lint run
```

---

## 📦 Сборка для продакшн

### Полная сборка

```bash
# Сборка backend
cd backend
docker-compose build

# Сборка frontend
cd ../frontend
npm run build
```

### Создание дистрибутива

```bash
cd frontend

# Сборка Electron app
npm run package

# Создание установщиков
npm run make
```

Результат в `frontend/dist/`:
- `LidarCleaner-0.1.0-x86_64.AppImage` (Linux)
- `LidarCleaner-0.1.0.dmg` (macOS)
- `LidarCleaner Setup 0.1.0.exe` (Windows)

---

## 📁 Структура проекта

```
LidarCleaner/
├── backend/                # Go backend
│   ├── cmd/               # Entry points
│   ├── internal/          # Internal packages
│   ├── pkg/               # Public packages
│   ├── migrations/        # DB migrations
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/              # Electron + React app
│   ├── src/
│   │   ├── main/         # Electron main
│   │   └── renderer/     # React app
│   ├── dist-electron/    # Compiled electron
│   ├── public/           # Static assets
│   ├── package.json
│   └── vite.config.ts
│
├── assets/               # README assets
│   └── schema.png
│
├── start-lidarcleaner.sh # Launch script
└── README.md
```

---

## 🔧 Технологии

### Frontend Technologies

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| [Electron](https://www.electronjs.org/) | 30.0 | Desktop framework |
| [React](https://reactjs.org/) | 18.3 | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.5 | Type safety |
| [Redux Toolkit](https://redux-toolkit.js.org/) | 2.9 | State management |
| [Three.js](https://threejs.org/) | 0.180 | 3D rendering |
| [Mantine](https://mantine.dev/) | 7.15 | UI components |
| [Vite](https://vitejs.dev/) | 5.4 | Build tool |
| [esbuild](https://esbuild.github.io/) | 0.25 | JS bundler |

### Backend Technologies

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| [Go](https://golang.org/) | 1.23 | Backend language |
| [Gin](https://gin-gonic.com/) | Latest | HTTP framework |
| [PostgreSQL](https://www.postgresql.org/) | 15 | Database |
| [MinIO](https://min.io/) | Latest | Object storage |
| [RabbitMQ](https://www.rabbitmq.com/) | 3 | Message queue |
| [Docker](https://www.docker.com/) | 20+ | Containerization |

---

## 🐛 Устранение неполадок

### Backend не запускается

**Проблема:** `dial tcp: lookup db: no such host`

**Решение:**
```bash
cd backend
docker-compose down
docker-compose up -d
```

---

### Frontend не подключается к Backend

**Проблема:** `ERR_CONNECTION_REFUSED`

**Решение:**
1. Убедитесь что backend запущен: `curl http://localhost:8000/health`
2. Проверьте `BACKEND_URL` в frontend
3. Проверьте логи: `docker-compose logs -f app`

---

### Electron окно не открывается

**Проблема:** Процесс запущен, но окна нет

**Решение:**
1. Перезапустите приложение
2. Проверьте консоль на ошибки
3. Убедитесь что Vite сервер запущен (http://localhost:5173)

---

### Файлы не загружаются

**Проблема:** Большие файлы не открываются

**Решение:**
- Проверьте размер файла (лимит: 2GB)
- Увеличьте RAM для Docker
- Проверьте свободное место на диске

---

### Медленная отрисовка

**Проблема:** Лаги при работе с большими облаками

**Решение:**
- Уменьшите размер точек
- Используйте фиксированный цвет вместо цветов вершин
- Закройте другие приложения
- Обновите драйверы видеокарты

---

## 🗺️ Roadmap

### v0.2.0 (В разработке)
- [ ] Поддержка LAS/LAZ форматов
- [ ] Классификация точек (земля, растительность, здания)
- [ ] Экспорт в GeoJSON
- [ ] Облачные вычисления

### v0.3.0 (Планируется)
- [ ] Мультифайловая работа
- [ ] Слияние облаков точек
- [ ] Автоматическое выравнивание
- [ ] Плагинная система

### v1.0.0 (Цель)
- [ ] Стабильный API
- [ ] Полная документация
- [ ] Производственная готовность
- [ ] Локализация (EN, RU, CN)

---

## 🤝 Contributing

Мы приветствуем вклад от сообщества! 

### Как внести вклад

1. **Fork** репозиторий
2. Создайте **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** изменения (`git commit -m 'Add amazing feature'`)
4. **Push** в branch (`git push origin feature/amazing-feature`)
5. Откройте **Pull Request**

### Правила

- Следуйте существующему стилю кода
- Добавьте тесты для новых функций
- Обновите документацию
- Опишите изменения в PR

---

## 📄 Лицензия

Этот проект распространяется под лицензией **MIT**. Подробности в файле [LICENSE](LICENSE).

---

## 👥 Авторы

- **LidarCleaner Team** - [GitHub](https://github.com/lidarcleaner)

---

## 🙏 Благодарности

- [Three.js](https://threejs.org/) за отличную 3D библиотеку
- [Electron](https://www.electronjs.org/) за desktop framework
- [Mantine](https://mantine.dev/) за красивые UI компоненты
- Всем contributors и тестировщикам

---

## 📞 Контакты

- **Issues**: [GitHub Issues](https://github.com/lidarcleaner/app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lidarcleaner/app/discussions)
- **Email**: info@lidarcleaner.app

---

<div align="center">

**Сделано с ❤️ для LiDAR сообщества**

[⬆ Наверх](#-lidarcleaner)

</div>
