package db

import "fmt"

func (d *DB) Migrate(statements ...string) error {
	for i, stmt := range statements {
		if _, err := d.conn.Exec(stmt); err != nil {
			return fmt.Errorf("migration %d failed: %w\n--- SQL ---\n%s", i+1, err, stmt)
		}
	}
	return nil
}
