package service

import (
	"context"
	"github.com/minio/minio-go/v7"
	minio2 "lct/internal/repository/minio"
	"lct/internal/repository/schema"
)

type ServiceInt interface {
	InitMinio() error
	CreateOne(ctx *context.Context, file minio2.FileDataType, fileName string, dileSize int64, objectKey string) (*minio.Object, int64, error)
	GetOne(objectID string) (string, error)
	GetMany(objectIDs []string) ([]string, error)
	DeleteOne(objectID string) error
	GetMetaDataByID(ctx *context.Context, id int64) (*schema.FileMetadata, error)
	GetMinioFileLink(objectID string) (string, error)
}
