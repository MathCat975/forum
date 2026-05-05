package structs

import "time"

type UserOAuthAccount struct {
	ID             uint      `db:"id"`
	UserID         uint      `db:"user_id"`
	Provider       string    `db:"provider"`
	ProviderUserID string    `db:"provider_user_id"`
	CreatedAt      time.Time `db:"created_at"`
}
