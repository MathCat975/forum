package db

import (
	"database/sql"
	"fmt"

	"main/pkg/structs"
)

func (db *DB) GetUserByID(id uint) (*structs.User, error) {
	var user structs.User
	err := db.Table("users").Where("id = ?", id).First(&user)
	if err != nil {
		return nil, fmt.Errorf("GetUserByID: %w", err)
	}
	return &user, nil
}

func (db *DB) GetUserByEmail(email string) (*structs.User, error) {
	var user structs.User
	err := db.Table("users").Where("email = ?", email).First(&user)
	if err != nil {
		return nil, fmt.Errorf("GetUserByEmail: %w", err)
	}
	return &user, nil
}

func (db *DB) GetUserByUsername(username string) (*structs.User, error) {
	var user structs.User
	err := db.Table("users").Where("username = ?", username).First(&user)
	if err != nil {
		return nil, fmt.Errorf("GetUserByUsername: %w", err)
	}
	return &user, nil
}

func (db *DB) CreateUser(user *structs.User) error {
	return db.Create("users", user)
}

var ErrNoRows = sql.ErrNoRows
