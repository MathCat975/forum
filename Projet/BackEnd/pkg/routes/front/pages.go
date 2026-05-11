package front

import (
	"html/template"
	"net/http"
)

func PageHandler(w http.ResponseWriter, r *http.Request, page string) {
	afficherPage(w, r, page)
}

// Base page
func afficherPage(w http.ResponseWriter, r *http.Request, page string) {
	tmpl := template.Must(template.ParseFiles("../FrontEnd/templates/" + page + ".html"))
	tmpl.Execute(w, nil)
}
