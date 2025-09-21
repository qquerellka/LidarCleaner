package repository

import (
	"context"
)

type Repository interface {
	SaveMetaData(ctx *context.Context, fileName string, fileSize int64, objectKey string) (int64, error)
}
