package ratelimit

import (
	"math"
	"sync"
	"time"
)

type bucket struct {
	tokens     float64
	lastRefill time.Time
	lastSeen   time.Time
}

type Limiter struct {
	capacity   float64
	refillRate float64
	mu         sync.Mutex
	buckets    map[string]*bucket
}

func New(maxRequests int, per time.Duration) *Limiter {
	l := &Limiter{
		capacity:   float64(maxRequests),
		refillRate: float64(maxRequests) / per.Seconds(),
		buckets:    make(map[string]*bucket),
	}
	go l.cleanupLoop()
	return l
}

func (l *Limiter) Allow(key string) (bool, time.Duration) {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.capacity, lastRefill: now}
		l.buckets[key] = b
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = math.Min(l.capacity, b.tokens+elapsed*l.refillRate)
	b.lastRefill = now
	b.lastSeen = now

	if b.tokens < 1 {
		needed := 1 - b.tokens
		retry := time.Duration(needed/l.refillRate*float64(time.Second)) + time.Second
		return false, retry
	}

	b.tokens--
	return true, 0
}

func (l *Limiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-15 * time.Minute)
		l.mu.Lock()
		for k, b := range l.buckets {
			if b.lastSeen.Before(cutoff) {
				delete(l.buckets, k)
			}
		}
		l.mu.Unlock()
	}
}
