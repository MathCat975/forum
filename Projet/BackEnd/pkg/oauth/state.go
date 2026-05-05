package oauth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
)

const stateCookieName = "oauth_state"

func SetStateCookie(w http.ResponseWriter) (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	state := base64.RawURLEncoding.EncodeToString(buf)

	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   300,
	})
	return state, nil
}

func VerifyStateCookie(w http.ResponseWriter, r *http.Request, gotState string) error {
	cookie, err := r.Cookie(stateCookieName)
	if err != nil {
		return errors.New("missing state cookie")
	}
	if cookie.Value == "" || cookie.Value != gotState {
		return errors.New("state mismatch")
	}
	clearStateCookie(w)
	return nil
}

func clearStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
