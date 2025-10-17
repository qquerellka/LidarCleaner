# 🏗️ Архитектура LidarCleaner

Подробное описание архитектуры приложения LidarCleaner.

## 📋 Содержание

- [Обзор](#обзор)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Взаимодействие компонентов](#взаимодействие-компонентов)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Производительность](#производительность)

---

## Обзор

LidarCleaner построен на архитектуре **Client-Server** с использованием:
- **Frontend**: Electron + React + Three.js
- **Backend**: Go + PostgreSQL + MinIO + RabbitMQ
- **Communication**: HTTP REST API, IPC

```
┌─────────────────────────────────────────────┐
│           Electron Desktop App              │
│  ┌────────────────────────────────────────┐ │
│  │      Renderer Process (React)          │ │
│  │  ┌──────────┐  ┌─────────┐  ┌───────┐ │ │
│  │  │ UI Layer │  │ 3D View │  │ Redux │ │ │
│  │  └────┬─────┘  └────┬────┘  └───┬───┘ │ │
│  │       └─────────────┴───────────┘     │ │
│  └────────────────┬───────────────────────┘ │
│  ┌────────────────┴───────────────────────┐ │
│  │      Main Process (Node.js)            │ │
│  │  ┌───────┐  ┌─────────┐  ┌──────────┐ │ │
│  │  │  IPC  │  │ File IO │  │ Backend  │ │ │
│  │  │Bridge │  │ Manager │  │  Client  │ │ │
│  │  └───┬───┘  └────┬────┘  └────┬─────┘ │ │
│  └──────┼───────────┼─────────────┼───────┘ │
└─────────┼───────────┼─────────────┼─────────┘
          │           │             │
          │           │        HTTP/REST
          │           │             │
┌─────────┼───────────┼─────────────▼─────────┐
│         │           │      Backend (Go)      │
│         │           │  ┌──────────────────┐  │
│         │           │  │   Gin Server     │  │
│         │           │  │  ┌────────────┐  │  │
│         │           │  │  │  Handlers  │  │  │
│         │           │  │  └──────┬─────┘  │  │
│         │           │  │         │        │  │
│         │           │  │  ┌──────▼─────┐  │  │
│         │           │  │  │  Services  │  │  │
│         │           │  │  └──────┬─────┘  │  │
│         │           │  └─────────┼────────┘  │
│         │           │            │           │
│         │           │  ┌─────────▼────────┐  │
│         │           │  │   PostgreSQL     │  │
│         │           │  │   (Metadata)     │  │
│         │           │  └──────────────────┘  │
│         │           │                        │
│         │           │  ┌──────────────────┐  │
│         │           └─▶│      MinIO       │  │
│         │              │   (S3 Storage)   │  │
│         │              └──────────────────┘  │
│         │                                    │
│         │              ┌──────────────────┐  │
│         └─────────────▶│    RabbitMQ      │  │
│                        │  (Task Queue)    │  │
│                        └────────┬─────────┘  │
│                                 │            │
│                        ┌────────▼─────────┐  │
│                        │   Worker Pool    │  │
│                        │ (CV Processing)  │  │
│                        └──────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Слои приложения

#### 1. Presentation Layer (UI)

**Компоненты:**
- `pages/` - Страницы приложения
- `components/` - Переиспользуемые UI компоненты
- `features/` - Feature-based модули

**Технологии:**
- React 18 (Functional Components + Hooks)
- Mantine UI (Component Library)
- CSS Modules

**Пример структуры:**
```typescript
// components/LoadingOverlay.tsx
export const LoadingOverlay: React.FC = () => {
  const { isLoading, loadingProgress, loadingMessage } = useSelector(
    (state: RootState) => state.ui
  );
  
  return (
    <Modal opened={isLoading}>
      <Progress value={loadingProgress} />
      <Text>{loadingMessage}</Text>
    </Modal>
  );
};
```

#### 2. Business Logic Layer

**Hooks:**
- Custom hooks инкапсулируют бизнес-логику
- Управляют side effects
- Взаимодействуют с Redux store

**Пример:**
```typescript
// hooks/usePointCloudLoader.ts
export const usePointCloudLoader = (scene: THREE.Scene) => {
  const dispatch = useDispatch();
  
  const loadFile = useCallback(async (path: string) => {
    dispatch(uiActions.setLoading({ isLoading: true }));
    
    try {
      const data = await window.api.readFile(path);
      const points = parsePointCloud(data);
      renderPoints(scene, points);
      
      dispatch(uiActions.setPointCount(points.length));
    } catch (error) {
      dispatch(uiActions.setError(error.message));
    } finally {
      dispatch(uiActions.setLoading({ isLoading: false }));
    }
  }, [scene, dispatch]);
  
  return { loadFile };
};
```

#### 3. State Management Layer

**Redux Toolkit Slices:**

```typescript
// store/index.ts
export const store = configureStore({
  reducer: {
    ui: uiReducer,           // UI state (loading, errors)
    scene: sceneReducer,     // 3D scene state
    edit: editReducer,       // Editing state (selection, history)
    backend: backendReducer, // Backend communication
  },
});
```

**Slice пример:**
```typescript
// store/editSlice.ts
export const editSlice = createSlice({
  name: 'edit',
  initialState: {
    selectedIndices: new Set<number>(),
    history: [],
    historyIndex: -1,
    selectionMode: 'box',
    brushSize: 50,
  },
  reducers: {
    setSelection(state, action) {
      state.selectedIndices = action.payload;
    },
    addToHistory(state, action) {
      state.history.push(action.payload);
      state.historyIndex++;
    },
    undo(state) {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        // Apply previous state
      }
    },
  },
});
```

#### 4. 3D Rendering Layer

**Three.js Integration:**

```typescript
// three/Scene3D.tsx
export const Scene3D: React.FC = () => {
  const sceneRef = useRef<THREE.Scene>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  // Initialize scene
  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    
    // Add lights, helpers, etc.
    setupScene(scene);
    
    return () => cleanup();
  }, []);
  
  // Animation loop
  useEffect(() => {
    const animate = () => {
      requestAnimationFrame(animate);
      rendererRef.current?.render(
        sceneRef.current!,
        cameraRef.current!
      );
    };
    animate();
  }, []);
  
  return <canvas ref={canvasRef} />;
};
```

**Оптимизации:**
- Point Cloud LOD (Level of Detail)
- Frustum Culling
- Октодерево для быстрого поиска
- BufferGeometry для минимизации памяти

#### 5. IPC Communication Layer

**Main Process:**
```typescript
// main/ipc/backend.ts
export function registerBackendIpc() {
  ipcMain.handle('backend:processFile', async (_, filePath) => {
    try {
      const response = await fetch('http://localhost:8000/process', {
        method: 'POST',
        body: JSON.stringify({ filePath }),
      });
      return await response.json();
    } catch (error) {
      throw new Error(`Backend error: ${error.message}`);
    }
  });
}
```

**Renderer Process:**
```typescript
// renderer/api.ts
export const api = {
  processFile: (filePath: string) => 
    ipcRenderer.invoke('backend:processFile', filePath),
};
```

---

## Backend Architecture

### Слои приложения

#### 1. HTTP Layer (Handlers)

```go
// internal/handlers/files.go
type FileHandler struct {
    fileService *services.FileService
    logger      *logger.Logger
}

func (h *FileHandler) UploadFile(c *gin.Context) {
    file, err := c.FormFile("file")
    if err != nil {
        c.JSON(400, gin.H{"error": "invalid file"})
        return
    }
    
    result, err := h.fileService.Upload(c.Request.Context(), file)
    if err != nil {
        h.logger.Error("upload failed", "error", err)
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, result)
}
```

#### 2. Service Layer

```go
// internal/services/file_service.go
type FileService struct {
    storage   Storage
    queue     Queue
    db        *sql.DB
    logger    *logger.Logger
}

func (s *FileService) Upload(ctx context.Context, file *File) (*UploadResult, error) {
    // Validate file
    if err := s.validateFile(file); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }
    
    // Save to MinIO
    objectKey, err := s.storage.Put(ctx, file)
    if err != nil {
        return nil, fmt.Errorf("storage error: %w", err)
    }
    
    // Save metadata to DB
    fileID, err := s.db.InsertFile(ctx, &FileMetadata{
        FileName: file.Name,
        ObjectKey: objectKey,
        Size: file.Size,
    })
    if err != nil {
        return nil, fmt.Errorf("db error: %w", err)
    }
    
    // Publish to queue for processing
    if err := s.queue.Publish(ctx, &ProcessMessage{
        FileID: fileID,
        ObjectKey: objectKey,
    }); err != nil {
        s.logger.Warn("queue publish failed", "error", err)
    }
    
    return &UploadResult{FileID: fileID}, nil
}
```

#### 3. Data Access Layer

```go
// internal/repository/file_repo.go
type FileRepository struct {
    db *sql.DB
}

func (r *FileRepository) InsertFile(ctx context.Context, meta *FileMetadata) (uuid.UUID, error) {
    query := `
        INSERT INTO files (filename, object_key, size, uploaded_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
    `
    
    var id uuid.UUID
    err := r.db.QueryRowContext(ctx, query,
        meta.FileName, meta.ObjectKey, meta.Size,
    ).Scan(&id)
    
    return id, err
}
```

#### 4. Worker Layer

```go
// internal/workers/processor.go
type ProcessorWorker struct {
    queue    Queue
    storage  Storage
    cvEngine CVEngine
    logger   *logger.Logger
}

func (w *ProcessorWorker) Start(ctx context.Context) error {
    return w.queue.Consume(ctx, func(msg *ProcessMessage) error {
        // Download file from MinIO
        data, err := w.storage.Get(ctx, msg.ObjectKey)
        if err != nil {
            return fmt.Errorf("download failed: %w", err)
        }
        
        // Process with CV engine
        result, err := w.cvEngine.RemoveDynamic(ctx, data)
        if err != nil {
            return fmt.Errorf("processing failed: %w", err)
        }
        
        // Upload result
        resultKey, err := w.storage.Put(ctx, result)
        if err != nil {
            return fmt.Errorf("upload result failed: %w", err)
        }
        
        w.logger.Info("processing complete", 
            "fileID", msg.FileID,
            "resultKey", resultKey,
        )
        
        return nil
    })
}
```

---

## Взаимодействие компонентов

### Сценарий 1: Загрузка файла

```
1. User clicks "Open File"
   │
2. FileLoader component calls window.api.openPCD()
   │
3. IPC → Main Process → Opens file dialog
   │
4. User selects file → Returns path
   │
5. IPC → Renderer → Dispatches setFilePath(path)
   │
6. Scene3D useEffect triggers → Calls loadPointCloudFromPath()
   │
7. Reads file via window.api.readFile(path)
   │
8. Parses PCD/PLY data
   │
9. Creates Three.js Points object
   │
10. Adds to scene → Renders
    │
11. Uploads to backend via window.api.uploadFile()
    │
12. Backend saves to MinIO + PostgreSQL
    │
13. Returns file_id to frontend
```

### Сценарий 2: Обработка файла (Remove Dynamic)

```
1. User clicks "Auto Clean"
   │
2. EditControls dispatches backend/processDynamic
   │
3. Frontend calls window.api.processDynamic(filePath)
   │
4. IPC → Main Process → HTTP POST /files/process_dynamic
   │
5. Backend:
   ├─ Validates file
   ├─ Creates task in DB
   ├─ Publishes message to RabbitMQ
   └─ Returns task_id
   │
6. Worker picks up message
   │
7. Downloads file from MinIO
   │
8. Runs CV algorithm (removes dynamic objects)
   │
9. Saves result to MinIO
   │
10. Updates task status in DB
    │
11. Frontend polls /process_status/:task_id
    │
12. When complete, downloads result file
    │
13. Loads cleaned point cloud into scene
```

### Сценарий 3: Выделение и удаление точек

```
1. User selects "Box Selection" mode
   │
2. User drags mouse → Creates selection box
   │
3. handleMouseUp calculates selected points:
   ├─ Projects screen coords to 3D frustum
   ├─ Tests each point for intersection
   └─ Returns Set<number> of indices
   │
4. Dispatches setSelection(indices)
   │
5. Updates point colors in geometry
   │
6. User presses Delete key
   │
7. onKeyDown → handleDeleteSelected()
   │
8. Creates history snapshot
   │
9. Marks points as deleted (hiddenIndices)
   │
10. Updates colors → Renders
```

---

## Data Flow

### State Flow (Redux)

```
Action → Reducer → State → Selector → Component → Re-render
  ↑                                                    │
  └────────────────────────────────────────────────────┘
              User Interaction / Side Effect
```

### File Data Flow

```
Disk File → IPC → ArrayBuffer → Parser → Float32Array
                                            │
                                            ↓
                               THREE.BufferGeometry
                                            │
                                            ↓
                                    THREE.Points
                                            │
                                            ↓
                                     THREE.Scene
                                            │
                                            ↓
                                    WebGL Renderer
```

---

## State Management

### State Schema

```typescript
interface RootState {
  ui: {
    filePath: string | null;
    pointCount: number;
    isLoading: boolean;
    loadingProgress: number;
    loadingMessage: string;
    recentFiles: RecentFile[];
  };
  
  scene: {
    backgroundColor: string;
    showAxes: boolean;
    showGrid: boolean;
    showBoundingBox: boolean;
    pointSize: number;
    colorMode: 'vertex' | 'fixed' | 'height';
    fixedColor: string;
    measurementMode: boolean;
    measurementPoints: MeasurementPoint[];
  };
  
  edit: {
    selectionMode: 'box' | 'brush';
    selectedIndices: Set<number>;
    hiddenIndices: Set<number>;
    deletedIndices: Set<number>;
    history: HistoryEntry[];
    historyIndex: number;
    brushSize: number;
  };
  
  backend: {
    isProcessing: boolean;
    progress: number;
    taskId: string | null;
  };
}
```

---

## Производительность

### Frontend Оптимизации

**1. Point Cloud Rendering:**
- Use BufferGeometry (не Geometry)
- Limit point count for preview (downsample)
- Use octree for raycasting
- Implement LOD (Level of Detail)

**2. Selection Optimization:**
```typescript
// Bad: O(n) every frame
points.forEach(point => {
  if (isInFrustum(point)) {
    selectPoint(point);
  }
});

// Good: O(log n) with octree
const octree = new Octree(points);
const selected = octree.search(frustum);
```

**3. Memory Management:**
- Dispose geometries and materials
- Clear Three.js objects properly
- Use WeakMap for caches
- Limit history size

**4. React Optimization:**
- Use React.memo for expensive components
- useMemo/useCallback for expensive calculations
- Virtualization for long lists
- Code splitting with React.lazy

### Backend Оптимизации

**1. Database:**
- Indexes on frequently queried columns
- Connection pooling
- Prepared statements
- Query optimization

**2. Storage:**
- Stream large files (не загружать в память)
- Use presigned URLs
- Compress files before upload
- Cache frequently accessed files

**3. Worker Pool:**
- Limit concurrent jobs
- Priority queue for tasks
- Graceful shutdown
- Health checks

---

## Безопасность

### Frontend
- CSP (Content Security Policy)
- Validate user input
- Sanitize file paths
- Limit file sizes

### Backend
- JWT authentication (будущее)
- Rate limiting
- Input validation
- SQL injection protection (prepared statements)
- CORS configuration

---

## Мониторинг

### Metrics
- Point cloud load time
- Rendering FPS
- Memory usage
- Backend response time
- Queue depth

### Logging
- Structured logging (JSON)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Correlation IDs
- Error tracking

---

Эта архитектура обеспечивает:
- ✅ Масштабируемость
- ✅ Maintainability
- ✅ Производительность
- ✅ Testability
- ✅ Расширяемость

