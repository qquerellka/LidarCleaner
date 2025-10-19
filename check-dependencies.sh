#!/bin/bash

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}   LidarCleaner - Проверка зависимостей      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

ALL_OK=true

# Функция проверки команды
check_command() {
    local cmd=$1
    local name=$2
    local min_version=$3
    
    if command -v $cmd &> /dev/null; then
        version=$($cmd --version 2>&1 | head -1)
        echo -e "${GREEN}✓${NC} $name установлен: $version"
    else
        echo -e "${RED}✗${NC} $name не найден"
        ALL_OK=false
    fi
}

# Проверка Docker
echo -e "${YELLOW}Проверка Docker:${NC}"
check_command "docker" "Docker"

if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker daemon запущен"
    else
        echo -e "${RED}✗${NC} Docker daemon не запущен"
        echo -e "   Запустите: ${BLUE}sudo systemctl start docker${NC}"
        ALL_OK=false
    fi
    
    # Проверка прав
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓${NC} Права на Docker в порядке"
    else
        echo -e "${YELLOW}⚠${NC} Нет прав на Docker"
        echo -e "   Выполните: ${BLUE}sudo usermod -aG docker \$USER${NC}"
        echo -e "   Затем перелогиньтесь"
        ALL_OK=false
    fi
fi

echo ""

# Проверка Docker Compose
echo -e "${YELLOW}Проверка Docker Compose:${NC}"
check_command "docker-compose" "Docker Compose"
echo ""

# Проверка Node.js
echo -e "${YELLOW}Проверка Node.js:${NC}"
check_command "node" "Node.js"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Версия Node.js подходит (требуется >= 18)"
    else
        echo -e "${RED}✗${NC} Версия Node.js слишком старая (требуется >= 18)"
        echo -e "   Текущая версия: v$NODE_VERSION"
        ALL_OK=false
    fi
fi

check_command "npm" "npm"

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}📦 Для установки npm на Ubuntu/Debian:${NC}"
    echo -e "   ${BLUE}sudo apt-get update${NC}"
    echo -e "   ${BLUE}sudo apt-get install -y npm${NC}"
    echo ""
    echo -e "${YELLOW}💡 Или через NodeSource (рекомендуется):${NC}"
    echo -e "   ${BLUE}curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -${NC}"
    echo -e "   ${BLUE}sudo apt-get install -y nodejs${NC}"
fi
echo ""

# Проверка зависимостей Electron (только для Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${YELLOW}Проверка зависимостей Electron (Linux):${NC}"
    
    # Список критичных библиотек для Electron
    ELECTRON_LIBS=(
        "libgbm.so:libgbm1"
        "libgtk-3.so:libgtk-3-0"
        "libnss3.so:libnss3"
        "libXss.so:libxss1"
        "libXtst.so:libxtst6"
    )
    
    ELECTRON_MISSING=()
    
    for lib_info in "${ELECTRON_LIBS[@]}"; do
        lib_name="${lib_info%%:*}"
        pkg_name="${lib_info##*:}"
        
        if ldconfig -p 2>/dev/null | grep -q "$lib_name"; then
            echo -e "${GREEN}✓${NC} $pkg_name установлен"
        else
            echo -e "${RED}✗${NC} $pkg_name не найден"
            ELECTRON_MISSING+=("$pkg_name")
            ALL_OK=false
        fi
    done
    
    # Проверка D-Bus
    if command -v dbus-daemon &> /dev/null; then
        echo -e "${GREEN}✓${NC} D-Bus установлен"
    else
        echo -e "${RED}✗${NC} D-Bus не найден"
        ELECTRON_MISSING+=("dbus" "dbus-x11")
        ALL_OK=false
    fi
    
    # Проверка DISPLAY
    if [ -n "$DISPLAY" ]; then
        echo -e "${GREEN}✓${NC} DISPLAY установлен: $DISPLAY"
    else
        echo -e "${YELLOW}⚠${NC} DISPLAY не установлен (GUI может не работать)"
        echo -e "   ${BLUE}Если используете SSH: ssh -X user@host${NC}"
    fi
    
    # Проверка прав на electron binary (если установлен)
    if [ -f "frontend/node_modules/electron/dist/electron" ]; then
        if [ -x "frontend/node_modules/electron/dist/electron" ]; then
            echo -e "${GREEN}✓${NC} Electron binary исполняемый"
        else
            echo -e "${YELLOW}⚠${NC} Electron binary не исполняемый"
            echo -e "   ${BLUE}Исправить: chmod +x frontend/node_modules/electron/dist/electron${NC}"
        fi
        
        # Проверка владельца
        ELECTRON_OWNER=$(stat -c '%U' frontend/node_modules/electron/dist/electron)
        if [ "$ELECTRON_OWNER" == "$USER" ]; then
            echo -e "${GREEN}✓${NC} Права доступа к Electron в порядке"
        else
            echo -e "${YELLOW}⚠${NC} Electron установлен от пользователя: $ELECTRON_OWNER"
            echo -e "   ${BLUE}Исправить: sudo chown -R \$USER:\$USER frontend/node_modules${NC}"
        fi
    fi
    
    # Вывод команды для установки недостающих пакетов
    if [ ${#ELECTRON_MISSING[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}📦 Для установки недостающих зависимостей Electron:${NC}"
        echo -e "   ${BLUE}sudo apt-get update${NC}"
        echo -e "   ${BLUE}sudo apt-get install -y ${ELECTRON_MISSING[*]}${NC}"
    fi
    
    echo ""
fi

# Проверка портов
echo -e "${YELLOW}Проверка портов:${NC}"
if lsof -i :8000 &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Порт 8000 занят (бэкенд)"
    lsof -i :8000 | grep LISTEN
else
    echo -e "${GREEN}✓${NC} Порт 8000 свободен (бэкенд)"
fi

if lsof -i :5173 &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Порт 5173 занят (фронтенд dev)"
    lsof -i :5173 | grep LISTEN
else
    echo -e "${GREEN}✓${NC} Порт 5173 свободен (фронтенд dev)"
fi
echo ""

# Проверка места на диске
echo -e "${YELLOW}Проверка места на диске:${NC}"
AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE" -ge 10 ]; then
    echo -e "${GREEN}✓${NC} Свободно ${AVAILABLE}GB (требуется >= 10GB)"
else
    echo -e "${RED}✗${NC} Недостаточно места: ${AVAILABLE}GB (требуется >= 10GB)"
    ALL_OK=false
fi
echo ""

# Итог
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✓ Все зависимости установлены!${NC}"
    echo ""
    echo -e "Можно запускать: ${BLUE}./start-lidarcleaner.sh${NC}"
else
    echo -e "${RED}✗ Обнаружены проблемы${NC}"
    echo ""
    echo -e "Смотрите инструкцию: ${BLUE}cat INSTALL.txt${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

