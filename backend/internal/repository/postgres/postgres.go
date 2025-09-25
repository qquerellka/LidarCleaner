package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"lct/config"
	"lct/internal/repository/schema"
	"log"
	"time"
)

type PostgresStorage struct {
	db *sql.DB
}

func (ps *PostgresStorage) GetDb() *sql.DB {
	return ps.db
}

func NewPostgresStorage(connStr string) (*PostgresStorage, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			db.Close()
		}
	}()
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(time.Hour)
	err = db.Ping()
	if err != nil {
		return nil, err
	}
	return &PostgresStorage{db: db}, nil
}

func (ps *PostgresStorage) SaveMetaData(ctx *context.Context, fileName string, fileSize int64, objectKey string) (int64, error) {
	query := `INSERT INTO files (original_filename, size, bucket, object_key) 
	          VALUES ($1, $2, $3, $4) RETURNING id`

	var ID int64
	err := ps.db.QueryRowContext(*ctx, query, fileName, fileSize, config.AppConfig.BucketName, objectKey).Scan(&ID)
	if err != nil {
		return 0, fmt.Errorf("failed to insert metadata: %w", err)
	}

	log.Printf("Метаданные сохранены в БД, id=%d", ID)
	return ID, nil
}

func (ps *PostgresStorage) GetMetaDataByID(ctx *context.Context, id int64) (*schema.FileMetadata, error) {
	query := `SELECT id, original_filename, object_key 
	          FROM files WHERE id = $1`

	var metadata schema.FileMetadata

	err := ps.db.QueryRowContext(*ctx, query, id).Scan(
		&metadata.ID,
		&metadata.OriginalFilename,
		&metadata.ObjectKey,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("файл с id %d не найден", id)
		}
		return nil, fmt.Errorf("ошибка при получении метаданных: %w", err)
	}

	log.Printf("Метаданные получены из БД для id=%d", id)
	return &metadata, nil
}
