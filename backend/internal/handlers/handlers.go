package handlers

import (
	//"context"
	"encoding/json"
	"fmt"

	//"github.com/minio/minio-go/v7"
	//"github.com/minio/minio-go/v7/pkg/credentials"
	"io"

	amqp "github.com/rabbitmq/amqp091-go"

	//"lct/config"
	"lct/internal/domain/errors"
	//"lct/internal/handlers/responses"
	minio2 "lct/internal/repository/minio"
	"lct/internal/service"
	"log"
	"net/http"
	"os"

	//"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service service.ServiceInt
}

func NewMinioHandler(service service.ServiceInt) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "good",
	})
}

func (h *Handler) CreateOne(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file received"})
		return
	}

	objectKey := uuid.New().String()

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open file"})
		return
	}
	defer f.Close()

	ctx := c.Request.Context()
	object, _, err := h.service.CreateOne(&ctx, f, file.Size, minio2.FileDataType{
		FileName: file.Filename,
		Data:     nil, // <-- не читаем всё в память
	}, file.Filename, file.Size, objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot save file"})
		return
	}
	defer object.Close()

	c.Writer.Header().Set("Content-Disposition", "attachment; filename=\""+file.Filename+"\"")
	c.Writer.Header().Set("Content-Type", "application/octet-stream")

	if _, err := io.Copy(c.Writer, object); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "stream error: " + err.Error()})
		return
	}
}

// GetFileByID обработчик для получения файла по ID после обработки CV worker
func (h *Handler) GetFileByIDAsync(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file received"})
		return
	}

	objectKey := uuid.New().String()
	log.Printf("objectkey исходного файла: %s", objectKey)

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open file"})
		return
	}
	defer f.Close()

	ctx := c.Request.Context()
	_, id, err := h.service.CreateOne(&ctx, f, file.Size, minio2.FileDataType{
		FileName: file.Filename,
		Data:     nil, // <-- не читаем всё в память
	}, file.Filename, file.Size, objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot save file"})
		return
	}
	metadata, err := h.service.GetMetaDataByID(&ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, errors.ErrorResponse{
			Status:  http.StatusNotFound,
			Error:   "Файл не найден или не готов",
			Details: err,
		})
		return
	}

	// Подключаемся к RabbitMQ
	conn, err := amqp.DialConfig(os.Getenv("RABBITMQ_URL"), amqp.Config{
		Heartbeat: 10 * time.Minute, // Увеличить heartbeat
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Не удалось подключиться к RabbitMQ",
			Details: err,
		})
		return
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Ошибка канала RabbitMQ",
			Details: err,
		})
		return
	}
	defer ch.Close()

	err = ch.ExchangeDeclare(
		"pcd_files", // имя exchange
		"fanout",    // тип
		true,        // durable
		false,       // autoDelete
		false,       // internal
		false,       // noWait
		nil,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Ошибка объявления exchange",
			Details: err,
		})
		return
	}

	// Создаём уникальную reply queue
	replyQueue, _ := ch.QueueDeclare("", false, true, true, false, nil)
	corrID := uuid.New().String()

	msgs, _ := ch.Consume(replyQueue.Name, "", true, false, false, false, nil)

	// Отправляем сообщение с метаданными
	meta := map[string]string{
		"id":        fmt.Sprintf("%d", id),
		"filename":  metadata.OriginalFilename,
		"minio_key": metadata.ObjectKey,
	}
	body, _ := json.Marshal(meta)

	err = ch.Publish(
		"pcd_files", // exchange
		"",          // routingKey пустой для fanout
		false,
		false,
		amqp.Publishing{
			ContentType:   "application/json",
			Body:          body,
			ReplyTo:       replyQueue.Name,
			CorrelationId: corrID,
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Не удалось отправить сообщение в exchange",
			Details: err,
		})
		return
	}

	// Ждём ответа от воркера
	timeout := time.After(2 * time.Hour)
	for {
		select {
		case msg := <-msgs:
			if msg.CorrelationId == corrID {
				var response map[string]string
				err := json.Unmarshal(msg.Body, &response)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot unmarshal response"})
				}
				log.Println(response)
				processedMinioKey := response["minio_key"]
				processedFileName := response["filename"]
				//processedFileSize := response["minio_key"]

				object, err := h.service.GetOne(f, file.Size, minio2.FileDataType{
					FileName: processedFileName,
					Data:     nil, // <-- не читаем всё в память
				}, processedMinioKey)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot save file"})
					return
				}
				defer object.Close()
				stat, err := object.Stat()
				if err != nil {
					log.Printf("Ошибка при получении метаданных объекта: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot get object metadata: " + err.Error()})
					return
				}
				log.Printf("Размер объекта: %d байт", stat.Size)
				if stat.Size == 0 {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "object is empty"})
					return
				}

				c.Writer.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", processedFileName))
				c.Writer.Header().Set("Content-Type", "application/x-ply")
				c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size))

				log.Println("Начинаем передачу файла клиенту")
				if _, err := io.Copy(c.Writer, object); err != nil {
					log.Printf("Ошибка при передаче файла: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "stream error: " + err.Error()})
					return
				}
				log.Println("Файл успешно передан клиенту")
				return
			}
		case <-timeout:
			c.JSON(http.StatusGatewayTimeout, errors.ErrorResponse{
				Status:  http.StatusGatewayTimeout,
				Error:   "Timeout ожидания обработки файла",
				Details: nil,
			})
			return
		}
	}
}
