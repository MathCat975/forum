package front

import (
	"html/template"
	"net/http"
)

func ProfileHandler(w http.ResponseWriter, r *http.Request) {
	afficherPage(w, r)
}

// Base page
func afficherPage(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.ParseFiles("../FrontEnd/templates/profile.html"))
	tmpl.Execute(w, nil)
}
