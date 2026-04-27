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

	http.HandleFunc("/api/user/profile", auth.RequireAuth(api.GetUserProfileHandler))

	http.HandleFunc("/api/categories", api.ListCategoriesHandler)

	http.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.GetPostHandler(w, r)
		case http.MethodPost:
			auth.RequireAuth(api.CreatePostHandler)(w, r)
		case http.MethodPut, http.MethodPatch:
			auth.RequireAuth(api.EditPostHandler)(w, r)
		case http.MethodDelete:
			auth.RequireAuth(api.DeletePostHandler)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST, PUT, PATCH, DELETE")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	http.HandleFunc("/api/posts/list", api.ListPostsByCategoryHandler)
	http.HandleFunc("/api/posts/reply", auth.RequireAuth(api.ReplyToPostHandler))
	http.HandleFunc("/api/posts/vote", auth.RequireAuth(api.VotePostHandler))
	http.HandleFunc("/api/comments", auth.RequireAuth(api.DeleteCommentHandler))

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
