package db

import (
	"database/sql"
	"fmt"
	"reflect"
	"strings"
)

type Query struct {
	conn   *sql.DB
	table  string
	wheres []string
	args   []any
	order  string
	lim    int
	off    int
}

func (d *DB) Table(name string) *Query {
	return &Query{conn: d.conn, table: name}
}

func (q *Query) Where(cond string, args ...any) *Query {
	q.wheres = append(q.wheres, cond)
	q.args = append(q.args, args...)
	return q
}

func (q *Query) OrderBy(expr string) *Query {
	q.order = expr
	return q
}

func (q *Query) Limit(n int) *Query {
	q.lim = n
	return q
}

func (q *Query) Offset(n int) *Query {
	q.off = n
	return q
}

func (q *Query) whereSQL() string {
	if len(q.wheres) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(q.wheres, " AND ")
}

func (q *Query) First(dest any) error {
	query := "SELECT * FROM " + q.table + q.whereSQL()
	if q.order != "" {
		query += " ORDER BY " + q.order
	}
	query += " LIMIT 1"

	rows, err := q.conn.Query(query, q.args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return err
	}
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return err
		}
		return sql.ErrNoRows
	}
	return scanInto(rows, cols, dest)
}

func (q *Query) Find(dest any) error {
	query := "SELECT * FROM " + q.table + q.whereSQL()
	if q.order != "" {
		query += " ORDER BY " + q.order
	}
	if q.lim > 0 {
		query += fmt.Sprintf(" LIMIT %d", q.lim)
	}
	if q.off > 0 {
		query += fmt.Sprintf(" OFFSET %d", q.off)
	}

	rows, err := q.conn.Query(query, q.args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return err
	}
	return scanAllInto(rows, cols, dest)
}

func (q *Query) Count() (int64, error) {
	query := "SELECT COUNT(*) FROM " + q.table + q.whereSQL()
	var n int64
	err := q.conn.QueryRow(query, q.args...).Scan(&n)
	return n, err
}

func (d *DB) Create(table string, src any) error {
	cols, vals := extractFields(src, true)
	if len(cols) == 0 {
		return fmt.Errorf("db.Create: no fields found on struct")
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?, ", len(cols)), ", ")
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", table, strings.Join(cols, ", "), placeholders)
	_, err := d.conn.Exec(query, vals...)
	return err
}

func (d *DB) Save(table string, src any) error {
	cols, vals := extractFields(src, false)
	if len(cols) == 0 {
		return fmt.Errorf("db.Save: no fields found on struct")
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?, ", len(cols)), ", ")
	query := fmt.Sprintf("INSERT OR REPLACE INTO %s (%s) VALUES (%s)", table, strings.Join(cols, ", "), placeholders)
	_, err := d.conn.Exec(query, vals...)
	return err
}

func (q *Query) Update(fields map[string]any) error {
	if len(fields) == 0 {
		return fmt.Errorf("db.Update: no fields provided")
	}
	setCols := make([]string, 0, len(fields))
	setArgs := make([]any, 0, len(fields))
	for col, val := range fields {
		setCols = append(setCols, col+" = ?")
		setArgs = append(setArgs, val)
	}
	query := fmt.Sprintf("UPDATE %s SET %s%s", q.table, strings.Join(setCols, ", "), q.whereSQL())
	_, err := q.conn.Exec(query, append(setArgs, q.args...)...)
	return err
}

func (q *Query) Delete() error {
	query := "DELETE FROM " + q.table + q.whereSQL()
	_, err := q.conn.Exec(query, q.args...)
	return err
}

func colName(f reflect.StructField) (name string, skip bool) {
	tag, ok := f.Tag.Lookup("db")
	if ok {
		if tag == "-" {
			return "", true
		}
		// strip options like ",unique" or ",nullable"
		return strings.SplitN(tag, ",", 2)[0], false
	}
	return strings.ToLower(f.Name), false
}

func extractFields(src any, skipZeroID bool) (cols []string, vals []any) {
	v := reflect.ValueOf(src)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		name, skip := colName(t.Field(i))
		if skip {
			continue
		}
		fv := v.Field(i)
		if skipZeroID && name == "id" && fv.IsZero() {
			continue
		}
		cols = append(cols, name)
		vals = append(vals, fv.Interface())
	}
	return
}

func scanInto(rows *sql.Rows, cols []string, dest any) error {
	v := reflect.ValueOf(dest)
	if v.Kind() != reflect.Ptr || v.Elem().Kind() != reflect.Struct {
		return fmt.Errorf("scanInto: dest must be a pointer to a struct")
	}
	v = v.Elem()
	t := v.Type()

	idx := make(map[string]int, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		name, skip := colName(t.Field(i))
		if !skip {
			idx[name] = i
		}
	}

	ptrs := make([]any, len(cols))
	for i, col := range cols {
		if fi, ok := idx[col]; ok {
			ptrs[i] = v.Field(fi).Addr().Interface()
		} else {
			var sink any
			ptrs[i] = &sink
		}
	}
	return rows.Scan(ptrs...)
}

func scanAllInto(rows *sql.Rows, cols []string, dest any) error {
	slicePtr := reflect.ValueOf(dest)
	if slicePtr.Kind() != reflect.Ptr || slicePtr.Elem().Kind() != reflect.Slice {
		return fmt.Errorf("scanAllInto: dest must be a pointer to a slice of structs")
	}
	slice := slicePtr.Elem()
	elemType := slice.Type().Elem()

	for rows.Next() {
		elem := reflect.New(elemType).Elem()
		t := elemType

		idx := make(map[string]int, t.NumField())
		for i := 0; i < t.NumField(); i++ {
			name, skip := colName(t.Field(i))
			if !skip {
				idx[name] = i
			}
		}

		ptrs := make([]any, len(cols))
		for i, col := range cols {
			if fi, ok := idx[col]; ok {
				ptrs[i] = elem.Field(fi).Addr().Interface()
			} else {
				var sink any
				ptrs[i] = &sink
			}
		}
		if err := rows.Scan(ptrs...); err != nil {
			return err
		}
		slice.Set(reflect.Append(slice, elem))
	}
	return rows.Err()
}
