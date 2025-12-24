//! Chang Store - Tauri Library
//!
//! Contains the core Tauri application setup with plugins and commands.
//! Separated from main.rs to support both library and binary builds.

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

/// Custom Tauri commands exposed to the frontend
mod commands {
    use tauri::{command, Manager};

    /// Save image to local file system
    ///
    /// # Arguments
    /// * `base64_data` - Base64 encoded image data
    /// * `file_path` - Target file path
    #[command]
    pub async fn save_image_to_file(base64_data: String, file_path: String) -> Result<String, String> {
        use std::fs;
        use std::path::Path;

        // Remove data URL prefix if present
        let base64_clean = if base64_data.contains(",") {
            base64_data.split(",").nth(1).unwrap_or(&base64_data)
        } else {
            &base64_data
        };

        // Decode base64
        let decoded = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            base64_clean,
        ).map_err(|e| format!("Failed to decode base64: {}", e))?;

        // Ensure parent directory exists
        if let Some(parent) = Path::new(&file_path).parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // Write file
        fs::write(&file_path, decoded)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(file_path)
    }

    /// Get app data directory path
    #[command]
    pub fn get_app_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
        app_handle
            .path()
            .app_data_dir()
            .map(|p| p.to_string_lossy().to_string())
            .map_err(|e| format!("Failed to get app data dir: {}", e))
    }
}

/// Initialize and run the Tauri application
pub fn run() {
    tauri::Builder::default()
        // File system plugin for reading/writing local files
        .plugin(tauri_plugin_fs::init())
        // Dialog plugin for open/save file dialogs
        .plugin(tauri_plugin_dialog::init())
        // Notification plugin for system notifications
        .plugin(tauri_plugin_notification::init())
        // Shell plugin for opening URLs in browser
        .plugin(tauri_plugin_shell::init())
        // Setup system tray
        .setup(|app| {
            // Create tray menu
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Chang Store - AI Fashion Studio")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        // Register custom commands
        .invoke_handler(tauri::generate_handler![
            commands::save_image_to_file,
            commands::get_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
