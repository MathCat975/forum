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

	db, err := database.GetDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	user, dbErr := db.GetUserByID(1)
	if dbErr != nil {
		log.Fatalf("Failed to get user: %v", dbErr)
	}
	fmt.Println(user)

	http.HandleFunc("/", handler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
