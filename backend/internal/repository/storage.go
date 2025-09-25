package repository

import (
	"context"
	"lct/internal/repository/schema"
)

type Repository interface {
	SaveMetaData(ctx *context.Context, fileName string, fileSize int64, objectKey string) (int64, error)
	GetMetaDataByID(ctx *context.Context, id int64) (*schema.FileMetadata, error)
}
