package structs

import "time"

type User struct {
	ID           uint      `db:"id"`
	Username     string    `db:"username,unique"`
	Email        string    `db:"email,unique"`
	AvatarUrl    string    `db:"avatar_url"`
	PasswordHash string    `db:"password_hash"`
	Role         string    `db:"role"`
	CreatedAt    time.Time `db:"created_at"`
}
