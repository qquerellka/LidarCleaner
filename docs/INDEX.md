# 📚 LidarCleaner Documentation Index

Полный индекс документации проекта LidarCleaner с навигацией и описанием всех документов.

---

## 🎯 Быстрая навигация

| Я хочу... | Документ |
|-----------|----------|
| **Начать работу быстро** | [QUICK_START.md](../QUICK_START.md) |
| **Понять как всё работает** | [README.md](../README.md) |
| **Решить проблему** | [user-guide/troubleshooting.md](user-guide/troubleshooting.md) |
| **Найти ответ на вопрос** | [user-guide/faq.md](user-guide/faq.md) |
| **Внести вклад** | [development/contributing.md](development/contributing.md) |
| **Настроить окружение** | [development/development.md](development/development.md) |
| **Понять архитектуру** | [development/architecture.md](development/architecture.md) |
| **Использовать API** | [api/rest-api.md](api/rest-api.md) |
| **Обучить ML модель** | [../ml/README.md](../ml/README.md) |

---

## 🌟 Основная документация

### [README.md](../README.md)
**Главная страница проекта**
- 📋 Обзор проекта и возможностей
- 🚀 Быстрый старт (краткий)
- ✨ Полное описание функций
- ⌨️ Горячие клавиши
- 🗺️ Roadmap
- 🤝 Contributing

**Начните отсюда**, если первый раз в проекте!

---

### [QUICK_START.md](../QUICK_START.md)
**Полное руководство по быстрому старту**
- 🔧 Установка зависимостей (Linux, Windows, macOS)
- ✅ Проверка готовности
- 🚀 Варианты запуска (автоматический и ручной)
- 📂 Первое использование
- 🎮 Базовые операции
- 🐛 Частые проблемы

**Подробная инструкция** для новичков — от установки до первого использования.

---

### [CHANGELOG.md](../CHANGELOG.md)
**История изменений**
- 📅 Все версии и релизы
- ✨ Added, Fixed, Changed, Removed
- 🔗 Ссылки на коммиты и PR

---

### [LICENSE](../LICENSE)
**Лицензия MIT**
- 📜 Условия использования и распространения

---

## 👤 Пользовательская документация

### [user-guide/faq.md](user-guide/faq.md)
**Часто задаваемые вопросы**

**40+ вопросов и ответов по темам:**
- Общие вопросы (что такое LidarCleaner, поддержка ОС)
- Установка и запуск
- Работа с файлами (форматы, размеры)
- Редактирование (выделение, удаление)
- Производительность (RAM, FPS)
- AI-обработка (Auto Clean)
- Экспорт и сохранение
- Troubleshooting

**Используйте FAQ**, если:
- У вас есть конкретный вопрос
- Нужно быстро найти ответ
- Хотите узнать best practices

---

### [user-guide/troubleshooting.md](user-guide/troubleshooting.md)
**Решение проблем и диагностика**

**30+ проблем с решениями:**
- 🔴 Backend проблемы (Database, MinIO, RabbitMQ)
- 🖥️ Frontend проблемы (Electron, IPC, File Loading)
- 🎨 3D Rendering (черный экран, FPS, выделение)
- ⚡ Производительность (memory leaks, загрузка)
- 🐳 Docker (daemon, порты, сборка)
- 🛠️ Build проблемы

**Каждая проблема включает:**
- Симптомы
- Причины
- Пошаговое решение
- Команды для диагностики

**Используйте Troubleshooting**, если:
- Что-то не работает
- Есть ошибка
- Нужна диагностика

---

## 👨‍💻 Документация для разработчиков

### [development/contributing.md](development/contributing.md)
**Руководство для contributors**

**Содержание:**
- 📜 Code of Conduct
- 🚀 Как начать (Fork, Clone, Setup)
- 🔄 Процесс разработки (Workflow)
- 🎨 Стиль кода (TypeScript, Go)
- ✅ Тестирование (Unit, Integration, E2E)
- 📝 Документация
- 💬 Коммиты (Conventional Commits)
- 🔍 Pull Requests (шаблон, review)

**Начните здесь**, если хотите внести вклад в проект!

---

### [development/development.md](development/development.md)
**Руководство по разработке**

**800+ строк инструкций:**
- 🛠️ Настройка окружения (Frontend + Backend)
- 💻 IDE конфигурация (VS Code, WebStorm, GoLand)
- 📁 Структура кода
- 🔥 Hot Reload
- 🐛 Debugging (Frontend + Backend)
- ✅ Testing (Unit, Integration, E2E)
- 📊 Performance Profiling
- 🌟 Best Practices

**Используйте**, если:
- Разрабатываете новую функцию
- Нужно настроить dev окружение
- Хотите узнать best practices

---

### [development/architecture.md](development/architecture.md)
**Архитектура приложения**

**Подробное описание:**
- 📊 Диаграмма системы (ASCII art)
- 🖥️ Frontend Architecture
  - 5 слоев (Presentation, Business Logic, State, 3D, IPC)
  - React компоненты
  - Redux State Management
  - Three.js интеграция
- 🔧 Backend Architecture
  - 4 слоя (HTTP, Service, Data Access, Worker)
  - Go сервисы
  - PostgreSQL, MinIO, RabbitMQ
- 🔄 Взаимодействие компонентов
- 📈 Data Flow диаграммы
- ⚡ Оптимизации производительности
- 🔒 Безопасность

**Используйте**, если:
- Нужно понять как всё работает
- Планируете большие изменения
- Пишете новый модуль

---

## 🌐 API Документация

### [api/rest-api.md](api/rest-api.md)
**REST API Documentation**

**Полное описание API:**
- 🔗 Base URL и endpoints
- 📝 8 endpoints с деталями:
  - Health Check
  - File Upload
  - Process Dynamic Objects
  - Get Processing Status
  - Download File
  - Delete File
  - List Files
  - Get File Info
- 📋 Request/Response примеры
- ❌ Error Handling (10+ error codes)
- 🔐 Authentication (planned)
- ⚖️ Rate Limiting (planned)
- 💡 Примеры на bash, curl, TypeScript

**Используйте**, если:
- Интегрируете с backend
- Пишете клиент
- Нужна справка по API

---

## 🤖 Machine Learning

### [../ml/README.md](../ml/README.md)
**ML модели и обучение**

**Содержимое:**
- 🧠 Описание используемых моделей (PointNet++)
- 📓 Jupyter notebooks для обучения
- 🖼️ Примеры результатов (до/после)
- 📊 Метрики качества
- 🔧 Инструкции по обучению
- 📦 Готовые модели

**Используйте**, если:
- Хотите обучить свою модель
- Нужно понять как работает Auto Clean
- Интересуют детали ML части

---

## 📁 Локальная документация

### Backend

**[backend/README.md](../backend/README.md)**
- 🚀 Quick Start для backend
- 🐳 Сервисы (PostgreSQL, MinIO, RabbitMQ)
- 🌐 Endpoints overview
- 🏗️ Architecture (internal structure)
- ✅ Testing
- 🗄️ Database migrations
- 📊 Monitoring

### Frontend

**[frontend/README.md](../frontend/README.md)**
- 🚀 Quick Start для frontend
- 📦 Scripts (dev, build, package)
- 🏗️ Architecture (src structure)
- 🔧 Tech Stack
- 🐛 Debugging
- 📦 Packaging для разных ОС

---

## 🐙 GitHub Templates

### Issue Templates

**.github/ISSUE_TEMPLATE/**
- **[bug_report.md](../.github/ISSUE_TEMPLATE/bug_report.md)** — Шаблон для багов
- **[feature_request.md](../.github/ISSUE_TEMPLATE/feature_request.md)** — Шаблон для features
- **[question.md](../.github/ISSUE_TEMPLATE/question.md)** — Шаблон для вопросов

### Pull Request Template

**[.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md)**
- Описание изменений
- Тип изменения
- Тестирование
- Checklist

### Workflows

**.github/workflows/**
- **[ci.yml](../.github/workflows/ci.yml)** — CI/CD пайплайн
- **[release.yml](../.github/workflows/release.yml)** — Автоматический релиз

---

## ⚙️ Конфигурация

### Root Level

- **[.gitignore](../.gitignore)** — Git ignore patterns
- **[.dockerignore](../.dockerignore)** — Docker ignore patterns
- **[.editorconfig](../.editorconfig)** — Editor config
- **[.prettierrc](../.prettierrc)** — Prettier config
- **[.prettierignore](../.prettierignore)** — Prettier ignore

### Frontend

- **[frontend/tsconfig.json](../frontend/tsconfig.json)** — TypeScript base config
- **[frontend/vite.config.ts](../frontend/vite.config.ts)** — Vite config
- **[frontend/eslint.config.js](../frontend/eslint.config.js)** — ESLint config
- **[frontend/package.json](../frontend/package.json)** — NPM config

### Backend

- **[backend/go.mod](../backend/go.mod)** — Go modules
- **[backend/docker-compose.yml](../backend/docker-compose.yml)** — Docker Compose config
- **[backend/Dockerfile](../backend/Dockerfile)** — Docker image

---

## 🔍 Поиск по темам

| Тема | Файлы |
|------|-------|
| **Установка** | [QUICK_START.md](../QUICK_START.md), [user-guide/faq.md](user-guide/faq.md) |
| **Разработка** | [development/development.md](development/development.md), [development/contributing.md](development/contributing.md) |
| **API** | [api/rest-api.md](api/rest-api.md) |
| **Архитектура** | [development/architecture.md](development/architecture.md) |
| **Проблемы** | [user-guide/troubleshooting.md](user-guide/troubleshooting.md), [user-guide/faq.md](user-guide/faq.md) |
| **Frontend** | [frontend/README.md](../frontend/README.md), [development/architecture.md](development/architecture.md) |
| **Backend** | [backend/README.md](../backend/README.md), [development/architecture.md](development/architecture.md) |
| **Горячие клавиши** | [README.md](../README.md#-горячие-клавиши), [QUICK_START.md](../QUICK_START.md) |
| **Contributing** | [development/contributing.md](development/contributing.md) |
| **CI/CD** | [../.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| **Machine Learning** | [../ml/README.md](../ml/README.md) |

---

## 📊 Статистика документации

### Объём

| Категория | Файлов | Строк (примерно) |
|-----------|--------|------------------|
| Основная документация | 4 | 1,500+ |
| Пользовательская | 2 | 1,200+ |
| Для разработчиков | 3 | 1,900+ |
| API | 1 | 600+ |
| Machine Learning | 1 | 400+ |
| Локальная (frontend/backend) | 2 | 350+ |
| GitHub templates | 6 | 500+ |
| Конфигурация | ~10 | 200+ |
| **ВСЕГО** | **~29** | **6,650+** |

### Покрытие

✅ **100% покрытие:**
- Установка и быстрый старт
- Архитектура (Frontend + Backend)
- API документация
- Разработка и contributing
- Troubleshooting и FAQ
- Machine Learning
- CI/CD

---

## 📝 Статус документации

| Документ | Статус | Последнее обновление |
|----------|--------|---------------------|
| README.md | ✅ Complete | 2024-10-18 |
| QUICK_START.md | ✅ Complete | 2024-10-18 |
| user-guide/contributing.md | ✅ Complete | 2024-10-18 |
| development/architecture.md | ✅ Complete | 2024-10-18 |
| api/rest-api.md | ✅ Complete | 2024-10-18 |
| development/development.md | ✅ Complete | 2024-10-18 |
| user-guide/troubleshooting.md | ✅ Complete | 2024-10-19 |
| user-guide/faq.md | ✅ Complete | 2024-10-18 |
| CHANGELOG.md | ✅ Complete | 2024-10-18 |
| LICENSE | ✅ Complete | 2024-10-18 |
| ml/README.md | ✅ Complete | 2024-10-18 |
| frontend/README.md | ✅ Complete | 2024-10-18 |
| backend/README.md | ✅ Complete | 2024-10-18 |

---

## 📖 Как использовать документацию

### Для пользователей

**Путь обучения:**
1. **[README.md](../README.md)** — получите общее представление
2. **[QUICK_START.md](../QUICK_START.md)** — установите и запустите
3. **[user-guide/faq.md](user-guide/faq.md)** — найдите ответы на вопросы
4. **[user-guide/troubleshooting.md](user-guide/troubleshooting.md)** — решите проблемы

**Если нужна справка:**
- Используйте таблицу "Быстрая навигация" выше
- Используйте "Поиск по темам"
- Ctrl+F в этом файле

---

### Для разработчиков

**Путь обучения:**
1. **[development/contributing.md](development/contributing.md)** — узнайте как внести вклад
2. **[development/development.md](development/development.md)** — настройте окружение
3. **[development/architecture.md](development/architecture.md)** — поймите архитектуру
4. **[api/rest-api.md](api/rest-api.md)** — изучите API (если нужно)

**Специфичные задачи:**
- **Frontend** → [frontend/README.md](../frontend/README.md)
- **Backend** → [backend/README.md](../backend/README.md)
- **ML модели** → [ml/README.md](../ml/README.md)

---

### Для maintainers

**Регулярно обновлять:**
- **[CHANGELOG.md](../CHANGELOG.md)** — при релизах
- **[README.md](../README.md)** — roadmap, версия
- **[docs/INDEX.md](INDEX.md)** — этот файл (статус документации)

**Настроить:**
- **[.github/workflows/](../.github/workflows/)** — CI/CD
- Issue/PR templates — под нужды проекта

---

## 🤝 Обратная связь

Нашли ошибку в документации? Хотите что-то улучшить?

1. Создайте [Issue](https://github.com/qquerellka/LidarCleaner/issues/new?template=question.md)
2. Отправьте [Pull Request](https://github.com/qquerellka/LidarCleaner/pulls) с исправлениями
3. Напишите на docs@lidarcleaner.app (если будет)

---

## 🎯 Планы по документации

### Скоро:
- [ ] Видео-туториалы (YouTube)
- [ ] Интерактивная документация (Docusaurus)
- [ ] API Reference (автогенерация из кода)
- [ ] Перевод на английский

### В перспективе:
- [ ] Community Wiki
- [ ] Best Practices гайды
- [ ] Performance optimization гайды
- [ ] Кейсы использования

---

<div align="center">

**Документация обновляется регулярно. Следите за изменениями!**

[⬆ Наверх](#-lidarcleaner-documentation-index) | [🏠 README](../README.md)

</div>

