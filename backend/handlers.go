package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ─── Team Handlers ──────────────────────────────────────

func handleGetTeam(w http.ResponseWriter, r *http.Request) {
	rows, err := DB.Query("SELECT id, name, role, color FROM team_members")
	if err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	defer rows.Close()

	members := []TeamMember{}
	for rows.Next() {
		var m TeamMember
		rows.Scan(&m.ID, &m.Name, &m.Role, &m.Color)
		members = append(members, m)
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

	DB.Exec("INSERT INTO team_members (id, name, role, color) VALUES (?, ?, ?, ?)",
		id, name, role, color)

	var m TeamMember
	DB.QueryRow("SELECT id, name, role, color FROM team_members WHERE id = ?", id).
		Scan(&m.ID, &m.Name, &m.Role, &m.Color)

	writeJSON(w, 201, m)
}

func handleUpdateTeamMember(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Name  string `json:"name"`
		Role  string `json:"role"`
		Color string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, 400)
		return
	}

	res, _ := DB.Exec("UPDATE team_members SET name = ?, role = ?, color = ? WHERE id = ?",
		body.Name, body.Role, body.Color, id)

	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, `{"error":"Member not found"}`, 404)
		return
	}

	var m TeamMember
	DB.QueryRow("SELECT id, name, role, color FROM team_members WHERE id = ?", id).
		Scan(&m.ID, &m.Name, &m.Role, &m.Color)

	writeJSON(w, 200, m)
}

func handleDeleteTeamMember(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	DB.Exec("DELETE FROM entries WHERE member_id = ?", id)
	res, _ := DB.Exec("DELETE FROM team_members WHERE id = ?", id)

	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, `{"error":"Member not found"}`, 404)
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// ─── Entry Handlers ─────────────────────────────────────

func handleGetEntries(w http.ResponseWriter, r *http.Request) {
	memberID := r.URL.Query().Get("member_id")

	var rows interface {
		Next() bool
		Scan(...any) error
		Close() error
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
			continue
		}
		entries = append(entries, e)
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

	DB.Exec(`
		INSERT INTO entries (id, member_id, date, summary, morale_score, growth_score,
			morale_rationale, growth_rationale,
			tags, action_items_mine, action_items_theirs, notable_quotes, blockers, wins, private_note)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, memberID, date, summary, moraleScore, growthScore,
		moraleRationale, growthRationale,
		tags, actionMine, actionTheirs, quotes, blockers, wins, privateNote,
	)

	row := DB.QueryRow(fmt.Sprintf("SELECT %s FROM entries WHERE id = ?", entryCols), id)
	e, err := scanEntry(row)
	if err != nil {
		http.Error(w, `{"error":"failed to read created entry"}`, 500)
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
		"blockers", "wins", "private_note",
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

	values = append(values, id)
	DB.Exec(fmt.Sprintf("UPDATE entries SET %s WHERE id = ?", strings.Join(setClauses, ", ")), values...)

	row = DB.QueryRow(fmt.Sprintf("SELECT %s FROM entries WHERE id = ?", entryCols), id)
	updated, _ := scanEntry(row)
	writeJSON(w, 200, updated)
}

func handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	res, _ := DB.Exec("DELETE FROM entries WHERE id = ?", id)
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, `{"error":"Entry not found"}`, 404)
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
