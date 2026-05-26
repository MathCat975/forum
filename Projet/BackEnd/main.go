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
	http.HandleFunc("/api/logout", api.LogoutHandler)

	http.HandleFunc("/api/auth/github", ratelimit.PerIP(ratelimit.Login, api.GitHubLoginHandler))
	http.HandleFunc("/api/auth/github/callback", api.GitHubCallbackHandler)
	http.HandleFunc("/api/auth/google", ratelimit.PerIP(ratelimit.Login, api.GoogleLoginHandler))
	http.HandleFunc("/api/auth/google/callback", api.GoogleCallbackHandler)
	http.HandleFunc("/api/auth/oauth/complete", ratelimit.PerIP(ratelimit.Register, api.OAuthCompleteHandler))

	http.HandleFunc("/api/upload", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.Upload, api.UploadImageHandler)))
	http.HandleFunc("/api/cdn/", api.ServeUpload)

	http.HandleFunc("/api/user/profile", auth.RequireAuth(api.GetUserProfileHandler))
	http.HandleFunc("/api/user/me", auth.RequireAuth(api.GetSelfHandler))
	http.HandleFunc("/api/user/oauth", auth.RequireAuth(api.DisconnectOAuthHandler))
	http.HandleFunc("/api/user", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.EditProfile, api.EditUserHandler)))

	http.HandleFunc("/api/categories", api.ListCategoriesHandler)

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

	http.HandleFunc("/api/admin/users", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.AdminAction, api.ListUsersHandler)))
	http.HandleFunc("/api/admin/users/role", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.AdminAction, api.ChangeUserRoleHandler)))
	http.HandleFunc("/api/admin/users/delete", auth.RequireAuth(
		ratelimit.PerUser(ratelimit.AdminAction, api.AdminDeleteUserHandler)))

	// Static files
	http.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("../FrontEnd/assets"))))

	// Page handler helper
	page := func(name string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			front.PageHandler(w, r, name)
		}
	}

	// Root routes
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/index", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})
	http.HandleFunc("/index", page("index"))
	http.HandleFunc("/login", page("login"))
	http.HandleFunc("/register", page("register"))
	http.HandleFunc("/profile", page("profile"))
	http.HandleFunc("/post", page("post"))
	http.HandleFunc("/create-post", page("create-post"))
	http.HandleFunc("/admin", page("admin"))
	http.HandleFunc("/ban", page("ban"))
	http.HandleFunc("/search", page("search"))
	http.HandleFunc("/complete-signup", page("complete-signup"))

	// Legacy /front/ routes
	http.HandleFunc("/front/index", page("index"))
	http.HandleFunc("/front/login", page("login"))
	http.HandleFunc("/front/register", page("register"))
	http.HandleFunc("/front/profile", page("profile"))
	http.HandleFunc("/front/post", page("post"))
	http.HandleFunc("/front/create-post", page("create-post"))
	http.HandleFunc("/front/admin", page("admin"))
	http.HandleFunc("/front/ban", page("ban"))
	http.HandleFunc("/front/search", page("search"))

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
