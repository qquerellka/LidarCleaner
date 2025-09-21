package service

import (
	"context"
	"lct/internal/repository/minio"
)

type ServiceInt interface {
	InitMinio() error
	CreateOne(ctx *context.Context, file minio.FileDataType, fileName string, dileSize int64, objectKey string) (string, int64, error)
	GetOne(objectID string) (string, error)
	GetMany(objectIDs []string) ([]string, error)
	DeleteOne(objectID string) error
}
