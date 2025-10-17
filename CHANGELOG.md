# 📝 Changelog

Все notable изменения в LidarCleaner документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Планируется

- LAS/LAZ форматы
- Классификация точек
- Облачные вычисления
- Плагинная система

---

## [0.1.0] - 2024-10-18

### 🎉 Первый релиз

Первая публичная версия LidarCleaner!

### ✨ Added

#### Основной функционал
- **Визуализация облаков точек**
  - Поддержка PCD (ASCII/Binary) и PLY (ASCII/Binary) форматов
  - Three.js 3D рендеринг
  - Вращение, панорамирование, масштабирование камеры
  - Настройка размера точек (1-10)
  - Три режима отображения: Vertex Colors, Fixed Color, Height-based

#### Редактирование
- **Инструменты выделения**
  - Box Selection (прямоугольное выделение)
  - Brush Selection (кисть с настраиваемым размером)
  - Модификаторы выделения (Ctrl - добавить, Alt - убрать)
  
- **Операции с точками**
  - Удаление выделенных точек
  - Скрытие/показ точек
  - Изоляция выделения
  - Инвертирование выделения
  - Выделить все / Снять выделение

- **История изменений**
  - Undo/Redo (до 20 действий)
  - Визуальный индикатор позиции в истории

#### AI-обработка
- **Auto Clean (удаление динамических объектов)**
  - Backend на Go для обработки
  - CV Worker (Python) с алгоритмами RANSAC/DBSCAN
  - Асинхронная обработка через RabbitMQ
  - Прогресс-бар с "умным" фейковым прогрессом
  - Отображение времени обработки

#### UI/UX
- **Интерфейс**
  - Mantine UI компоненты
  - Темная/Светлая тема с автоопределением системной
  - Компактное боковое меню с секциями:
    - Statistics (статистика точек)
    - Selection Mode (режимы выделения)
    - Actions (операции)
    - History (история)
    - Scene Elements (элементы сцены)
    - Color Mode (режимы цвета)

- **Модальные окна**
  - LoadingOverlay с прогресс-баром
  - HotkeysModal (справка по горячим клавишам)
  - Quick Actions Toolbar (быстрые действия для выделения)

- **Minimap**
  - 2D карта облака точек
  - Индикатор позиции камеры
  - Клик для перемещения камеры

- **Measurement Tool (инструмент измерения)**
  - Измерение расстояния между двумя точками
  - Визуализация линии и точек
  - Горячая клавиша `M`

- **Recent Files (недавние файлы)**
  - Список последних 5 файлов
  - Быстрый доступ к недавним
  - Удаление из списка

- **Drag & Drop**
  - Перетаскивание PCD/PLY файлов в окно
  - Визуальная обратная связь при dragging

#### Элементы сцены
- Оси координат (X, Y, Z)
- Сетка
- Bounding Box (ограничивающая рамка)
- Ambient и Directional освещение

#### Экспорт
- Экспорт в PLY (ASCII)
- Экспорт в PLY (Binary)
- Экспорт в PCD
- Сохранение цветов точек

#### Горячие клавиши
- **Навигация**: Колесо, ЛКМ, ПКМ, Alt+1..5, 1..5, Ctrl+Hold
- **Выделение**: B, V, [, ], Ctrl+ЛКМ, Alt+ЛКМ, Ctrl+A, Ctrl+I, Escape
- **Редактирование**: Delete, Backspace, H, Alt+H, I, Ctrl+Z, Ctrl+Shift+Z
- **Инструменты**: M, Alt+Колесо, ?
- **Файлы**: Ctrl+O, Ctrl+S, Ctrl+Alt+S

#### Backend
- **Go HTTP Server (Gin)**
  - Health check endpoint
  - File upload/download
  - Process dynamic objects
  - Task status tracking

- **Инфраструктура**
  - PostgreSQL 15 (метаданные)
  - MinIO (S3-совместимое хранилище)
  - RabbitMQ (очередь задач)
  - Docker Compose для оркестрации

- **API Endpoints**
  - `GET /health` - проверка здоровья
  - `POST /files/upload_file` - загрузка файла
  - `POST /files/download` - скачивание файла
  - `POST /files/process_dynamic` - запуск обработки
  - `GET /files/process_status/:task_id` - статус обработки
  - `DELETE /files/:file_id` - удаление файла

#### Development
- **Frontend**
  - Electron 30
  - React 18 + TypeScript 5
  - Redux Toolkit для state management
  - Vite для сборки
  - esbuild для Electron main/preload
  - ESLint + Prettier

- **Backend**
  - Go 1.23
  - Structured logging
  - Graceful shutdown
  - Health checks

- **Скрипты**
  - `start-lidarcleaner.sh` - единый скрипт запуска backend + frontend
  - Выбор между dev и production режимами
  - Автоматическая проверка зависимостей

#### Документация
- **README.md** - основная документация с красивым оформлением
- **CONTRIBUTING.md** - руководство для contributors
- **ARCHITECTURE.md** - подробная архитектура приложения
- **API.md** - полная документация REST API
- **DEVELOPMENT.md** - руководство для разработчиков
- **TROUBLESHOOTING.md** - решения проблем
- **FAQ.md** - часто задаваемые вопросы
- **CHANGELOG.md** - история изменений

#### Производительность
- BufferGeometry для эффективного использования памяти
- Frustum culling
- Оптимизированные raycasting для выделения
- Web Workers для парсинга (planned)

#### Валидация
- Проверка формата файлов (.pcd, .ply)
- Валидация размера (лимит 2GB, предупреждение при >200MB)
- Проверка наличия точек в файле

### 🔧 Technical Details

#### Frontend Stack
- Electron 30.0
- React 18.3
- TypeScript 5.5
- Redux Toolkit 2.9
- Three.js 0.180
- Mantine UI 7.15
- Vite 5.4

#### Backend Stack
- Go 1.23
- Gin HTTP framework
- PostgreSQL 15
- MinIO (latest)
- RabbitMQ 3
- Docker & Docker Compose

#### Build & Deploy
- electron-builder для создания дистрибутивов
- AppImage для Linux
- DMG для macOS (planned)
- EXE для Windows (planned)

---

## [0.0.1] - 2024-10-01

### 🚧 Pre-release / Development

Начало разработки проекта.

- Proof of concept
- Базовая визуализация PCD файлов
- Простое выделение точек

---

## Типы изменений

- `Added` - новые функции
- `Changed` - изменения в существующем функционале
- `Deprecated` - скоро будет удалено
- `Removed` - удаленные функции
- `Fixed` - исправления багов
- `Security` - исправления безопасности

---

## Ссылки

- [Unreleased]: https://github.com/lidarcleaner/app/compare/v0.1.0...HEAD
- [0.1.0]: https://github.com/lidarcleaner/app/releases/tag/v0.1.0
- [0.0.1]: https://github.com/lidarcleaner/app/releases/tag/v0.0.1

