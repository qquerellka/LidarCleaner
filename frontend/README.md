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

- `npm run preview` - Preview production build
- `npm run package` - Create distributable (AppImage, DMG, EXE)

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

### Linux (AppImage)

```bash
npm run package
# Output: dist/LidarCleaner-*.AppImage
```

### Windows (EXE)

```bash
npm run package
# Output: dist/LidarCleaner-Setup-*.exe
```

### macOS (DMG)

```bash
npm run package
# Output: dist/LidarCleaner-*.dmg
```

## 🔗 Environment Variables

- `BACKEND_URL` - Backend API URL (default: http://localhost:8000)
- `VITE_DEV_SERVER_PORT` - Vite dev server port (default: 5173)

## 📚 Documentation

- [Main README](../README.md)
- [Development Guide](../DEVELOPMENT.md)
- [Architecture](../ARCHITECTURE.md)
- [Contributing](../CONTRIBUTING.md)

## 🐛 Troubleshooting

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues.

## 📄 License

MIT - See [LICENSE](../LICENSE)
