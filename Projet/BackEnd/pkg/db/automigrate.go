package db

import (
	"fmt"
	"reflect"
	"strings"
	"time"
)

var timeType = reflect.TypeOf(time.Time{})

func (d *DB) AutoMigrate(models ...any) error {
	for _, model := range models {
		stmt, err := buildCreateTable(model)
		if err != nil {
			return err
		}
		if _, err := d.conn.Exec(stmt); err != nil {
			return fmt.Errorf("AutoMigrate %T: %w", model, err)
		}
	}
	return nil
}

func buildCreateTable(model any) (string, error) {
	t := reflect.TypeOf(model)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return "", fmt.Errorf("AutoMigrate: expected a struct, got %s", t.Kind())
	}

	tableName := strings.ToLower(t.Name()) + "s"

	var colDefs []string
	for i := 0; i < t.NumField(); i++ {
		def, err := buildColumnDef(t.Field(i))
		if err != nil {
			return "", err
		}
		if def == "" {
			continue
		}
		colDefs = append(colDefs, "\t"+def)
	}

	if len(colDefs) == 0 {
		return "", fmt.Errorf("AutoMigrate %s: no columns found", t.Name())
	}

	return fmt.Sprintf(
		"CREATE TABLE IF NOT EXISTS %s (\n%s\n)",
		tableName,
		strings.Join(colDefs, ",\n"),
	), nil
}

func buildColumnDef(f reflect.StructField) (string, error) {
	rawTag, hasTag := f.Tag.Lookup("db")
	if hasTag && rawTag == "-" {
		return "", nil
	}

	var colName string
	var opts []string
	if hasTag && rawTag != "" {
		parts := strings.Split(rawTag, ",")
		colName = parts[0]
		opts = parts[1:]
	} else {
		colName = strings.ToLower(f.Name)
	}

	nullable := sliceContains(opts, "nullable") || f.Type.Kind() == reflect.Ptr
	unique := sliceContains(opts, "unique")

	ft := f.Type
	if ft.Kind() == reflect.Ptr {
		ft = ft.Elem()
	}

	sqlType, defaultVal, err := goToSQLType(ft)
	if err != nil {
		return "", fmt.Errorf("field %s: %w", f.Name, err)
	}

	if strings.EqualFold(colName, "id") && isSQLInteger(ft) {
		return colName + " " + sqlType + " PRIMARY KEY AUTOINCREMENT", nil
	}

	var sb strings.Builder
	sb.WriteString(colName)
	sb.WriteString(" ")
	sb.WriteString(sqlType)

	if unique {
		sb.WriteString(" UNIQUE")
	}
	if !nullable {
		sb.WriteString(" NOT NULL")
		if defaultVal != "" {
			sb.WriteString(" DEFAULT ")
			sb.WriteString(defaultVal)
		}
	}

	return sb.String(), nil
}

func goToSQLType(t reflect.Type) (sqlType, defaultVal string, err error) {
	if t == timeType {
		return "DATETIME", "CURRENT_TIMESTAMP", nil
	}
	switch t.Kind() {
	case reflect.String:
		return "TEXT", "''", nil
	case reflect.Bool:
		return "INTEGER", "0", nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "INTEGER", "0", nil
	case reflect.Float32, reflect.Float64:
		return "REAL", "0", nil
	case reflect.Slice:
		if t.Elem().Kind() == reflect.Uint8 { // []byte
			return "BLOB", "", nil
		}
	}
	return "", "", fmt.Errorf("unsupported Go type %s", t)
}

func isSQLInteger(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return true
	}
	return false
}

func sliceContains(s []string, v string) bool {
	for _, item := range s {
		if item == v {
			return true
		}
	}
	return false
}
