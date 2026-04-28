package api

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	uploadsDir  = "./uploads"
	allowedName = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
	allowedExts = map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".svg":  true,
	}
)

func validateFileName(name string) error {
	if name != filepath.Base(name) {
		return errors.New("path segments not allowed")
	}

	if name == "." || name == ".." {
		return errors.New("invalid name")
	}

	if strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return errors.New("slashes not allowed")
	}

	if strings.HasPrefix(name, ".") {
		return errors.New("hidden files not allowed")
	}

	if !allowedName.MatchString(name) {
		return errors.New("invalid chars")
	}

	ext := strings.ToLower(filepath.Ext(name))
	if !allowedExts[ext] {
		return errors.New("invalid extension")
	}

	return nil
}

func ServeUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := strings.TrimPrefix(r.URL.Path, "/api/cdn/")
	if name == "" {
		http.NotFound(w, r)
		return
	}

	if err := validateFileName(name); err != nil {
		http.Error(w, "bad file name", http.StatusBadRequest)
		return
	}

	fullPath := filepath.Join(uploadsDir, name)

	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if info.IsDir() {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("X-Content-Type-Options", "nosniff")

	http.ServeFile(w, r, fullPath)
}
