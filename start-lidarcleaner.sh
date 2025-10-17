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

