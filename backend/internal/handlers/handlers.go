package handlers

import (
	//"context"
	"encoding/json"
	"fmt"
	//"github.com/minio/minio-go/v7"
	//"github.com/minio/minio-go/v7/pkg/credentials"
	amqp "github.com/rabbitmq/amqp091-go"
	"io"
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
	// Получаем ID файла
	//idParam := c.Param("id")
	//id, err := strconv.ParseInt(idParam, 10, 64)
	//if err != nil {
	//	c.JSON(http.StatusBadRequest, errors.ErrorResponse{
	//		Status:  http.StatusBadRequest,
	//		Error:   "Неверный формат ID",
	//		Details: err,
	//	})
	//	return
	//}
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
	_, id, err := h.service.CreateOne(&ctx, f, file.Size, minio2.FileDataType{
		FileName: file.Filename,
		Data:     nil, // <-- не читаем всё в память
	}, file.Filename, file.Size, objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot save file"})
		return
	}
	//defer object.Close()

	// Получаем метаданные файла
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
	conn, err := amqp.Dial(os.Getenv("RABBITMQ_URL"))
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
	timeout := time.After(60 * time.Second)
	for {
		select {
		case msg := <-msgs:
			if msg.CorrelationId == corrID {
				var response map[string]string
				json.Unmarshal(msg.Body, &response)
				//processedMinioKey := response["minio_key"]

				object, err := h.service.GetOne(f, file.Size, minio2.FileDataType{
					FileName: file.Filename,
					Data:     nil, // <-- не читаем всё в память
				}, objectKey)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot save file"})
				}
				c.Writer.Header().Set("Content-Disposition", "attachment; filename=\""+file.Filename+"\"")
				c.Writer.Header().Set("Content-Type", "application/octet-stream")

				if _, err := io.Copy(c.Writer, object); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "stream error: " + err.Error()})
					return
				}
				//if err != nil {
				//	c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
				//		Status:  http.StatusGatewayTimeout,
				//		Error:   "Timeout ожидания обработки файла",
				//		Details: nil,
				//	})
				//}
				//c.JSON(http.StatusOK, responses.SuccessResponse{
				//	Status:  http.StatusOK,
				//	Message: "File processed successfully",
				//	ID:      id,
				//	Data:    link,
				//})
				//return
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

func (h *Handler) StartRabbitWorker() error {
	conn, err := amqp.Dial(os.Getenv("RABBITMQ_URL"))
	if err != nil {
		return err
	}
	ch, err := conn.Channel()
	if err != nil {
		return err
	}

	// объявляем exchange
	err = ch.ExchangeDeclare(
		"pcd_files", // exchange
		"fanout",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	// объявляем очередь
	q, err := ch.QueueDeclare(
		"file_metadata_queue", // очередь из конфига
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	// биндим очередь к exchange
	err = ch.QueueBind(
		q.Name,
		"",
		"pcd_files",
		false,
		nil,
	)
	if err != nil {
		return err
	}

	msgs, err := ch.Consume(q.Name, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	log.Println("RabbitMQ worker started...")

	for msg := range msgs {
		go func(m amqp.Delivery) {
			log.Printf("Received message: %s", string(m.Body))

			// тут парсим JSON с метаданными
			var meta map[string]string
			if err := json.Unmarshal(m.Body, &meta); err != nil {
				log.Printf("Ошибка разбора JSON: %v", err)
				m.Ack(false)
				return
			}

			// имитация обработки файла
			processedKey := "processed/" + meta["filename"]

			// формируем ответ
			response := map[string]string{
				"id":        meta["id"],
				"filename":  meta["filename"],
				"minio_key": processedKey,
			}
			respBody, _ := json.Marshal(response)

			// публикуем ответ в reply_to
			if m.ReplyTo != "" {
				err = ch.Publish(
					"",        // default exchange
					m.ReplyTo, // reply queue
					false,
					false,
					amqp.Publishing{
						ContentType:   "application/json",
						CorrelationId: m.CorrelationId,
						Body:          respBody,
					},
				)
				if err != nil {
					log.Printf("Ошибка отправки ответа: %v", err)
				}
			}

			m.Ack(false)
		}(msg)
	}

	return nil
}
