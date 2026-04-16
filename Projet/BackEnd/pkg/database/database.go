package database

import (
	"fmt"
	"sync"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"main/pkg/structs"
)

type DB struct {
	conn *gorm.DB
}

var (
	instance *DB
	once     sync.Once
)

func GetDB() (*DB, error) {
	var err error
	once.Do(func() {
		dbConn, dbErr := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
		if dbErr != nil {
			err = fmt.Errorf("failed to connect database: %v", dbErr)
			return
		}

		if migrateErr := dbConn.AutoMigrate(&structs.User{}); migrateErr != nil {
			err = fmt.Errorf("AutoMigrate failed: %v", migrateErr)
			return
		}

		fmt.Println("Database ready")
		instance = &DB{conn: dbConn}
	})
	if err != nil {
		return nil, err
	}
	return instance, nil
}

func (db *DB) CreateUser(user *structs.User) error {
	result := db.conn.Create(user)
	return result.Error
}

func (db *DB) GetUserByID(id uint) (*structs.User, error) {
	var user structs.User
	result := db.conn.First(&user, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}