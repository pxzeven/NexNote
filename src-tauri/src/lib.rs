use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Note {
    id: String,
    title: String,
    content: String,
    updated_at: u64,
    created_at: u64,
}

fn get_notes_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    path.push("Notes");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn get_trash_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut path = get_notes_dir(app_handle)?;
    path.push(".trash");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

#[tauri::command]
fn get_notes(app_handle: AppHandle) -> Result<Vec<Note>, String> {
    let notes_dir = get_notes_dir(&app_handle)?;
    let mut notes = Vec::new();

    if let Ok(entries) = fs::read_dir(notes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let id = path.file_name().unwrap().to_string_lossy().into_owned();
                let title = path.file_stem().unwrap().to_string_lossy().into_owned();
                let content = fs::read_to_string(&path).unwrap_or_default();
                let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

                let updated_at = metadata
                    .modified()
                    .unwrap_or(SystemTime::now())
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let created_at = metadata
                    .created()
                    .unwrap_or(SystemTime::now())
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;

                notes.push(Note {
                    id,
                    title,
                    content,
                    updated_at,
                    created_at,
                });
            }
        }
    }
    notes.sort_by_key(|b| std::cmp::Reverse(b.updated_at));
    Ok(notes)
}

#[tauri::command]
fn save_note(
    app_handle: AppHandle,
    id: String,
    title: String,
    content: String,
) -> Result<Note, String> {
    let notes_dir = get_notes_dir(&app_handle)?;

    let target_filename = if id.is_empty() {
        let base_name = if title.trim().is_empty() {
            "Untitled Note".to_string()
        } else {
            title
                .replace(&['<', '>', ':', '"', '/', '\\', '|', '?', '*'][..], "")
                .trim()
                .to_string()
        };
        let mut name = format!("{}.md", base_name);
        let mut counter = 1;
        while notes_dir.join(&name).exists() {
            name = format!("{} ({}).md", base_name, counter);
            counter += 1;
        }
        name
    } else {
        id
    };

    let target_path = notes_dir.join(&target_filename);
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&target_path).map_err(|e| e.to_string())?;
    let updated_at = metadata
        .modified()
        .unwrap_or(SystemTime::now())
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    let created_at = metadata
        .created()
        .unwrap_or(SystemTime::now())
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    Ok(Note {
        id: target_filename,
        title,
        content,
        updated_at,
        created_at,
    })
}

#[tauri::command]
fn delete_note(app_handle: AppHandle, id: String) -> Result<bool, String> {
    let notes_dir = get_notes_dir(&app_handle)?;
    let trash_dir = get_trash_dir(&app_handle)?;

    let file_path = notes_dir.join(&id);
    if file_path.exists() {
        let mut target_trash_path = trash_dir.join(&id);
        if target_trash_path.exists() {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            target_trash_path = trash_dir.join(format!("{}-{}", timestamp, id));
        }
        fs::rename(file_path, target_trash_path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn get_trashed_notes(app_handle: AppHandle) -> Result<Vec<Note>, String> {
    let trash_dir = get_trash_dir(&app_handle)?;
    let mut notes = Vec::new();

    if let Ok(entries) = fs::read_dir(trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let id = path.file_name().unwrap().to_string_lossy().into_owned();
                let title = path.file_stem().unwrap().to_string_lossy().into_owned();
                let content = fs::read_to_string(&path).unwrap_or_default();
                let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

                let updated_at = metadata
                    .modified()
                    .unwrap_or(SystemTime::now())
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let created_at = metadata
                    .created()
                    .unwrap_or(SystemTime::now())
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;

                notes.push(Note {
                    id,
                    title,
                    content,
                    updated_at,
                    created_at,
                });
            }
        }
    }
    notes.sort_by_key(|b| std::cmp::Reverse(b.updated_at));
    Ok(notes)
}

#[tauri::command]
fn restore_note(app_handle: AppHandle, id: String) -> Result<bool, String> {
    let notes_dir = get_notes_dir(&app_handle)?;
    let trash_dir = get_trash_dir(&app_handle)?;

    let trash_path = trash_dir.join(&id);
    if trash_path.exists() {
        let mut target_path = notes_dir.join(&id);
        if target_path.exists() {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            target_path = notes_dir.join(format!("restored-{}-{}", timestamp, id));
        }
        fs::rename(trash_path, target_path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn permanently_delete_note(app_handle: AppHandle, id: String) -> Result<bool, String> {
    let trash_dir = get_trash_dir(&app_handle)?;
    let trash_path = trash_dir.join(&id);

    if trash_path.exists() {
        fs::remove_file(trash_path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn empty_trash(app_handle: AppHandle) -> Result<bool, String> {
    let trash_dir = get_trash_dir(&app_handle)?;

    if let Ok(entries) = fs::read_dir(trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let _ = fs::remove_file(path);
            }
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn rename_note(
    app_handle: AppHandle,
    id: String,
    new_title: String,
) -> Result<Option<String>, String> {
    let notes_dir = get_notes_dir(&app_handle)?;
    let old_path = notes_dir.join(&id);

    if !old_path.exists() {
        return Ok(None);
    }

    let base_name = if new_title.trim().is_empty() {
        "Untitled Note".to_string()
    } else {
        new_title
            .replace(&['<', '>', ':', '"', '/', '\\', '|', '?', '*'][..], "")
            .trim()
            .to_string()
    };
    let mut new_filename = format!("{}.md", base_name);
    let mut counter = 1;

    while notes_dir.join(&new_filename).exists() && new_filename != id {
        new_filename = format!("{} ({}).md", base_name, counter);
        counter += 1;
    }

    let new_path = notes_dir.join(&new_filename);
    if old_path != new_path {
        fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    }

    Ok(Some(new_filename))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_notes,
            save_note,
            delete_note,
            get_trashed_notes,
            restore_note,
            permanently_delete_note,
            empty_trash,
            rename_note
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
