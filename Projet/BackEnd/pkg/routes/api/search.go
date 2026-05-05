package api

import (
	"encoding/json"
	"errors"
	"main/pkg/db"
	"main/pkg/routes"
	"main/pkg/structs"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type searchResponse struct {
	Posts    []structs.Post    `json:"posts,omitempty"`
	Comments []structs.Message `json:"comments,omitempty"`
	Page     int               `json:"page"`
	Size     int               `json:"size"`
	Total    int64             `json:"total"`
	HasMore  bool              `json:"has_more"`
}

func SearchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	params := r.URL.Query()
	keyword := strings.TrimSpace(params.Get("q"))
	scope := params.Get("in")

	switch scope {
	case "", "all", "titles", "comments":
	default:
		routes.JsonError(w, "invalid in parameter", http.StatusBadRequest)
		return
	}

	var authorID uint
	if username := strings.TrimSpace(params.Get("username")); username != "" {
		user, err := db.GetDB().GetUserByUsername(username)
		if err != nil {
			writeEmptySearch(w, scope)
			return
		}
		authorID = user.ID
	}

	var categoryID uint
	if c := params.Get("category_id"); c != "" {
		v, err := strconv.ParseUint(c, 10, 64)
		if err != nil || v == 0 {
			routes.JsonError(w, "invalid category_id", http.StatusBadRequest)
			return
		}
		if _, ok := GetCategory(uint(v)); !ok {
			routes.JsonError(w, "invalid category", http.StatusBadRequest)
			return
		}
		categoryID = uint(v)
	}

	fromTime, hasFrom, err := parseSearchDate(params.Get("from"), false)
	if err != nil {
		routes.JsonError(w, "invalid from date", http.StatusBadRequest)
		return
	}
	toTime, hasTo, err := parseSearchDate(params.Get("to"), true)
	if err != nil {
		routes.JsonError(w, "invalid to date", http.StatusBadRequest)
		return
	}

	page, size, err := parsePagination(params)
	if err != nil {
		routes.JsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if keyword == "" && authorID == 0 && categoryID == 0 && !hasFrom && !hasTo {
		routes.JsonError(w, "at least one filter required", http.StatusBadRequest)
		return
	}

	if scope == "comments" {
		searchComments(w, keyword, authorID, categoryID, fromTime, hasFrom, toTime, hasTo, page, size)
		return
	}
	searchPosts(w, keyword, scope, authorID, categoryID, fromTime, hasFrom, toTime, hasTo, page, size)
}

func searchPosts(w http.ResponseWriter, keyword, scope string, authorID, categoryID uint, fromTime time.Time, hasFrom bool, toTime time.Time, hasTo bool, page, size int) {
	build := func() *db.Query {
		q := db.GetDB().Table("posts")
		if keyword != "" {
			pattern := "%" + keyword + "%"
			if scope == "titles" {
				q.Where("title LIKE ?", pattern)
			} else {
				q.Where("(title LIKE ? OR message LIKE ?)", pattern, pattern)
			}
		}
		if authorID != 0 {
			q.Where("author_id = ?", authorID)
		}
		if categoryID != 0 {
			q.Where("category_id = ?", categoryID)
		}
		if hasFrom {
			q.Where("created_at >= ?", fromTime)
		}
		if hasTo {
			q.Where("created_at < ?", toTime)
		}
		return q
	}

	total, err := build().Count()
	if err != nil {
		routes.JsonError(w, "search failed", http.StatusInternalServerError)
		return
	}

	var posts []structs.Post
	if err := build().
		OrderBy("created_at DESC").
		Limit(size).
		Offset((page - 1) * size).
		Find(&posts); err != nil {
		routes.JsonError(w, "search failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(searchResponse{
		Posts:   posts,
		Page:    page,
		Size:    size,
		Total:   total,
		HasMore: int64(page*size) < total,
	})
}

func searchComments(w http.ResponseWriter, keyword string, authorID, categoryID uint, fromTime time.Time, hasFrom bool, toTime time.Time, hasTo bool, page, size int) {
	build := func() *db.Query {
		q := db.GetDB().Table("messages")
		if keyword != "" {
			q.Where("message LIKE ?", "%"+keyword+"%")
		}
		if authorID != 0 {
			q.Where("author_id = ?", authorID)
		}
		if categoryID != 0 {
			q.Where("post_id IN (SELECT id FROM posts WHERE category_id = ?)", categoryID)
		}
		if hasFrom {
			q.Where("created_at >= ?", fromTime)
		}
		if hasTo {
			q.Where("created_at < ?", toTime)
		}
		return q
	}

	total, err := build().Count()
	if err != nil {
		routes.JsonError(w, "search failed", http.StatusInternalServerError)
		return
	}

	var comments []structs.Message
	if err := build().
		OrderBy("created_at DESC").
		Limit(size).
		Offset((page - 1) * size).
		Find(&comments); err != nil {
		routes.JsonError(w, "search failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(searchResponse{
		Comments: comments,
		Page:     page,
		Size:     size,
		Total:    total,
		HasMore:  int64(page*size) < total,
	})
}

func writeEmptySearch(w http.ResponseWriter, scope string) {
	resp := searchResponse{Page: 1, Size: 0}
	if scope == "comments" {
		resp.Comments = []structs.Message{}
	} else {
		resp.Posts = []structs.Post{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func parseSearchDate(raw string, endOfDay bool) (time.Time, bool, error) {
	if raw == "" {
		return time.Time{}, false, nil
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		if endOfDay {
			t = t.Add(24 * time.Hour)
		}
		return t, true, nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, true, nil
	}
	return time.Time{}, false, errors.New("invalid date")
}

func parsePagination(params url.Values) (page, size int, err error) {
	page = 1
	size = 20
	if v := params.Get("size"); v != "" {
		n, e := strconv.Atoi(v)
		if e != nil || n <= 0 {
			return 0, 0, errors.New("invalid size")
		}
		size = n
	}
	if size > 50 {
		size = 50
	}
	if v := params.Get("page"); v != "" {
		n, e := strconv.Atoi(v)
		if e != nil || n <= 0 {
			return 0, 0, errors.New("invalid page")
		}
		page = n
	}
	return page, size, nil
}
