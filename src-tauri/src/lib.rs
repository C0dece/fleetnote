mod oauth;
mod secrets;

/// Точка входа, общая для десктопа и мобильных платформ.
/// На Android/iOS Tauri вызывает её через `mobile_entry_point`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(oauth::OAuthState::default())
        .invoke_handler(tauri::generate_handler![
            oauth::oauth_start,
            oauth::oauth_wait,
            oauth::oauth_cancel,
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
        ])
        .run(tauri::generate_context!())
        .expect("не удалось запустить Fleetnote");
}
