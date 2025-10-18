# LidarCleaner Frontend

Electron + React + Three.js desktop application for LiDAR point cloud visualization and editing.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

## 📦 Scripts

### Development

- `npm run dev` - Start full development environment
- `npm run dev:renderer` - Vite dev server only
- `npm run dev:main` - Build Electron main process (watch mode)
- `npm run dev:preload` - Build preload script (watch mode)
- `npm run dev:electron` - Start Electron app

### Building

- `npm run build` - Build all (renderer + main + preload)
- `npm run build:renderer` - Build React app
- `npm run build:main` - Build Electron main process
- `npm run build:preload` - Build preload script

### Production

- `npm run preview` - Preview production build (with --no-sandbox for dev)
- `npm run dist` - Create distributable packages for current platform
- `npm run dist:linux` - Create all Linux packages (AppImage, deb, rpm)
- `npm run dist:appimage` - Create AppImage (recommended for Linux)
- `npm run dist:deb` - Create .deb package (Ubuntu/Debian)
- `npm run dist:rpm` - Create .rpm package (Fedora/RHEL)

### Code Quality

- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm run type-check` - TypeScript type checking

## 🏗️ Architecture

```
src/
├── main/           # Electron Main Process
│   ├── index.ts    # Entry point
│   ├── window.ts   # Window management
│   ├── menu.ts     # Application menu
│   └── ipc/        # IPC handlers
│
└── renderer/       # React App
    ├── main.tsx    # React entry
    ├── App.tsx     # Root component
    ├── components/ # UI components
    ├── features/   # Feature modules
    ├── pages/      # Page components
    ├── store/      # Redux store
    ├── three/      # Three.js integration
    └── styles/     # Global styles
```

## 🔧 Tech Stack

- **Electron** 30.0 - Desktop framework
- **React** 18.3 - UI library
- **TypeScript** 5.5 - Type safety
- **Redux Toolkit** 2.9 - State management
- **Three.js** 0.180 - 3D rendering
- **Mantine** 7.15 - UI components
- **Vite** 5.4 - Build tool
- **esbuild** 0.25 - JS bundler

## 📝 Configuration

### tsconfig.json

Three TypeScript configs:
- `tsconfig.json` - Base config
- `tsconfig.app.json` - Renderer (React)
- `tsconfig.node.json` - Main/Preload (Node.js)

### vite.config.ts

Vite configuration for renderer process.

### electron-builder.json

Electron Builder configuration for packaging.

## 🐛 Debugging

### Chrome DevTools

```bash
# DevTools automatically open in dev mode
npm run dev
```

Press `Ctrl+Shift+I` to toggle DevTools.

### VS Code

Use launch configuration:

```json
{
  "name": "Electron: Main",
  "type": "node",
  "request": "launch",
  "cwd": "${workspaceFolder}/frontend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev:electron"]
}
```

## 📦 Packaging

### Quick Start

```bash
# Install dependencies
npm install

# Build all Linux packages
npm run dist:linux
```

Output in `dist/`:
- `LidarCleaner-*.AppImage` - Universal (recommended)
- `LidarCleaner-*.deb` - Ubuntu/Debian
- `LidarCleaner-*.rpm` - Fedora/RHEL

### Linux Formats

**AppImage (recommended):**
```bash
npm run dist:appimage
chmod +x dist/LidarCleaner-*.AppImage
./dist/LidarCleaner-*.AppImage
```

**Debian/Ubuntu (.deb):**
```bash
npm run dist:deb
sudo dpkg -i dist/LidarCleaner-*.deb
```

**Fedora/RHEL (.rpm):**
```bash
npm run dist:rpm
sudo rpm -i dist/LidarCleaner-*.rpm
```

### Docker Build (alternative)

```bash
# Using Makefile
make docker-dist-all      # All formats
make docker-dist-appimage # AppImage only
make docker-dist-deb      # .deb only
make docker-dist-rpm      # .rpm only
```

📖 **Detailed guide:** See [PRODUCTION_BUILD.md](./PRODUCTION_BUILD.md)

## 🔗 Environment Variables

- `BACKEND_URL` - Backend API URL (default: http://localhost:8000)
- `VITE_DEV_SERVER_PORT` - Vite dev server port (default: 5173)

## 📚 Documentation

- [Main README](../README.md)
- [Development Guide](../DEVELOPMENT.md)
- [Architecture](../ARCHITECTURE.md)
- [Contributing](../CONTRIBUTING.md)

## 🐛 Troubleshooting

### Sandbox error on Linux

**Error:** `The SUID sandbox helper binary was found, but is not configured correctly`

**Solution for development:**
```bash
# Already fixed in package.json
npm run dev  # uses --no-sandbox flag
```

**Solution for production:**
```bash
# Build proper packages (sandbox configured automatically)
npm run dist:appimage
```

📖 **More info:** See [PRODUCTION_BUILD.md](./PRODUCTION_BUILD.md)

### Other issues

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for more common issues.

## 📄 License

MIT - See [LICENSE](../LICENSE)
