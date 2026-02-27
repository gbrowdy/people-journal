use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppDb(pub Mutex<Connection>);

#[derive(Debug, Serialize, Clone)]
pub struct TeamMember {
    pub id: String,
    pub name: String,
    pub role: String,
    pub color: String,
    pub jira_account_id: Option<String>,
    pub prep_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActionItem {
    pub text: String,
    pub completed: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct Entry {
    pub id: String,
    pub member_id: String,
    pub date: String,
    pub summary: Option<String>,
    pub morale_score: Option<i64>,
    pub growth_score: Option<i64>,
    pub morale_rationale: Option<String>,
    pub growth_rationale: Option<String>,
    pub tags: Vec<String>,
    pub action_items_mine: Vec<ActionItem>,
    pub action_items_theirs: Vec<ActionItem>,
    pub notable_quotes: Vec<String>,
    pub blockers: Vec<String>,
    pub wins: Vec<String>,
    pub private_note: Option<String>,
    pub transcript: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

pub fn db_path() -> PathBuf {
    let dir = if cfg!(target_os = "macos") {
        dirs::home_dir()
            .expect("no home dir")
            .join("Library/Application Support/People Journal")
    } else if cfg!(target_os = "windows") {
        dirs::data_dir()
            .expect("no data dir")
            .join("People Journal")
    } else {
        dirs::data_dir()
            .expect("no data dir")
            .join("people-journal")
    };
    std::fs::create_dir_all(&dir).expect("failed to create data directory");
    dir.join("people-journal.db")
}

pub fn init_db() -> Connection {
    let path = db_path();
    log::info!("Database: {}", path.display());

    let conn = Connection::open(&path).expect("failed to open database");

    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        .expect("failed to set pragmas");

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS team_members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            color TEXT NOT NULL
        )"
    ).expect("failed to create team_members table");

    // Add columns if they don't exist (ALTER TABLE ADD COLUMN is a no-op if it exists)
    let _ = conn.execute_batch("ALTER TABLE team_members ADD COLUMN jira_account_id TEXT");
    let _ = conn.execute_batch("ALTER TABLE team_members ADD COLUMN prep_notes TEXT");

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS entries (
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
        )"
    ).expect("failed to create entries table");

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cache (
            key TEXT NOT NULL,
            category TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (key, category)
        )"
    ).expect("failed to create cache table");

    // Seed default team members if empty
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM team_members", [], |row| row.get(0))
        .unwrap_or(0);

    if count == 0 {
        let defaults = [
            ("member-1", "Engineer 1", "Engineer", "#E07A5F"),
            ("member-2", "Engineer 2", "Engineer", "#3D405B"),
            ("member-3", "Engineer 3", "Engineer", "#81B29A"),
            ("member-4", "Engineer 4", "Engineer", "#F2CC8F"),
        ];
        for (id, name, role, color) in defaults {
            let _ = conn.execute(
                "INSERT INTO team_members (id, name, role, color) VALUES (?1, ?2, ?3, ?4)",
                params![id, name, role, color],
            );
        }
    }

    conn
}

pub fn get_team_members(conn: &Connection) -> Vec<TeamMember> {
    let mut stmt = conn
        .prepare("SELECT id, name, role, color, jira_account_id, prep_notes FROM team_members")
        .expect("failed to prepare query");

    stmt.query_map([], |row| {
        Ok(TeamMember {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            color: row.get(3)?,
            jira_account_id: row.get(4)?,
            prep_notes: row.get(5)?,
        })
    })
    .expect("failed to query team members")
    .filter_map(|r| r.ok())
    .collect()
}

fn parse_json_vec<T: serde::de::DeserializeOwned>(raw: Option<String>) -> Vec<T> {
    raw.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

pub fn get_entries(conn: &Connection, member_id: Option<&str>) -> Vec<Entry> {
    let base = "SELECT id, member_id, date, summary, morale_score, growth_score, \
                morale_rationale, growth_rationale, tags, action_items_mine, \
                action_items_theirs, notable_quotes, blockers, wins, \
                private_note, transcript, created_at, updated_at FROM entries";

    let query;
    let mut stmt;

    if let Some(mid) = member_id {
        query = format!("{base} WHERE member_id = ?1 ORDER BY date DESC");
        stmt = conn.prepare(&query).expect("failed to prepare query");
        let rows = stmt.query_map(params![mid], row_to_entry)
            .expect("failed to query entries");
        rows.filter_map(|r| r.ok()).collect()
    } else {
        query = format!("{base} ORDER BY date DESC");
        stmt = conn.prepare(&query).expect("failed to prepare query");
        let rows = stmt.query_map([], row_to_entry)
            .expect("failed to query entries");
        rows.filter_map(|r| r.ok()).collect()
    }
}

fn row_to_entry(row: &rusqlite::Row) -> rusqlite::Result<Entry> {
    Ok(Entry {
        id: row.get(0)?,
        member_id: row.get(1)?,
        date: row.get(2)?,
        summary: row.get(3)?,
        morale_score: row.get(4)?,
        growth_score: row.get(5)?,
        morale_rationale: row.get(6)?,
        growth_rationale: row.get(7)?,
        tags: parse_json_vec(row.get(8)?),
        action_items_mine: parse_json_vec(row.get(9)?),
        action_items_theirs: parse_json_vec(row.get(10)?),
        notable_quotes: parse_json_vec(row.get(11)?),
        blockers: parse_json_vec(row.get(12)?),
        wins: parse_json_vec(row.get(13)?),
        private_note: row.get(14)?,
        transcript: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}
