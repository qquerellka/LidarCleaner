package minio

import (
	//"bytes"
	"context"
	"fmt"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"io"
	"lct/config"
	"log"
	//"sync"
	"time"
)

// minioClient реализация интерфейса MinioClient
type minioClient struct {
	mc *minio.Client // Клиент Minio
}

// NewMinioClient создает новый экземпляр Minio Client
func NewMinioClient() Client {
	return &minioClient{} // Возвращает новый экземпляр minioClient с указанным именем бакета
}

// InitMinio подключается к Minio и создает бакет, если не существует
// Бакет - это контейнер для хранения объектов в Minio. Он представляет собой пространство имен, в котором можно хранить и организовывать файлы и папки.
func (m *minioClient) InitMinio() error {
	ctx := context.Background()

	var client *minio.Client
	var err error

	// пробуем 5 раз с паузой 3 секунды
	for i := 0; i < 5; i++ {
		client, err = minio.New(config.AppConfig.MinioEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(config.AppConfig.MinioRootUser, config.AppConfig.MinioRootPassword, ""),
			Secure: config.AppConfig.MinioUseSSL,
		})
		if err == nil {
			// сохранили клиент
			m.mc = client

			// проверяем бакет
			exists, err := m.mc.BucketExists(ctx, config.AppConfig.BucketName)
			if err == nil {
				if !exists {
					if err := m.mc.MakeBucket(ctx, config.AppConfig.BucketName, minio.MakeBucketOptions{}); err != nil {
						log.Printf("Ошибка при создании бакета: %v", err)
						return err
					}
					log.Printf("Бакет %s успешно создан", config.AppConfig.BucketName)
				} else {
					log.Printf("Бакет %s уже существует", config.AppConfig.BucketName)
				}
				return nil // всё успешно
			}
		}

		log.Printf("MinIO ещё не готов (попытка %d/10): %v", i+1, err)
		time.Sleep(3 * time.Second)
	}

	return fmt.Errorf("не удалось подключиться к MinIO после 10 попыток: %w", err)
}

// Контекст используется для передачи сигналов об отмене операции загрузки в случае необходимости.

// CreateOne создает один объект в бакете Minio.
// Метод принимает структуру fileData, которая содержит имя файла и его данные.
// В случае успешной загрузки данных в бакет, метод возвращает nil, иначе возвращает ошибку.
// Все операции выполняются в контексте задачи.
func (m *minioClient) CreateOne(r io.Reader, size int64, file FileDataType, objectID string) (*minio.Object, error) {

	// Создание потока данных для загрузки в бакет Minio.
	//reader := bytes.NewReader(file.Data)

	// Загрузка данных в бакет Minio с использованием контекста для возможности отмены операции.
	_, err := m.mc.PutObject(
		context.Background(),
		config.AppConfig.BucketName,
		objectID,
		r,
		size,
		minio.PutObjectOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("ошибка при создании объекта %s: %v", file.FileName, err)
	}
	info, err := m.mc.StatObject(context.Background(), config.AppConfig.BucketName, objectID, minio.StatObjectOptions{})
	log.Printf("Saved object size = %d\n", info.Size)

	object, err := m.mc.GetObject(
		context.Background(),
		config.AppConfig.BucketName,
		objectID,
		minio.GetObjectOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("ошибка при получении объекта %s: %v", file.FileName, err)
	}
	log.Println("файл загружен в minio")
	return object, nil
}

// GetOne получает один объект из бакета Minio по его идентификатору.
// Он принимает строку `objectID` в качестве параметра и возвращает срез байт данных объекта и ошибку, если такая возникает.
func (m *minioClient) GetOne(r io.Reader, size int64, file FileDataType, objectID string) (*minio.Object, error) {
	// Получение предварительно подписанного URL для доступа к объекту Minio.
	object, err := m.mc.GetObject(
		context.Background(),
		config.AppConfig.BucketName,
		objectID,
		minio.GetObjectOptions{},
	)
	if err != nil {
		log.Printf("ошибка при получении файла")
		return nil, fmt.Errorf("ошибка при получении объекта %s: %v", file.FileName, err)
	}
	log.Println("файл получен из minio")
	return object, nil

}
