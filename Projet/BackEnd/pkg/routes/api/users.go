package api

import (
	"encoding/json"
	"net/http"
	"time"

	"main/pkg/auth"
	"main/pkg/db"
	"main/pkg/routes"
	"main/pkg/structs"

	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	database := db.GetDB()

	if _, err := database.GetUserByEmail(req.Email); err == nil {
		routes.JsonError(w, "email or username already in use", http.StatusConflict)
		return
	}

	if _, err := database.GetUserByUsername(req.Username); err == nil {
		routes.JsonError(w, "email or username already in use", http.StatusConflict)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}

	user := structs.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		CreatedAt:    time.Now(),
		AvatarUrl:    "default.png",
		Role:         "user",
	}

	if err := database.CreateUser(&user); err != nil {
		routes.JsonError(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	created, err := database.GetUserByEmail(req.Email)
	if err != nil {
		routes.JsonError(w, "failed to retrieve created user", http.StatusInternalServerError)
		return
	}

	tokenStr, err := auth.GenerateToken(created.ID, created.Username, created.Role)
	if err != nil {
		routes.JsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}
	auth.SetTokenCookie(w, tokenStr)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var user *structs.User
	var lookupErr error

	switch {
	case req.Email != "":
		user, lookupErr = db.GetDB().GetUserByEmail(req.Email)
	case req.Username != "":
		user, lookupErr = db.GetDB().GetUserByUsername(req.Username)
	default:
		routes.JsonError(w, "email or username required", http.StatusBadRequest)
		return
	}

	if lookupErr != nil {
		routes.JsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		routes.JsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	tokenStr, err := auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		routes.JsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}
	auth.SetTokenCookie(w, tokenStr)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type userProfileResponse struct {
	Username     string    `json:"username"`
	AvatarUrl    string    `json:"avatar_url"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	PostCount    int64     `json:"post_count"`
	CommentCount int64     `json:"comment_count"`
	LikeCount    int64     `json:"like_count"`
	DislikeCount int64     `json:"dislike_count"`
}

func GetUserProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if _, ok := auth.ClaimsFromContext(r.Context()); !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	username := r.URL.Query().Get("username")
	if username == "" {
		routes.JsonError(w, "username required", http.StatusBadRequest)
		return
	}

	user, err := db.GetDB().GetUserByUsername(username)
	if err != nil {
		routes.JsonError(w, "user not found", http.StatusNotFound)
		return
	}

	posts, comments, likes, dislikes, err := db.GetDB().UserStats(user.ID)
	if err != nil {
		routes.JsonError(w, "failed to load user stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userProfileResponse{
		Username:     user.Username,
		AvatarUrl:    user.AvatarUrl,
		Role:         user.Role,
		CreatedAt:    user.CreatedAt,
		PostCount:    posts,
		CommentCount: comments,
		LikeCount:    likes,
		DislikeCount: dislikes,
	})
}
