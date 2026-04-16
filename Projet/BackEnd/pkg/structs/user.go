package structs

import "time"

type User struct {
	ID        uint   `gorm:"primaryKey"`
	Username  string `gorm:"unique"`
	Email     string `gorm:"unique"`
	AvatarUrl string
	PasswordHash  string
	CreatedAt time.Time
}