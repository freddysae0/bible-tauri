use tauri::Manager;

#[tauri::command]
async fn get_push_token(app: tauri::AppHandle) -> Result<String, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir: {e}"))?;
  let path = dir.join("fcm_token.txt");
  let token = std::fs::read_to_string(&path).map_err(|e| format!("read {:?}: {e}", path))?;
  let trimmed = token.trim();
  if trimmed.is_empty() {
    return Err("empty token".into());
  }
  Ok(trimmed.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![get_push_token]);

  #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
  let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

  builder
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
