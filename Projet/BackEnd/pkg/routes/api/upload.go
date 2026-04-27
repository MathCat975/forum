package api

import (
	"encoding/json"
	"fmt"
	"image/jpeg"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"main/pkg/auth"

	"github.com/disintegration/imaging"
)

const (
	maxUploadSize = 5 << 20
	targetSize    = 512
)

var UploadImageHandler = auth.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		jsonError(w, "file too large (max 3 MB)", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		jsonError(w, "missing image field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size > 3<<20 {
		jsonError(w, "file too large (max 3 MB) "+strconv.FormatInt(header.Size, 10), http.StatusRequestEntityTooLarge)
		return
	}

	ct := header.Header.Get("Content-Type")
	switch ct {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
	default:
		jsonError(w, "unsupported image type (jpeg, png, gif, webp only)", http.StatusUnsupportedMediaType)
		return
	}

	img, err := imaging.Decode(file, imaging.AutoOrientation(true))
	if err != nil {
		jsonError(w, "invalid image", http.StatusBadRequest)
		return
	}

	resized := imaging.Resize(img, targetSize, targetSize, imaging.Lanczos)

	claims, _ := auth.ClaimsFromContext(r.Context())
	filename := fmt.Sprintf("%d_%d.jpg", claims.UserID, time.Now().UnixNano())
	fullPath := filepath.Join(uploadsDir, filename)

	out, err := os.Create(fullPath)
	if err != nil {
		jsonError(w, "failed to save image", http.StatusInternalServerError)
		return
	}
	defer out.Close()

	if err := jpeg.Encode(out, resized, &jpeg.Options{Quality: 90}); err != nil {
		jsonError(w, "failed to encode image", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": "/api/cdn/" + filename,
	})
})
