# 🤝 Contributing to LidarCleaner

Спасибо за интерес к LidarCleaner! Мы приветствуем любой вклад от сообщества.

## 📋 Содержание

- [Code of Conduct](#code-of-conduct)
- [Как начать](#как-начать)
- [Процесс разработки](#процесс-разработки)
- [Стиль кода](#стиль-кода)
- [Тестирование](#тестирование)
- [Документация](#документация)
- [Коммиты](#коммиты)
- [Pull Requests](#pull-requests)

---

## Code of Conduct

Этот проект придерживается кодекса поведения. Участвуя, вы соглашаетесь соблюдать его условия:

- Будьте уважительны к другим участникам
- Принимайте конструктивную критику
- Фокусируйтесь на том, что лучше для сообщества
- Проявляйте эмпатию к другим участникам

---

## Как начать

### 1. Настройка окружения

```bash
# Клонируйте репозиторий
git clone https://github.com/lidarcleaner/app.git
cd LidarCleaner

# Установите зависимости
cd frontend
npm install

# Запустите в dev режиме
cd ../
./start-lidarcleaner.sh
```

### 2. Найдите задачу

- Проверьте [Issues](https://github.com/lidarcleaner/app/issues) на наличие открытых задач
- Ищите метки `good first issue` или `help wanted`
- Спросите в комментариях, если хотите взять задачу

### 3. Создайте ветку

```bash
git checkout -b feature/your-feature-name
```

---

## Процесс разработки

### Workflow

1. **Fork** репозиторий
2. **Clone** свой fork
3. **Branch** создайте feature branch
4. **Code** реализуйте изменения
5. **Test** протестируйте изменения
6. **Commit** сделайте коммиты
7. **Push** отправьте в свой fork
8. **PR** создайте Pull Request

### Типы изменений

- **Feature** - новая функциональность
- **Bug Fix** - исправление ошибки
- **Refactor** - рефакторинг кода
- **Docs** - изменения в документации
- **Style** - форматирование, отступы
- **Test** - добавление тестов
- **Chore** - обновление зависимостей, конфигурации

---

## Стиль кода

### Frontend (TypeScript/React)

```typescript
// ✅ Хорошо
interface PointCloudProps {
  filePath: string;
  onLoad?: (points: number) => void;
}

export const PointCloud: React.FC<PointCloudProps> = ({ filePath, onLoad }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    loadPointCloud(filePath);
  }, [filePath]);
  
  return <Canvas>{/* ... */}</Canvas>;
};

// ❌ Плохо
export const PointCloud = (props: any) => {
  let loading = false;
  // ...
};
```

**Правила:**
- Используйте TypeScript strict mode
- Именуйте компоненты в PascalCase
- Используйте функциональные компоненты + hooks
- Избегайте `any`, используйте конкретные типы
- Комментируйте сложную логику

### Backend (Go)

```go
// ✅ Хорошо
type FileService struct {
    storage Storage
    logger  *Logger
}

func (s *FileService) UploadFile(ctx context.Context, file *File) error {
    if err := s.validateFile(file); err != nil {
        return fmt.Errorf("validate file: %w", err)
    }
    
    return s.storage.Save(ctx, file)
}

// ❌ Плохо
func uploadFile(f interface{}) {
    // ...
}
```

**Правила:**
- Следуйте [Effective Go](https://golang.org/doc/effective_go)
- Используйте `gofmt` для форматирования
- Обрабатывайте все ошибки
- Добавляйте контекст к ошибкам
- Пишите godoc комментарии

### Именование

```typescript
// Переменные и функции - camelCase
const pointCount = 1000;
function loadPointCloud() {}

// Константы - UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 2_000_000_000;

// Типы и интерфейсы - PascalCase
interface PointCloudData {}
type SceneMode = 'edit' | 'view';

// Приватные поля - с префиксом _
class Scene {
  private _initialized = false;
}
```
---

## Документация

### Комментарии в коде

```typescript
/**
 * Загружает облако точек из файла
 * @param filePath - Путь к PCD или PLY файлу
 * @param options - Опции загрузки
 * @returns Promise с данными облака точек
 * @throws {Error} Если файл не найден или имеет неверный формат
 */
async function loadPointCloud(
  filePath: string,
  options?: LoadOptions
): Promise<PointCloudData> {
  // ...
}
```

### README обновления

Если вы добавляете новую функцию:
- Обновите README.md
- Добавьте примеры использования
- Обновите список горячих клавиш (если применимо)
- Добавьте скриншоты/гифки

### Changelog

Добавьте запись в CHANGELOG.md:

```markdown
## [Unreleased]

### Added
- Новая функция измерения углов (#123)
- Поддержка LAZ формата (#124)

### Fixed
- Исправлена утечка памяти при загрузке больших файлов (#125)
```

---

## Коммиты

### Формат коммитов

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Типы

- `feat`: Новая функция
- `fix`: Исправление бага
- `docs`: Документация
- `style`: Форматирование
- `refactor`: Рефакторинг
- `test`: Тесты
- `chore`: Обслуживание

### Примеры

```bash
# Хорошо
feat(selection): add polygon selection tool
fix(renderer): fix memory leak in point cloud cleanup
docs(api): update file upload endpoint documentation

# Плохо
update code
fix bug
changes
```

### Детальные коммиты

```
feat(selection): add polygon selection tool

- Implement polygon drawing on canvas
- Add point inclusion test using ray casting
- Add hotkey 'P' for polygon mode
- Update selection state in Redux

Closes #123
```

---

## Pull Requests

### Перед созданием PR

- [ ] Код проходит линтинг (`npm run lint`)
- [ ] Все тесты проходят (`npm run test`)
- [ ] Код отформатирован
- [ ] Документация обновлена
- [ ] CHANGELOG.md обновлён
- [ ] Нет конфликтов с main
- [ ] Коммиты чистые и логичные

### Шаблон PR

```markdown
## Описание
Краткое описание изменений

## Тип изменения
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Тестирование
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Edge cases tested

## Скриншоты (если применимо)
![Screenshot](url)

## Checklist
- [ ] Код следует стилю проекта
- [ ] Документация обновлена
- [ ] Нет предупреждений линтера
- [ ] Тесты проходят
```

### Review процесс

1. **Автоматические проверки** - CI/CD пайплайн
2. **Code review** - минимум 1 approver
3. **Testing** - мантейнеры проверяют функционал
4. **Merge** - squash and merge в main

### После merge

- Ваша ветка будет удалена
- Изменения попадут в следующий релиз
- Вы будете упомянуты в CHANGELOG

