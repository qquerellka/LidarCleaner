#!/bin/bash

set -e

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🚀 LidarCleaner Launcher       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Проверка Docker
echo -e "${YELLOW}▶ Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running. Please start Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is ready${NC}"
echo ""

# Проверка Node.js и npm
echo -e "${YELLOW}▶ Checking Node.js and npm...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found.${NC}"
    echo -e "${YELLOW}📦 To install on Ubuntu/Debian:${NC}"
    echo -e "   ${BLUE}curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -${NC}"
    echo -e "   ${BLUE}sudo apt-get install -y nodejs${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found.${NC}"
    echo -e "${YELLOW}📦 To install on Ubuntu/Debian:${NC}"
    echo -e "   ${BLUE}sudo apt-get update${NC}"
    echo -e "   ${BLUE}sudo apt-get install -y npm${NC}"
    echo -e ""
    echo -e "${YELLOW}💡 Or install via NodeSource (recommended):${NC}"
    echo -e "   ${BLUE}curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -${NC}"
    echo -e "   ${BLUE}sudo apt-get install -y nodejs${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version is too old (current: v$NODE_VERSION, required: >= 18)${NC}"
    echo -e "${YELLOW}📦 To update on Ubuntu/Debian:${NC}"
    echo -e "   ${BLUE}curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -${NC}"
    echo -e "   ${BLUE}sudo apt-get install -y nodejs${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version) and npm $(npm --version) are ready${NC}"
echo ""

# Проверка зависимостей для Electron на Ubuntu/Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${YELLOW}▶ Checking Electron dependencies for Linux...${NC}"
    
    MISSING_LIBS=()
    
    # Проверка критичных библиотек для Electron
    if ! ldconfig -p 2>/dev/null | grep -q "libgbm.so"; then
        MISSING_LIBS+=("libgbm1")
    fi
    if ! ldconfig -p 2>/dev/null | grep -q "libgtk-3.so"; then
        MISSING_LIBS+=("libgtk-3-0")
    fi
    
    # Проверка DISPLAY для GUI
    if [ -z "$DISPLAY" ]; then
        echo -e "${RED}✗ DISPLAY variable is not set${NC}"
        echo -e "${YELLOW}⚠ Warning: GUI applications may not work without X11/Wayland display${NC}"
        echo -e "${YELLOW}💡 If running over SSH, use: ${BLUE}ssh -X user@host${NC}"
    fi
    
    # Проверка прав доступа к frontend/node_modules
    if [ -d "frontend/node_modules/electron/dist" ]; then
        if [ ! -r "frontend/node_modules/electron/dist/electron" ] || [ ! -x "frontend/node_modules/electron/dist/electron" ]; then
            echo -e "${YELLOW}⚠ Warning: Electron binary may have permission issues${NC}"
            echo -e "${YELLOW}💡 Run if needed: ${BLUE}chmod +x frontend/node_modules/electron/dist/electron${NC}"
        fi
    fi
    
    if [ ${#MISSING_LIBS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠ Warning: Some Electron dependencies may be missing:${NC}"
        for lib in "${MISSING_LIBS[@]}"; do
            echo -e "   - $lib"
        done
        echo ""
        echo -e "${YELLOW}📦 To install on Ubuntu/Debian:${NC}"
        echo -e "   ${BLUE}sudo apt-get update${NC}"
        echo -e "   ${BLUE}sudo apt-get install -y libgbm1 libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 dbus dbus-x11${NC}"
        echo ""
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Electron dependencies look good${NC}"
    fi
    echo ""
fi

# Запуск Backend
echo -e "${YELLOW}▶ Starting Backend (Docker Compose)...${NC}"
cd backend

# Остановка старых контейнеров (если есть)
docker-compose down &> /dev/null || true

# Запуск сервисов
echo -e "${YELLOW}▶ Starting services (PostgreSQL, MinIO, RabbitMQ, Go)...${NC}"
docker-compose up -d

# Ожидание готовности
echo -e "${YELLOW}▶ Waiting for services to be healthy...${NC}"
sleep 5

# Проверка статуса
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Backend is ready!${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    docker-compose logs
    exit 1
fi

echo ""

# Запуск Frontend
cd ../frontend

# Проверка node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}▶ Installing dependencies...${NC}"
    npm install
fi

echo ""
echo -e "${YELLOW}Choose mode:${NC}"
echo -e "  ${GREEN}1)${NC} Development (hot reload, dev tools)"
echo -e "  ${GREEN}2)${NC} Production (optimized build)"
echo ""
read -p "Select [1/2] (default: 1): " mode
mode=${mode:-1}

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✨ LidarCleaner is starting! ✨    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Backend:${NC}  http://localhost:8000"

if [ "$mode" == "2" ]; then
    # Production mode
    echo -e "  ${GREEN}Frontend:${NC} Production build"
    echo ""
    echo -e "${YELLOW}▶ Building production version...${NC}"
    npm run build
    echo -e "${GREEN}✓ Build complete!${NC}"
    echo ""
    echo -e "${YELLOW}💡 To stop: Press Ctrl+C${NC}"
    echo ""
    npm run preview
else
    # Development mode
    echo -e "  ${GREEN}Frontend:${NC} Development (Vite + Electron)"
    echo ""
    echo -e "${YELLOW}💡 To stop: Press Ctrl+C in this terminal, then run:${NC}"
    echo -e "   ${BLUE}cd backend && docker-compose down${NC}"
    echo ""
    npm run dev
fi

