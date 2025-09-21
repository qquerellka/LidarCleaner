package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"io"
	"lct/internal/domain/errors"
	"lct/internal/handlers/responses"
	"lct/internal/repository/minio"
	"lct/internal/service"
	"net/http"
)

type Handler struct {
	service service.ServiceInt
}

func NewMinioHandler(service service.ServiceInt) *Handler {
	return &Handler{
		service: service,
	}
}

//TODO: Сделать ручку обработки: Отправлять метаданные о файле через RabbitMQ

// TODO: Возвращать в CreateOne id файла из postgres
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "good",
	})
}

// CreateOne обработчик для создания одного объекта в хранилище MinIO из переданных данных.
func (h *Handler) CreateOne(c *gin.Context) {
	// Получаем файл из запроса
	file, err := c.FormFile("file")
	if err != nil {
		// Если файл не получен, возвращаем ошибку с соответствующим статусом и сообщением
		c.JSON(http.StatusBadRequest, errors.ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   "No file is received",
			Details: err,
		})
		return
	}

	//уникальный ключ для MinIO
	objectKey := uuid.New().String()

	// Открываем файл для чтения
	f, err := file.Open()
	if err != nil {
		// Если файл не удается открыть, возвращаем ошибку с соответствующим статусом и сообщением
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Unable to open the file",
			Details: err,
		})
		return
	}
	defer f.Close() // Закрываем файл после завершения работы с ним

	// Читаем содержимое файла в байтовый срез
	fileBytes, err := io.ReadAll(f)
	if err != nil {
		// Если не удается прочитать содержимое файла, возвращаем ошибку с соответствующим статусом и сообщением
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Unable to read the file",
			Details: err,
		})
		return
	}

	// Создаем структуру FileDataType для хранения данных файла
	fileData := minio.FileDataType{
		FileName: file.Filename, // Имя файла
		Data:     fileBytes,     // Содержимое файла в виде байтового среза
	}

	ctx := c.Request.Context()

	// Сохраняем файл в MinIO с помощью метода CreateOne
	link, id, err := h.service.CreateOne(&ctx, fileData, file.Filename, file.Size, objectKey)
	if err != nil {
		// Если не удается сохранить файл, возвращаем ошибку с соответствующим статусом и сообщением
		c.JSON(http.StatusInternalServerError, errors.ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   "Unable to save the file",
			Details: err,
		})
		return
	}

	// Возвращаем успешный ответ с URL-адресом сохраненного файла
	c.JSON(http.StatusOK, responses.SuccessResponse{
		Status:  http.StatusOK,
		Message: "File uploaded successfully",
		ID:      id,
		Data:    link, // URL-адрес загруженного файла
	})
}
