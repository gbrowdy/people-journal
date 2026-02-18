package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	InitDB()
	defer DB.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/team", handleGetTeam)
	mux.HandleFunc("POST /api/team", handleCreateTeamMember)
	mux.HandleFunc("PUT /api/team/{id}", handleUpdateTeamMember)
	mux.HandleFunc("DELETE /api/team/{id}", handleDeleteTeamMember)

	mux.HandleFunc("GET /api/entries", handleGetEntries)
	mux.HandleFunc("GET /api/entries/{id}", handleGetEntry)
	mux.HandleFunc("POST /api/entries", handleCreateEntry)
	mux.HandleFunc("PUT /api/entries/{id}", handleUpdateEntry)
	mux.HandleFunc("DELETE /api/entries/{id}", handleDeleteEntry)

	mux.HandleFunc("POST /api/extract", handleExtract)
	mux.HandleFunc("POST /api/prep", handlePrep)

	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fmt.Printf("Backend running on http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		fmt.Println("Server error:", err)
		os.Exit(1)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}

		next.ServeHTTP(w, r)
	})
}
