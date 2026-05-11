package oauth

import (
	"errors"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
)

var (
	githubConfig *oauth2.Config
	googleConfig *oauth2.Config

	frontendURL   string
	pendingSecret []byte
)

func Init() error {
	frontendURL = os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		return errors.New("FRONTEND_URL is not set")
	}

	secret := os.Getenv("OAUTH_PENDING_SECRET")
	if secret == "" {
		return errors.New("OAUTH_PENDING_SECRET is not set")
	}
	pendingSecret = []byte(secret)

	if id, sec, redir := os.Getenv("GITHUB_CLIENT_ID"), os.Getenv("GITHUB_CLIENT_SECRET"), os.Getenv("GITHUB_REDIRECT_URL"); id != "" && sec != "" && redir != "" {
		githubConfig = &oauth2.Config{
			ClientID:     id,
			ClientSecret: sec,
			RedirectURL:  redir,
			Scopes:       []string{"read:user", "user:email"},
			Endpoint:     endpoints.GitHub,
		}
	}

	if id, sec, redir := os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("GOOGLE_CLIENT_SECRET"), os.Getenv("GOOGLE_REDIRECT_URL"); id != "" && sec != "" && redir != "" {
		googleConfig = &oauth2.Config{
			ClientID:     id,
			ClientSecret: sec,
			RedirectURL:  redir,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     endpoints.Google,
		}
	}

	return nil
}

func FrontendURL() string { return frontendURL }
