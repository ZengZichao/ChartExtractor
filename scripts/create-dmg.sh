#!/usr/bin/env bash
#
# Copyright (C) 2026 Zichao Zeng
# This file is part of ChartExtractor, released under the GNU GPL v3.0
# (or later). See the LICENSE file at the project root for details.
#
# create-dmg.sh — 免交互生成 ChartExtractor 的 macOS DMG 安装包（评审 F11）
#
# 背景：tauri.conf.json 的 bundle.targets 仅 ["app"]，DMG 由本脚本在 .app 产出后
#       额外用系统自带 hdiutil 生成，避免手动步骤丢失且可纳入 CI。
# 依赖：macOS + hdiutil（系统自带），无需第三方 create-dmg 工具。
#
# 用法：
#   scripts/create-dmg.sh            # 自动读取版本号与本机架构
#   scripts/create-dmg.sh 1.0.0     # 指定版本
#   scripts/create-dmg.sh 1.0.0 x86_64
#
# 前置：需先产出 .app，例如 `npm run package`（即 `tauri build`）。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT/release"

# 版本号：优先参数，否则取 src-tauri/Cargo.toml 的 version
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(grep -m1 '^version' "$ROOT/src-tauri/Cargo.toml" | sed -E 's/.*"([0-9.]+)".*/\1/')
fi
if [ -z "$VERSION" ]; then
  echo "错误：无法解析版本号" >&2
  exit 1
fi

# 架构：优先参数，否则取本机
ARCH="${2:-}"
if [ -z "$ARCH" ]; then
  ARCH=$(uname -m)
fi
case "$ARCH" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64)        ARCH=x86_64 ;;
esac

# 定位已构建的 .app
SRC_APP=$(find "$ROOT/src-tauri/target/release/bundle" -maxdepth 3 -name 'ChartExtractor.app' -type d 2>/dev/null | head -1)
if [ ! -d "$SRC_APP" ]; then
  echo "错误：未找到 ChartExtractor.app，请先运行 'npm run package'（tauri build）" >&2
  echo "      查找路径：$ROOT/src-tauri/target/release/bundle/macos/ChartExtractor.app" >&2
  exit 1
fi

DMG_NAME="ChartExtractor-${VERSION}-${ARCH}.dmg"
DMG_PATH="$RELEASE_DIR/$DMG_NAME"
STAGING=$(mktemp -d)
TMP_DMG=$(mktemp -u).dmg

cleanup() { rm -rf "$STAGING" "$TMP_DMG" 2>/dev/null || true; }
trap cleanup EXIT

echo "==> 源 .app : $SRC_APP"
echo "==> 版本/架构: ${VERSION} / ${ARCH}"

# 暂存区：放置 .app 与 /Applications 快捷方式（拖拽安装）
mkdir -p "$STAGING"
cp -R "$SRC_APP" "$STAGING/ChartExtractor.app"
ln -s /Applications "$STAGING/Applications"

# 1) 创建可读写临时镜像（UDWR），再用 -srcfolder 打包
hdiutil create \
  -volname "ChartExtractor ${VERSION}" \
  -srcfolder "$STAGING" \
  -ov -format UDRW \
  "$TMP_DMG" >/dev/null

# 2) 挂载以等待文件系统就绪（无 GUI 样式，保持最简可靠）
DEV=$(hdiutil attach -nobrowse -noverify "$TMP_DMG" | awk 'NR==1{print $1}')
sleep 1
hdiutil detach "$DEV" >/dev/null 2>&1 || true

# 3) 转换为压缩只读 DMG（UDZO）
mkdir -p "$RELEASE_DIR"
hdiutil convert "$TMP_DMG" -format UDZO -ov -o "$DMG_PATH" >/dev/null

# 同步 .app 副本到 release/（与既有交付物结构一致）
rm -rf "$RELEASE_DIR/ChartExtractor.app"
cp -R "$SRC_APP" "$RELEASE_DIR/ChartExtractor.app"

SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo "==> 已生成 DMG : $DMG_PATH"
echo "==> DMG 大小  : $SIZE"
