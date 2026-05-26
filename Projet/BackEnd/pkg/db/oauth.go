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

func (db *DB) GetOAuthAccountsByUserID(userID uint) ([]structs.UserOAuthAccount, error) {
	var accs []structs.UserOAuthAccount
	err := db.Table("useroauthaccounts").Where("user_id = ?", userID).Find(&accs)
	if err != nil {
		return nil, fmt.Errorf("GetOAuthAccountsByUserID: %w", err)
	}
	return accs, nil
}

func (db *DB) GetOAuthAccountByUserAndProvider(userID uint, provider string) (*structs.UserOAuthAccount, error) {
	var acc structs.UserOAuthAccount
	err := db.Table("useroauthaccounts").
		Where("user_id = ?", userID).
		Where("provider = ?", provider).
		First(&acc)
	if err != nil {
		return nil, fmt.Errorf("GetOAuthAccountByUserAndProvider: %w", err)
	}
	return &acc, nil
}

func (db *DB) DeleteOAuthAccount(userID uint, provider string) error {
	return db.Table("useroauthaccounts").
		Where("user_id = ?", userID).
		Where("provider = ?", provider).
		Delete()
}
