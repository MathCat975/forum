package ratelimit

import "time"

var (
	Login    = New(10, time.Minute)
	Register = New(5, time.Minute)

	Search        = New(30, time.Minute)
	CreatePost    = New(10, time.Minute)
	Vote          = New(30, time.Minute)
	EditProfile   = New(10, time.Minute)
	Upload        = New(10, time.Minute)
	DeleteComment = New(20, time.Minute)
	EditPost      = New(10, time.Minute)
	AdminAction   = New(30, time.Minute)
)
