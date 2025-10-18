# 🛠️ Development Guide

Полное руководство по разработке LidarCleaner.

## 📋 Содержание

- [Начало работы](#начало-работы)
- [Настройка IDE](#настройка-ide)
- [Структура кода](#структура-кода)
- [Workflow](#workflow)
- [Debugging](#debugging)
- [Testing](#testing)
- [Performance](#performance)
- [Best Practices](#best-practices)

---

## Начало работы

### Клонирование репозитория

```bash
git clone https://github.com/lidarcleaner/app.git
cd LidarCleaner
```

### Frontend Setup

```bash
cd frontend
npm install

# Запуск в dev режиме
npm run dev

# Альтернативный запуск (каждый процесс отдельно)
npm run dev:renderer  # Vite dev server
npm run dev:main      # Electron main process
npm run dev:preload   # Preload script
npm run dev:electron  # Electron app
```

### Backend Setup

```bash
cd backend

# Запуск через Docker Compose
docker-compose up -d

# Или локально (требуется настройка .env)
go run cmd/app/main.go
```

### Переменные окружения

**Frontend** (.env.local):
```bash
BACKEND_URL=http://localhost:8000
VITE_DEV_SERVER_PORT=5173
```

**Backend** (.env):
```bash
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=root
MINIO_SECRET_KEY=minio_password
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

---

## Настройка IDE

### VS Code (рекомендуется)

#### Расширения

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "golang.go",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "christian-kohler.path-intellisense"
  ]
}
```

#### Settings (.vscode/settings.json)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "typescriptreact"
  ],
  "go.useLanguageServer": true,
  "go.lintTool": "golangci-lint",
  "go.lintOnSave": "workspace"
}
```

#### Launch Configuration (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:electron"],
      "outputCapture": "std"
    },
    {
      "name": "Go: Backend",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}/backend/cmd/app",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/postgres"
      }
    }
  ]
}
```

### WebStorm

1. Открыть `frontend/` как проект
2. Включить TypeScript support
3. Настроить ESLint и Prettier
4. Добавить Run Configuration для `npm run dev`

### GoLand

1. Открыть `backend/` как проект
2. Включить Go Modules
3. Настроить Run Configuration для `main.go`

---

## Структура кода

### Frontend Architecture

```
frontend/src/
├── main/                   # Electron Main Process
│   ├── index.ts           # Entry point
│   ├── window.ts          # Window management
│   ├── menu.ts            # Application menu
│   ├── logger.ts          # Logging
│   └── ipc/               # IPC handlers
│       ├── dialogs.ts     # File dialogs
│       ├── backend.ts     # Backend communication
│       ├── fs.ts          # File system operations
│       └── net.ts         # Network requests
│
└── renderer/              # React App
    ├── main.tsx          # React entry point
    ├── App.tsx           # Root component
    ├── components/       # Reusable UI components
    │   ├── LoadingOverlay.tsx
    │   ├── HotkeysModal.tsx
    │   ├── QuickActionsToolbar.tsx
    │   └── Minimap.tsx
    ├── features/         # Feature modules
    │   ├── FileLoader/
    │   │   └── FileLoader.tsx
    │   └── SceneControls/
    │       ├── SceneControls.tsx
    │       ├── EditControls.tsx
    │       ├── AutoCleanButton.tsx
    │       └── ExportButtons.tsx
    ├── pages/            # Page components
    │   └── Home.tsx
    ├── store/            # Redux store
    │   ├── index.ts
    │   ├── uiSlice.ts
    │   ├── sceneSlice.ts
    │   └── editSlice.ts
    ├── three/            # Three.js integration
    │   ├── Scene3D.tsx
    │   └── boxSelection.ts
    ├── styles/           # Global styles
    │   └── index.css
    └── renderer.d.ts     # Type definitions
```

### Backend Architecture

```
backend/
├── cmd/
│   └── app/
│       └── main.go           # Entry point
├── internal/
│   ├── handlers/             # HTTP handlers
│   │   ├── health.go
│   │   ├── files.go
│   │   └── process.go
│   ├── service/              # Business logic
│   │   └── usecase/
│   │       └── service.go
│   ├── repository/           # Data access
│   │   ├── postgres/
│   │   │   └── postgres.go
│   │   ├── minio/
│   │   │   └── client.go
│   │   └── storage.go
│   └── domain/               # Domain models
│       └── errors/
│           └── errors.go
├── migrations/               # DB migrations
│   ├── 000001_init_.up.sql
│   └── 000001_init_.down.sql
└── config/
    └── config.go            # Configuration
```

---

## Workflow

### Feature Development

1. **Создайте ветку**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Разработайте feature**
   - Пишите код
   - Добавляйте тесты
   - Обновляйте документацию

3. **Проверьте код**
   ```bash
   # Frontend
   cd frontend
   npm run lint
   npm run test
   
   # Backend
   cd backend
   go test ./...
   go vet ./...
   ```

4. **Коммит**
   ```bash
   git add .
   git commit -m "feat: add polygon selection tool"
   ```

5. **Push и создайте PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Hot Reload

**Frontend:**
- Vite автоматически перезагружает при изменении React кода
- esbuild пересобирает main/preload при изменениях
- Electron перезапускается автоматически

**Backend:**
```bash
# Используйте air для hot reload
go install github.com/cosmtrek/air@latest
cd backend
air
```

---

## Debugging

### Frontend Debugging

#### Chrome DevTools

```typescript
// В коде renderer
debugger; // Остановится в DevTools

console.log('Debug info:', data);
console.table(array);
console.time('operation');
// ... code
console.timeEnd('operation');
```

#### Electron Main Process

```bash
# Запустите с флагом inspect
npm run dev:electron -- --inspect=5858

# Откройте chrome://inspect в Chrome
# Подключитесь к процессу
```

#### VS Code Debugging

1. Установите breakpoints в коде
2. Запустите "Electron: Main" configuration
3. Debugger остановится на breakpoints

### Backend Debugging

#### Delve (Go debugger)

```bash
# Установка
go install github.com/go-delve/delve/cmd/dlv@latest

# Запуск
cd backend
dlv debug cmd/app/main.go
```

#### VS Code Debugging

1. Установите breakpoints
2. Запустите "Go: Backend" configuration
3. Используйте debug panel

#### Logging

```go
// Структурированный логгинг
log.Info("processing file",
    "fileID", fileID,
    "size", size,
)

log.Error("failed to upload",
    "error", err,
    "path", path,
)
```

---

## Testing

### Frontend Tests

#### Unit Tests (Vitest)

```typescript
// FileLoader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileLoader } from './FileLoader';

describe('FileLoader', () => {
  it('renders open button', () => {
    render(<FileLoader />);
    expect(screen.getByText('Open PCD File')).toBeInTheDocument();
  });
  
  it('validates file extension', () => {
    const result = validateFile('test.pcd');
    expect(result.valid).toBe(true);
    
    const invalid = validateFile('test.txt');
    expect(invalid.valid).toBe(false);
  });
});
```

#### Component Tests

```typescript
// Scene3D.test.tsx
describe('Scene3D', () => {
  it('initializes Three.js scene', () => {
    const { container } = render(<Scene3D />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
  
  it('loads point cloud', async () => {
    const { rerender } = render(<Scene3D filePath={null} />);
    
    rerender(<Scene3D filePath="/test.pcd" />);
    
    await waitFor(() => {
      expect(screen.getByText(/points loaded/i)).toBeInTheDocument();
    });
  });
});
```

#### E2E Tests (Playwright)

```typescript
// e2e/load-file.spec.ts
import { test, expect } from '@playwright/test';

test('load and display point cloud', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Click open button
  await page.click('button:has-text("Open PCD File")');
  
  // Select file (requires mocking file dialog)
  await page.setInputFiles('input[type="file"]', 'test.pcd');
  
  // Wait for loading
  await page.waitForSelector('canvas');
  
  // Verify point count
  await expect(page.locator('text=/\\d+ points/')).toBeVisible();
});
```

### Backend Tests

#### Unit Tests

```go
// handlers_test.go
func TestUploadFile(t *testing.T) {
    // Setup
    mockStorage := &MockStorage{}
    handler := NewFileHandler(mockStorage)
    
    // Create request
    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)
    part, _ := writer.CreateFormFile("file", "test.pcd")
    part.Write([]byte("test data"))
    writer.Close()
    
    req := httptest.NewRequest("POST", "/upload", body)
    req.Header.Set("Content-Type", writer.FormDataContentType())
    w := httptest.NewRecorder()
    
    // Execute
    handler.ServeHTTP(w, req)
    
    // Assert
    assert.Equal(t, 200, w.Code)
    assert.Contains(t, w.Body.String(), "file_id")
}
```

#### Integration Tests

```go
// integration_test.go
func TestFileUploadFlow(t *testing.T) {
    // Start test server
    server := setupTestServer(t)
    defer server.Close()
    
    // Upload file
    resp := uploadFile(server.URL, "test.pcd")
    require.Equal(t, 200, resp.StatusCode)
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fileID := result["file_id"].(string)
    
    // Verify in database
    file, err := testDB.GetFile(fileID)
    require.NoError(t, err)
    assert.Equal(t, "test.pcd", file.Name)
}
```

### Running Tests

```bash
# Frontend
cd frontend
npm run test              # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Backend
cd backend
go test ./...                    # All tests
go test -v ./internal/handlers/  # Specific package
go test -cover ./...            # With coverage
go test -race ./...             # Race detection
```

---

## Performance

### Profiling Frontend

#### Chrome DevTools Performance Tab

1. Открыть DevTools → Performance
2. Начать запись
3. Выполнить действие (загрузка файла, выделение)
4. Остановить запись
5. Анализировать flame graph

#### React DevTools Profiler

```typescript
import { Profiler } from 'react';

<Profiler id="Scene3D" onRender={onRenderCallback}>
  <Scene3D />
</Profiler>

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  console.log(`${id} took ${actualDuration}ms to render`);
}
```

#### Memory Profiling

```typescript
// В начале
const before = performance.memory.usedJSHeapSize;

// ... операции

// В конце
const after = performance.memory.usedJSHeapSize;
console.log(`Memory used: ${(after - before) / 1024 / 1024}MB`);
```

### Profiling Backend

#### CPU Profiling

```bash
# Запустить с профилированием
go test -cpuprofile=cpu.prof -bench=.

# Анализ
go tool pprof cpu.prof
```

#### Memory Profiling

```bash
# Memory profile
go test -memprofile=mem.prof -bench=.

# Анализ
go tool pprof mem.prof
```

#### Live Profiling

```go
// Добавить в main.go
import _ "net/http/pprof"

go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

```bash
# Просмотр в браузере
open http://localhost:6060/debug/pprof/

# CPU profile
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
```

---

## Best Practices

### Code Organization

✅ **DO:**
- Группируйте связанный код в модули
- Используйте barrel exports (index.ts)
- Разделяйте бизнес-логику и UI
- Держите компоненты маленькими (<200 строк)

❌ **DON'T:**
- Не создавайте God Objects
- Не смешивайте concerns
- Не дублируйте код

### Performance

✅ **DO:**
- Мемоизируйте дорогие вычисления
- Используйте useMemo/useCallback
- Виртуализируйте длинные списки
- Dispose Three.js объекты

❌ **DON'T:**
- Не создавайте объекты в render
- Не используйте inline functions в props
- Не забывайте чистить event listeners

### Error Handling

✅ **DO:**
```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  showNotification({
    type: 'error',
    message: 'Operation failed. Please try again.',
  });
}
```

❌ **DON'T:**
```typescript
try {
  await riskyOperation();
} catch (error) {
  console.log('error'); // Too vague
  // Silent failure
}
```

### Commits

✅ **DO:**
```bash
feat(selection): add polygon selection tool

- Implement polygon drawing
- Add point-in-polygon test
- Update hotkeys documentation

Closes #123
```

❌ **DON'T:**
```bash
update code
fix stuff
WIP
```

---

## Полезные команды

### Frontend

```bash
# Development
npm run dev                    # Full dev environment
npm run dev:renderer          # Only Vite
npm run dev:electron          # Only Electron

# Building
npm run build                 # Build all
npm run build:renderer        # Build React app
npm run build:main            # Build Electron main
npm run preview               # Preview production build

# Code Quality
npm run lint                  # ESLint
npm run format                # Prettier
npm run type-check            # TypeScript

# Testing
npm run test                  # Run tests
npm run test:watch           # Watch mode
npm run test:coverage        # With coverage

# Packaging
npm run package              # Create distributable
```

### Backend

```bash
# Development
go run cmd/app/main.go       # Run directly
air                          # Hot reload

# Building
go build -o bin/server cmd/app/main.go

# Testing
go test ./...                # All tests
go test -v ./internal/...    # Verbose
go test -cover ./...         # Coverage

# Code Quality
go fmt ./...                 # Format
go vet ./...                 # Vet
golangci-lint run           # Linter

# Database
migrate -path migrations -database $DATABASE_URL up
migrate -path migrations -database $DATABASE_URL down

# Docker
docker-compose up -d         # Start services
docker-compose logs -f app   # View logs
docker-compose down          # Stop services
```

---

## Troubleshooting

См. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) для подробного руководства.

---

## Resources

- [Electron Docs](https://www.electronjs.org/docs/latest)
- [React Docs](https://react.dev/)
- [Three.js Docs](https://threejs.org/docs/)
- [Go by Example](https://gobyexample.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

Удачной разработки! 🚀

