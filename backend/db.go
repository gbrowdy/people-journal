package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

type TeamMember struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Role  string `json:"role"`
	Color string `json:"color"`
}

type ActionItem struct {
	Text      string `json:"text"`
	Completed bool   `json:"completed"`
}

type Entry struct {
	ID                string       `json:"id"`
	MemberID          string       `json:"member_id"`
	Date              string       `json:"date"`
	Summary           *string      `json:"summary"`
	MoraleScore       *int         `json:"morale_score"`
	GrowthScore       *int         `json:"growth_score"`
	MoraleRationale   *string      `json:"morale_rationale"`
	GrowthRationale   *string      `json:"growth_rationale"`
	Tags              []string     `json:"tags"`
	ActionItemsMine   []ActionItem `json:"action_items_mine"`
	ActionItemsTheirs []ActionItem `json:"action_items_theirs"`
	NotableQuotes     []string     `json:"notable_quotes"`
	Blockers          []string     `json:"blockers"`
	Wins              []string     `json:"wins"`
	PrivateNote       *string      `json:"private_note"`
	Transcript        *string      `json:"transcript"`
	CreatedAt         *string      `json:"created_at"`
	UpdatedAt         *string      `json:"updated_at"`
}

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite", "./people-journal.db")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	DB.Exec("PRAGMA journal_mode = WAL")
	DB.Exec("PRAGMA foreign_keys = ON")

	DB.Exec(`
		CREATE TABLE IF NOT EXISTS team_members (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			color TEXT NOT NULL
		)
	`)

	DB.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id TEXT PRIMARY KEY,
			member_id TEXT NOT NULL REFERENCES team_members(id),
			date TEXT NOT NULL,
			summary TEXT,
			morale_score INTEGER,
			growth_score INTEGER,
			morale_rationale TEXT,
			growth_rationale TEXT,
			tags TEXT,
			action_items_mine TEXT,
			action_items_theirs TEXT,
			notable_quotes TEXT,
			blockers TEXT,
			wins TEXT,
			private_note TEXT,
			transcript TEXT,
			created_at TEXT,
			updated_at TEXT
		)
	`)

	DB.Exec(`
		CREATE TABLE IF NOT EXISTS cache (
			key TEXT NOT NULL,
			category TEXT NOT NULL,
			value TEXT NOT NULL,
			created_at TEXT NOT NULL,
			PRIMARY KEY (key, category)
		)
	`)

	// Seed default team members if table is empty
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM team_members").Scan(&count)
	if count == 0 {
		defaults := [][]string{
			{"member-1", "Engineer 1", "Engineer", "#E07A5F"},
			{"member-2", "Engineer 2", "Engineer", "#3D405B"},
			{"member-3", "Engineer 3", "Engineer", "#81B29A"},
			{"member-4", "Engineer 4", "Engineer", "#F2CC8F"},
		}
		for _, m := range defaults {
			DB.Exec("INSERT INTO team_members (id, name, role, color) VALUES (?, ?, ?, ?)",
				m[0], m[1], m[2], m[3])
		}
	}
}

func parseJSONArray(s string) []string {
	if s == "" {
		return []string{}
	}
	var arr []string
	if err := json.Unmarshal([]byte(s), &arr); err != nil {
		return []string{}
	}
	return arr
}

func parseActionItems(s string) []ActionItem {
	if s == "" {
		return []ActionItem{}
	}
	var items []ActionItem
	if err := json.Unmarshal([]byte(s), &items); err != nil {
		return []ActionItem{}
	}
	return items
}

func scanEntry(row interface{ Scan(...any) error }) (Entry, error) {
	var e Entry
	var tags, actionMine, actionTheirs, quotes, blockers, wins sql.NullString
	var summary, moraleRat, growthRat, privateNote sql.NullString
	var transcript, createdAt, updatedAt sql.NullString
	var moraleScore, growthScore sql.NullInt64

	err := row.Scan(
		&e.ID, &e.MemberID, &e.Date,
		&summary, &moraleScore, &growthScore,
		&moraleRat, &growthRat,
		&tags, &actionMine, &actionTheirs,
		&quotes, &blockers, &wins,
		&privateNote,
		&transcript, &createdAt, &updatedAt,
	)
	if err != nil {
		return e, err
	}

	if summary.Valid {
		e.Summary = &summary.String
	}
	if moraleScore.Valid {
		v := int(moraleScore.Int64)
		e.MoraleScore = &v
	}
	if growthScore.Valid {
		v := int(growthScore.Int64)
		e.GrowthScore = &v
	}
	if moraleRat.Valid {
		e.MoraleRationale = &moraleRat.String
	}
	if growthRat.Valid {
		e.GrowthRationale = &growthRat.String
	}
	if privateNote.Valid {
		e.PrivateNote = &privateNote.String
	}
	if transcript.Valid {
		e.Transcript = &transcript.String
	}
	if createdAt.Valid {
		e.CreatedAt = &createdAt.String
	}
	if updatedAt.Valid {
		e.UpdatedAt = &updatedAt.String
	}

	e.Tags = parseJSONArray(tags.String)
	e.ActionItemsMine = parseActionItems(actionMine.String)
	e.ActionItemsTheirs = parseActionItems(actionTheirs.String)
	e.NotableQuotes = parseJSONArray(quotes.String)
	e.Blockers = parseJSONArray(blockers.String)
	e.Wins = parseJSONArray(wins.String)

	return e, nil
}

// entryCols is the SELECT column list for entries, matching scanEntry order.
var entryCols = strings.Join([]string{
	"id", "member_id", "date",
	"summary", "morale_score", "growth_score",
	"morale_rationale", "growth_rationale",
	"tags", "action_items_mine", "action_items_theirs",
	"notable_quotes", "blockers", "wins",
	"private_note", "transcript", "created_at", "updated_at",
}, ", ")

func entryQuery(where string) string {
	return fmt.Sprintf("SELECT %s FROM entries %s ORDER BY date DESC", entryCols, where)
}
