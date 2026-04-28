package db

import (
	"database/sql"
	"fmt"
	"strings"

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

func (db *DB) UserStats(userID uint) (posts, comments, likes, dislikes int64, err error) {
	posts, err = db.Table("posts").Where("author_id = ?", userID).Count()
	if err != nil {
		return
	}

	comments, err = db.Table("messages").Where("author_id = ?", userID).Count()
	if err != nil {
		return
	}

	var userPosts []structs.Post
	if err = db.Table("posts").Where("author_id = ?", userID).Find(&userPosts); err != nil {
		return
	}
	if len(userPosts) == 0 {
		return
	}

	ids := make([]any, len(userPosts))
	placeholders := make([]string, len(userPosts))
	for i, p := range userPosts {
		ids[i] = p.ID
		placeholders[i] = "?"
	}
	inClause := "post_id IN (" + strings.Join(placeholders, ",") + ")"

	likes, err = db.Table("postvotes").Where(inClause, ids...).Where("value = ?", 1).Count()
	if err != nil {
		return
	}
	dislikes, err = db.Table("postvotes").Where(inClause, ids...).Where("value = ?", -1).Count()
	return
}
