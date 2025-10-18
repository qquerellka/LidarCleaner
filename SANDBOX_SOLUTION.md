# 🔒 Решение проблемы Sandbox на Linux

## ❌ Проблема

При запуске приложения на Ubuntu/Linux возникала ошибка:

```
FATAL:setuid_sandbox_host.cc(158)] The SUID sandbox helper binary was found, 
but is not configured correctly. Rather than run without sandboxing I'm aborting now.
```

## ✅ Решение

### Для разработки

**Изменено:** `frontend/package.json`

Добавлен флаг `--no-sandbox` к командам запуска:

```json
{
  "scripts": {
    "dev:electron": "electron . --no-sandbox",
    "preview": "electron . --no-sandbox"
  }
}
```

**Теперь работает:**
```bash
./start-lidarcleaner.sh
# или
cd frontend && npm run dev
```

### Для production

**Добавлено:**
1. ✅ `electron-builder` в зависимости
2. ✅ Конфигурация `electron-builder.json`
3. ✅ Новые npm скрипты для сборки
4. ✅ Подробная документация

**Команды для сборки:**
```bash
cd frontend
npm install
npm run dist:appimage  # Создаст готовое приложение с правильным sandbox
```

---

## 📚 Документация

### Русская документация
📖 **[PRODUCTION_BUILD_RU.md](frontend/PRODUCTION_BUILD_RU.md)**

Полное объяснение:
- Что такое sandbox и зачем он нужен
- Почему в разработке используем `--no-sandbox`
- Как правильно собрать для production
- Сравнение форматов (AppImage, deb, rpm)

### Английская документация
📖 **[PRODUCTION_BUILD.md](frontend/PRODUCTION_BUILD.md)**

Детальный гайд:
- Build commands
- Package formats
- Security best practices
- CI/CD setup
- Troubleshooting

---

## 🎯 Быстрые команды

### Разработка (сейчас)
```bash
# Из корня проекта
./start-lidarcleaner.sh

# Или из frontend/
cd frontend
npm run dev
```

### Production сборка (для пользователей)
```bash
cd frontend

# AppImage (рекомендуется)
npm run dist:appimage

# Или все форматы сразу
npm run dist:linux
```

---

## 🔍 Что изменилось

### 1. frontend/package.json
- ✅ Добавлен `electron-builder@^25.1.8`
- ✅ Добавлены скрипты: `dist`, `dist:linux`, `dist:appimage`, `dist:deb`, `dist:rpm`
- ✅ Обновлены `dev:electron` и `preview` с флагом `--no-sandbox`

### 2. frontend/electron-builder.json (новый файл)
- ✅ Конфигурация для Linux пакетов
- ✅ Настройки AppImage, deb, rpm
- ✅ Ассоциации файлов (.pcd)
- ✅ Категории и метаданные

### 3. frontend/README.md
- ✅ Обновлен раздел Production
- ✅ Обновлен раздел Packaging
- ✅ Добавлен раздел Troubleshooting с решением sandbox

### 4. Новая документация
- ✅ `frontend/PRODUCTION_BUILD.md` (EN)
- ✅ `frontend/PRODUCTION_BUILD_RU.md` (RU)
- ✅ `frontend/build/ICON_README.md`
- ✅ `SANDBOX_SOLUTION.md` (этот файл)

### 5. frontend/src/main/main.ts
- ✅ Sandbox уже был правильно включен в коде

---

## 💡 Почему так?

### В разработке: --no-sandbox

**Проблема:**
- Sandbox требует специальных прав (`sudo chown root` + `chmod 4755`)
- Неудобно настраивать для каждого разработчика
- Требуется перенастройка после каждого `npm install`

**Решение:**
- Отключаем sandbox флагом `--no-sandbox`
- Безопасно, т.к. это локальная разработка
- Стандартная практика для Linux разработчиков

### В production: sandbox включен

**Как работает:**
- `electron-builder` создает пакеты с правильными правами
- **AppImage:** настраивает sandbox при запуске (FUSE mount)
- **deb/rpm:** post-install скрипты устанавливают права
- Sandbox включен в коде (`sandbox: true`)

**Безопасность:**
- Приложение изолировано от системы
- Защита от вредоносного кода
- Chromium sandbox (как в Chrome браузере)

---

## ✅ Что делать дальше

### 1. Разработка (прямо сейчас)
```bash
./start-lidarcleaner.sh
```
Всё должно работать!

### 2. Добавить иконку (опционально)
Поместите PNG иконку 512x512 в:
```
frontend/build/icon.png
```

### 3. Собрать релиз (когда готово)
```bash
cd frontend
npm run dist:appimage
```

### 4. Протестировать на чистой системе
```bash
chmod +x dist/LidarCleaner-*.AppImage
./dist/LidarCleaner-*.AppImage
```

---

## 🎓 Полезные ссылки

- [Chromium Sandbox Design](https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Builder](https://www.electron.build/)

---

## 🤝 Вопросы?

Читайте подробную документацию:
- 🇷🇺 [PRODUCTION_BUILD_RU.md](frontend/PRODUCTION_BUILD_RU.md)
- 🇬🇧 [PRODUCTION_BUILD.md](frontend/PRODUCTION_BUILD.md)

