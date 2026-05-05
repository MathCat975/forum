package db

import (
	"fmt"

	"main/pkg/structs"
)

func (db *DB) GetOAuthAccount(provider, providerUserID string) (*structs.UserOAuthAccount, error) {
	var acc structs.UserOAuthAccount
	err := db.Table("useroauthaccounts").
		Where("provider = ?", provider).
		Where("provider_user_id = ?", providerUserID).
		First(&acc)
	if err != nil {
		return nil, fmt.Errorf("GetOAuthAccount: %w", err)
	}
	return &acc, nil
}

func (db *DB) CreateOAuthAccount(acc *structs.UserOAuthAccount) error {
	return db.Create("useroauthaccounts", acc)
}
