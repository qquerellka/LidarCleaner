.PHONY: help build dist clean run docker-build docker-dist docker-clean

# Переменные
DOCKER_IMAGE_BUILDER = lidar-frontend-builder
DOCKER_IMAGE_RUNTIME = lidar-frontend-runtime
DOCKER_IMAGE_DIST = lidar-frontend-dist

help: ## Показать справку
	@echo "Доступные команды:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ============================================
# Локальная сборка
# ============================================

install: ## Установить зависимости
	npm install

build: ## Собрать приложение
	npm run build

dev: ## Запустить dev режим
	npm run dev

preview: ## Предпросмотр собранного приложения
	npm run preview

clean: ## Очистить build артефакты
	rm -rf dist dist-electron node_modules/.cache

# ============================================
# Docker сборка
# ============================================

docker-build: ## Собрать Docker образ (builder)
	docker build --target builder -t $(DOCKER_IMAGE_BUILDER) .

docker-runtime: ## Собрать Docker образ (runtime)
	docker build --target runtime -t $(DOCKER_IMAGE_RUNTIME) .

docker-dist-builder: ## Собрать Docker образ для создания дистрибутивов
	docker build --target dist-builder -t $(DOCKER_IMAGE_DIST) .

docker-all: docker-build docker-runtime docker-dist-builder ## Собрать все Docker образы

# ============================================
# Создание дистрибутивов через Docker
# ============================================

docker-dist-appimage: docker-dist-builder ## Создать AppImage
	@echo "Создание AppImage..."
	docker run --rm -v $(PWD)/dist:/app/dist $(DOCKER_IMAGE_DIST) electron-builder --linux AppImage
	@echo "✅ AppImage создан в dist/"

docker-dist-deb: docker-dist-builder ## Создать .deb пакет
	@echo "Создание .deb пакета..."
	docker run --rm -v $(PWD)/dist:/app/dist $(DOCKER_IMAGE_DIST) electron-builder --linux deb
	@echo "✅ .deb пакет создан в dist/"

docker-dist-rpm: docker-dist-builder ## Создать .rpm пакет
	@echo "Создание .rpm пакета..."
	docker run --rm -v $(PWD)/dist:/app/dist $(DOCKER_IMAGE_DIST) electron-builder --linux rpm
	@echo "✅ .rpm пакет создан в dist/"

docker-dist-all: docker-dist-builder ## Создать все форматы дистрибутивов
	@echo "Создание всех дистрибутивов..."
	docker run --rm -v $(PWD)/dist:/app/dist $(DOCKER_IMAGE_DIST) electron-builder --linux
	@echo "✅ Все дистрибутивы созданы в dist/"

# ============================================
# Docker Compose
# ============================================

compose-build: ## Собрать через docker-compose
	docker-compose up frontend-builder

compose-dist: ## Создать дистрибутив через docker-compose
	docker-compose up frontend-dist

compose-run: ## Запустить через docker-compose (требует X11)
	xhost +local:docker
	docker-compose up frontend-runtime
	xhost -local:docker

# ============================================
# Запуск в Docker
# ============================================

docker-run: docker-runtime ## Запустить приложение в Docker (требует X11)
	@echo "Разрешение доступа к X11..."
	xhost +local:docker
	docker run --rm \
		-e DISPLAY=$(DISPLAY) \
		-e BACKEND_URL=${BACKEND_URL:-http://localhost:8000} \
		-v /tmp/.X11-unix:/tmp/.X11-unix:rw \
		--net=host \
		$(DOCKER_IMAGE_RUNTIME)
	xhost -local:docker

# ============================================
# Очистка
# ============================================

docker-clean: ## Удалить Docker образы и контейнеры
	docker-compose down -v
	docker rmi $(DOCKER_IMAGE_BUILDER) $(DOCKER_IMAGE_RUNTIME) $(DOCKER_IMAGE_DIST) 2>/dev/null || true
	docker system prune -f

clean-all: clean docker-clean ## Полная очистка (локально + Docker)

# ============================================
# Утилиты
# ============================================

docker-shell: docker-build ## Открыть shell в builder контейнере
	docker run --rm -it --entrypoint /bin/bash $(DOCKER_IMAGE_BUILDER)

docker-logs: ## Показать логи docker-compose
	docker-compose logs -f

docker-ps: ## Показать запущенные контейнеры
	docker ps -a | grep lidar-frontend

docker-images: ## Показать размер образов
	@echo "Размер Docker образов:"
	@docker images | grep lidar-frontend || echo "Образы не найдены"

# ============================================
# Тестирование
# ============================================

test: build ## Запустить тесты (если есть)
	@echo "Тесты не настроены"

lint: ## Запустить линтер
	npm run lint 2>/dev/null || echo "Линтер не настроен"

# ============================================
# CI/CD
# ============================================

ci-build: ## CI: Сборка приложения
	npm ci
	npm run build

ci-dist: ## CI: Создание дистрибутивов
	docker-compose up frontend-dist

# ============================================
# Информация
# ============================================

info: ## Показать информацию о проекте
	@echo "=== Информация о проекте ==="
	@echo "Node версия: $$(node --version)"
	@echo "NPM версия: $$(npm --version)"
	@echo "Docker версия: $$(docker --version)"
	@echo "Docker Compose версия: $$(docker-compose --version 2>/dev/null || echo 'не установлен')"
	@echo ""
	@echo "=== Переменные окружения ==="
	@echo "BACKEND_URL: ${BACKEND_URL:-http://localhost:8000}"
	@echo "DISPLAY: ${DISPLAY:-не установлен}"
	@echo ""
	@echo "=== Директории ==="
	@echo "dist/: $$(du -sh dist 2>/dev/null | cut -f1 || echo 'не существует')"
	@echo "dist-electron/: $$(du -sh dist-electron 2>/dev/null | cut -f1 || echo 'не существует')"
	@echo "node_modules/: $$(du -sh node_modules 2>/dev/null | cut -f1 || echo 'не существует')"

version: ## Показать версию приложения
	@echo "LidarCleaner Frontend v$$(node -p "require('./package.json').version")"

