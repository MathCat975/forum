package main

import (
	"log"
	"main/pkg/auth"
	"main/pkg/oauth"
	"main/pkg/ratelimit"
	"main/pkg/routes/api"
	"main/pkg/routes/front"

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

	if err := oauth.Init(); err != nil {
		log.Fatalf("OAuth initialization failed: %v", err)
	}

	_, err := db.Open("database.db")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	http.HandleFunc("/api/register", ratelimit.PerIP(ratelimit.Register, api.RegisterHandler))

	http.HandleFunc("/api/login", ratelimit.PerIP(ratelimit.Login, api.LoginHandler))

	http.HandleFunc("/api/auth/github", ratelimit.PerIP(ratelimit.Login, api.GitHubLoginHandler))
	http.HandleFunc("/api/auth/github/callback", api.GitHubCallbackHandler)
	http.HandleFunc("/api/auth/google", ratelimit.PerIP(ratelimit.Login, api.GoogleLoginHandler))
	http.HandleFunc("/api/auth/google/callback", api.GoogleCallbackHandler)
	http.HandleFunc("/api/auth/oauth/complete", ratelimit.PerIP(ratelimit.Register, api.OAuthCompleteHandler))

	http.HandleFunc("/api/upload", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.Upload, api.UploadImageHandler)))
	// Static files
	http.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("../FrontEnd/assets"))))

	// API routes
	http.HandleFunc("/api/register", api.RegisterHandler)
	http.HandleFunc("/api/login", api.LoginHandler)
	http.HandleFunc("/api/upload", api.UploadImageHandler)
	http.HandleFunc("/api/cdn/", api.ServeUpload)

	http.HandleFunc("/api/user/profile", auth.RequireAuth(api.GetUserProfileHandler))
	http.HandleFunc("/api/user", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.EditProfile, api.EditUserHandler)))

	http.HandleFunc("/api/user", auth.RequireAuth(api.EditUserHandler))
	http.HandleFunc("/api/categories", api.ListCategoriesHandler)
	
	// Front routes
	http.HandleFunc("/front/profile", func(w http.ResponseWriter, r *http.Request) {
		front.PageHandler(w, r, "profile")
	})
	http.HandleFunc("/front/ban", func(w http.ResponseWriter, r *http.Request) {
		front.PageHandler(w, r, "ban")
	})
	http.HandleFunc("/front/index", func(w http.ResponseWriter, r *http.Request) {
		front.PageHandler(w, r, "index")
	})
	http.HandleFunc("/front/login", func(w http.ResponseWriter, r *http.Request) {
		front.PageHandler(w, r, "login")
	})
	http.HandleFunc("/front/register", func(w http.ResponseWriter, r *http.Request) {
		front.PageHandler(w, r, "register")
	})

	http.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.GetPostHandler(w, r)
		case http.MethodPost:
			auth.RequireAuth(ratelimit.PerUser(ratelimit.CreatePost, api.CreatePostHandler))(w, r)
		case http.MethodPut, http.MethodPatch:
			auth.RequireAuth(ratelimit.PerUser(ratelimit.EditPost, api.EditPostHandler))(w, r)
		case http.MethodDelete:
			auth.RequireAuth(ratelimit.PerUser(ratelimit.EditPost, api.DeletePostHandler))(w, r)
		default:
			w.Header().Set("Allow", "GET, POST, PUT, PATCH, DELETE")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	http.HandleFunc("/api/posts/list", api.ListPostsByCategoryHandler)
	http.HandleFunc("/api/posts/reply", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.CreatePost, api.ReplyToPostHandler)))
	http.HandleFunc("/api/posts/vote", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.Vote, api.VotePostHandler)))
	http.HandleFunc("/api/comments", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.DeleteComment, api.DeleteCommentHandler)))

	http.HandleFunc("/api/search", ratelimit.PerIP(ratelimit.Search, api.SearchHandler))

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
