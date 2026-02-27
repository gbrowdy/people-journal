package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load("../.env")

	if jiraConfigured() {
		fmt.Printf("JIRA integration: enabled (%s)\n", os.Getenv("JIRA_BASE_URL"))
	} else {
		fmt.Printf("JIRA integration: disabled — JIRA_BASE_URL=%q JIRA_EMAIL=%q JIRA_API_TOKEN=(set=%v)\n",
			os.Getenv("JIRA_BASE_URL"), os.Getenv("JIRA_EMAIL"), os.Getenv("JIRA_API_TOKEN") != "")
	}

	InitDB()
	defer DB.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/team", handleGetTeam)
	mux.HandleFunc("POST /api/team", handleCreateTeamMember)
	mux.HandleFunc("PUT /api/team/{id}", handleUpdateTeamMember)
	mux.HandleFunc("PUT /api/team/{id}/prep-notes", handleUpdatePrepNotes)
	mux.HandleFunc("DELETE /api/team/{id}", handleDeleteTeamMember)

	mux.HandleFunc("GET /api/entries", handleGetEntries)
	mux.HandleFunc("GET /api/entries/{id}", handleGetEntry)
	mux.HandleFunc("POST /api/entries", handleCreateEntry)
	mux.HandleFunc("PUT /api/entries/{id}", handleUpdateEntry)
	mux.HandleFunc("DELETE /api/entries/{id}", handleDeleteEntry)

	mux.HandleFunc("GET /api/config", handleGetConfig)
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

		// Limit request body size to 10 MB
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
		}

		next.ServeHTTP(w, r)
	})
}
