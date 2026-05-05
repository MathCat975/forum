package oauth

import (
	"net/http/httptest"
	"testing"
)

func TestPendingRoundTrip(t *testing.T) {
	pendingSecret = []byte("test-secret-please-do-not-use")

	claims := PendingClaims{
		Provider:       "github",
		ProviderUserID: "12345",
		Email:          "x@example.com",
		AvatarURL:      "https://example.com/a.png",
	}

	w := httptest.NewRecorder()
	if err := SetPendingCookie(w, claims); err != nil {
		t.Fatalf("SetPendingCookie: %v", err)
	}

	req := httptest.NewRequest("POST", "/complete", nil)
	for _, c := range w.Result().Cookies() {
		req.AddCookie(c)
	}

	got, err := ReadPendingCookie(req)
	if err != nil {
		t.Fatalf("ReadPendingCookie: %v", err)
	}
	if got.Provider != claims.Provider || got.ProviderUserID != claims.ProviderUserID || got.Email != claims.Email {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}

func TestReadPendingMissing(t *testing.T) {
	pendingSecret = []byte("test-secret-please-do-not-use")
	req := httptest.NewRequest("POST", "/complete", nil)
	if _, err := ReadPendingCookie(req); err == nil {
		t.Fatal("expected error for missing cookie")
	}
}
