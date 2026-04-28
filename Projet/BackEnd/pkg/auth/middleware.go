package auth

import (
	"context"
	"encoding/json"
	"net/http"
)

type contextKey string

const claimsKey contextKey = "claims"

func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*Claims)
	return c, ok
}

func authError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func extractClaims(w http.ResponseWriter, r *http.Request) (*Claims, bool) {
	cookie, err := r.Cookie("token")
	if err != nil {
		authError(w, "authentication required", http.StatusUnauthorized)
		return nil, false
	}
	claims, err := ParseToken(cookie.Value)
	if err != nil {
		authError(w, "invalid or expired token", http.StatusUnauthorized)
		return nil, false
	}
	return claims, true
}

func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := extractClaims(w, r)
		if !ok {
			return
		}
		if claims.Role == "banned" {
			authError(w, "account banned", http.StatusForbidden)
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
	}
}

func RequireRole(next http.HandlerFunc, roles ...string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := extractClaims(w, r)
		if !ok {
			return
		}
		if claims.Role == "banned" {
			authError(w, "account banned", http.StatusForbidden)
			return
		}
		for _, role := range roles {
			if claims.Role == role {
				next(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
				return
			}
		}
		authError(w, "forbidden", http.StatusForbidden)
	}
}
