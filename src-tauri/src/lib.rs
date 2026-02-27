mod db;

use db::{AppDb, Entry, TeamMember};
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
fn get_team(db: State<AppDb>) -> Vec<TeamMember> {
    let conn = db.0.lock().unwrap();
    db::get_team_members(&conn)
}

#[tauri::command]
fn get_entries(db: State<AppDb>, member_id: Option<String>) -> Vec<Entry> {
    let conn = db.0.lock().unwrap();
    db::get_entries(&conn, member_id.as_deref())
}

#[tauri::command]
fn get_config() -> HashMap<String, serde_json::Value> {
    // JIRA is not configured in the Tauri build (no .env)
    let mut config = HashMap::new();
    config.insert("jira_configured".into(), serde_json::Value::Bool(false));
    config
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::init_db();

    tauri::Builder::default()
        .manage(AppDb(std::sync::Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![get_team, get_entries, get_config])
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
