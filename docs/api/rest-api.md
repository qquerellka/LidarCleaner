# 🌐 LidarCleaner API Documentation

Полная документация REST API для LidarCleaner Backend.

## 📋 Содержание

- [Base Information](#base-information)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Files](#files)
  - [Processing](#processing)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Base Information

### Base URL
```
http://localhost:8000
```

### Content Types
- Request: `application/json`, `multipart/form-data`
- Response: `application/json`

### Headers
```http
Content-Type: application/json
Accept: application/json
```

---

## Authentication

**Current Version:** No authentication required

**Future:** JWT Bearer tokens
```http
Authorization: Bearer <token>
```

---

## Endpoints

### Health

#### GET /health

Проверка здоровья сервиса.

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:8000
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-10-18T00:00:00Z",
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "queue": "healthy"
  }
}
```

**Response Codes:**
- `200` - Service healthy
- `503` - Service unhealthy

---

### Files

#### POST /files/upload_file

Загрузка PCD или PLY файла.

**Request:**
```http
POST /files/upload_file HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="pointcloud.pcd"
Content-Type: application/octet-stream

<binary data>
------WebKitFormBoundary--
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| file | file | Yes | PCD or PLY file (max 2GB) |

**Response:** `200 OK`
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "pointcloud.pcd",
  "size": 12345678,
  "point_count": 1000000,
  "uploaded_at": "2024-10-18T00:00:00Z",
  "object_key": "files/2024/10/18/550e8400..."
}
```

**Response Codes:**
- `200` - File uploaded successfully
- `400` - Invalid file format or size
- `413` - File too large
- `500` - Internal server error

**Errors:**
```json
{
  "error": "file too large",
  "details": "maximum file size is 2GB",
  "code": "FILE_TOO_LARGE"
}
```

---

#### GET /files/:file_id

Получение информации о файле.

**Request:**
```http
GET /files/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:8000
```

**Response:** `200 OK`
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "pointcloud.pcd",
  "size": 12345678,
  "point_count": 1000000,
  "uploaded_at": "2024-10-18T00:00:00Z",
  "status": "ready",
  "download_url": "/files/550e8400.../download"
}
```

**Response Codes:**
- `200` - Success
- `404` - File not found

---

#### POST /files/download

Скачивание файла с сервера.

**Request:**
```http
POST /files/download HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "file_path": "/path/to/pointcloud.pcd"
}
```

**Response:** `200 OK`
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="pointcloud.pcd"

<binary data>
```

**Response Codes:**
- `200` - Success
- `404` - File not found
- `500` - Download failed

---

#### DELETE /files/:file_id

Удаление файла.

**Request:**
```http
DELETE /files/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:8000
```

**Response:** `200 OK`
```json
{
  "message": "file deleted successfully",
  "file_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Codes:**
- `200` - Success
- `404` - File not found
- `500` - Deletion failed

---

### Processing

#### POST /files/process_dynamic

Запуск обработки для удаления динамических объектов.

**Request:**
```http
POST /files/process_dynamic HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "file_path": "/path/to/pointcloud.pcd",
  "options": {
    "algorithm": "ransac",
    "threshold": 0.05,
    "min_points": 100
  }
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| file_path | string | Yes | Path to PCD/PLY file |
| options | object | No | Processing options |
| options.algorithm | string | No | Algorithm: "ransac", "dbscan" (default: "ransac") |
| options.threshold | float | No | Distance threshold (default: 0.05) |
| options.min_points | int | No | Minimum cluster size (default: 100) |

**Response:** `200 OK`
```json
{
  "task_id": "task-550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "file_path": "/path/to/pointcloud.pcd",
  "estimated_time": 900,
  "created_at": "2024-10-18T00:00:00Z"
}
```

**Response Codes:**
- `200` - Task created
- `400` - Invalid request
- `404` - File not found
- `500` - Task creation failed

---

#### GET /files/process_status/:task_id

Получение статуса обработки.

**Request:**
```http
GET /files/process_status/task-550e8400 HTTP/1.1
Host: localhost:8000
```

**Response:** `200 OK`

**Status: Queued**
```json
{
  "task_id": "task-550e8400",
  "status": "queued",
  "progress": 0,
  "message": "Task is waiting in queue",
  "position": 3
}
```

**Status: Processing**
```json
{
  "task_id": "task-550e8400",
  "status": "processing",
  "progress": 45,
  "message": "Removing dynamic objects...",
  "started_at": "2024-10-18T00:00:00Z",
  "estimated_remaining": 450
}
```

**Status: Completed**
```json
{
  "task_id": "task-550e8400",
  "status": "completed",
  "progress": 100,
  "message": "Processing complete",
  "result_path": "/path/to/cleaned_pointcloud.pcd",
  "result_file_id": "550e8400-result",
  "statistics": {
    "original_points": 1000000,
    "remaining_points": 850000,
    "removed_points": 150000,
    "processing_time": 856.42
  },
  "completed_at": "2024-10-18T00:15:00Z"
}
```

**Status: Failed**
```json
{
  "task_id": "task-550e8400",
  "status": "failed",
  "progress": 23,
  "message": "Processing failed",
  "error": "insufficient memory",
  "failed_at": "2024-10-18T00:05:00Z"
}
```

**Response Codes:**
- `200` - Success
- `404` - Task not found

---

#### POST /files/process_cancel/:task_id

Отмена задачи обработки.

**Request:**
```http
POST /files/process_cancel/task-550e8400 HTTP/1.1
Host: localhost:8000
```

**Response:** `200 OK`
```json
{
  "task_id": "task-550e8400",
  "status": "cancelled",
  "message": "Task cancelled successfully"
}
```

**Response Codes:**
- `200` - Task cancelled
- `404` - Task not found
- `409` - Task already completed/failed

---

#### GET /files/tasks

Получение списка всех задач.

**Request:**
```http
GET /files/tasks?status=processing&limit=10&offset=0 HTTP/1.1
Host: localhost:8000
```

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| status | string | all | Filter by status: "queued", "processing", "completed", "failed" |
| limit | int | 20 | Max results per page |
| offset | int | 0 | Pagination offset |

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "task_id": "task-1",
      "file_path": "/path/to/file1.pcd",
      "status": "processing",
      "progress": 45,
      "created_at": "2024-10-18T00:00:00Z"
    },
    {
      "task_id": "task-2",
      "file_path": "/path/to/file2.ply",
      "status": "completed",
      "progress": 100,
      "created_at": "2024-10-18T00:10:00Z",
      "completed_at": "2024-10-18T00:25:00Z"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "short error message",
  "details": "detailed error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-10-18T00:00:00Z",
  "request_id": "req-550e8400"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request format |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| `FILE_NOT_FOUND` | 404 | File does not exist |
| `UNSUPPORTED_FORMAT` | 400 | File format not supported |
| `TASK_NOT_FOUND` | 404 | Task ID not found |
| `TASK_FAILED` | 500 | Processing task failed |
| `STORAGE_ERROR` | 500 | Storage service error |
| `DATABASE_ERROR` | 500 | Database connection error |
| `QUEUE_ERROR` | 500 | Message queue error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Example Error Responses

**400 Bad Request:**
```json
{
  "error": "invalid file format",
  "details": "only PCD and PLY formats are supported",
  "code": "UNSUPPORTED_FORMAT"
}
```

**404 Not Found:**
```json
{
  "error": "file not found",
  "details": "file with ID 550e8400 does not exist",
  "code": "FILE_NOT_FOUND"
}
```

**500 Internal Server Error:**
```json
{
  "error": "internal server error",
  "details": "database connection failed",
  "code": "DATABASE_ERROR"
}
```

---

## Rate Limiting

**Current Version:** No rate limiting

**Future:**
- 100 requests per minute per IP
- 1000 requests per hour per IP

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

**429 Too Many Requests:**
```json
{
  "error": "rate limit exceeded",
  "details": "maximum 100 requests per minute",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 45
}
```

---

## Examples

### Example 1: Upload and Process File

```bash
# 1. Upload file
curl -X POST http://localhost:8000/files/upload_file \
  -F "file=@pointcloud.pcd"

# Response:
# {
#   "file_id": "550e8400-e29b-41d4-a716-446655440000",
#   "filename": "pointcloud.pcd",
#   ...
# }

# 2. Start processing
curl -X POST http://localhost:8000/files/process_dynamic \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/path/to/pointcloud.pcd",
    "options": {
      "algorithm": "ransac",
      "threshold": 0.05
    }
  }'

# Response:
# {
#   "task_id": "task-123",
#   "status": "queued",
#   ...
# }

# 3. Poll status
while true; do
  STATUS=$(curl -s http://localhost:8000/files/process_status/task-123 | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    echo "Processing complete!"
    break
  fi
  sleep 5
done

# 4. Download result
curl -X POST http://localhost:8000/files/download \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/cleaned_pointcloud.pcd"}' \
  -o cleaned.pcd
```

### Example 2: Monitor All Tasks

```bash
# Get all processing tasks
curl "http://localhost:8000/files/tasks?status=processing&limit=5"

# Response:
# {
#   "tasks": [
#     {"task_id": "task-1", "progress": 23, ...},
#     {"task_id": "task-2", "progress": 67, ...}
#   ],
#   "total": 2
# }
```

### Example 3: JavaScript/TypeScript

```typescript
// Upload file
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('http://localhost:8000/files/upload_file', {
    method: 'POST',
    body: formData,
  });
  
  return await response.json();
}

// Start processing
async function processFile(filePath: string) {
  const response = await fetch('http://localhost:8000/files/process_dynamic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_path: filePath,
      options: {
        algorithm: 'ransac',
        threshold: 0.05,
      },
    }),
  });
  
  return await response.json();
}

// Poll status
async function waitForCompletion(taskId: string) {
  while (true) {
    const response = await fetch(
      `http://localhost:8000/files/process_status/${taskId}`
    );
    const data = await response.json();
    
    if (data.status === 'completed') {
      return data;
    } else if (data.status === 'failed') {
      throw new Error(data.error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

---

## Versioning

**Current Version:** v1 (implicit)

**Future:** Explicit versioning
```
http://localhost:8000/v1/files/upload_file
http://localhost:8000/v2/files/upload_file
```

---

## Support

- 📧 Email: api@lidarcleaner.app
- 🐛 Issues: [GitHub Issues](https://github.com/lidarcleaner/app/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/lidarcleaner/app/discussions)

