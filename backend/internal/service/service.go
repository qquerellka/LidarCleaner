package service

import (
	"context"
	"github.com/minio/minio-go/v7"
	"io"
	minio2 "lct/internal/repository/minio"
	"lct/internal/repository/schema"
)

type ServiceInt interface {
	InitMinio() error
	CreateOne(ctx *context.Context, r io.Reader, size int64, file minio2.FileDataType, fileName string, fileSize int64, objectKey string) (*minio.Object, int64, error)
	GetOne(r io.Reader, size int64, file minio2.FileDataType, objectID string) (*minio.Object, error)
	GetMetaDataByID(ctx *context.Context, id int64) (*schema.FileMetadata, error)
}
