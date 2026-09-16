#!/usr/bin/env bash
#
# Copyright (C) 2026 Zichao Zeng
# This file is part of ChartExtractor, released under the GNU GPL v3.0
# (or later). See the LICENSE file at the project root for details.
#
# notarize.sh — ChartExtractor macOS 发布签名 + 公证 + 盖章（Developer ID 分发路径）
#
# 前置条件（需要开发者账号侧准备，本机 git 仓库无需提交任何凭据）：
#   1. 安装 Developer ID Application 证书到系统钥匙串
#   2. 注册公证用的 App Store Connect API Key（或使用 Apple ID + 专用密码）
#   3. 环境变量（或直接改脚本）：
#      TAURI_SIGNING_IDENTITY  证书名称，如 "Developer ID Application: Your Name (TEAMID)"
#      APPLE_ID                Apple ID（邮箱）
#      APPLE_PASSWORD          专用密码（app-specific password）
#      APPLE_TEAM_ID           团队 ID
#
# 用法：
#   export TAURI_SIGNING_IDENTITY="Developer ID Application: ..."
#   export APPLE_ID=you@example.com APPLE_PASSWORD=xxxx APPLE_TEAM_ID=XXXXXXXXXX
#   scripts/notarize.sh [版本号] [架构]
#
# 流程：
#   1. 以签名身份构建 .app（自动启用 hardened runtime 与 WKWebView 所需 entitlements）
#   2. 生成 DMG（scripts/create-dmg.sh）
#   3. 对 .app 与 .dmg 做必选校验（codesign / spctl）
#   4. notarytool submit 公证 DMG
#   5. stapler staple 盖章
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(grep -m1 '^version' "$ROOT/src-tauri/Cargo.toml" | sed -E 's/.*"([0-9.]+)".*/\1/')}"
ARCH="${2:-$(uname -m)}"
case "$ARCH" in
  arm64|aarch64) ARCH=arm64 ;; x86_64) ARCH=x86_64 ;;
esac

: "${TAURI_SIGNING_IDENTITY:? 缺少 TAURI_SIGNING_IDENTITY（Developer ID 证书名）}"
APP="$ROOT/src-tauri/target/release/bundle/macos/ChartExtractor.app"

echo "==> 1/5 以签名身份构建（提示：如需 Universal 请先 rustup target add x86_64-apple-darwin 并改用 --target universal-apple-darwin）"
if [ -n "${UNIVERSAL:-}" ]; then
  (cd "$ROOT" && npx tauri build --bundles app --target universal-apple-darwin)
  APP="$ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/ChartExtractor.app"
else
  (cd "$ROOT" && TAURI_SIGNING_IDENTITY="$TAURI_SIGNING_IDENTITY" npm run package)
fi

echo "==> 2/5 生成 DMG"
"$ROOT/scripts/create-dmg.sh" "$VERSION" "$ARCH"
DMG="$ROOT/release/ChartExtractor-${VERSION}-${ARCH}.dmg"

echo "==> 3/5 校验签名与 Gatekeeper"
codesign -dvvv "$APP" 2>&1 | grep -E 'flags|Identifier|TeamIdentifier' || true
spctl -a -vv "$APP" || { echo "spctl 未通过（签名身份可能不正确）"; exit 1; }

echo "==> 4/5 公证（notarytool submit，可能需要几分钟）"
if [ -n "${APPLE_API_KEY_ID:-}" ]; then
  # App Store Connect API Key 模式
  xcrun notarytool submit "$DMG" \
    --key "$APPLE_API_KEY_FILE" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_ISSUER_ID" \
    --wait --output-format json
else
  # Apple ID + 专用密码模式
  xcrun notarytool submit "$DMG" \
    --apple-id "${APPLE_ID:?}" --password "${APPLE_PASSWORD:?}" \
    --team-id "${APPLE_TEAM_ID:?}" --wait --output-format json
fi

echo "==> 5/5 盖章并二次验证"
xcrun stapler staple "$DMG"
spctl --assess --type open --context context:primary-signature -vv "$DMG" || true
echo "✅ 完成：$DMG"