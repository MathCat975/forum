package api

import (
	"encoding/json"
	"net/http"
	"time"

	"main/pkg/auth"
	"main/pkg/db"
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

type errorResponse struct {
	Error string `json:"error"`
}

func jsonError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(errorResponse{Error: message})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	database := db.GetDB()

	if _, err := database.GetUserByEmail(req.Email); err == nil {
		jsonError(w, "email or username already in use", http.StatusConflict)
		return
	}

	if _, err := database.GetUserByUsername(req.Username); err == nil {
		jsonError(w, "email or username already in use", http.StatusConflict)
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
		jsonError(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	created, err := database.GetUserByEmail(req.Email)
	if err != nil {
		jsonError(w, "failed to retrieve created user", http.StatusInternalServerError)
		return
	}

	tokenStr, err := auth.GenerateToken(created.ID, created.Username, created.Role)
	if err != nil {
		jsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}
	auth.SetTokenCookie(w, tokenStr)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
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
		jsonError(w, "email or username required", http.StatusBadRequest)
		return
	}

	if lookupErr != nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	tokenStr, err := auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		jsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}
	auth.SetTokenCookie(w, tokenStr)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
