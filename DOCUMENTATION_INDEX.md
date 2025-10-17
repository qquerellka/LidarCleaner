# 📚 Documentation Index

Полный индекс документации проекта LidarCleaner.

---

## 🌟 Основная документация

### [README.md](README.md)
**Главная страница проекта**
- Обзор проекта
- Быстрый старт
- Возможности
- Горячие клавиши
- Roadmap

### [CHANGELOG.md](CHANGELOG.md)
**История изменений**
- Все версии и их изменения
- Типы изменений (Added, Fixed, Changed, etc.)

### [LICENSE](LICENSE)
**Лицензия MIT**
- Условия использования

---

## 👨‍💻 Разработка

### [CONTRIBUTING.md](CONTRIBUTING.md)
**Руководство для contributors**
- Code of Conduct
- Процесс разработки
- Стиль кода (TypeScript, Go)
- Тестирование
- Коммиты (Conventional Commits)
- Pull Requests

### [DEVELOPMENT.md](DEVELOPMENT.md)
**Руководство для разработчиков**
- Настройка окружения
- Настройка IDE (VS Code, WebStorm, GoLand)
- Структура кода
- Workflow
- Debugging (Frontend и Backend)
- Testing (Unit, Integration, E2E)
- Performance profiling
- Best Practices

### [ARCHITECTURE.md](ARCHITECTURE.md)
**Архитектура приложения**
- Обзор системы
- Frontend Architecture (слои, Three.js, Redux)
- Backend Architecture (слои, Go services)
- Взаимодействие компонентов
- Data Flow
- State Management
- Производительность
- Безопасность

---

## 🌐 API

### [API.md](API.md)
**REST API документация**
- Endpoints (Health, Files, Processing)
- Request/Response форматы
- Error Handling
- Rate Limiting
- Examples (curl, JavaScript/TypeScript)

---

## ❓ Помощь и поддержка

### [FAQ.md](FAQ.md)
**Часто задаваемые вопросы**
- Общие вопросы
- Установка и запуск
- Работа с файлами
- Редактирование
- Производительность
- AI-обработка
- Экспорт и сохранение
- Troubleshooting

### [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
**Решение проблем**
- Проблемы с Backend
- Проблемы с Frontend
- Проблемы с Electron
- Проблемы с 3D рендерингом
- Проблемы с производительностью
- Проблемы с Docker
- Проблемы с сборкой
- Логи для диагностики

---

## 📁 Локальная документация

### Frontend

**[frontend/README.md](frontend/README.md)**
- Quick Start
- Scripts (dev, build, package)
- Architecture
- Tech Stack
- Debugging
- Packaging

### Backend

**[backend/README.md](backend/README.md)**
- Quick Start
- Services (PostgreSQL, MinIO, RabbitMQ)
- Endpoints
- Architecture
- Testing
- Database migrations
- Monitoring

---

## 🐙 GitHub

### Issue Templates

**.github/ISSUE_TEMPLATE/**
- **[bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md)** - Шаблон для багов
- **[feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md)** - Шаблон для features
- **[question.md](.github/ISSUE_TEMPLATE/question.md)** - Шаблон для вопросов

### Pull Request Template

**[.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)**
- Описание изменений
- Тип изменения
- Тестирование
- Checklist

### Workflows

**.github/workflows/**
- **[ci.yml](.github/workflows/ci.yml)** - CI/CD пайплайн
- **[release.yml](.github/workflows/release.yml)** - Автоматический релиз

---

## ⚙️ Конфигурация

### Root Level

- **[.gitignore](.gitignore)** - Git ignore patterns
- **[.dockerignore](.dockerignore)** - Docker ignore patterns
- **[.editorconfig](.editorconfig)** - Editor config
- **[.prettierrc](.prettierrc)** - Prettier config
- **[.prettierignore](.prettierignore)** - Prettier ignore
- **[.github/markdown-link-check-config.json](.github/markdown-link-check-config.json)** - Markdown link checker config

### Frontend

- **[frontend/tsconfig.json](frontend/tsconfig.json)** - TypeScript base config
- **[frontend/tsconfig.app.json](frontend/tsconfig.app.json)** - TypeScript renderer config
- **[frontend/tsconfig.node.json](frontend/tsconfig.node.json)** - TypeScript node config
- **[frontend/vite.config.ts](frontend/vite.config.ts)** - Vite config
- **[frontend/eslint.config.js](frontend/eslint.config.js)** - ESLint config
- **[frontend/package.json](frontend/package.json)** - NPM config

### Backend

- **[backend/go.mod](backend/go.mod)** - Go modules
- **[backend/docker-compose.yml](backend/docker-compose.yml)** - Docker Compose config
- **[backend/Dockerfile](backend/Dockerfile)** - Docker image

---

## 📖 Как использовать документацию

### Для пользователей

1. Начните с **[README.md](README.md)** - основная информация
2. Если возникли вопросы → **[FAQ.md](FAQ.md)**
3. Если проблемы → **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**
4. Для API интеграции → **[API.md](API.md)**

### Для разработчиков

1. Начните с **[CONTRIBUTING.md](CONTRIBUTING.md)** - как внести вклад
2. Настройте окружение → **[DEVELOPMENT.md](DEVELOPMENT.md)**
3. Изучите архитектуру → **[ARCHITECTURE.md](ARCHITECTURE.md)**
4. Смотрите специфичные README:
   - **[frontend/README.md](frontend/README.md)**
   - **[backend/README.md](backend/README.md)**

### Для maintainers

1. **[CHANGELOG.md](CHANGELOG.md)** - обновляйте при релизах
2. **[.github/workflows/](https://github.com/.github/workflows/)** - CI/CD
3. Issue/PR templates - настройте под проект

---

## 🔍 Поиск по документации

### По темам

| Тема | Файлы |
|------|-------|
| **Установка** | [README.md](README.md#-быстрый-старт), [FAQ.md](FAQ.md#установка-и-запуск) |
| **Разработка** | [DEVELOPMENT.md](DEVELOPMENT.md), [CONTRIBUTING.md](CONTRIBUTING.md) |
| **API** | [API.md](API.md) |
| **Архитектура** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Проблемы** | [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [FAQ.md](FAQ.md) |
| **Frontend** | [frontend/README.md](frontend/README.md), [ARCHITECTURE.md](ARCHITECTURE.md#frontend-architecture) |
| **Backend** | [backend/README.md](backend/README.md), [ARCHITECTURE.md](ARCHITECTURE.md#backend-architecture) |
| **Горячие клавиши** | [README.md](README.md#-горячие-клавиши) |
| **Contributing** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **CI/CD** | [.github/workflows/ci.yml](.github/workflows/ci.yml), [.github/workflows/release.yml](.github/workflows/release.yml) |

---

## 📝 Статус документации

| Документ | Статус | Последнее обновление |
|----------|--------|---------------------|
| README.md | ✅ Complete | 2024-10-18 |
| CONTRIBUTING.md | ✅ Complete | 2024-10-18 |
| ARCHITECTURE.md | ✅ Complete | 2024-10-18 |
| API.md | ✅ Complete | 2024-10-18 |
| DEVELOPMENT.md | ✅ Complete | 2024-10-18 |
| TROUBLESHOOTING.md | ✅ Complete | 2024-10-18 |
| FAQ.md | ✅ Complete | 2024-10-18 |
| CHANGELOG.md | ✅ Complete | 2024-10-18 |
| LICENSE | ✅ Complete | 2024-10-18 |
| frontend/README.md | ✅ Complete | 2024-10-18 |
| backend/README.md | ✅ Complete | 2024-10-18 |

---

## 🤝 Обратная связь

Нашли ошибку в документации? Хотите что-то улучшить?

1. Создайте [Issue](https://github.com/lidarcleaner/app/issues/new?template=question.md)
2. Отправьте [Pull Request](https://github.com/lidarcleaner/app/pulls) с исправлениями
3. Напишите на docs@lidarcleaner.app

---

<div align="center">

**Документация обновляется регулярно. Следите за изменениями!**

[⬆ Наверх](#-documentation-index)

</div>

