// Copyright (C) 2026 Zichao Zeng
//
// This file is part of ChartExtractor.
// ChartExtractor is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// ChartExtractor is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
// (see <https://www.gnu.org/licenses/>)
// 图表数据提取器 - Tauri 入口
// 所有操作系统能力（文件读写 / 写前备份 / GBK 编码 / 最近文件 / 打开文件）
// 统一收口到 Rust 命令层，前端经 invoke 调用，保证离线与最小权限。
mod commands;
fn main() {
 tauri::Builder::default()
 .plugin(tauri_plugin_dialog::init())
 .plugin(tauri_plugin_opener::init())
 .invoke_handler(tauri::generate_handler![
 commands::open_file,
 commands::save_file,
 commands::read_file,
 commands::write_file,
 commands::write_with_backup,
 commands::read_text_file,
 commands::write_text_file,
 commands::write_text_encoded,
 commands::file_stat,
 commands::open_path,
 commands::get_user_data_path,
 commands::get_recent_files,
 commands::add_recent_file,
 commands::save_autosave,
 commands::load_autosave,
 commands::clear_autosave,
 commands::open_directory,
 commands::list_directory,
 ])
 .run(tauri::generate_context!())
 .expect("error while running tauri application");
}