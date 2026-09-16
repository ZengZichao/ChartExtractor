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
// 图表数据提取器 - Tauri 命令层
// 二进制内容以 base64 在前端与 Rust 之间往返，保持前端改动最小、接口简洁。
use std::fs;
use std::path::PathBuf;
use base64::{engine::general_purpose::STANDARD, Engine};
use tokio::sync::oneshot;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
const MAX_RECENT_FILES: usize = 20;
/// 原子写文件 —— 先写同目录临时文件再 rename（同卷 rename 原子）。
/// 避免写入途中崩溃留下截断文件。
fn write_atomic(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
 let tmp = path.with_extension(format!("tmp.{}", std::process::id()));
 std::fs::write(&tmp, bytes)?;
 let res = std::fs::rename(&tmp, path);
 if res.is_err() {
 let _ = std::fs::remove_file(&tmp);
 }
 res
}
#[derive(Deserialize)]
pub struct DialogFilter {
 pub name: String,
 pub extensions: Vec<String>,
}
#[derive(Deserialize)]
pub struct RecentFileEntry {
 pub path: String,
 pub name: String,
}
/// 最近文件（强类型，编译期锁住字段；前端 RecentFile[] 对应）
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
 pub path: String,
 pub name: String,
 pub last_opened: String,
}
#[derive(Serialize)]
pub struct FileReadResult {
 pub success: bool,
 pub data: Option<String>,
 pub size: Option<u64>,
 pub error: Option<String>,
}
#[derive(Serialize)]
pub struct SimpleResult {
 pub success: bool,
 pub error: Option<String>,
}
#[derive(Serialize)]
pub struct FileStatResult {
 pub success: bool,
 pub size: Option<u64>,
 pub is_file: Option<bool>,
 pub is_directory: Option<bool>,
 pub error: Option<String>,
}
/// 最近文件持久化路径：app_config_dir/recentFiles.json
fn recent_files_path(app: &AppHandle) -> Option<PathBuf> {
 app.path()
 .app_config_dir()
 .ok()
 .map(|dir| dir.join("recentFiles.json"))
}
/// 自动保存路径：app_config_dir/autosave.prj（ 会话恢复）
fn autosave_path(app: &AppHandle) -> Option<PathBuf> {
 app.path()
 .app_config_dir()
 .ok()
 .map(|dir| dir.join("autosave.prj"))
}
/// 写入自动保存（崩溃/误关后恢复上次会话)
#[tauri::command]
pub fn save_autosave(app: AppHandle, data: String) -> SimpleResult {
 let Some(path) = autosave_path(&app) else {
 return SimpleResult { success: false, error: Some("无法定位应用数据目录".into()) };
 };
 if let Some(parent) = path.parent() {
 let _ = fs::create_dir_all(parent);
 }
 match STANDARD.decode(&data) {
 Ok(bytes) => match write_atomic(&path, &bytes) {
 Ok(_) => SimpleResult { success: true, error: None },
 Err(e) => SimpleResult { success: false, error: Some(e.to_string()) },
 },
 Err(e) => SimpleResult { success: false, error: Some(e.to_string()) },
 }
}
/// 读取自动保存（若存在返回 base64，否则 success=false）
#[tauri::command]
pub fn load_autosave(app: AppHandle) -> FileReadResult {
 let Some(path) = autosave_path(&app) else {
 return FileReadResult { success: false, data: None, size: None, error: Some("无法定位应用数据目录".into()) };
 };
 match fs::read(&path) {
 Ok(bytes) => FileReadResult {
 success: true,
 data: Some(STANDARD.encode(&bytes)),
 size: Some(bytes.len() as u64),
 error: None,
 },
 Err(e) => FileReadResult { success: false, data: None, size: None, error: Some(e.to_string()) },
 }
}
/// 清除自动保存（用户明确放弃恢复 / 手动保存后）
#[tauri::command]
pub fn clear_autosave(app: AppHandle) -> SimpleResult {
 if let Some(path) = autosave_path(&app) {
 let _ = fs::remove_file(&path);
 }
 SimpleResult { success: true, error: None }
}
fn read_recent_files(app: &AppHandle) -> Vec<RecentFile> {
 if let Some(p) = recent_files_path(app) {
 if let Ok(content) = fs::read_to_string(&p) {
 if let Ok(list) = serde_json::from_str::<Vec<RecentFile>>(&content) {
 return list;
 }
 }
 }
 Vec::new()
}
/// 纯函数：更新最近文件列表（去重、置顶、上限截断）。
/// 抽离自命令逻辑，便于单测。
fn update_recent_files(list: &mut Vec<RecentFile>, entry: &RecentFileEntry, max: usize) {
 list.retain(|item| item.path != entry.path);
 list.insert(
 0,
 RecentFile {
 path: entry.path.clone(),
 name: entry.name.clone(),
 last_opened: now_rfc3339(),
 });
 if list.len() > max {
 list.truncate(max);
 }
}
/// 用 std::time 生成 RFC3339 UTC 时间戳（替代 chrono)。
/// 基于 Howard Hinnant 的 civil_from_days 算法，零外部依赖。
fn now_rfc3339() -> String {
 let secs = std::time::SystemTime::now()
 .duration_since(std::time::UNIX_EPOCH)
 .map(|d| d.as_secs())
 .unwrap_or(0);
 let days = (secs / 86400) as i64;
 let rem = secs % 86400;
 let (year, month, day) = civil_from_days(days);
 let h = rem / 3600;
 let m = (rem % 3600) / 60;
 let s = rem % 60;
 format!(
 "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
 year, month, day, h, m, s
 )
}
/// 自 Unix 纪元天数推导公历年月日（Hinnant 算法）
fn civil_from_days(z: i64) -> (i64, u32, u32) {
 let z = z + 719468;
 let era = if z >= 0 { z } else { z - 146096 } / 146097;
 let doe = z - era * 146097; // [0, 146096]
 let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
 let y = yoe + era * 400;
 let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
 let mp = (5 * doy + 2) / 153; // [0, 11]
 let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
 let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
 (
 if m <= 2 { y + 1 } else { y },
 m as u32,
 d as u32)
}
fn apply_filters(
 mut builder: tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>,
 filters: Option<Vec<DialogFilter>>) -> tauri_plugin_dialog::FileDialogBuilder<tauri::Wry> {
 if let Some(filters) = filters {
 for f in filters {
 let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
 builder = builder.add_filter(f.name, &exts);
 }
 }
 builder
}
// 注意：必须使用回调式 pick_file / save_file + oneshot::await，而不是 blocking_*。
// blocking_pick_file 内部用 sync_channel.recv 在 tokio 命令线程上阻塞整个线程，
// macOS 上原生 NSOpenPanel（rfd sheet）依赖主线程事件循环，阻塞命令线程会触发
// Tauri 运行时死锁，表现为点击「文件」后整个 GUI 冻结（详见 tauri-plugin-dialog 文档警告）。
#[tauri::command]
pub async fn open_file(app: AppHandle, filters: Option<Vec<DialogFilter>>) -> Option<String> {
 let builder = app.dialog().file();
 let builder = apply_filters(builder, filters);
 let (tx, rx) = oneshot::channel::<Option<String>>();
 builder.pick_file(move |p| {
 let _ = tx.send(p.map(|f| f.to_string()));
 });
 rx.await.ok().flatten()
}
#[tauri::command]
pub async fn save_file(
 app: AppHandle,
 default_name: String,
 filters: Option<Vec<DialogFilter>>) -> Option<String> {
 let builder = app.dialog().file().set_file_name(default_name);
 let builder = apply_filters(builder, filters);
 let (tx, rx) = oneshot::channel::<Option<String>>();
 builder.save_file(move |p| {
 let _ = tx.send(p.map(|f| f.to_string()));
 });
 rx.await.ok().flatten()
}
#[tauri::command]
pub fn read_file(path: String) -> FileReadResult {
 match fs::read(&path) {
 Ok(bytes) => FileReadResult {
 success: true,
 data: Some(STANDARD.encode(&bytes)),
 size: Some(bytes.len() as u64),
 error: None,
 },
 Err(e) => FileReadResult {
 success: false,
 data: None,
 size: None,
 error: Some(e.to_string()),
 },
 }
}
#[tauri::command]
pub fn write_file(path: String, data: String) -> SimpleResult {
 match STANDARD.decode(&data) {
 Ok(bytes) => match write_atomic(&PathBuf::from(&path), &bytes) {
 Ok(_) => SimpleResult {
 success: true,
 error: None,
 },
 Err(e) => SimpleResult {
 success: false,
 error: Some(e.to_string()),
 },
 },
 Err(e) => SimpleResult {
 success: false,
 error: Some(e.to_string()),
 },
 }
}
/// 写盘前备份旧文件为 .prj.bak
#[tauri::command]
pub fn write_with_backup(path: String, data: String) -> SimpleResult {
 let target = PathBuf::from(&path);
 let bytes = match STANDARD.decode(&data) {
 Ok(b) => b,
 Err(e) => return SimpleResult { success: false, error: Some(e.to_string()) },
 };
 // 1) 旧文件先转存备份；备份失败即中止，避免覆盖在外的原文件
 if target.exists() {
 if let Err(e) = fs::copy(&target, format!("{}.bak", path)) {
 return SimpleResult { success: false, error: Some(format!("备份失败，已中止写入: {}", e)) };
 }
 }
 // 2) 先写同目录临时文件（fs::rename 同卷原子），成功后原子替换目标
 let tmp = target.with_extension("prj.tmp");
 if let Err(e) = fs::write(&tmp, &bytes) {
 let _ = fs::remove_file(&tmp);
 return SimpleResult { success: false, error: Some(e.to_string()) };
 }
 match fs::rename(&tmp, &target) {
 Ok(_) => SimpleResult { success: true, error: None },
 Err(e) => {
 let _ = fs::remove_file(&tmp);
 SimpleResult { success: false, error: Some(e.to_string()) }
 }
 }
}
// 预留命令：read_text_file / file_stat / open_path / get_user_data_path 当前前端零调用，
// 保留为「预留能力」并在 capabilities 维持最小权限；清理前请确认无迭代计划。
#[tauri::command]
pub fn read_text_file(path: String) -> FileReadResult {
 match fs::read_to_string(&path) {
 Ok(content) => {
 let size = content.len() as u64;
 FileReadResult {
 success: true,
 data: Some(content),
 size: Some(size),
 error: None,
 }
 }
 Err(e) => FileReadResult {
 success: false,
 data: None,
 size: None,
 error: Some(e.to_string()),
 },
 }
}
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> SimpleResult {
 match write_atomic(&PathBuf::from(&path), content.as_bytes()) {
 Ok(_) => SimpleResult {
 success: true,
 error: None,
 },
 Err(e) => SimpleResult {
 success: false,
 error: Some(e.to_string()),
 },
 }
}
/// 按指定编码写文本（GBK 用 encoding_rs，替代 Electron 的 iconv-lite)
#[tauri::command]
pub fn write_text_encoded(path: String, content: String, encoding: String) -> SimpleResult {
 // P2-16 修复：非法编码名返回错误而非静默回退 UTF-8
 let enc = match encoding_rs::Encoding::for_label(encoding.as_bytes()) {
  Some(e) => e,
  None => return SimpleResult { success: false, error: Some(format!("Unknown encoding: {}", encoding)) },
 };
 let (cow, _, _) = enc.encode(&content);
 match write_atomic(&PathBuf::from(&path), cow.as_ref()) {
 Ok(_) => SimpleResult {
 success: true,
 error: None,
 },
 Err(e) => SimpleResult {
 success: false,
 error: Some(e.to_string()),
 },
 }
}
#[tauri::command]
pub fn file_stat(path: String) -> FileStatResult {
 match fs::metadata(&path) {
 Ok(m) => FileStatResult {
 success: true,
 size: Some(m.len()),
 is_file: Some(m.is_file()),
 is_directory: Some(m.is_dir()),
 error: None,
 },
 Err(e) => FileStatResult {
 success: false,
 size: None,
 is_file: None,
 is_directory: None,
 error: Some(e.to_string()),
 },
 }
}
#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> SimpleResult {
 match app.opener().open_path(&path, None::<&str>) {
 Ok(_) => SimpleResult {
 success: true,
 error: None,
 },
 Err(e) => SimpleResult {
 success: false,
 error: Some(e.to_string()),
 },
 }
}
#[tauri::command]
pub fn get_user_data_path(app: AppHandle) -> Result<String, String> {
 app.path()
 .app_config_dir()
 .map(|p| p.to_string_lossy().to_string())
 .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_recent_files(app: AppHandle) -> Vec<RecentFile> {
 read_recent_files(&app)
}
/// 写入最近文件
#[tauri::command]
pub fn add_recent_file(app: AppHandle, entry: RecentFileEntry) -> SimpleResult {
 let mut list = read_recent_files(&app);
 update_recent_files(&mut list, &entry, MAX_RECENT_FILES);
 if let Some(p) = recent_files_path(&app) {
 if let Some(parent) = p.parent() {
 let _ = fs::create_dir_all(parent);
 }
 match fs::write(&p, serde_json::to_string_pretty(&list).unwrap_or_default()) {
 Ok(_) => SimpleResult { success: true, error: None },
 Err(e) => SimpleResult { success: false, error: Some(e.to_string()) },
 }
 } else {
 SimpleResult { success: false, error: Some("无法定位应用配置目录".into()) }
 }
}
/// -批量处理：打开目录选择对话框
#[tauri::command]
pub async fn open_directory(app: AppHandle) -> Option<String> {
 let (tx, rx) = oneshot::channel::<Option<String>>();
 app.dialog()
 .file()
 .pick_folder(move |p| {
 let _ = tx.send(p.map(|f| f.to_string()));
 });
 rx.await.ok().flatten()
}
/// -批量处理：列出目录下指定扩展名的文件（纯本地，不触网）
#[derive(Serialize)]
pub struct DirEntry {
 pub path: String,
 pub name: String,
}
#[tauri::command]
pub fn list_directory(
 dir_path: String,
 extensions: Option<Vec<String>>) -> Result<Vec<DirEntry>, String> {
 let path = PathBuf::from(&dir_path);
 if !path.is_dir() {
 return Err(format!("Not a directory: {}", dir_path));
 }
 let exts: Option<std::collections::HashSet<String>> = extensions.map(|e| {
 e.iter().map(|s| s.to_lowercase()).collect()
 });
 let mut entries: Vec<DirEntry> = Vec::new();
 if let Ok(rd) = fs::read_dir(&path) {
 for entry in rd.flatten() {
 let p = entry.path();
 if !p.is_file() {
 continue;
 }
 let ext = p
 .extension()
 .and_then(|e| e.to_str())
 .map(|s| s.to_lowercase());
 if let Some(ref allowed) = exts {
 if let Some(ref e) = ext {
 if !allowed.contains(e) {
 continue;
 }
 } else {
 continue;
 }
 }
 let name = entry
 .file_name()
 .to_string_lossy()
 .to_string();
 entries.push(DirEntry {
 path: p.to_string_lossy().to_string(),
 name,
 });
 }
 }
 entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
 Ok(entries)
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test]
 fn recent_files_dedup_and_truncate() {
 let mut list: Vec<RecentFile> = vec![];
 for i in 0..(MAX_RECENT_FILES + 5) {
 let e = RecentFileEntry {
 path: format!("p{}", i),
 name: format!("N{}", i),
 };
 update_recent_files(&mut list, &e, MAX_RECENT_FILES);
 }
 // 上限截断
 assert_eq!(list.len(), MAX_RECENT_FILES);
 // 最新置顶
 assert_eq!(list[0].path, format!("p{}", MAX_RECENT_FILES + 4));
 // 去重：重复路径移到最前且不增加长度、无重复
 let dup = RecentFileEntry {
 path: "p0".into(),
 name: "N0".into(),
 };
 update_recent_files(&mut list, &dup, MAX_RECENT_FILES);
 assert_eq!(list.len(), MAX_RECENT_FILES);
 assert_eq!(list[0].path, "p0");
 let mut sorted: Vec<&String> = list.iter().map(|r| &r.path).collect();
 sorted.sort();
 let unique = sorted.iter().collect::<std::collections::HashSet<_>>();
 assert_eq!(sorted.len(), unique.len());
 }
 #[test]
 fn gbk_roundtrip() {
 let path = std::env::temp_dir()
 .join("ce_test_gbk.txt")
 .to_string_lossy()
 .to_string();
 let content = "你好，世界！GBK测试";
 let r = write_text_encoded(path.clone(), content.to_string(), "gbk".to_string());
 assert!(r.success, "write failed: {:?}", r.error);
 let bytes = std::fs::read(&path).unwrap();
 let (cow, _, had_errors) = encoding_rs::GBK.decode(&bytes);
 assert!(!had_errors);
 assert_eq!(cow.as_ref(), content);
 let _ = std::fs::remove_file(&path);
 }
 #[test]
 fn write_with_backup_creates_bak() {
 let path = std::env::temp_dir()
 .join("ce_test_bak.txt")
 .to_string_lossy()
 .to_string();
 let _ = std::fs::write(&path, "ORIGINAL");
 let new_content = "UPDATED";
 let b64 = STANDARD.encode(new_content.as_bytes());
 let r = write_with_backup(path.clone(), b64);
 assert!(r.success);
 assert_eq!(std::fs::read_to_string(&path).unwrap(), new_content);
 assert_eq!(
 std::fs::read_to_string(format!("{}.bak", path)).unwrap(),
 "ORIGINAL"
 );
 let _ = std::fs::remove_file(&path);
 let _ = std::fs::remove_file(format!("{}.bak", path));
 }
 #[test]
 fn civil_from_days_known_dates() {
 // 1970-01-01 -> day 0
 assert_eq!(civil_from_days(0), (1970, 1, 1));
 // 2000-01-01 -> day 10957 (30y + 7 leap)
 assert_eq!(civil_from_days(10957), (2000, 1, 1));
 // 2026-08-11 -> day 20676 (56y + 14 leap 到 2026-01-01，再加 222 天)
 assert_eq!(civil_from_days(20676), (2026, 8, 11));
 }
}