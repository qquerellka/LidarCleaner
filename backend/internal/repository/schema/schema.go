package schema

type FileMetadata struct {
	ID               int    `json:"id"`
	OriginalFilename string `json:"filename"`
	ObjectKey        string `json:"minio_key"`
}
