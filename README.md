# People Journal

A private tool for engineering managers to turn 1:1 meeting transcripts into structured, searchable notes. Paste a transcript, and AI extracts a summary, action items, morale/growth scores with rationale, wins, blockers, and notable quotes. Every field is editable before and after saving.

## Prerequisites

- [Go 1.24+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/) (for the frontend dev server)
- An API key from [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> && cd people-journal

# 2. Set up the backend
cd backend
cp .env.example .env        # then add your API key
go run .                     # starts on :3001

# 3. In another terminal, start the frontend
cd frontend
npm install
npm run dev                  # starts on :5173
```

Open [http://localhost:5173](http://localhost:5173).

## Configuration

Create `backend/.env` with at least one API key:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Anthropic is used by default when both keys are present. The `PORT` variable is optional (defaults to `3001`).

## Project Structure

```
backend/
  main.go          Server setup, routing, CORS
  db.go            SQLite schema, seed data, model structs
  handlers.go      HTTP handlers for team + entry CRUD
  extract.go       AI transcript extraction (Anthropic/OpenAI)
  .env             API keys (not committed)

frontend/
  src/
    App.jsx        View routing, state, API orchestration
    api.js         Fetch wrappers for all endpoints
    constants.js   Shared tag list
    components/    PulseBar, PulseSelector, TagPill, EntryCard, EditableList
    views/         Dashboard, PersonView, NewEntry, ReviewEntry, EntryDetail, Settings
```

## API

All routes are prefixed with `/api`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/team | List team members |
| POST | /api/team | Create team member |
| PUT | /api/team/{id} | Update team member |
| DELETE | /api/team/{id} | Delete team member and their entries |
| GET | /api/entries | List entries (optional `?member_id=` filter) |
| GET | /api/entries/{id} | Get single entry |
| POST | /api/entries | Create entry |
| PUT | /api/entries/{id} | Partial update entry |
| DELETE | /api/entries/{id} | Delete entry |
| POST | /api/extract | Extract structured data from transcript |

## Tech Stack

**Backend:** Go, SQLite ([modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite)), standard library HTTP server

**Frontend:** React, Vite, inline styles. Fonts: DM Sans, DM Mono, Fraunces.

## Design Decisions

- **SQLite with no ORM.** Single-file database, zero infrastructure. JSON arrays stored as TEXT columns.
- **Pure Go SQLite driver.** No CGo dependency, cross-compiles cleanly.
- **No auth.** This is a personal, local tool. Add authentication if you deploy it.
- **AI calls are server-side.** API keys never touch the browser.
- **Inline styles throughout.** Inherited from the original prototype. No CSS framework.

## License

MIT
