package minio

import (
	"bytes"
	"context"
	"fmt"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"lct/config"
	"log"
	"sync"
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
func (m *minioClient) CreateOne(file FileDataType, objectID string) (*minio.Object, error) {

	// Создание потока данных для загрузки в бакет Minio.
	reader := bytes.NewReader(file.Data)

	// Загрузка данных в бакет Minio с использованием контекста для возможности отмены операции.
	_, err := m.mc.PutObject(context.Background(), config.AppConfig.BucketName, objectID, reader, int64(len(file.Data)), minio.PutObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("ошибка при создании объекта %s: %v", file.FileName, err)
	}

	// Получение URL для загруженного объекта
	//url, err := m.mc.PresignedGetObject(context.Background(),
	//	config.AppConfig.BucketName,
	//	objectID,
	//	time.Hour*24,
	//	nil,
	//)
	//if err != nil {
	//	return "", fmt.Errorf("ошибка при создании URL для объекта %s: %v", file.FileName, err)
	//}

	object, err := m.mc.GetObject(context.Background(), config.AppConfig.BucketName, objectID, minio.GetObjectOptions{})
	if err != nil {
		//http.Error(w, "Ошибка при получении файла: "+err.Error(), http.StatusInternalServerError)
		return nil, fmt.Errorf("ошибка при создании URL для объекта %s: %v", file.FileName, err)
	}
	//defer object.Close()
	//Внешний MinIO клиент для генерации presigned URL (использует внешний адрес)
	log.Println("файл загружен в minio")
	return object, nil
}

// GetOne получает один объект из бакета Minio по его идентификатору.
// Он принимает строку `objectID` в качестве параметра и возвращает срез байт данных объекта и ошибку, если такая возникает.
func (m *minioClient) GetOne(objectID string) (string, error) {
	// Получение предварительно подписанного URL для доступа к объекту Minio.
	url, err := m.mc.PresignedGetObject(context.Background(), config.AppConfig.BucketName, objectID, time.Second*24*60*60, nil)
	if err != nil {
		return "", fmt.Errorf("ошибка при получении URL для объекта %s: %v", objectID, err)
	}

	return url.String(), nil
}

// GetMany получает несколько объектов из бакета Minio по их идентификаторам.
func (m *minioClient) GetMany(objectIDs []string) ([]string, error) {
	// Создание каналов для передачи URL-адресов объектов и ошибок
	urlCh := make(chan string, len(objectIDs))         // Канал для URL-адресов объектов
	errCh := make(chan OperationError, len(objectIDs)) // Канал для ошибок

	var wg sync.WaitGroup                                 // WaitGroup для ожидания завершения всех горутин
	_, cancel := context.WithCancel(context.Background()) // Создание контекста с возможностью отмены операции
	defer cancel()                                        // Отложенный вызов функции отмены контекста при завершении функции GetMany

	// Запуск горутин для получения URL-адресов каждого объекта.
	for _, objectID := range objectIDs {
		wg.Add(1) // Увеличение счетчика WaitGroup перед запуском каждой горутины
		go func(objectID string) {
			defer wg.Done()                // Уменьшение счетчика WaitGroup после завершения горутины
			url, err := m.GetOne(objectID) // Получение URL-адреса объекта по его идентификатору с помощью метода GetOne
			if err != nil {
				errCh <- OperationError{ObjectID: objectID, Error: fmt.Errorf("ошибка при получении объекта %s: %v", objectID, err)} // Отправка ошибки в канал с ошибками
				cancel()                                                                                                             // Отмена операции при возникновении ошибки
				return
			}
			urlCh <- url // Отправка URL-адреса объекта в канал с URL-адресами
		}(objectID) // Передача идентификатора объекта в анонимную горутину
	}

	// Закрытие каналов после завершения всех горутин.
	go func() {
		wg.Wait()    // Блокировка до тех пор, пока счетчик WaitGroup не станет равным 0
		close(urlCh) // Закрытие канала с URL-адресами после завершения всех горутин
		close(errCh) // Закрытие канала с ошибками после завершения всех горутин
	}()

	// Сбор URL-адресов объектов и ошибок из каналов.
	var urls []string // Массив для хранения URL-адресов
	var errs []error  // Массив для хранения ошибок
	for url := range urlCh {
		urls = append(urls, url) // Добавление URL-адреса в массив URL-адресов
	}
	for opErr := range errCh {
		errs = append(errs, opErr.Error) // Добавление ошибки в массив ошибок
	}

	// Проверка наличия ошибок.
	if len(errs) > 0 {
		return nil, fmt.Errorf("ошибки при получении объектов: %v", errs) // Возврат ошибки, если возникли ошибки при получении объектов
	}

	return urls, nil // Возврат массива URL-адресов, если ошибок не возникло
}

// DeleteOne удаляет один объект из бакета Minio по его идентификатору.
func (m *minioClient) DeleteOne(objectID string) error {
	// Удаление объекта из бакета Minio.
	err := m.mc.RemoveObject(context.Background(), config.AppConfig.BucketName, objectID, minio.RemoveObjectOptions{})
	if err != nil {
		return err // Возвращаем ошибку, если не удалось удалить объект.
	}
	return nil // Возвращаем nil, если объект успешно удалён.
}

// DeleteMany удаляет несколько объектов из бакета Minio по их идентификаторам с использованием горутин.
func (m *minioClient) DeleteMany(objectIDs []string) error {
	// Создание канала для передачи ошибок с размером, равным количеству объектов для удаления
	errCh := make(chan OperationError, len(objectIDs)) // Канал для ошибок
	var wg sync.WaitGroup                              // WaitGroup для ожидания завершения всех горутин

	ctx, cancel := context.WithCancel(context.Background()) // Создание контекста с возможностью отмены операции
	defer cancel()                                          // Отложенный вызов функции отмены контекста при завершении функции DeleteMany

	// Запуск горутин для удаления каждого объекта.
	for _, objectID := range objectIDs {
		wg.Add(1) // Увеличение счетчика WaitGroup перед запуском каждой горутины
		go func(id string) {
			defer wg.Done()                                                                             // Уменьшение счетчика WaitGroup после завершения горутины
			err := m.mc.RemoveObject(ctx, config.AppConfig.BucketName, id, minio.RemoveObjectOptions{}) // Удаление объекта с использованием Minio клиента
			if err != nil {
				errCh <- OperationError{ObjectID: id, Error: fmt.Errorf("ошибка при удалении объекта %s: %v", id, err)} // Отправка ошибки в канал с ошибками
				cancel()                                                                                                // Отмена операции при возникновении ошибки
			}
		}(objectID) // Передача идентификатора объекта в анонимную горутину
	}

	// Ожидание завершения всех горутин и закрытие канала с ошибками.
	go func() {
		wg.Wait()    // Блокировка до тех пор, пока счетчик WaitGroup не станет равным 0
		close(errCh) // Закрытие канала с ошибками после завершения всех горутин
	}()

	// Сбор ошибок из канала.
	var errs []error // Массив для хранения ошибок
	for opErr := range errCh {
		errs = append(errs, opErr.Error) // Добавление ошибки в массив ошибок
	}

	// Проверка наличия ошибок.
	if len(errs) > 0 {
		return fmt.Errorf("ошибки при удалении объектов: %v", errs) // Возврат ошибки, если возникли ошибки при удалении объектов
	}

	return nil // Возврат nil, если ошибок не возникло
}

func (m *minioClient) GetMinioFileLink(objectID string) (string, error) {
	url, err := m.mc.PresignedGetObject(
		context.Background(),
		config.AppConfig.BucketName, // имя бакета в MinIO
		objectID,                    // ключ объекта (minio_key)
		time.Second*24*60*60,        // время жизни ссылки (в твоём случае сутки)
		nil,                         // можно передать кастомные query-параметры, тут пусто
	)
	if err != nil {
		return "", fmt.Errorf("ошибки при генерации ссылки на файл minio: %v", err)
	}

	return url.String(), err
}
