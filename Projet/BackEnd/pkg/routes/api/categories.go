package api

import (
	"encoding/json"
	"main/pkg/routes"
	"net/http"
)

type Category struct {
	ID     uint   `json:"id"`
	Name   string `json:"name"`
	Group  string `json:"group"`
	Locked bool   `json:"locked"`
}

var Categories = []Category{
	{ID: 1, Name: "Announcement", Group: "General", Locked: true},
	{ID: 2, Name: "Public Square", Group: "General"},

	{ID: 10, Name: "Software & Tools", Group: "Marketplace"},
	{ID: 11, Name: "Services", Group: "Marketplace"},
	{ID: 12, Name: "Accounts", Group: "Marketplace"},
	{ID: 13, Name: "Others", Group: "Marketplace"},

	{ID: 20, Name: "Coding & Reverse Engineer", Group: "Research"},
	{ID: 21, Name: "Security & Pentesting", Group: "Research"},
	{ID: 22, Name: "Others", Group: "Research"},
}

var categoriesByID = func() map[uint]Category {
	m := make(map[uint]Category, len(Categories))
	for _, c := range Categories {
		m[c.ID] = c
	}
	return m
}()

func GetCategory(id uint) (Category, bool) {
	c, ok := categoriesByID[id]
	return c, ok
}

func ListCategoriesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		routes.JsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Categories)
}
