package usecase

import (
	"context"
	"github.com/minio/minio-go/v7"
	"lct/internal/repository"
	minio2 "lct/internal/repository/minio"
	"lct/internal/repository/schema"
)

type Service struct {
	PostgresStorage repository.Repository
	MinioStorage    minio2.Client
	//RabbitMQClient   rabbitmq.ClientInt
	//RabbitMQConsumer rabbitmq.ConsumerInt
}

func NewService(postgres repository.Repository, minio minio2.Client) *Service {
	return &Service{
		PostgresStorage: postgres,
		MinioStorage:    minio,
		//RabbitMQClient:   rabbitmqClient,
		//RabbitMQConsumer: rabbitmqConsumer,
	}
}

func (s *Service) InitMinio() error {
	return s.MinioStorage.InitMinio()
}

func (s *Service) CreateOne(ctx *context.Context, file minio2.FileDataType, fileName string, fileSize int64, objectKey string) (*minio.Object, int64, error) {
	id, err := s.PostgresStorage.SaveMetaData(ctx, fileName, fileSize, objectKey)
	if err != nil {
		return nil, 0, err
	}

	object, err := s.MinioStorage.CreateOne(file, objectKey)

	return object, id, err
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

func (s *Service) GetMetaDataByID(ctx *context.Context, id int64) (*schema.FileMetadata, error) {
	// Получаем метаданные из PostgreSQl
	return s.PostgresStorage.GetMetaDataByID(ctx, id)
}

func (s *Service) GetMinioFileLink(objectID string) (string, error) {
	return s.MinioStorage.GetMinioFileLink(objectID)
}
