//! Chang Store - Tauri Application Entry Point
//!
//! This is the main entry point for the Tauri desktop application.
//! It initializes plugins for file system access, notifications,
//! dialogs, and system tray functionality.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    chang_store_lib::run()
}
