package api

import (
	"encoding/json"
	"main/pkg/auth"
	"main/pkg/db"
	"main/pkg/routes"
	"main/pkg/structs"
	"net/http"
	"strconv"
	"time"
)

type createPostRequest struct {
	Title      string `json:"title"`
	Message    string `json:"message"`
	CategoryId uint   `json:"category_id"`
}

type editPostRequest struct {
	Title   string `json:"title"`
	Message string `json:"message"`
}

type replyRequest struct {
	PostId  uint   `json:"post_id"`
	Message string `json:"message"`
}

type voteRequest struct {
	PostId uint `json:"post_id"`
	Value  int  `json:"value"`
}

type postResponse struct {
	structs.Post
	Likes    int64 `json:"likes"`
	Dislikes int64 `json:"dislikes"`
}

func CreatePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	var req createPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.Title == "" || req.Message == "" {
		routes.JsonError(w, "title and message required", http.StatusBadRequest)
		return
	}

	cat, ok := GetCategory(req.CategoryId)
	if !ok {
		routes.JsonError(w, "invalid category", http.StatusBadRequest)
		return
	}
	if cat.Locked && claims.Role != "admin" {
		routes.JsonError(w, "category locked", http.StatusForbidden)
		return
	}

	post := structs.Post{
		AuthorId:   claims.UserID,
		CategoryId: req.CategoryId,
		Title:      req.Title,
		Message:    req.Message,
		CreatedAt:  time.Now(),
	}

	if err := db.GetDB().Create("posts", &post); err != nil {
		routes.JsonError(w, "failed to create post", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func GetPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id, err := strconv.ParseUint(r.URL.Query().Get("id"), 10, 64)
	if err != nil || id == 0 {
		routes.JsonError(w, "invalid post id", http.StatusBadRequest)
		return
	}

	var post structs.Post
	if err := db.GetDB().Table("posts").Where("id = ?", id).First(&post); err != nil {
		routes.JsonError(w, "post not found", http.StatusNotFound)
		return
	}

	var comments []structs.Message
	if err := db.GetDB().Table("messages").Where("post_id = ?", id).OrderBy("created_at ASC").Find(&comments); err != nil {
		routes.JsonError(w, "failed to load comments", http.StatusInternalServerError)
		return
	}
	post.Comments = comments

	likes, _ := db.GetDB().Table("postvotes").Where("post_id = ?", id).Where("value = ?", 1).Count()
	dislikes, _ := db.GetDB().Table("postvotes").Where("post_id = ?", id).Where("value = ?", -1).Count()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(postResponse{Post: post, Likes: likes, Dislikes: dislikes})
}

func EditPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseUint(r.URL.Query().Get("id"), 10, 64)
	if err != nil || id == 0 {
		routes.JsonError(w, "invalid post id", http.StatusBadRequest)
		return
	}

	var req editPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var post structs.Post
	if err := db.GetDB().Table("posts").Where("id = ?", id).First(&post); err != nil {
		routes.JsonError(w, "post not found", http.StatusNotFound)
		return
	}

	if post.AuthorId != claims.UserID && claims.Role != "admin" {
		routes.JsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	fields := map[string]any{}
	if req.Title != "" {
		fields["title"] = req.Title
	}
	if req.Message != "" {
		fields["message"] = req.Message
	}
	if len(fields) == 0 {
		routes.JsonError(w, "nothing to update", http.StatusBadRequest)
		return
	}

	if err := db.GetDB().Table("posts").Where("id = ?", id).Update(fields); err != nil {
		routes.JsonError(w, "failed to update post", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func DeletePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseUint(r.URL.Query().Get("id"), 10, 64)
	if err != nil || id == 0 {
		routes.JsonError(w, "invalid post id", http.StatusBadRequest)
		return
	}

	var post structs.Post
	if err := db.GetDB().Table("posts").Where("id = ?", id).First(&post); err != nil {
		routes.JsonError(w, "post not found", http.StatusNotFound)
		return
	}

	if post.AuthorId != claims.UserID && claims.Role != "admin" {
		routes.JsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := db.GetDB().Table("messages").Where("post_id = ?", id).Delete(); err != nil {
		routes.JsonError(w, "failed to delete comments", http.StatusInternalServerError)
		return
	}

	if err := db.GetDB().Table("posts").Where("id = ?", id).Delete(); err != nil {
		routes.JsonError(w, "failed to delete post", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func ReplyToPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	var req replyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.PostId == 0 || req.Message == "" {
		routes.JsonError(w, "post_id and message required", http.StatusBadRequest)
		return
	}

	var post structs.Post
	if err := db.GetDB().Table("posts").Where("id = ?", req.PostId).First(&post); err != nil {
		routes.JsonError(w, "post not found", http.StatusNotFound)
		return
	}

	if cat, ok := GetCategory(post.CategoryId); ok && cat.Locked && claims.Role != "admin" {
		routes.JsonError(w, "post locked", http.StatusForbidden)
		return
	}

	msg := structs.Message{
		AuthorId:  claims.UserID,
		PostId:    req.PostId,
		Message:   req.Message,
		CreatedAt: time.Now(),
	}

	if err := db.GetDB().Create("messages", &msg); err != nil {
		routes.JsonError(w, "failed to create reply", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func DeleteCommentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseUint(r.URL.Query().Get("id"), 10, 64)
	if err != nil || id == 0 {
		routes.JsonError(w, "invalid comment id", http.StatusBadRequest)
		return
	}

	var msg structs.Message
	if err := db.GetDB().Table("messages").Where("id = ?", id).First(&msg); err != nil {
		routes.JsonError(w, "comment not found", http.StatusNotFound)
		return
	}

	if msg.AuthorId != claims.UserID && claims.Role != "admin" {
		routes.JsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := db.GetDB().Table("messages").Where("id = ?", id).Delete(); err != nil {
		routes.JsonError(w, "failed to delete comment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func VotePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	var req voteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.PostId == 0 {
		routes.JsonError(w, "post_id required", http.StatusBadRequest)
		return
	}
	if req.Value != 1 && req.Value != -1 {
		routes.JsonError(w, "value must be 1 or -1", http.StatusBadRequest)
		return
	}

	var post structs.Post
	if err := db.GetDB().Table("posts").Where("id = ?", req.PostId).First(&post); err != nil {
		routes.JsonError(w, "post not found", http.StatusNotFound)
		return
	}

	var existing structs.PostVote
	err := db.GetDB().
		Table("postvotes").
		Where("user_id = ?", claims.UserID).
		Where("post_id = ?", req.PostId).
		First(&existing)

	switch {
	case err == db.ErrNoRows:
		vote := structs.PostVote{
			UserId:    claims.UserID,
			PostId:    req.PostId,
			Value:     req.Value,
			CreatedAt: time.Now(),
		}
		if err := db.GetDB().Create("postvotes", &vote); err != nil {
			routes.JsonError(w, "failed to vote", http.StatusInternalServerError)
			return
		}
	case err != nil:
		routes.JsonError(w, "failed to vote", http.StatusInternalServerError)
		return
	default:
		if existing.Value == req.Value {
			if err := db.GetDB().Table("postvotes").Where("id = ?", existing.ID).Delete(); err != nil {
				routes.JsonError(w, "failed to vote", http.StatusInternalServerError)
				return
			}
		} else {
			if err := db.GetDB().Table("postvotes").Where("id = ?", existing.ID).Update(map[string]any{"value": req.Value}); err != nil {
				routes.JsonError(w, "failed to vote", http.StatusInternalServerError)
				return
			}
		}
	}

	likes, _ := db.GetDB().Table("postvotes").Where("post_id = ?", req.PostId).Where("value = ?", 1).Count()
	dislikes, _ := db.GetDB().Table("postvotes").Where("post_id = ?", req.PostId).Where("value = ?", -1).Count()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":   "ok",
		"likes":    likes,
		"dislikes": dislikes,
	})
}

type listPostsResponse struct {
	Posts    []structs.Post `json:"posts"`
	Page     int            `json:"page"`
	Size     int            `json:"size"`
	Total    int64          `json:"total"`
	HasMore  bool           `json:"has_more"`
}

func ListPostsByCategoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	categoryId, err := strconv.ParseUint(r.URL.Query().Get("category_id"), 10, 64)
	if err != nil || categoryId == 0 {
		routes.JsonError(w, "invalid category_id", http.StatusBadRequest)
		return
	}

	if _, ok := GetCategory(uint(categoryId)); !ok {
		routes.JsonError(w, "invalid category", http.StatusBadRequest)
		return
	}

	size := 20
	if s := r.URL.Query().Get("size"); s != "" {
		v, err := strconv.Atoi(s)
		if err != nil || v <= 0 {
			routes.JsonError(w, "invalid size", http.StatusBadRequest)
			return
		}
		size = v
	}
	if size > 50 {
		size = 50
	}

	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		v, err := strconv.Atoi(p)
		if err != nil || v <= 0 {
			routes.JsonError(w, "invalid page", http.StatusBadRequest)
			return
		}
		page = v
	}

	total, err := db.GetDB().Table("posts").Where("category_id = ?", categoryId).Count()
	if err != nil {
		routes.JsonError(w, "failed to count posts", http.StatusInternalServerError)
		return
	}

	var posts []structs.Post
	if err := db.GetDB().
		Table("posts").
		Where("category_id = ?", categoryId).
		OrderBy("created_at DESC").
		Limit(size).
		Offset((page - 1) * size).
		Find(&posts); err != nil {
		routes.JsonError(w, "failed to load posts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(listPostsResponse{
		Posts:   posts,
		Page:    page,
		Size:    size,
		Total:   total,
		HasMore: int64(page*size) < total,
	})
}
