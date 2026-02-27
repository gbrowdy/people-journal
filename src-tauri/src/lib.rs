mod ai;
mod db;

use db::{AppDb, Entry, TeamMember};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

// ─── Team commands ──────────────────────────────────────

#[tauri::command]
fn get_team(db: State<AppDb>) -> Vec<TeamMember> {
    let conn = db.0.lock().unwrap();
    db::get_team_members(&conn)
}

#[derive(Deserialize)]
struct CreateTeamMemberData {
    #[serde(default)]
    name: String,
    #[serde(default)]
    role: String,
    #[serde(default)]
    color: String,
}

#[tauri::command]
fn create_team_member(db: State<AppDb>, data: CreateTeamMemberData) -> TeamMember {
    let conn = db.0.lock().unwrap();
    db::create_team_member(&conn, &data.name, &data.role, &data.color)
}

#[derive(Deserialize)]
struct UpdateTeamMemberData {
    name: String,
    role: String,
    color: String,
    jira_account_id: Option<String>,
}

#[tauri::command]
fn update_team_member(db: State<AppDb>, id: String, data: UpdateTeamMemberData) -> Option<TeamMember> {
    let conn = db.0.lock().unwrap();
    db::update_team_member(&conn, &id, &data.name, &data.role, &data.color, data.jira_account_id.as_deref())
}

#[tauri::command]
fn delete_team_member(db: State<AppDb>, id: String) -> bool {
    let conn = db.0.lock().unwrap();
    db::delete_team_member(&conn, &id)
}

#[tauri::command]
fn update_prep_notes(db: State<AppDb>, member_id: String, prep_notes: String) -> bool {
    let conn = db.0.lock().unwrap();
    db::update_prep_notes(&conn, &member_id, &prep_notes)
}

// ─── Entry commands ─────────────────────────────────────

#[tauri::command]
fn get_entries(db: State<AppDb>, member_id: Option<String>) -> Vec<Entry> {
    let conn = db.0.lock().unwrap();
    db::get_entries(&conn, member_id.as_deref())
}

#[tauri::command]
fn get_entry(db: State<AppDb>, id: String) -> Option<Entry> {
    let conn = db.0.lock().unwrap();
    db::get_entry(&conn, &id)
}

#[tauri::command]
fn create_entry(db: State<AppDb>, data: serde_json::Value) -> Option<Entry> {
    let conn = db.0.lock().unwrap();
    db::create_entry(&conn, &data)
}

#[tauri::command]
fn update_entry(db: State<AppDb>, id: String, data: serde_json::Value) -> Option<Entry> {
    let conn = db.0.lock().unwrap();
    db::update_entry(&conn, &id, &data)
}

#[tauri::command]
fn delete_entry(db: State<AppDb>, id: String) -> bool {
    let conn = db.0.lock().unwrap();
    db::delete_entry(&conn, &id)
}

// ─── AI commands ────────────────────────────────────────

#[tauri::command]
async fn extract_transcript(
    db: State<'_, AppDb>,
    transcript: String,
    member_name: String,
) -> Result<serde_json::Value, String> {
    // Check cache
    let cache_key = db::cache_key(&[&member_name, &transcript]);
    {
        let conn = db.0.lock().unwrap();
        if let Some(cached) = db::cache_get(&conn, &cache_key, "extract") {
            if let Ok(val) = serde_json::from_str(&cached) {
                return Ok(val);
            }
        }
    }

    let result = ai::extract_transcript(&transcript, &member_name).await?;

    // Cache the result
    {
        let conn = db.0.lock().unwrap();
        if let Ok(json_str) = serde_json::to_string(&result) {
            db::cache_set(&conn, &cache_key, "extract", &json_str);
        }
    }

    Ok(result)
}

#[derive(Serialize, Deserialize)]
struct PrepResponse {
    briefing: String,
    open_items_mine: Vec<PrepActionItem>,
    open_items_theirs: Vec<PrepActionItem>,
    recent_tags: Vec<TagCount>,
    unresolved_blockers: Vec<String>,
    morale_scores: Vec<ScorePoint>,
    growth_scores: Vec<ScorePoint>,
}

#[derive(Serialize, Deserialize)]
struct PrepActionItem {
    text: String,
    date: String,
}

#[derive(Serialize, Deserialize)]
struct TagCount {
    tag: String,
    count: usize,
}

#[derive(Serialize, Deserialize)]
struct ScorePoint {
    date: String,
    score: i64,
}

fn compute_structured_prep(entries: &[Entry]) -> (Vec<PrepActionItem>, Vec<PrepActionItem>, Vec<TagCount>, Vec<String>, Vec<ScorePoint>, Vec<ScorePoint>) {
    let mut open_mine = Vec::new();
    let mut open_theirs = Vec::new();
    let mut tag_counts: HashMap<String, usize> = HashMap::new();
    let mut blockers = Vec::new();
    let mut morale_scores = Vec::new();
    let mut growth_scores = Vec::new();

    for e in entries {
        for a in &e.action_items_mine {
            if !a.completed {
                open_mine.push(PrepActionItem { text: a.text.clone(), date: e.date.clone() });
            }
        }
        for a in &e.action_items_theirs {
            if !a.completed {
                open_theirs.push(PrepActionItem { text: a.text.clone(), date: e.date.clone() });
            }
        }
        for t in &e.tags {
            *tag_counts.entry(t.clone()).or_default() += 1;
        }
        blockers.extend(e.blockers.iter().cloned());
        if let Some(score) = e.morale_score {
            morale_scores.push(ScorePoint { date: e.date.clone(), score });
        }
        if let Some(score) = e.growth_score {
            growth_scores.push(ScorePoint { date: e.date.clone(), score });
        }
    }

    let mut tags: Vec<TagCount> = tag_counts.into_iter().map(|(tag, count)| TagCount { tag, count }).collect();
    tags.sort_by(|a, b| b.count.cmp(&a.count));

    (open_mine, open_theirs, tags, blockers, morale_scores, growth_scores)
}

#[tauri::command]
async fn fetch_prep(
    db: State<'_, AppDb>,
    member_id: String,
    force: bool,
) -> Result<PrepResponse, String> {
    let (member_name, entries) = {
        let conn = db.0.lock().unwrap();
        let name = db::get_member_name(&conn, &member_id)
            .ok_or("member not found")?;
        let entries = db::get_entries_limited(&conn, &member_id, 5);
        (name, entries)
    };

    if entries.is_empty() {
        return Ok(PrepResponse {
            briefing: "No entries yet for this team member.".to_string(),
            open_items_mine: vec![],
            open_items_theirs: vec![],
            recent_tags: vec![],
            unresolved_blockers: vec![],
            morale_scores: vec![],
            growth_scores: vec![],
        });
    }

    // Build cache key
    let mut key_parts: Vec<String> = vec![
        member_id.clone(),
        chrono::Utc::now().format("%Y-%m-%d").to_string(),
    ];
    for e in &entries {
        key_parts.push(e.id.clone());
        if let Some(ref u) = e.updated_at {
            key_parts.push(u.clone());
        }
    }
    let key_refs: Vec<&str> = key_parts.iter().map(|s| s.as_str()).collect();
    let cache_key = db::cache_key(&key_refs);

    // Check cache
    if !force {
        let conn = db.0.lock().unwrap();
        if let Some(cached) = db::cache_get(&conn, &cache_key, "prep") {
            if let Ok(val) = serde_json::from_str(&cached) {
                return Ok(val);
            }
        }
    }

    let (open_mine, open_theirs, tags, blockers, morale_scores, growth_scores) =
        compute_structured_prep(&entries);

    // Generate AI briefing
    let prompt = ai::build_prep_prompt(&member_name, &entries);
    let briefing = match ai::generate_briefing(&prompt).await {
        Ok(text) => text,
        Err(_) => "Failed to generate AI briefing. Showing structured data only.".to_string(),
    };

    let resp = PrepResponse {
        briefing,
        open_items_mine: open_mine,
        open_items_theirs: open_theirs,
        recent_tags: tags,
        unresolved_blockers: blockers,
        morale_scores,
        growth_scores,
    };

    // Cache
    {
        let conn = db.0.lock().unwrap();
        if let Ok(json_str) = serde_json::to_string(&resp) {
            db::cache_set(&conn, &cache_key, "prep", &json_str);
        }
    }

    Ok(resp)
}

// ─── Config ─────────────────────────────────────────────

#[tauri::command]
fn get_config() -> HashMap<String, serde_json::Value> {
    let mut config = HashMap::new();
    config.insert("jira_configured".into(), serde_json::Value::Bool(false));
    config
}

// ─── App entry ──────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env from the project root (shared with the Go backend)
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::from_filename(".env");

    let conn = db::init_db();

    tauri::Builder::default()
        .manage(AppDb(std::sync::Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            get_team,
            create_team_member,
            update_team_member,
            delete_team_member,
            update_prep_notes,
            get_entries,
            get_entry,
            create_entry,
            update_entry,
            delete_entry,
            extract_transcript,
            fetch_prep,
            get_config,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
