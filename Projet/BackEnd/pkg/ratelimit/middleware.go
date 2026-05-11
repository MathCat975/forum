package ratelimit

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"main/pkg/auth"
	"main/pkg/routes"
)

func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func writeLimited(w http.ResponseWriter, retry time.Duration) {
	secs := int(retry.Seconds())
	if secs < 1 {
		secs = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(secs))
	routes.JsonError(w, "rate limit exceeded", http.StatusTooManyRequests)
}

func PerIP(l *Limiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ok, retry := l.Allow(ClientIP(r))
		if !ok {
			writeLimited(w, retry)
			return
		}
		next(w, r)
	}
}

func PerUser(l *Limiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := ""
		if claims, ok := auth.ClaimsFromContext(r.Context()); ok {
			key = "u:" + strconv.FormatUint(uint64(claims.UserID), 10)
		} else {
			key = "ip:" + ClientIP(r)
		}
		ok, retry := l.Allow(key)
		if !ok {
			writeLimited(w, retry)
			return
		}
		next(w, r)
	}
}

