# LidarCleaner


![schema](assets/schema.png)

## Запуск (Backend + Frontend)

### 1) Backend (Docker Compose)

В одном терминале запустите backend и инфраструктуру (PostgreSQL, MinIO, RabbitMQ):

```bash
cd backend
docker compose up -d --build
docker compose logs -f app
```

Проверка здоровья:

```bash
curl http://localhost:8000/health
```

### 2) Frontend (Electron + Vite)

Во втором терминале запустите приложение Electron c указанием адреса backend:

```bash
cd frontend
npm i
BACKEND_URL=http://localhost:8000 npm run dev
```

По умолчанию `BACKEND_URL` = `http://localhost:8000`. При необходимости измените на другой адрес.

### 3) Проверка взаимодействия

- В окне приложения нажмите «Open PCD File» и выберите `.pcd` файл — он автоматически отправится на backend через POST `/files/upload_file`.
- Логи backend можно смотреть командой:

```bash
cd backend
docker compose logs -f app
```

Опционально, можно проверить подключение из консоли рендерера:

```javascript
await window.api.backendHealth()
```

## Навигация и горячие клавиши

- Основное
  - R — Reset камеры
  - F — Fit ко всей сцене
  - Alt+F — Fit к точке/кластеру под курсором
  - G — Вкл/выкл сетку
  - X — Вкл/выкл оси
  - H — Домашний вид (0,0,5 → target 0,0,0)
  - O — Автоворот камеры (toggle)

- Фокусировка
  - Double click — Фокус на точку под курсором с мягким перелётом
  - Shift + Double click — Добавочный фокус (смешивание со старым target)
  - Ctrl + Click — Установить target без перелёта

- Presets (сохраняются в localStorage)
  - Alt+1..9 — Загрузить пресет
  - Ctrl+Alt+1..9 — Сохранить пресет

- Fly-режим (огляд/полёт)
  - T — Вкл/выкл fly-mode
  - Управление: WASD — движение, Q/E — вниз/вверх
  - Мышь — поворот (yaw/pitch)
  - Shift — ускорение, Ctrl — медленнее/точнее

- Жесты
  - Alt + колесо — изменять размер точек (экранный)
  - Zoom к курсору — включён (OrbitControls.zoomToCursor)
  - Панорамирование — средняя кнопка; вращение — правая кнопка

- Прочее
  - Автовыравнивание облака по плоскости: тонкая ось → Y-up, затем опускание на y=0
  - Мини-компас в углу; клики дают быстрые виды (Front/Side/Top)
  - Состояние камеры (position/target) сохраняется между сессиями

---

## Обзор проекта

LidarCleaner — редактор лидарных карт, автоматизирующий удаление динамических объектов (пешеходы, машины и т.п.) из облаков точек. Проект состоит из десктопного приложения на Electron/React (Frontend), сервера на Go (Backend), хранилищ данных (PostgreSQL, MinIO) и CV-воркера на Python с моделями семейства PointNet/PointNet++ для постобработки.

### Ключевые возможности
- Загрузка `.pcd` файлов и просмотр облаков точек в 3D.
- Управление камерой, пресеты, фокус на точках/кластерах, fly-режим.
- Отправка облака точек на сервер для обработки и получение очищенного результата.
- Интеграция с MinIO для объектного хранения и PostgreSQL для метаданных.
- Асинхронная обработка через RabbitMQ и CV-воркер на Python (PointNet/PointNet++).

## Архитектура

Высокоуровневую схему см. на изображении `assets/schema.png`.

### Компоненты
- Backend (Go + Gin): REST API, загрузка/выгрузка файлов в MinIO, хранение метаданных в PostgreSQL, взаимодействие с RabbitMQ.
- CV Worker (Python): подписка на события, получение исходных данных из MinIO, инференс модели, запись обработанного результата обратно в MinIO, ответ через RabbitMQ.
- Хранилища: PostgreSQL (метаданные), MinIO (исходные и обработанные `.pcd`).
- Frontend (Electron + React + Vite + Three.js): UI, рендер облаков точек, интеграция с Backend.

## Переменные окружения

Backend (Go):
- `PORT` — порт HTTP-сервера (по умолчанию `8000`).
- `DATABASE_URL` — строка подключения к PostgreSQL, напр.: `postgresql://postgres:postgres@db:5432/postgres?sslmode=disable`.
- `RABBITMQ_URL` — URL RabbitMQ, напр.: `amqp://guest:guest@rabbitmq:5672/`.
- `MINIO_ENDPOINT` — адрес MinIO, напр.: `minio:9000`.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — учётные данные MinIO.
- `MINIO_BUCKET_NAME` — имя бакета для хранения файлов.
- `MINIO_USE_SSL` — `true|false` для SSL к MinIO.

Frontend (Electron):
- `BACKEND_URL` — адрес backend API (по умолчанию `http://localhost:8000`).

CV Worker (Python):
- Использует `RABBITMQ_URL`, `MINIO_*`, `MINIO_BUCKET_NAME` из docker-compose.

## API (Backend)

Базовый URL: `http://<host>:8000`

- `GET /health` — проверка состояния сервиса.
- `POST /files/upload_file` — загрузка исходного файла.
  - Формат: `multipart/form-data`, поле `file` — `.pcd`.
  - Поведение: сохраняет объект в MinIO и возвращает поток файла (для тестов/валидации загрузки).
- `POST /files/download` — асинхронная обработка файла с ответом по готовности.
  - Формат: `multipart/form-data`, поле `file` — `.pcd`.
  - Последовательность: файл сохраняется в MinIO → метаданные записываются в БД → формируется сообщение в RabbitMQ (exchange `pcd_files`, `fanout`, `replyTo` временная очередь) → ожидание ответа от CV-воркера → при получении ключа обработанного объекта из MinIO сервер отдаёт поток обработанного файла.

Пример запроса (curl):

```bash
curl -X POST http://localhost:8000/files/download \
  -F "file=@sample.pcd" \
  -o cleaned.pcd
```

## Поток данных
1) Frontend загружает `.pcd` → Backend (`/files/download`).
2) Backend сохраняет объект в MinIO, пишет метаданные в PostgreSQL.
3) Backend публикует событие в RabbitMQ (`pcd_files`, `fanout`), указывает `replyTo` и `correlationId`.
4) CV-воркер получает событие, читает исходный `.pcd` из MinIO, применяет PointNet/PointNet++ для фильтрации динамики, записывает обработанный `.pcd` в MinIO.
5) CV-воркер отправляет ответ в `replyTo` с `correlationId`.
6) Backend получает ответ и стримит обработанный `.pcd` в клиент.

## Запуск через Docker (Backend + инфраструктура + CV worker)

См. инструкции выше в разделе «Запуск (Backend + Frontend)». Коротко:

```bash
cd backend
docker compose up -d --build
docker compose logs -f app
```

После старта будут доступны:
- Backend: `http://localhost:8000`
- MinIO: `http://localhost:9000` (консоль: `http://localhost:9001` если включена)
- PostgreSQL: `localhost:5432`
- RabbitMQ Management: `http://localhost:15672` (guest/guest)

## Локальная разработка

Frontend:

```bash
cd frontend
npm i
BACKEND_URL=http://localhost:8000 npm run dev
```

Backend (локально, без Docker) — требуется запущенные PostgreSQL/MinIO/RabbitMQ и корректный `.env`:

```bash
cd backend
go run .
```

## CV-воркер (Python)

Код расположен в `backend/cv_worker`. По умолчанию запускается через `docker-compose` и подключается к `RABBITMQ_URL`/MinIO. Модели PointNet/PointNet++ и вспомогательные скрипты находятся в `Pointnet_Pointnet2_pytorch/`. Для ручного запуска убедитесь в наличии Python 3.10+, PyTorch и зависимостей, а также переменных окружения MinIO/RabbitMQ. Ресурсные лимиты задаются в compose.

## Траблшутинг
- Backend не стартует: проверьте доступность PostgreSQL/MinIO/RabbitMQ и значения переменных окружения (`DATABASE_URL`, `MINIO_*`, `RABBITMQ_URL`).
- MinIO бакет не создаётся: убедитесь, что `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` корректны и сервис доступен по `MINIO_ENDPOINT`.
- Нет ответа от воркера: проверьте логи `cv-worker`, доступность RabbitMQ (`http://localhost:15672`), корректность exchange `pcd_files` и наличие ответной очереди.
- Пустой ответ файла: проверьте размер объекта в MinIO и корректность формата `.pcd` исходного файла.

## Roadmap (кратко)
- Выбор/переключение моделей и параметров инференса из UI.
- Пакетная обработка и очереди задач с прогрессом.
- Поддержка форматов LAS/LAZ, конвертация в/из `.pcd`.
- Маскирование/редактирование областей вручную перед автоочисткой.
- Предпросмотр диффа «до/после» и метрики качества.
