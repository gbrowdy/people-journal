mod db;

use db::{AppDb, Entry, TeamMember};
use serde::Deserialize;
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
