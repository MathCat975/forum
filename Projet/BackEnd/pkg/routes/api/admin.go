package api

import (
	"encoding/json"
	"main/pkg/auth"
	"main/pkg/db"
	"main/pkg/routes"
	"main/pkg/structs"
	"net/http"
	"strconv"
)

type adminUserResponse struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	AvatarUrl string `json:"avatar_url"`
	CreatedAt string `json:"created_at"`
}

type changeRoleRequest struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
}

func ListUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || claims.Role != "admin" {
		routes.JsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var users []structs.User
	if err := db.GetDB().Table("users").OrderBy("id ASC").Find(&users); err != nil {
		routes.JsonError(w, "failed to load users", http.StatusInternalServerError)
		return
	}

	resp := make([]adminUserResponse, 0, len(users))
	for _, u := range users {
		resp = append(resp, adminUserResponse{
			ID:        u.ID,
			Username:  u.Username,
			Email:     u.Email,
			Role:      u.Role,
			AvatarUrl: u.AvatarUrl,
			CreatedAt: u.CreatedAt.Format("2006-01-02 15:04"),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func ChangeUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || claims.Role != "admin" {
		routes.JsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var req changeRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.UserID == 0 {
		routes.JsonError(w, "user_id required", http.StatusBadRequest)
		return
	}

	if req.Role != "user" && req.Role != "admin" && req.Role != "banned" {
		routes.JsonError(w, "role must be user, admin, or banned", http.StatusBadRequest)
		return
	}

	if req.UserID == claims.UserID {
		routes.JsonError(w, "cannot change your own role", http.StatusBadRequest)
		return
	}

	if _, err := db.GetDB().GetUserByID(req.UserID); err != nil {
		routes.JsonError(w, "user not found", http.StatusNotFound)
		return
	}

	if err := db.GetDB().Table("users").Where("id = ?", req.UserID).Update(map[string]any{"role": req.Role}); err != nil {
		routes.JsonError(w, "failed to update role", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func AdminDeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || claims.Role != "admin" {
		routes.JsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	id, err := strconv.ParseUint(r.URL.Query().Get("id"), 10, 64)
	if err != nil || id == 0 {
		routes.JsonError(w, "invalid user id", http.StatusBadRequest)
		return
	}

	if uint(id) == claims.UserID {
		routes.JsonError(w, "cannot delete yourself", http.StatusBadRequest)
		return
	}

	database := db.GetDB()

	if _, err := database.GetUserByID(uint(id)); err != nil {
		routes.JsonError(w, "user not found", http.StatusNotFound)
		return
	}

	var userPosts []structs.Post
	_ = database.Table("posts").Where("author_id = ?", id).Find(&userPosts)
	for _, p := range userPosts {
		_ = database.Table("messages").Where("post_id = ?", p.ID).Delete()
		_ = database.Table("postvotes").Where("post_id = ?", p.ID).Delete()
	}
	_ = database.Table("posts").Where("author_id = ?", id).Delete()
	_ = database.Table("messages").Where("author_id = ?", id).Delete()
	_ = database.Table("postvotes").Where("user_id = ?", id).Delete()
	_ = database.Table("useroauthaccounts").Where("user_id = ?", id).Delete()
	_ = database.Table("users").Where("id = ?", id).Delete()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
