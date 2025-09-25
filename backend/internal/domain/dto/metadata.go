package dto

// FileMetadataDto DTO для метаданных файла
//type FileMetadataDto struct {
//	ID               int64  `json:"id"`
//	OriginalFilename string `json:"original_filename"`
//	Size             int64  `json:"size"`
//	Bucket           string `json:"bucket"`
//	ObjectKey        string `json:"object_key"`
//	CreatedAt        string `json:"created_at,omitempty"`
//}

// RabbitMQMessage структура сообщения для отправки в RabbitMQ
//type RabbitMQMessage struct {
//	Type     string          `json:"type"`
//	Metadata FileMetadataDto `json:"metadata"`
//}

// CVWorkerNotification уведомление от CV worker о готовности файла
//type CVWorkerNotification struct {
//	Type      string `json:"type"`
//	FileID    int64  `json:"file_id"`
//	Status    string `json:"status"` // "processed", "error"
//	MinioPath string `json:"minio_path,omitempty"`
//	Error     string `json:"error,omitempty"`
//}
