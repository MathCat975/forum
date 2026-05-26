package oauth

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const pendingCookieName = "oauth_pending"
const pendingTTL = 5 * time.Minute

type PendingClaims struct {
	Provider       string `json:"provider"`
	ProviderUserID string `json:"provider_user_id"`
	Email          string `json:"email"`
	AvatarURL      string `json:"avatar_url"`
	jwt.RegisteredClaims
}

func SetPendingCookie(w http.ResponseWriter, c PendingClaims) error {
	now := time.Now()
	c.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(pendingTTL)),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	signed, err := tok.SignedString(pendingSecret)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     pendingCookieName,
		Value:    signed,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(pendingTTL.Seconds()),
	})
	return nil
}

func ReadPendingCookie(r *http.Request) (*PendingClaims, error) {
	cookie, err := r.Cookie(pendingCookieName)
	if err != nil {
		return nil, errors.New("missing pending cookie")
	}
	parsed, err := jwt.ParseWithClaims(cookie.Value, &PendingClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return pendingSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*PendingClaims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid pending claims")
	}
	return claims, nil
}

func ClearPendingCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     pendingCookieName,
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
