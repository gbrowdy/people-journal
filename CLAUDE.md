## GIT COMMITS — IMPORTANT

**NEVER add a `Co-Authored-By` line to commits. Gil Browdy is the SOLE author of all commits. Do NOT co-sign commits as Claude or any AI. No exceptions.**

# People Journal

A private tool for engineering managers to process 1:1 meeting transcripts into structured, searchable notes using AI extraction.

## Architecture

Go + SQLite backend, Vite + React frontend, optional Tauri desktop wrapper.

```
.env              API keys — shared by both backends (never commit)

backend/          Go HTTP server (port 3001)
  main.go         Server setup, routing, CORS middleware
  db.go           SQLite schema, seed data, model structs, scan helpers
  handlers.go     HTTP handlers for team + entry CRUD
  extract.go      Anthropic/OpenAI transcript extraction
  prep.go         Pre-meeting prep briefing generation
  jira.go         JIRA REST API client (optional integration)
  cache.go        Response caching helpers

src-tauri/        Tauri desktop app (Rust + native SQLite)
  src/lib.rs      Tauri commands (mirrors Go API routes)
  src/db.rs       SQLite schema, CRUD, caching
  src/ai.rs       Anthropic/OpenAI API calls

frontend/         Vite + React app (port 5173)
  src/
    App.jsx       View router, state management, API orchestration
    api.js        Fetch wrappers — auto-detects Tauri vs HTTP backend
    constants.js  TAGS array
    components/   PulseBar, PulseSelector, TagPill, EntryCard, EditableList
    views/        Dashboard, PersonView, NewEntry, ReviewEntry, EntryDetail, Settings, PrepView
```

## Running locally

```bash
# Terminal 1 — backend
cd backend && go run .

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` requests to the backend.

## Key decisions

- **SQLite** via `modernc.org/sqlite` (pure Go, no CGo). Data lives in `backend/people-journal.db` (gitignored).
- **No ORM** — direct `database/sql` queries. Schema is simple enough that an ORM adds weight without value.
- **Go 1.22+ method routing** — `http.ServeMux` with `GET /path/{id}` patterns. No external router.
- **JSON columns** for arrays (tags, action_items, etc.) stored as TEXT. Parsed with `encoding/json` on read.
- **No auth** — personal, local tool. Can add later if needed.
- **AI API calls happen server-side** (`POST /api/extract`) to keep keys out of the browser. Anthropic preferred, OpenAI as fallback.
- **Inline styles** throughout the frontend — carried over from the original Artifact prototype. No CSS framework.
- **JIRA integration** (optional) — configured via `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` in `.env`. When set, the prep view fetches the team member's JIRA activity (current sprint tickets, recently completed, blocked items, sprint stats) and feeds it to the AI briefing. JIRA account IDs are auto-resolved by display name and cached on the team member row.

## API routes

```
GET    /api/team              All team members
POST   /api/team              Create a team member
PUT    /api/team/{id}         Update a team member (name, role, color, jira_account_id)
DELETE /api/team/{id}         Delete a team member and their entries

GET    /api/entries            All entries (optional ?member_id= filter)
GET    /api/entries/{id}       Single entry
POST   /api/entries            Create entry
PUT    /api/entries/{id}       Partial update entry (only sent fields are changed)
DELETE /api/entries/{id}       Delete entry

POST   /api/extract            Send { transcript, member_name }, get structured data back
POST   /api/prep               Pre-meeting briefing with AI + structured data (+ JIRA if configured)
GET    /api/config              App config (JIRA configured, base URL)
```

## Database

Two tables: `team_members` and `entries`. Schema is in `backend/db.go`. On first run, seeds 4 default team members. Entry array fields (tags, action_items_mine, etc.) are stored as JSON strings and parsed on read. Entries include `morale_rationale` and `growth_rationale` text fields for AI-generated score explanations.

## Frontend conventions

- Views are in `frontend/src/views/`, one per file. Each receives props from App.jsx — no direct API calls in views.
- App.jsx owns all state and passes callbacks down. View switching is a simple string state (`view`), not a router.
- Shared components are in `frontend/src/components/`. Keep them stateless where possible.
- EntryDetail supports per-section click-to-edit. Only one section editable at a time.
- EditableList is used in both ReviewEntry and EntryDetail for inline list editing.
- Fonts: DM Sans (body), DM Mono (dates/code), Fraunces (headings). Loaded via Google Fonts in index.html.
- Color palette per team member — stored in the database, threaded through as `member.color`.
