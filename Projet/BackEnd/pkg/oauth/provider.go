package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"golang.org/x/oauth2"
)

type UserInfo struct {
	ProviderUserID string
	Email          string
	EmailVerified  bool
	Username       string
	AvatarURL      string
}

type Provider interface {
	Name() string
	Config() *oauth2.Config
	FetchUser(ctx context.Context, token *oauth2.Token) (*UserInfo, error)
}

func ProviderByName(name string) (Provider, error) {
	switch name {
	case "github":
		if githubConfig == nil {
			return nil, errors.New("github provider not configured")
		}
		return githubProvider{}, nil
	case "google":
		if googleConfig == nil {
			return nil, errors.New("google provider not configured")
		}
		return googleProvider{}, nil
	default:
		return nil, fmt.Errorf("unknown provider %q", name)
	}
}

// ----- GitHub -----

type githubProvider struct{}

func (githubProvider) Name() string           { return "github" }
func (githubProvider) Config() *oauth2.Config { return githubConfig }

type githubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

func (githubProvider) FetchUser(ctx context.Context, token *oauth2.Token) (*UserInfo, error) {
	client := githubConfig.Client(ctx, token)

	var u githubUser
	if err := getJSON(ctx, client, "https://api.github.com/user", &u); err != nil {
		return nil, fmt.Errorf("fetch github user: %w", err)
	}
	if u.ID == 0 {
		return nil, errors.New("github returned empty user id")
	}

	email := u.Email
	verified := email != ""
	if email == "" {
		var emails []githubEmail
		if err := getJSON(ctx, client, "https://api.github.com/user/emails", &emails); err != nil {
			return nil, fmt.Errorf("fetch github emails: %w", err)
		}
		for _, e := range emails {
			if e.Primary && e.Verified {
				email = e.Email
				verified = true
				break
			}
		}
	}

	return &UserInfo{
		ProviderUserID: strconv.FormatInt(u.ID, 10),
		Email:          email,
		EmailVerified:  verified,
		Username:       u.Login,
		AvatarURL:      u.AvatarURL,
	}, nil
}

// ----- Google -----

type googleProvider struct{}

func (googleProvider) Name() string           { return "google" }
func (googleProvider) Config() *oauth2.Config { return googleConfig }

type googleUser struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (googleProvider) FetchUser(ctx context.Context, token *oauth2.Token) (*UserInfo, error) {
	client := googleConfig.Client(ctx, token)

	var u googleUser
	if err := getJSON(ctx, client, "https://www.googleapis.com/oauth2/v3/userinfo", &u); err != nil {
		return nil, fmt.Errorf("fetch google user: %w", err)
	}
	if u.Sub == "" {
		return nil, errors.New("google returned empty sub")
	}

	username := u.Name
	for i, c := range u.Email {
		if c == '@' {
			username = u.Email[:i]
			break
		}
	}

	return &UserInfo{
		ProviderUserID: u.Sub,
		Email:          u.Email,
		EmailVerified:  u.EmailVerified,
		Username:       username,
		AvatarURL:      u.Picture,
	}, nil
}

// ----- helpers -----

func getJSON(ctx context.Context, client *http.Client, url string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("GET %s: %s", url, resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(dest)
}
