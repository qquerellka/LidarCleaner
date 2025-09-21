package pcd

import (
	"context"
	"lct/internal/repository"
	"lct/internal/repository/minio"
)

type Service struct {
	PostgresStorage repository.Repository
	MinioStorage    minio.Client
}

func NewService(postgres repository.Repository, minio minio.Client) *Service {
	return &Service{
		PostgresStorage: postgres,
		MinioStorage:    minio,
	}
}

func (s *Service) InitMinio() error {
	return s.MinioStorage.InitMinio()
}

func (s *Service) CreateOne(ctx *context.Context, file minio.FileDataType, fileName string, fileSize int64, objectKey string) (string, int64, error) {
	id, err := s.PostgresStorage.SaveMetaData(ctx, fileName, fileSize, objectKey)
	if err != nil {
		return "", 0, err
	}

	data, err := s.MinioStorage.CreateOne(file, objectKey)

	return data, id, err
}

func (s *Service) GetOne(objectID string) (string, error) {
	return s.MinioStorage.GetOne(objectID)
}
func (s *Service) GetMany(objectIDs []string) ([]string, error) {
	return s.MinioStorage.GetMany(objectIDs)
}
func (s *Service) DeleteOne(objectID string) error {
	return s.MinioStorage.DeleteOne(objectID)
}

func (s *Service) DeleteMany(objectIDs []string) error {
	return s.MinioStorage.DeleteMany(objectIDs)
}
