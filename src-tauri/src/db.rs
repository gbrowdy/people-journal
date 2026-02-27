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

fn json_stringify<T: Serialize>(val: &T) -> String {
    serde_json::to_string(val).unwrap_or_else(|_| "[]".to_string())
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ─── Team CRUD ──────────────────────────────────────────

pub fn create_team_member(conn: &Connection, name: &str, role: &str, color: &str) -> TeamMember {
    let id = format!("member-{}", chrono::Utc::now().timestamp_millis());
    let name = if name.is_empty() { "New Member" } else { name };
    let role = if role.is_empty() { "Engineer" } else { role };
    let color = if color.is_empty() { "#888888" } else { color };

    conn.execute(
        "INSERT INTO team_members (id, name, role, color) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, role, color],
    ).expect("failed to create team member");

    get_team_member(conn, &id).expect("failed to read created team member")
}

pub fn update_team_member(
    conn: &Connection,
    id: &str,
    name: &str,
    role: &str,
    color: &str,
    jira_account_id: Option<&str>,
) -> Option<TeamMember> {
    let changed = conn.execute(
        "UPDATE team_members SET name = ?1, role = ?2, color = ?3, jira_account_id = ?4 WHERE id = ?5",
        params![name, role, color, jira_account_id, id],
    ).unwrap_or(0);

    if changed == 0 { return None; }
    get_team_member(conn, id)
}

pub fn delete_team_member(conn: &Connection, id: &str) -> bool {
    let tx = conn.unchecked_transaction().expect("failed to begin transaction");
    tx.execute("DELETE FROM entries WHERE member_id = ?1", params![id]).ok();
    let changed = tx.execute("DELETE FROM team_members WHERE id = ?1", params![id]).unwrap_or(0);
    tx.commit().expect("failed to commit");
    changed > 0
}

pub fn update_prep_notes(conn: &Connection, member_id: &str, prep_notes: &str) -> bool {
    let val: Option<&str> = if prep_notes.is_empty() { None } else { Some(prep_notes) };
    let changed = conn.execute(
        "UPDATE team_members SET prep_notes = ?1 WHERE id = ?2",
        params![val, member_id],
    ).unwrap_or(0);
    changed > 0
}

fn get_team_member(conn: &Connection, id: &str) -> Option<TeamMember> {
    conn.query_row(
        "SELECT id, name, role, color, jira_account_id, prep_notes FROM team_members WHERE id = ?1",
        params![id],
        |row| Ok(TeamMember {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            color: row.get(3)?,
            jira_account_id: row.get(4)?,
            prep_notes: row.get(5)?,
        }),
    ).ok()
}

// ─── Entry CRUD ─────────────────────────────────────────

const ENTRY_COLS: &str = "id, member_id, date, summary, morale_score, growth_score, \
    morale_rationale, growth_rationale, tags, action_items_mine, \
    action_items_theirs, notable_quotes, blockers, wins, \
    private_note, transcript, created_at, updated_at";

pub fn get_entries(conn: &Connection, member_id: Option<&str>) -> Vec<Entry> {
    if let Some(mid) = member_id {
        let query = format!("SELECT {ENTRY_COLS} FROM entries WHERE member_id = ?1 ORDER BY date DESC");
        let mut stmt = conn.prepare(&query).expect("failed to prepare query");
        stmt.query_map(params![mid], row_to_entry)
            .expect("failed to query entries")
            .filter_map(|r| r.ok())
            .collect()
    } else {
        let query = format!("SELECT {ENTRY_COLS} FROM entries ORDER BY date DESC");
        let mut stmt = conn.prepare(&query).expect("failed to prepare query");
        stmt.query_map([], row_to_entry)
            .expect("failed to query entries")
            .filter_map(|r| r.ok())
            .collect()
    }
}

pub fn get_entry(conn: &Connection, id: &str) -> Option<Entry> {
    let query = format!("SELECT {ENTRY_COLS} FROM entries WHERE id = ?1");
    conn.query_row(&query, params![id], row_to_entry).ok()
}

pub fn create_entry(conn: &Connection, data: &serde_json::Value) -> Option<Entry> {
    let id = data["id"].as_str().map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("entry-{}", chrono::Utc::now().timestamp_millis()));
    let member_id = data["member_id"].as_str().unwrap_or("");
    let date = data["date"].as_str().map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(now_rfc3339);
    let now = now_rfc3339();

    conn.execute(
        "INSERT INTO entries (id, member_id, date, summary, morale_score, growth_score, \
         morale_rationale, growth_rationale, tags, action_items_mine, action_items_theirs, \
         notable_quotes, blockers, wins, private_note, transcript, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            id, member_id, date,
            data["summary"].as_str(),
            data["morale_score"].as_i64(),
            data["growth_score"].as_i64(),
            data["morale_rationale"].as_str(),
            data["growth_rationale"].as_str(),
            json_stringify(&data["tags"]),
            json_stringify(&data["action_items_mine"]),
            json_stringify(&data["action_items_theirs"]),
            json_stringify(&data["notable_quotes"]),
            json_stringify(&data["blockers"]),
            json_stringify(&data["wins"]),
            data["private_note"].as_str(),
            data["transcript"].as_str(),
            now, now,
        ],
    ).ok()?;

    // Clear prep notes for this member
    if !member_id.is_empty() {
        conn.execute("UPDATE team_members SET prep_notes = NULL WHERE id = ?1", params![member_id]).ok();
    }

    get_entry(conn, &id)
}

pub fn update_entry(conn: &Connection, id: &str, data: &serde_json::Value) -> Option<Entry> {
    // Check entry exists
    get_entry(conn, id)?;

    let allowed = [
        "summary", "morale_score", "growth_score", "morale_rationale", "growth_rationale",
        "tags", "action_items_mine", "action_items_theirs", "notable_quotes",
        "blockers", "wins", "private_note", "transcript",
    ];
    let json_fields = ["tags", "action_items_mine", "action_items_theirs", "notable_quotes", "blockers", "wins"];

    let obj = data.as_object()?;
    let mut set_clauses = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    for field in &allowed {
        if let Some(val) = obj.get(*field) {
            set_clauses.push(format!("{field} = ?"));
            if json_fields.contains(field) {
                values.push(Box::new(json_stringify(val)));
            } else if val.is_null() {
                values.push(Box::new(None::<String>));
            } else if let Some(n) = val.as_i64() {
                values.push(Box::new(n));
            } else if let Some(f) = val.as_f64() {
                values.push(Box::new(f as i64));
            } else {
                values.push(Box::new(val.as_str().map(|s| s.to_string())));
            }
        }
    }

    if set_clauses.is_empty() {
        return get_entry(conn, id);
    }

    set_clauses.push("updated_at = ?".to_string());
    values.push(Box::new(now_rfc3339()));
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE entries SET {} WHERE id = ?",
        set_clauses.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice()).ok()?;

    get_entry(conn, id)
}

pub fn delete_entry(conn: &Connection, id: &str) -> bool {
    conn.execute("DELETE FROM entries WHERE id = ?1", params![id]).unwrap_or(0) > 0
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
