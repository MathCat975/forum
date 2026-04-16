package main

import (
	"log"
	"main/pkg/auth"
	"main/pkg/routes/api"
	"net/http"

	"main/pkg/db"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: no .env file, using environment variables")
	}

	if err := auth.Init(); err != nil {
		log.Fatalf("Auth initialization failed: %v", err)
	}

	_, err := db.Open("database.db")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	http.HandleFunc("/api/register", api.RegisterHandler)
	http.HandleFunc("/api/login", api.LoginHandler)
	http.HandleFunc("/api/upload", api.UploadImageHandler)
	http.HandleFunc("/api/cdn/", api.ServeUpload)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
