package main

import (
	"fmt"
	"log"
	"net/http"

	"main/pkg/database"
)

func handler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hi there, I love %s!", r.URL.Path[1:])
}

func main() {
	_, err := database.GetDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	http.HandleFunc("/", handler)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
