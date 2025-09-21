package handlers

import "github.com/gin-gonic/gin"

// RegisterRoutes - метод регистрации всех роутов в системе
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.HealthCheck)

	// Здесь мы обозначили все эндпоинты системы с соответствующими хендлерами
	minioRoutes := router.Group("/files")
	{
		minioRoutes.POST("/upload_file", h.CreateOne)

		//minioRoutes.GET("/:objectID", h.GetOne)
		//minioRoutes.GET("/many", h.GetMany)
		//
		//minioRoutes.DELETE("/:objectID", h.DeleteOne)
		//minioRoutes.DELETE("/many", h.DeleteMany)
	}

}
