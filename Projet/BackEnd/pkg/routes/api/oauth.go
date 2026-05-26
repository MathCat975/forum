package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"main/pkg/auth"
	"main/pkg/db"
	"main/pkg/oauth"
	"main/pkg/routes"
	"main/pkg/structs"

	xoauth2 "golang.org/x/oauth2"
)

const (
	usernameMin = 3
	usernameMax = 32
)

func GitHubLoginHandler(w http.ResponseWriter, r *http.Request) {
	startOAuth(w, r, "github")
}

func GoogleLoginHandler(w http.ResponseWriter, r *http.Request) {
	startOAuth(w, r, "google")
}

func startOAuth(w http.ResponseWriter, r *http.Request, name string) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	provider, err := oauth.ProviderByName(name)
	if err != nil {
		routes.JsonError(w, "provider not configured", http.StatusServiceUnavailable)
		return
	}
	state, err := oauth.SetStateCookie(w)
	if err != nil {
		routes.JsonError(w, "failed to start oauth", http.StatusInternalServerError)
		return
	}
	url := provider.Config().AuthCodeURL(state, xoauth2.AccessTypeOnline)
	http.Redirect(w, r, url, http.StatusFound)
}

func GitHubCallbackHandler(w http.ResponseWriter, r *http.Request) {
	handleCallback(w, r, "github")
}

func GoogleCallbackHandler(w http.ResponseWriter, r *http.Request) {
	handleCallback(w, r, "google")
}

func redirectErr(w http.ResponseWriter, r *http.Request, code string) {
	http.Redirect(w, r, oauth.FrontendURL()+"/login?error="+code, http.StatusFound)
}

func handleCallback(w http.ResponseWriter, r *http.Request, name string) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	provider, err := oauth.ProviderByName(name)
	if err != nil {
		redirectErr(w, r, "provider_error")
		return
	}

	gotState := r.URL.Query().Get("state")
	if err := oauth.VerifyStateCookie(w, r, gotState); err != nil {
		redirectErr(w, r, "state_mismatch")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		redirectErr(w, r, "provider_error")
		return
	}

	token, err := provider.Config().Exchange(r.Context(), code)
	if err != nil {
		redirectErr(w, r, "provider_error")
		return
	}

	info, err := provider.FetchUser(r.Context(), token)
	if err != nil {
		redirectErr(w, r, "provider_error")
		return
	}
	if info.Email == "" || !info.EmailVerified {
		redirectErr(w, r, "email_unverified")
		return
	}

	database := db.GetDB()

	acc, err := database.GetOAuthAccount(provider.Name(), info.ProviderUserID)
	if err == nil {
		user, err := database.GetUserByID(acc.UserID)
		if err != nil {
			redirectErr(w, r, "provider_error")
			return
		}
		issueSession(w, user)
		http.Redirect(w, r, oauth.FrontendURL()+"/", http.StatusFound)
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		redirectErr(w, r, "provider_error")
		return
	}

	if cookie, cookieErr := r.Cookie("token"); cookieErr == nil {
		if claims, parseErr := auth.ParseToken(cookie.Value); parseErr == nil {
			newAcc := structs.UserOAuthAccount{
				UserID:         claims.UserID,
				Provider:       provider.Name(),
				ProviderUserID: info.ProviderUserID,
				ProviderEmail:  info.Email,
			}
			if createErr := database.CreateOAuthAccount(&newAcc); createErr != nil {
				redirectErr(w, r, "provider_error")
				return
			}
			http.Redirect(w, r, oauth.FrontendURL()+"/profile", http.StatusFound)
			return
		}
	}

	if _, err := database.GetUserByEmail(info.Email); err == nil {
		redirectErr(w, r, "email_taken")
		return
	}

	pending := oauth.PendingClaims{
		Provider:       provider.Name(),
		ProviderUserID: info.ProviderUserID,
		Email:          info.Email,
		AvatarURL:      info.AvatarURL,
	}
	if err := oauth.SetPendingCookie(w, pending); err != nil {
		redirectErr(w, r, "provider_error")
		return
	}
	http.Redirect(w, r, oauth.FrontendURL()+"/complete-signup", http.StatusFound)
}

type oauthCompleteRequest struct {
	Username string `json:"username"`
}

func OAuthCompleteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pending, err := oauth.ReadPendingCookie(r)
	if err != nil {
		routes.JsonError(w, "pending session expired", http.StatusBadRequest)
		return
	}

	var req oauthCompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	username := strings.TrimSpace(req.Username)
	if len(username) < usernameMin || len(username) > usernameMax {
		routes.JsonError(w, "username must be 3-32 characters", http.StatusBadRequest)
		return
	}

	database := db.GetDB()

	if _, err := database.GetUserByUsername(username); err == nil {
		routes.JsonError(w, "username already in use", http.StatusConflict)
		return
	}

	avatar := pending.AvatarURL
	if avatar == "" {
		avatar = "default.png"
	}

	user := structs.User{
		Username:     username,
		Email:        pending.Email,
		AvatarUrl:    avatar,
		PasswordHash: nil,
		Role:         "user",
		CreatedAt:    time.Now(),
	}
	if err := database.CreateUser(&user); err != nil {
		routes.JsonError(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	created, err := database.GetUserByEmail(pending.Email)
	if err != nil {
		routes.JsonError(w, "failed to retrieve created user", http.StatusInternalServerError)
		return
	}

	if err := database.CreateOAuthAccount(&structs.UserOAuthAccount{
		UserID:         created.ID,
		Provider:       pending.Provider,
		ProviderUserID: pending.ProviderUserID,
		ProviderEmail:  pending.Email,
		CreatedAt:      time.Now(),
	}); err != nil {
		routes.JsonError(w, "failed to link oauth account", http.StatusInternalServerError)
		return
	}

	oauth.ClearPendingCookie(w)
	issueSession(w, created)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":   "ok",
		"username": created.Username,
	})
}

func issueSession(w http.ResponseWriter, user *structs.User) {
	tok, err := auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		return
	}
	auth.SetTokenCookie(w, tok)
}

type disconnectOAuthRequest struct {
	Provider string `json:"provider"`
}

func DisconnectOAuthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		routes.JsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	var req disconnectOAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		routes.JsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	provider := strings.TrimSpace(strings.ToLower(req.Provider))
	if provider == "git" {
		provider = "github"
	}
	if provider != "github" && provider != "google" {
		routes.JsonError(w, "provider must be github or google", http.StatusBadRequest)
		return
	}

	database := db.GetDB()

	user, err := database.GetUserByID(claims.UserID)
	if err != nil {
		routes.JsonError(w, "user not found", http.StatusNotFound)
		return
	}

	if _, err := database.GetOAuthAccountByUserAndProvider(user.ID, provider); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			routes.JsonError(w, "oauth account not linked", http.StatusNotFound)
			return
		}
		routes.JsonError(w, "failed to load oauth account", http.StatusInternalServerError)
		return
	}

	accounts, err := database.GetOAuthAccountsByUserID(user.ID)
	if err != nil {
		routes.JsonError(w, "failed to load oauth accounts", http.StatusInternalServerError)
		return
	}

	if user.PasswordHash == nil && len(accounts) <= 1 {
		routes.JsonError(w, "cannot disconnect last sign-in method", http.StatusBadRequest)
		return
	}

	if err := database.DeleteOAuthAccount(user.ID, provider); err != nil {
		routes.JsonError(w, "failed to disconnect oauth account", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
