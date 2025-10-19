# Production Build Guide

## 📦 Как собрать приложение для production

### Быстрый старт

```bash
cd frontend

# 1. Установить зависимости (если еще не установлены)
npm install

# 2. Собрать все форматы для Linux
npm run dist:linux
```

Готово! Файлы появятся в `frontend/dist/`:
- `LidarCleaner-*.AppImage` — универсальный формат (рекомендуется)
- `LidarCleaner-*.deb` — для Ubuntu/Debian
- `LidarCleaner-*.rpm` — для Fedora/RHEL/CentOS

---

## 🎯 Доступные команды

### Локальная сборка

```bash
# Все форматы Linux (AppImage, deb, rpm)
npm run dist:linux

# Только AppImage (рекомендуется)
npm run dist:appimage

# Только .deb (Ubuntu/Debian)
npm run dist:deb

# Только .rpm (Fedora/RHEL)
npm run dist:rpm
```

### Docker сборка (если локальная не работает)

```bash
# Все форматы через Docker
make docker-dist-all

# Только AppImage
make docker-dist-appimage

# Только .deb
make docker-dist-deb

# Только .rpm
make docker-dist-rpm
```

---

## 🔒 Как работает Sandbox в Production

### ❌ Проблема в разработке

В режиме разработки (`npm run dev`) мы используем флаг `--no-sandbox`:
```json
"dev:electron": "electron . --no-sandbox"
```

Это нужно, потому что:
- Electron требует специальных прав для `chrome-sandbox` на Linux
- Настройка этих прав сложна и не нужна для разработки
- Безопасно, так как вы контролируете код

### ✅ Решение для Production

При сборке через **electron-builder** создаются пакеты, которые:

1. **AppImage** — автоматически настраивает sandbox при запуске
2. **deb/rpm** — устанавливают права через post-install скрипты

**Что происходит внутри:**

```bash
# При установке .deb/.rpm автоматически выполняется:
sudo chown root /usr/lib/lidarcleaner/chrome-sandbox
sudo chmod 4755 /usr/lib/lidarcleaner/chrome-sandbox
```

**SUID bit (4755)** позволяет:
- Временно повысить права для создания изолированной среды
- Само приложение работает с правами пользователя
- Chromium создает защищенный sandbox

### 🛡️ Безопасность

В production **sandbox включен** в коде:

```typescript
// src/main/main.ts
webPreferences: {
  sandbox: true,           // ✅ Включен
  contextIsolation: true,  // ✅ Изоляция контекста
  nodeIntegration: false,  // ✅ Node.js отключен в renderer
}
```

Это означает:
- Renderer процесс изолирован от системы
- Доступ к Node.js и Electron API только через preload
- Защита от XSS и code injection
- Если в приложении уязвимость → система в безопасности

---

## 📋 Форматы пакетов

### AppImage (рекомендуется)

**Преимущества:**
- ✅ Работает на любом Linux без установки
- ✅ Портативный (один файл)
- ✅ Автоматически настраивает sandbox
- ✅ Не требует root прав

**Использование:**
```bash
chmod +x LidarCleaner-*.AppImage
./LidarCleaner-*.AppImage
```

### .deb (Ubuntu/Debian)

**Преимущества:**
- ✅ Интеграция с системой (меню, иконки)
- ✅ Автоматическое обновление через apt
- ✅ Правильные права для sandbox

**Установка:**
```bash
sudo dpkg -i LidarCleaner-*.deb
sudo apt-get install -f  # если нужны зависимости
```

**Запуск:**
```bash
lidarcleaner
# или из меню приложений
```

### .rpm (Fedora/RHEL/CentOS)

**Преимущества:**
- ✅ Интеграция с системой
- ✅ Правильные права для sandbox

**Установка:**
```bash
sudo rpm -i LidarCleaner-*.rpm
# или
sudo dnf install LidarCleaner-*.rpm
```

---

## 🚀 CI/CD

Для автоматической сборки в CI/CD:

```yaml
# .github/workflows/build.yml
name: Build
on: [push, pull_request]

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Build application
        run: cd frontend && npm run dist:linux
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: linux-packages
          path: frontend/dist/*.{AppImage,deb,rpm}
```

---

## 🔧 Настройка electron-builder

Конфигурация в `electron-builder.json`:

```json
{
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "category": "Graphics",
    "fileAssociations": [
      {
        "ext": "pcd",
        "name": "Point Cloud Data"
      }
    ]
  }
}
```

---

## 📊 Размеры пакетов

Примерные размеры (с Electron + Chromium):

- AppImage: ~150-200 MB
- .deb: ~150-200 MB
- .rpm: ~150-200 MB

**Почему так много?**
- Electron включает полный Chromium (~100 MB)
- Three.js и другие библиотеки
- Это нормально для Electron приложений

---

## 🐛 Устранение проблем

### Ошибка: "chrome-sandbox must be owned by root"

**Когда возникает:** При запуске без упаковки
**Решение:** 
- **Для разработки:** используйте `npm run dev` (с `--no-sandbox`)
- **Для production:** соберите пакет через `npm run dist:appimage`

### Ошибка сборки на Arch Linux

```bash
# Установите зависимости
sudo pacman -S fakeroot dpkg rpm-tools
```

### AppImage не запускается

```bash
# Проверьте права
chmod +x LidarCleaner-*.AppImage

# Проверьте FUSE
sudo modprobe fuse

# Или используйте --appimage-extract-and-run
./LidarCleaner-*.AppImage --appimage-extract-and-run
```

---

## 📝 Checklist перед релизом

- [ ] Обновить версию в `package.json`
- [ ] Обновить `CHANGELOG.md`
- [ ] Протестировать сборку: `npm run dist:linux`
- [ ] Проверить AppImage на чистой системе
- [ ] Проверить .deb на Ubuntu
- [ ] Создать GitHub Release с артефактами
- [ ] Обновить документацию

---

## 🎓 Дополнительные ресурсы

- [Electron Builder Documentation](https://www.electron.build/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Chromium Sandbox Design](https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md)

