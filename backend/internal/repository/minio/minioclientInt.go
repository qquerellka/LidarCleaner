package minio

import "github.com/minio/minio-go/v7"

// Client интерфейс для взаимодействия с Minio
type Client interface {
	InitMinio() error                                                     // Метод для инициализации подключения к Minio
	CreateOne(file FileDataType, objectKey string) (*minio.Object, error) // Метод для создания одного объекта в бакете Minio
	GetOne(objectID string) (string, error)                               // Метод для получения одного объекта из бакета Minio
	GetMany(objectIDs []string) ([]string, error)                         // Метод для получения нескольких объектов из бакета Minio
	DeleteOne(objectID string) error                                      // Метод для удаления одного объекта из бакета Minio
	DeleteMany(objectIDs []string) error                                  // Метод для удаления нескольких объектов из бакета Minio
	GetMinioFileLink(objectID string) (string, error)
}
