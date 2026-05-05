package oauth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGenerateAndVerifyState(t *testing.T) {
	w := httptest.NewRecorder()
	state, err := SetStateCookie(w)
	if err != nil {
		t.Fatalf("SetStateCookie: %v", err)
	}
	if state == "" {
		t.Fatal("expected non-empty state")
	}

	req := httptest.NewRequest("GET", "/cb?state="+state, nil)
	for _, c := range w.Result().Cookies() {
		req.AddCookie(c)
	}

	w2 := httptest.NewRecorder()
	if err := VerifyStateCookie(w2, req, state); err != nil {
		t.Fatalf("VerifyStateCookie: %v", err)
	}
}

func TestVerifyStateMismatch(t *testing.T) {
	req := httptest.NewRequest("GET", "/cb", nil)
	req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "abc"})

	w := httptest.NewRecorder()
	if err := VerifyStateCookie(w, req, "different"); err == nil {
		t.Fatal("expected mismatch error, got nil")
	}
}
