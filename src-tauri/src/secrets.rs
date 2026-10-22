//! Хранение паролей и токенов в системном хранилище секретов.
//!
//! Windows — Credential Manager, macOS — Keychain, Linux — Secret Service.
//! Если хранилища нет (например, голый сервер без keyring), значения ложатся
//! в файл приложения с правами только для владельца, и фронтенд об этом узнаёт.

use keyring::Entry;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const SERVICE: &str = "app.fleetnote.notes";

#[derive(Serialize)]
pub struct SecretStatus {
    /// `system` — системное хранилище, `file` — запасной файл.
    pub backend: String,
}

#[tauri::command]
pub fn secret_set(app: tauri::AppHandle, key: String, value: String) -> Result<SecretStatus, String> {
    match Entry::new(SERVICE, &key).and_then(|entry| entry.set_password(&value)) {
        Ok(()) => Ok(SecretStatus { backend: "system".into() }),
        Err(_) => {
            let mut all = read_file(&app)?;
            all.insert(key, value);
            write_file(&app, &all)?;
            Ok(SecretStatus { backend: "file".into() })
        }
    }
}

#[tauri::command]
pub fn secret_get(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    if let Ok(entry) = Entry::new(SERVICE, &key) {
        if let Ok(value) = entry.get_password() {
            return Ok(Some(value));
        }
    }
    Ok(read_file(&app)?.get(&key).cloned())
}

#[tauri::command]
pub fn secret_delete(app: tauri::AppHandle, key: String) -> Result<(), String> {
    if let Ok(entry) = Entry::new(SERVICE, &key) {
        let _ = entry.delete_credential();
    }
    let mut all = read_file(&app)?;
    if all.remove(&key).is_some() {
        write_file(&app, &all)?;
    }
    Ok(())
}

fn fallback_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("secrets.json"))
}

fn read_file(app: &tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let path = fallback_path(app)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn write_file(app: &tauri::AppHandle, values: &HashMap<String, String>) -> Result<(), String> {
    let path = fallback_path(app)?;
    let raw = serde_json::to_string_pretty(values).map_err(|error| error.to_string())?;
    fs::write(&path, raw).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}
