package config

import (
	"github.com/joho/godotenv"
	"log"
	"os"
	"strconv"
)

// Config структура, обозначающая структуру .env файла
type Config struct {
	Port              string // Порт, на котором запускается сервер
	MinioEndpoint     string // Адрес конечной точки Minio
	BucketName        string // Название конкретного бакета в Minio
	MinioRootUser     string // Имя пользователя для доступа к Minio
	MinioRootPassword string // Пароль для доступа к Minio
	MinioUseSSL       bool
	DatabaseURL       string
	RabbitMQURL       string // URL для подключения к RabbitMQ
	RabbitMQExchange  string // Имя exchange в RabbitMQ
	RabbitMQQueue     string // Имя очереди в RabbitMQ
}

var AppConfig *Config

// LoadConfig загружает конфигурацию из файла .env
//
//	func LoadConfig() {
//		// Загружаем переменные окружения из файла .env
//		err := godotenv.Load()
//		if err != nil {
//			log.Println("Error loading .env file")
//		}
//
//		// Устанавливаем конфигурационные параметры
//		AppConfig = &Config{
//			Port:              getEnv("PORT", "8000"),
//			MinioEndpoint:     "minio:9000",
//			BucketName:        "defaultbucket",
//			MinioRootUser:     "root",
//			MinioRootPassword: "minio_password",
//			MinioUseSSL:       false,
//			DatabaseURL:       "postgresql://postgres:postgres@db:5432/postgres?sslmode=disable",
//			RabbitMQURL:       "amqp://guest:guest@rabbitmq:5672/",
//			RabbitMQExchange:  "pcd_files",
//			RabbitMQQueue:     "file_metadata_queue",
//		}
//	}
func LoadConfig() {
	// Загружаем переменные окружения из файла .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}

	// Устанавливаем конфигурационные параметры
	AppConfig = &Config{
		Port:              "8000",
		MinioEndpoint:     "minio:9000",
		BucketName:        "defaultbucket",
		MinioRootUser:     "root",
		MinioRootPassword: "minio_password",
		MinioUseSSL:       false,
		DatabaseURL:       "postgresql://postgres:postgres@db:5432/postgres?sslmode=disable",
		RabbitMQURL:       "amqp://guest:guest@rabbitmq:5672/",
		RabbitMQExchange:  "pcd_files",
		RabbitMQQueue:     "file_metadata_queue",
	}
}

// getEnv считывает значение переменной окружения или возвращает значение по умолчанию, если переменная не установлена
func getEnv(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// getEnvAsInt считывает значение переменной окружения как целое число или возвращает значение по умолчанию, если переменная не установлена или не может быть преобразована в целое число
func getEnvAsInt(key string, defaultValue int) int {
	if valueStr := getEnv(key, ""); valueStr != "" {
		if value, err := strconv.Atoi(valueStr); err == nil {
			return value
		}
	}
	return defaultValue
}

// getEnvAsBool считывает значение переменной окружения как булево или возвращает значение по умолчанию, если переменная не установлена или не может быть преобразована в булево
func getEnvAsBool(key string, defaultValue bool) bool {
	if valueStr := getEnv(key, ""); valueStr != "" {
		if value, err := strconv.ParseBool(valueStr); err == nil {
			return value
		}
	}
	return defaultValue
}
