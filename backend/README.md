# LidarCleaner Backend

Go HTTP server for processing LiDAR point clouds with CV algorithms.

## 🚀 Quick Start

### Docker Compose (рекомендуется)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Local Development

```bash
# Install dependencies
go mod download

# Run migrations
migrate -path migrations -database $DATABASE_URL up

# Start server
go run cmd/app/main.go
```

## 📦 Services

### Main Services

- **Go HTTP Server** (port 8000) - Main API
- **PostgreSQL** (port 5432) - Database
- **MinIO** (port 9000, UI: 9001) - Object storage
- **RabbitMQ** (port 5672, UI: 15672) - Message queue

### Endpoints

- `GET /health` - Health check
- `POST /files/upload_file` - Upload PCD/PLY file
- `POST /files/download` - Download file
- `POST /files/process_dynamic` - Process file (remove dynamic objects)
- `GET /files/process_status/:task_id` - Get processing status
- `DELETE /files/:file_id` - Delete file

See [API.md](../API.md) for full documentation.

## 🏗️ Architecture

```
backend/
├── cmd/
│   └── app/
│       └── main.go           # Entry point
│
├── internal/
│   ├── handlers/             # HTTP handlers
│   │   ├── handlers.go
│   │   ├── dto.go
│   │   └── responses/
│   │
│   ├── service/              # Business logic
│   │   └── usecase/
│   │       └── service.go
│   │
│   ├── repository/           # Data access
│   │   ├── storage.go
│   │   ├── postgres/
│   │   │   └── postgres.go
│   │   └── minio/
│   │       └── client.go
│   │
│   └── domain/               # Domain models
│       └── errors/
│           └── errors.go
│
├── config/
│   └── config.go            # Configuration
│
├── migrations/              # Database migrations
│   ├── 000001_init_.up.sql
│   └── 000001_init_.down.sql
│
├── cv_worker/               # Computer vision worker
│   ├── worker.py
│   └── Pointnet_Pointnet2_pytorch/
│
├── docker-compose.yml
├── Dockerfile
└── go.mod
```

## 🔧 Tech Stack

- **Go** 1.23 - Backend language
- **Gin** - HTTP framework
- **PostgreSQL** 15 - Database
- **MinIO** - S3-compatible storage
- **RabbitMQ** - Message queue
- **Docker** - Containerization

## 📝 Configuration

### Environment Variables

Create `.env` file:

```bash
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres?sslmode=disable
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=root
MINIO_SECRET_KEY=minio_password
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
```

### Docker Compose

Edit `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres
      # ...
```

## 🧪 Testing

```bash
# Run all tests
go test ./...

# With coverage
go test -cover ./...

# Race detection
go test -race ./...

# Verbose
go test -v ./...

# Specific package
go test ./internal/handlers/
```

## 🗄️ Database

### Migrations

```bash
# Install migrate tool
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Run migrations
migrate -path migrations -database $DATABASE_URL up

# Rollback
migrate -path migrations -database $DATABASE_URL down

# Create new migration
migrate create -ext sql -dir migrations -seq <name>
```

### Direct access

```bash
# PostgreSQL
docker exec -it backend_db_1 psql -U postgres

# MinIO console
open http://localhost:9001
# Login: root / minio_password

# RabbitMQ management
open http://localhost:15672
# Login: guest / guest
```

## 🐛 Debugging

### Logs

```bash
# View logs
docker-compose logs -f app

# Save to file
docker-compose logs app > backend.log
```

### Delve Debugger

```bash
# Install
go install github.com/go-delve/delve/cmd/dlv@latest

# Debug
dlv debug cmd/app/main.go
```

### Profiling

```bash
# Add to main.go
import _ "net/http/pprof"

go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()

# View in browser
open http://localhost:6060/debug/pprof/
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8000/health
```

### Metrics (planned)

- Prometheus metrics endpoint
- Grafana dashboards

## 🚀 Deployment

### Production Build

```bash
# Build binary
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/server cmd/app/main.go

# Build Docker image
docker build -t lidarcleaner-backend:latest .

# Run
docker run -p 8000:8000 --env-file .env lidarcleaner-backend:latest
```

### Docker Compose Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🔐 Security

- Input validation
- SQL injection protection (prepared statements)
- Rate limiting (planned)
- JWT authentication (planned)

## 📚 Documentation

- [Main README](../README.md)
- [API Documentation](../API.md)
- [Architecture](../ARCHITECTURE.md)
- [Development Guide](../DEVELOPMENT.md)

## 🐛 Troubleshooting

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues.

## 📄 License

MIT - See [LICENSE](../LICENSE)

