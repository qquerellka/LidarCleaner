package usecase

import (
	"context"
	"github.com/minio/minio-go/v7"
	"io"
	"lct/internal/repository"
	minio2 "lct/internal/repository/minio"
	"lct/internal/repository/schema"
)

type Service struct {
	PostgresStorage repository.Repository
	MinioStorage    minio2.Client
}

func NewService(postgres repository.Repository, minio minio2.Client) *Service {
	return &Service{
		PostgresStorage: postgres,
		MinioStorage:    minio,
	}
}

func (s *Service) InitMinio() error {
	return s.MinioStorage.InitMinio()
}

func (s *Service) CreateOne(ctx *context.Context, r io.Reader, size int64, file minio2.FileDataType, fileName string, fileSize int64, objectKey string) (*minio.Object, int64, error) {
	id, err := s.PostgresStorage.SaveMetaData(ctx, fileName, fileSize, objectKey)
	if err != nil {
		return nil, 0, err
	}

	object, err := s.MinioStorage.CreateOne(r, size, file, objectKey)

	return object, id, err
}

func (s *Service) GetOne(r io.Reader, size int64, file minio2.FileDataType, objectID string) (*minio.Object, error) {
	return s.MinioStorage.GetOne(r, size, file, objectID)
}

func (s *Service) GetMetaDataByID(ctx *context.Context, id int64) (*schema.FileMetadata, error) {
	// Получаем метаданные из PostgreSQl
	return s.PostgresStorage.GetMetaDataByID(ctx, id)
}
