# Сборка для Production (на русском)

## 🎯 Быстрый старт

```bash
cd frontend
npm install
npm run dist:appimage
```

Готово! Файл появится в `frontend/dist/LidarCleaner-*.AppImage`

## 📦 Доступные форматы

### 1. AppImage (рекомендуется)

**Самый простой способ** — один файл, работает везде:

```bash
npm run dist:appimage
chmod +x dist/LidarCleaner-*.AppImage
./dist/LidarCleaner-*.AppImage
```

✅ Преимущества:
- Не требует установки
- Работает на любом Linux
- Автоматически настраивает sandbox

### 2. .deb пакет (Ubuntu/Debian)

```bash
npm run dist:deb
sudo dpkg -i dist/LidarCleaner-*.deb
```

После установки запускается из меню или командой `lidarcleaner`

### 3. .rpm пакет (Fedora/RHEL/CentOS)

```bash
npm run dist:rpm
sudo rpm -i dist/LidarCleaner-*.rpm
```

### 4. Все форматы сразу

```bash
npm run dist:linux
```

Создаст AppImage, .deb и .rpm

---

## 🔒 Почему нужен флаг --no-sandbox в разработке?

### Проблема

При запуске `npm run dev` без флага `--no-sandbox` возникает ошибка:

```
The SUID sandbox helper binary was found, but is not configured correctly.
```

### Причина

Electron использует **Chromium sandbox** — механизм безопасности, который:
- Изолирует приложение от системы
- Защищает от вредоносного кода
- Требует специальных прав на Linux

На Linux для sandbox нужно:
```bash
sudo chown root chrome-sandbox
sudo chmod 4755 chrome-sandbox
```

Это неудобно для разработки!

### Решение

#### ✅ Для разработки (ваш компьютер)

**Отключаем sandbox** флагом `--no-sandbox`:

```json
"dev:electron": "electron . --no-sandbox"
```

Это **безопасно**, потому что:
- Вы контролируете код
- Это ваш компьютер
- Упрощает разработку

#### ✅ Для production (конечные пользователи)

**Sandbox включен** и настраивается автоматически:

1. **AppImage** — настраивает sandbox при запуске
2. **.deb/.rpm** — устанавливают правильные права автоматически

В коде sandbox **включен**:
```typescript
webPreferences: {
  sandbox: true,           // ✅
  contextIsolation: true,  // ✅
  nodeIntegration: false,  // ✅
}
```

---

## 🛡️ Что такое Sandbox?

```
┌─────────────────────────────────────┐
│     Операционная система            │
│  ┌───────────────────────────────┐  │
│  │        SANDBOX                │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Ваше приложение        │  │  │
│  │  │                         │  │  │
│  │  │  ❌ Нет доступа к:      │  │  │
│  │  │   - Системным файлам   │  │  │
│  │  │   - Root правам        │  │  │
│  │  │   - Другим процессам   │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Зачем?**
- Если в приложении уязвимость → система в безопасности
- Приложение не может случайно удалить системные файлы
- Защита от вредоносного кода

---

## 📊 Сравнение форматов

| Формат   | Установка | Размер    | Sandbox | Интеграция |
|----------|-----------|-----------|---------|------------|
| AppImage | Не нужна  | ~200 MB   | ✅ Авто | ❌         |
| .deb     | Нужна     | ~200 MB   | ✅ Авто | ✅         |
| .rpm     | Нужна     | ~200 MB   | ✅ Авто | ✅         |

**Почему 200 MB?**
- Electron включает полный браузер Chromium (~100 MB)
- Three.js и другие библиотеки
- Это нормально для Electron приложений (Discord, VS Code, Slack)

---

## 🚀 Сборка через Docker

Если локальная сборка не работает:

```bash
# Все форматы
make docker-dist-all

# Только AppImage
make docker-dist-appimage
```

---

## ❓ Частые вопросы

### Можно ли уменьшить размер?

Нет, Electron всегда включает Chromium. Это цена за кроссплатформенность.

### Безопасно ли использовать --no-sandbox?

- ✅ **Для разработки** — да, это ваш код
- ❌ **Для production** — нет, используйте правильную упаковку

### Как обновить приложение?

- **AppImage:** скачать новую версию
- **.deb/.rpm:** через пакетный менеджер или скачать новый пакет

### Нужен ли интернет для работы?

Нет, приложение работает оффлайн. Интернет нужен только для:
- Связи с backend (если используется)
- Авто-очистки через AI (если backend запущен)

---

## 📝 Итого

### Разработка
```bash
npm run dev  # с --no-sandbox
```

### Production
```bash
npm run dist:appimage  # sandbox включен и настроен
```

### Распространение
Отправьте пользователям `.AppImage` файл — работает из коробки!

---

## 🔗 Дополнительно

- [Подробная документация (EN)](./PRODUCTION_BUILD.md)
- [Документация Electron Builder](https://www.electron.build/)
- [Безопасность Electron](https://www.electronjs.org/docs/latest/tutorial/security)

