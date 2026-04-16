package db

import (
	"database/sql"
	"fmt"
	"sync"

	"main/pkg/structs"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	conn *sql.DB
}

var (
	instance *DB
	once     sync.Once
)

func Open(path string) (*DB, error) {
	var initErr error
	once.Do(func() {
		conn, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL")
		if err != nil {
			initErr = fmt.Errorf("open db: %w", err)
			return
		}
		if err = conn.Ping(); err != nil {
			initErr = fmt.Errorf("ping db: %w", err)
			return
		}
		instance = &DB{conn: conn}
		fmt.Println("Database ready")
		if err := instance.AutoMigrate(
			&structs.User{},
		); err != nil {
			initErr = err
			instance = nil
			return
		}
		_ = instance.Migrate("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
	})
	if initErr != nil {
		return nil, initErr
	}
	return instance, nil
}

func GetDB() *DB {
	if instance == nil {
		panic("db.GetDB called before db.Open")
	}
	return instance
}

func (d *DB) Close() error {
	return d.conn.Close()
}
