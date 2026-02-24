package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// ─── Team Handlers ──────────────────────────────────────

func handleGetTeam(w http.ResponseWriter, r *http.Request) {
	rows, err := DB.Query("SELECT id, name, role, color, jira_account_id, prep_notes FROM team_members")
	if err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	defer rows.Close()

	members := []TeamMember{}
	for rows.Next() {
		var m TeamMember
		var jiraID, prepNotes sql.NullString
		if err := rows.Scan(&m.ID, &m.Name, &m.Role, &m.Color, &jiraID, &prepNotes); err != nil {
			log.Printf("Failed to scan team member: %v", err)
			continue
		}
		if jiraID.Valid {
			m.JiraAccountID = &jiraID.String
		}
		if prepNotes.Valid {
			m.PrepNotes = &prepNotes.String
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, 200, members)
}

func handleCreateTeamMember(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Role  string `json:"role"`
		Color string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, 400)
		return
	}

	id := fmt.Sprintf("member-%d", time.Now().UnixMilli())
	name := body.Name
	if name == "" {
		name = "New Member"
	}
	role := body.Role
	if role == "" {
		role = "Engineer"
	}
	color := body.Color
	if color == "" {
		color = "#888888"
	}

	if _, err := DB.Exec("INSERT INTO team_members (id, name, role, color) VALUES (?, ?, ?, ?)",
		id, name, role, color); err != nil {
		log.Printf("Failed to create team member: %v", err)
		writeJSON(w, 500, map[string]string{"error": "failed to create team member"})
		return
	}

	var m TeamMember
	var jiraID, prepNotes sql.NullString
	if err := DB.QueryRow("SELECT id, name, role, color, jira_account_id, prep_notes FROM team_members WHERE id = ?", id).
		Scan(&m.ID, &m.Name, &m.Role, &m.Color, &jiraID, &prepNotes); err != nil {
		log.Printf("Failed to read created team member: %v", err)
		writeJSON(w, 500, map[string]string{"error": "failed to read created team member"})
		return
	}
	if jiraID.Valid {
		m.JiraAccountID = &jiraID.String
	}
	if prepNotes.Valid {
		m.PrepNotes = &prepNotes.String
	}

	writeJSON(w, 201, m)
}

func handleUpdateTeamMember(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Name          string  `json:"name"`
		Role          string  `json:"role"`
		Color         string  `json:"color"`
		JiraAccountID *string `json:"jira_account_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, 400)
		return
	}

	res, err := DB.Exec(
		"UPDATE team_members SET name = ?, role = ?, color = ?, jira_account_id = ? WHERE id = ?",
		body.Name, body.Role, body.Color, body.JiraAccountID, id,
	)
	if err != nil {
		log.Printf("Failed to update team member %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to update team member"})
		return
	}

	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, 404, map[string]string{"error": "member not found"})
		return
	}

	m, err := scanTeamMember(DB.QueryRow("SELECT id, name, role, color, jira_account_id, prep_notes FROM team_members WHERE id = ?", id))
	if err != nil {
		log.Printf("Failed to read updated team member: %v", err)
		writeJSON(w, 500, map[string]string{"error": "failed to read updated team member"})
		return
	}

	writeJSON(w, 200, m)
}

func handleDeleteTeamMember(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM entries WHERE member_id = ?", id); err != nil {
		log.Printf("Failed to delete entries for member %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to delete member entries"})
		return
	}

	res, err := tx.Exec("DELETE FROM team_members WHERE id = ?", id)
	if err != nil {
		log.Printf("Failed to delete team member %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to delete team member"})
		return
	}

	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, 404, map[string]string{"error": "member not found"})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit delete for member %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}

	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// ─── Config Handler ─────────────────────────────────────

func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	configured := jiraConfigured()
	config := map[string]any{
		"jira_configured": configured,
	}
	if configured {
		config["jira_base_url"] = strings.TrimRight(os.Getenv("JIRA_BASE_URL"), "/")
	}
	writeJSON(w, 200, config)
}

// ─── Entry Handlers ─────────────────────────────────────

func handleGetEntries(w http.ResponseWriter, r *http.Request) {
	memberID := r.URL.Query().Get("member_id")

	var rows interface {
		Next() bool
		Scan(...any) error
		Close() error
		Err() error
	}
	var err error

	if memberID != "" {
		rows, err = DB.Query(entryQuery("WHERE member_id = ?"), memberID)
	} else {
		rows, err = DB.Query(entryQuery(""))
	}
	if err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	defer rows.Close()

	entries := []Entry{}
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			log.Printf("Failed to scan entry: %v", err)
			continue
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, 200, entries)
}

func handleGetEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	row := DB.QueryRow(fmt.Sprintf("SELECT %s FROM entries WHERE id = ?", entryCols), id)
	e, err := scanEntry(row)
	if err != nil {
		http.Error(w, `{"error":"Entry not found"}`, 404)
		return
	}
	writeJSON(w, 200, e)
}

func handleCreateEntry(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, 400)
		return
	}

	id, _ := body["id"].(string)
	if id == "" {
		id = fmt.Sprintf("entry-%d", time.Now().UnixMilli())
	}
	memberID, _ := body["member_id"].(string)
	date, _ := body["date"].(string)
	if date == "" {
		date = time.Now().UTC().Format(time.RFC3339)
	}
	summary := nullString(body["summary"])
	moraleScore := nullInt(body["morale_score"])
	growthScore := nullInt(body["growth_score"])
	moraleRationale := nullString(body["morale_rationale"])
	growthRationale := nullString(body["growth_rationale"])
	privateNote := nullString(body["private_note"])

	tags := jsonStringify(body["tags"])
	actionMine := jsonStringify(body["action_items_mine"])
	actionTheirs := jsonStringify(body["action_items_theirs"])
	quotes := jsonStringify(body["notable_quotes"])
	blockers := jsonStringify(body["blockers"])
	wins := jsonStringify(body["wins"])

	transcript := nullString(body["transcript"])
	now := time.Now().UTC().Format(time.RFC3339)

	if _, err := DB.Exec(`
		INSERT INTO entries (id, member_id, date, summary, morale_score, growth_score,
			morale_rationale, growth_rationale,
			tags, action_items_mine, action_items_theirs, notable_quotes, blockers, wins,
			private_note, transcript, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, memberID, date, summary, moraleScore, growthScore,
		moraleRationale, growthRationale,
		tags, actionMine, actionTheirs, quotes, blockers, wins,
		privateNote, transcript, now, now,
	); err != nil {
		log.Printf("Failed to create entry: %v", err)
		writeJSON(w, 500, map[string]string{"error": "failed to create entry"})
		return
	}

	row := DB.QueryRow(fmt.Sprintf("SELECT %s FROM entries WHERE id = ?", entryCols), id)
	e, err := scanEntry(row)
	if err != nil {
		log.Printf("Failed to read created entry: %v", err)
		writeJSON(w, 500, map[string]string{"error": "failed to read created entry"})
		return
	}
	writeJSON(w, 201, e)
}

func handleUpdateEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Check entry exists
	row := DB.QueryRow(fmt.Sprintf("SELECT %s FROM entries WHERE id = ?", entryCols), id)
	existing, err := scanEntry(row)
	if err != nil {
		http.Error(w, `{"error":"Entry not found"}`, 404)
		return
	}

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, 400)
		return
	}

	allowedFields := []string{
		"summary", "morale_score", "growth_score", "morale_rationale", "growth_rationale",
		"tags", "action_items_mine", "action_items_theirs", "notable_quotes",
		"blockers", "wins", "private_note", "transcript",
	}
	jsonFields := map[string]bool{
		"tags": true, "action_items_mine": true, "action_items_theirs": true,
		"notable_quotes": true, "blockers": true, "wins": true,
	}

	var setClauses []string
	var values []any

	for _, field := range allowedFields {
		val, ok := body[field]
		if !ok {
			continue
		}
		setClauses = append(setClauses, field+" = ?")
		if jsonFields[field] {
			values = append(values, jsonStringify(val))
		} else {
			values = append(values, val)
		}
	}

	if len(setClauses) == 0 {
		writeJSON(w, 200, existing)
		return
	}

	// Always update updated_at when there are changes
	setClauses = append(setClauses, "updated_at = ?")
	values = append(values, time.Now().UTC().Format(time.RFC3339))

	values = append(values, id)
	if _, err := DB.Exec(fmt.Sprintf("UPDATE entries SET %s WHERE id = ?", strings.Join(setClauses, ", ")), values...); err != nil {
		log.Printf("Failed to update entry %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to update entry"})
		return
	}

	row = DB.QueryRow(fmt.Sprintf("SELECT %s FROM entries WHERE id = ?", entryCols), id)
	updated, err := scanEntry(row)
	if err != nil {
		log.Printf("Failed to read updated entry %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to read updated entry"})
		return
	}
	writeJSON(w, 200, updated)
}

func handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	res, err := DB.Exec("DELETE FROM entries WHERE id = ?", id)
	if err != nil {
		log.Printf("Failed to delete entry %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to delete entry"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, 404, map[string]string{"error": "entry not found"})
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// ─── Helpers ────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func nullString(v any) any {
	if v == nil {
		return nil
	}
	s, ok := v.(string)
	if !ok {
		return nil
	}
	return s
}

func nullInt(v any) any {
	if v == nil {
		return nil
	}
	// JSON numbers come as float64
	f, ok := v.(float64)
	if !ok {
		return nil
	}
	return int(f)
}

func scanTeamMember(row interface{ Scan(...any) error }) (TeamMember, error) {
	var m TeamMember
	var jiraID, prepNotes sql.NullString
	err := row.Scan(&m.ID, &m.Name, &m.Role, &m.Color, &jiraID, &prepNotes)
	if err != nil {
		return m, err
	}
	if jiraID.Valid {
		m.JiraAccountID = &jiraID.String
	}
	if prepNotes.Valid {
		m.PrepNotes = &prepNotes.String
	}
	return m, nil
}

func handleUpdatePrepNotes(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		PrepNotes string `json:"prep_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}

	var val any = body.PrepNotes
	if body.PrepNotes == "" {
		val = nil
	}

	res, err := DB.Exec("UPDATE team_members SET prep_notes = ? WHERE id = ?", val, id)
	if err != nil {
		log.Printf("Failed to update prep notes for %s: %v", id, err)
		writeJSON(w, 500, map[string]string{"error": "failed to update prep notes"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, 404, map[string]string{"error": "member not found"})
		return
	}

	writeJSON(w, 200, map[string]string{"prep_notes": body.PrepNotes})
}

func jsonStringify(v any) string {
	if v == nil {
		return "[]"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}
