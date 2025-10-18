# 🔧 Troubleshooting Guide

Решения распространённых проблем в LidarCleaner.

## 📋 Содержание

- [Проблемы с Backend](#проблемы-с-backend)
- [Проблемы с Frontend](#проблемы-с-frontend)
- [Проблемы с Electron](#проблемы-с-electron)
- [Проблемы с 3D рендерингом](#проблемы-с-3d-рендерингом)
- [Проблемы с производительностью](#проблемы-с-производительностью)
- [Проблемы с Docker](#проблемы-с-docker)
- [Проблемы с сборкой](#проблемы-с-сборкой)

---

## Проблемы с Backend

### Backend не запускается

#### ❌ Ошибка: `dial tcp: lookup db: no such host`

**Причина:** Backend пытается подключиться к PostgreSQL через Docker network, но запущен вне Docker.

**Решение:**
```bash
# Используйте Docker Compose
cd backend
docker-compose down
docker-compose up -d

# Проверьте статус
docker-compose ps
```

**Альтернатива (локальный запуск):**
```bash
# Измените .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
MINIO_ENDPOINT=localhost:9000
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Запустите инфраструктуру
docker-compose up -d db minio rabbitmq

# Запустите backend локально
go run cmd/app/main.go
```

---

#### ❌ Ошибка: `failed to open database: pq: role "postgres" does not exist`

**Причина:** PostgreSQL не настроен правильно.

**Решение:**
```bash
# Пересоздайте контейнеры
cd backend
docker-compose down -v  # -v удалит volumes
docker-compose up -d

# Проверьте логи
docker-compose logs db
```

---

#### ❌ Ошибка: `MinIO connection refused`

**Причина:** MinIO не запущен или неправильный endpoint.

**Решение:**
```bash
# Проверьте MinIO
docker-compose ps minio

# Перезапустите
docker-compose restart minio

# Проверьте логи
docker-compose logs minio

# Попробуйте доступ через браузер
open http://localhost:9001
# Login: root / minio_password
```

---

#### ❌ Ошибка: `RabbitMQ connection failed`

**Решение:**
```bash
# Проверьте RabbitMQ
docker-compose ps rabbitmq

# Перезапустите
docker-compose restart rabbitmq

# Управление через UI
open http://localhost:15672
# Login: guest / guest
```

---

### Backend работает медленно

#### Медленные запросы к БД

**Диагностика:**
```sql
-- Посмотреть медленные запросы
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**Решение:**
- Добавьте индексы на часто запрашиваемые колонки
- Используйте EXPLAIN ANALYZE для анализа запросов
- Увеличьте connection pool

---

## Проблемы с Frontend

### Electron окно не открывается

#### ❌ Приложение запущено, но окна нет

**Диагностика:**
```bash
# Проверьте процессы
ps aux | grep electron

# Проверьте логи
npm run dev 2>&1 | tee debug.log
```

**Решение 1: Перезапуск**
```bash
# Остановите все процессы
pkill -f electron
pkill -f node

# Очистите порты
lsof -ti:5173 | xargs kill -9

# Запустите снова
npm run dev
```

**Решение 2: Проверка Vite**
```bash
# Убедитесь что Vite сервер запущен
curl http://localhost:5173

# Если не отвечает, запустите отдельно
npm run dev:renderer

# В другом терминале
npm run dev:electron
```

---

#### ❌ Ошибка: `ERR_FILE_NOT_FOUND` при загрузке index.html

**Причина:** Electron не может найти собранные файлы.

**Решение:**
```bash
# Пересоберите приложение
npm run build:renderer
npm run build:main
npm run build:preload

# Проверьте существование файлов
ls -la dist-electron/renderer/index.html

# Запустите preview
npm run preview
```

---

### Файлы не загружаются

#### ❌ Ошибка: `ECONNREFUSED` при загрузке файла

**Причина:** Backend не запущен или неправильный URL.

**Решение:**
```bash
# Проверьте backend
curl http://localhost:8000/health

# Если не отвечает, запустите
cd backend
docker-compose up -d

# Проверьте BACKEND_URL в frontend
echo $BACKEND_URL  # Должно быть http://localhost:8000
```

---

#### ❌ Ошибка: `File too large`

**Причина:** Файл превышает лимит 2GB.

**Решение:**
```bash
# Проверьте размер файла
ls -lh /path/to/file.pcd

# Если >2GB, используйте downsampling
python scripts/downsample.py input.pcd output.pcd --factor 0.5
```

---

#### ❌ Файл загружается, но 0 точек отображается

**Причина:** Неверный формат файла или ошибка парсинга.

**Решение:**
```bash
# Проверьте формат PCD
head -20 /path/to/file.pcd
# Должно содержать:
# VERSION .7
# FIELDS x y z ...
# SIZE 4 4 4 ...
# TYPE F F F ...
# COUNT 1 1 1 ...
# WIDTH <number>
# HEIGHT 1
# POINTS <number>
# DATA ascii/binary

# Попробуйте конвертировать в ASCII
pcl_convert_pcd_ascii_binary input.pcd output.pcd 0
```

---

## Проблемы с Electron

### DevTools не открываются

**Решение:**
```typescript
// В main/window.ts
mainWindow.webContents.openDevTools({ mode: 'detach' });
```

```bash
# Или используйте горячую клавишу
Ctrl+Shift+I  # Linux/Windows
Cmd+Option+I  # macOS
```

---

### IPC не работает

#### ❌ Ошибка: `window.api is undefined`

**Причина:** Preload script не загружен.

**Решение:**
```typescript
// В main/window.ts
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, '../preload/preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
});

// Проверьте путь
console.log('Preload path:', path.join(__dirname, '../preload/preload.js'));
```

---

## Проблемы с 3D рендерингом

### Черный экран вместо облака точек

**Диагностика:**
```typescript
// В Scene3D.tsx
useEffect(() => {
  console.log('Scene:', sceneRef.current);
  console.log('Camera:', cameraRef.current);
  console.log('Points:', pointsRef.current);
}, []);
```

**Решение 1: Проверка камеры**
```typescript
// Сброс позиции камеры
camera.position.set(0, 0, 100);
camera.lookAt(0, 0, 0);
controls.update();
```

**Решение 2: Проверка освещения**
```typescript
// Добавьте ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
```

**Решение 3: Проверка масштаба**
```typescript
// Вычислите bounding box
const bbox = new THREE.Box3().setFromObject(points);
const center = bbox.getCenter(new THREE.Vector3());
const size = bbox.getSize(new THREE.Vector3());

// Переместите камеру
camera.position.set(center.x, center.y, size.length() * 2);
camera.lookAt(center);
```

---

### Низкий FPS / лаги

**Причина:** Слишком много точек или неоптимизированный код.

**Решение 1: Downsampling**
```typescript
// Уменьшите количество точек
const downsampleFactor = 0.5; // 50% точек
const downsampledPositions = [];
for (let i = 0; i < positions.length; i += 3) {
  if (Math.random() < downsampleFactor) {
    downsampledPositions.push(
      positions[i],
      positions[i + 1],
      positions[i + 2]
    );
  }
}
```

**Решение 2: Уменьшение размера точек**
```typescript
pointsMaterial.size = 1; // Меньше размер = быстрее рендеринг
```

**Решение 3: Frustum culling**
```typescript
// Уже включен по умолчанию в Three.js
// Убедитесь что не отключен:
points.frustumCulled = true;
```

---

### Выделение не работает

#### ❌ Точки не выделяются при клике

**Диагностика:**
```typescript
// В обработчике клика
console.log('Raycaster:', raycaster);
console.log('Intersects:', intersects);
console.log('Points object:', pointsRef.current);
```

**Решение:**
```typescript
// Убедитесь что raycaster настроен правильно
raycaster.params.Points.threshold = 0.5; // Увеличьте порог

// Убедитесь что координаты нормализованы
const mouse = new THREE.Vector2(
  (event.clientX / window.innerWidth) * 2 - 1,
  -(event.clientY / window.innerHeight) * 2 + 1
);
```

---

## Проблемы с производительностью

### Высокое использование памяти

**Диагностика:**
```typescript
// В консоли браузера
console.log(performance.memory);
```

**Решение 1: Dispose объекты**
```typescript
// При удалении облака точек
geometry.dispose();
material.dispose();
scene.remove(points);
```

**Решение 2: Ограничьте историю**
```typescript
const MAX_HISTORY_SIZE = 20;
if (history.length > MAX_HISTORY_SIZE) {
  history.shift(); // Удалите самую старую запись
}
```

---

### Медленная загрузка файлов

**Решение 1: Используйте Web Workers**
```typescript
// parser.worker.ts
self.onmessage = (e) => {
  const data = e.data;
  const parsed = parsePointCloud(data);
  self.postMessage(parsed);
};

// В основном потоке
const worker = new Worker('parser.worker.js');
worker.postMessage(fileData);
worker.onmessage = (e) => {
  const points = e.data;
  // Render points
};
```

**Решение 2: Streaming parsing**
```typescript
// Парсите файл по частям
async function* parseInChunks(file) {
  const chunkSize = 1024 * 1024; // 1MB
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = file.slice(offset, offset + chunkSize);
    const data = await chunk.arrayBuffer();
    yield parseChunk(data);
  }
}
```

---

## Проблемы с Docker

### Docker daemon не запущен

```bash
# Linux
sudo systemctl start docker

# Проверка
docker ps
```

---

### Порты заняты

```bash
# Найдите процесс
lsof -i:8000
lsof -i:5432

# Убейте процесс
kill -9 <PID>

# Или измените порты в docker-compose.yml
```

---

### Медленная сборка образов

```bash
# Используйте cache
docker-compose build --parallel

# Очистите неиспользуемые образы
docker system prune -a
```

---

## Проблемы с сборкой

### Ошибки TypeScript

```bash
# Проверьте tsconfig.json
npx tsc --noEmit

# Обновите типы
npm install --save-dev @types/node @types/react
```

---

### Ошибки ESLint

```bash
# Автоисправление
npm run lint --fix

# Игнорирование файлов (.eslintignore)
dist/
dist-electron/
node_modules/
```

---

### Ошибки esbuild

```bash
# Очистите и пересоберите
rm -rf dist-electron
npm run build

# Проверьте версию Node.js
node --version  # Должна быть >=18.0
```

---

## Логи для диагностики

### Frontend Logs

```bash
# Electron main process
export ELECTRON_ENABLE_LOGGING=1
npm run dev

# Сохранить логи
npm run dev 2>&1 | tee frontend.log
```

### Backend Logs

```bash
# Docker logs
docker-compose logs -f app

# Сохранить логи
docker-compose logs app > backend.log
```

### Database Logs

```bash
# PostgreSQL logs
docker-compose logs db

# Включить query logging
# В docker-compose.yml:
command:
  - "postgres"
  - "-c"
  - "log_statement=all"
```

---

## Получение помощи

Если проблема не решена:

1. **Соберите информацию:**
   - Версии (Node.js, Go, Docker)
   - ОС и версия
   - Полные логи ошибок
   - Шаги для воспроизведения

2. **Создайте Issue:**
   ```bash
   # Шаблон Issue
   **Описание:**
   Краткое описание проблемы
   
   **Воспроизведение:**
   1. Шаг 1
   2. Шаг 2
   3. ...
   
   **Ожидаемое поведение:**
   Что должно происходить
   
   **Актуальное поведение:**
   Что происходит на самом деле
   
   **Окружение:**
   - OS: Linux 6.17.1
   - Node.js: v18.0.0
   - Go: 1.23
   - Docker: 20.10
   
   **Логи:**
   ```
   [paste logs here]
   ```
   ```

3. **Куда обращаться:**
   - 🐛 [GitHub Issues](https://github.com/lidarcleaner/app/issues)
   - 💬 [Discussions](https://github.com/lidarcleaner/app/discussions)
   - 📧 Email: support@lidarcleaner.app

---

## Полезные команды для диагностики

```bash
# System info
uname -a
node --version
npm --version
go version
docker --version
docker-compose --version

# Process info
ps aux | grep -E 'electron|node|go'
lsof -i -P -n | grep LISTEN

# Network
curl -v http://localhost:8000/health
nc -zv localhost 8000

# Disk space
df -h
du -sh node_modules/

# Memory
free -h
docker stats

# Clean everything and restart
pkill -f electron
pkill -f node
cd backend && docker-compose down -v
cd ../frontend
rm -rf node_modules dist-electron
npm install
cd ../
./start-lidarcleaner.sh
```

---

Не нашли решение? Создайте Issue с подробным описанием! 🐛

