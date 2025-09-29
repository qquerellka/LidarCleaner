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

