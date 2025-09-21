package responses

// Нужен для JSON ответов в случае правильной работы сервиса
type SuccessResponse struct {
	Status  int         `json:"status"`
	Message string      `json:"message"`
	ID      int64       `json:"id"`
	Data    interface{} `json:"data,omitempty"`
}
