package api

import (
	"encoding/json"
	"net/http"
	"strings"
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

	hashStr := string(hashedPassword)
	user := structs.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: &hashStr,
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

	if user.PasswordHash == nil {
		routes.JsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
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

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	auth.ClearTokenCookie(w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type connexionServiceResponse struct {
	Git    *string `json:"git"`
	Google *string `json:"google"`
	Email  *string `json:"email"`
}

type userProfileResponse struct {
	Username          string                    `json:"username"`
	AvatarUrl         string                    `json:"avatar_url"`
	Role              string                    `json:"role"`
	CreatedAt         time.Time                 `json:"created_at"`
	PostCount         int64                     `json:"post_count"`
	CommentCount      int64                     `json:"comment_count"`
	LikeCount         int64                     `json:"like_count"`
	DislikeCount      int64                     `json:"dislike_count"`
	ConnexionService  *connexionServiceResponse `json:"connexionService,omitempty"`
	LastPosts         []postPreviewResponse    `json:"lastPosts"`
}

type postPreviewResponse struct {
	ID             uint      `json:"id"`
	Title          string    `json:"title"`
	Message        string    `json:"message"`
	CreatedAt      time.Time `json:"created_at"`
	AuthorUsername string   `json:"author_username"`
}

func buildConnexionService(user *structs.User, accounts []structs.UserOAuthAccount) *connexionServiceResponse {
	resp := &connexionServiceResponse{}
	if user.Email != "" {
		email := user.Email
		resp.Email = &email
	}
	for _, acc := range accounts {
		if acc.ProviderEmail == "" {
			continue
		}
		providerEmail := acc.ProviderEmail
		switch acc.Provider {
		case "github":
			resp.Git = &providerEmail
		case "google":
			resp.Google = &providerEmail
		}
	}
	return resp
}

func loadUserProfile(user *structs.User, includeConnexion bool) (*userProfileResponse, error) {
	database := db.GetDB()

	postCount, commentCount, likeCount, dislikeCount, err := database.UserStats(user.ID)
	if err != nil {
		return nil, err
	}

	lastPosts, err := database.UserLatestPosts(user.ID, 5)
	if err != nil {
		return nil, err
	}
	if lastPosts == nil {
		lastPosts = []structs.Post{}
	}

	lastPostPreviews := make([]postPreviewResponse, 0, len(lastPosts))
	for _, p := range lastPosts {
		authorUsername := ""
		if author, err := database.GetUserByID(p.AuthorId); err == nil {
			authorUsername = author.Username
		}

		lastPostPreviews = append(lastPostPreviews, postPreviewResponse{
			ID:             p.ID,
			Title:          p.Title,
			Message:        p.Message,
			CreatedAt:      p.CreatedAt,
			AuthorUsername: authorUsername,
		})
	}

	resp := &userProfileResponse{
		Username:     user.Username,
		AvatarUrl:    user.AvatarUrl,
		Role:         user.Role,
		CreatedAt:    user.CreatedAt,
		PostCount:    postCount,
		CommentCount: commentCount,
		LikeCount:    likeCount,
		DislikeCount: dislikeCount,
		LastPosts:    lastPostPreviews,
	}

	if includeConnexion {
		accounts, err := database.GetOAuthAccountsByUserID(user.ID)
		if err != nil {
			return nil, err
		}
		resp.ConnexionService = buildConnexionService(user, accounts)
	}

	return resp, nil
}

type editUserRequest struct {
	Username  *string `json:"username,omitempty"`
	AvatarUrl *string `json:"avatar_url,omitempty"`
}

func EditUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	var req editUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	database := db.GetDB()

	user, err := database.GetUserByID(claims.UserID)
	if err != nil {
		routes.JsonError(w, "user not found", http.StatusNotFound)
		return
	}

	fields := map[string]any{}

	if req.Username != nil {
		newName := strings.TrimSpace(*req.Username)
		if newName == "" {
			routes.JsonError(w, "username cannot be empty", http.StatusBadRequest)
			return
		}
		if newName != user.Username {
			if existing, err := database.GetUserByUsername(newName); err == nil && existing.ID != user.ID {
				routes.JsonError(w, "username already in use", http.StatusConflict)
				return
			}
			fields["username"] = newName
			user.Username = newName
		}
	}

	if req.AvatarUrl != nil {
		newAvatar := strings.TrimSpace(*req.AvatarUrl)
		if newAvatar == "" {
			routes.JsonError(w, "avatar_url cannot be empty", http.StatusBadRequest)
			return
		}
		if !strings.HasPrefix(newAvatar, "/api/cdn/") && newAvatar != "default.png" {
			routes.JsonError(w, "invalid avatar_url", http.StatusBadRequest)
			return
		}
		fields["avatar_url"] = newAvatar
		user.AvatarUrl = newAvatar
	}

	if len(fields) == 0 {
		routes.JsonError(w, "nothing to update", http.StatusBadRequest)
		return
	}

	if err := database.Table("users").Where("id = ?", user.ID).Update(fields); err != nil {
		routes.JsonError(w, "failed to update user", http.StatusInternalServerError)
		return
	}

	if _, renamed := fields["username"]; renamed {
		tokenStr, err := auth.GenerateToken(user.ID, user.Username, user.Role)
		if err != nil {
			routes.JsonError(w, "failed to refresh token", http.StatusInternalServerError)
			return
		}
		auth.SetTokenCookie(w, tokenStr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":     "ok",
		"username":   user.Username,
		"avatar_url": user.AvatarUrl,
	})
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

	profile, err := loadUserProfile(user, false)
	if err != nil {
		routes.JsonError(w, "failed to load user profile", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func GetSelfHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	user, err := db.GetDB().GetUserByUsername(claims.Username)
	if err != nil {
		routes.JsonError(w, "user not found", http.StatusNotFound)
		return
	}

	profile, err := loadUserProfile(user, true)
	if err != nil {
		routes.JsonError(w, "failed to load user profile", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}
