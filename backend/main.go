package main

import (
	"lct/config"
	"lct/internal/handlers"
	"lct/internal/repository/minio"
	"lct/internal/repository/postgres"
	"lct/internal/service/usecase"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	//Загрузка конфигурации из файла .env
	config.LoadConfig()
	log.Printf("Config: %+v\n", config.AppConfig)
	DatabaseURL := config.AppConfig.DatabaseURL

	//Миграции
	m, err := migrate.New("file://migrations", DatabaseURL)

	if err != nil {
		log.Fatalf("unable to create migrations instance: %v", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("unable to run migrations: %v", err)
	}
	log.Println("migrations successfully created")

	// Инициализация соединения с Minio
	minioClient := minio.NewMinioClient()
	err = minioClient.InitMinio()
	if err != nil {
		log.Fatalf("Ошибка инициализации Minio: %v", err)
	}
	//Инициализация слоя хранилища
	postgresRepo, err := postgres.NewPostgresStorage(DatabaseURL)
	if err != nil {
		log.Fatalf("error init postgres storage: %v", err)
	}

	//Инициализация сервисного слоя
	service := usecase.NewService(postgresRepo, minioClient)

	// Инициализация маршрутизатора Gin
	router := gin.Default()
	h := handlers.NewMinioHandler(service) // условно
	h.RegisterRoutes(router)

	go func() {
		err := h.StartRabbitWorker()
		if err != nil {
			log.Fatalf("Failed to start RabbitMQ worker: %v", err)
		}
	}()

	// Запуск сервера Gin
	port := config.AppConfig.Port // Мы берем
	err = router.Run(":" + port)
	if err != nil {
		log.Fatalf("Ошибка запуска сервера Gin: %v", err)
	}
}
