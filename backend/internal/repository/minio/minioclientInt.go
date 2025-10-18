package minio

import (
	"github.com/minio/minio-go/v7"
	"io"
)

// Client интерфейс для взаимодействия с Minio
type Client interface {
	InitMinio() error                                                                              // Метод для инициализации подключения к Minio
	CreateOne(r io.Reader, size int64, file FileDataType, objectKey string) (*minio.Object, error) // Метод для создания одного объекта в бакете Minio
	GetOne(r io.Reader, size int64, file FileDataType, objectID string) (*minio.Object, error)     // Метод для получения одного объекта из бакета Minio
}
