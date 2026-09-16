# ChartExtractor

[简体中文](./README.md) | **English**

A fully offline desktop application for extracting numerical data from charts (Tauri v2 + React + TypeScript), built to help researchers extract data from figures in published papers (bitmap / PDF) efficiently and reproducibly.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
![Platform: macOS 10.15+](https://img.shields.io/badge/platform-macOS%2010.15%2B-lightgrey)
![Offline](https://img.shields.io/badge/network-100%25%20offline-success)

> 📖 **User Guide**: [简体中文](./docs/USAGE.zh.md) | [English](./docs/USAGE.en.md)

## Features

- **100% offline**: All processing happens locally — your data never leaves the machine, making it suitable for unpublished or sensitive data. CI enforces an offline red-line scan that rejects any outbound network call.
- **Multi-format import**: Common image formats and multi-page PDFs; drag-and-drop and `Ctrl/Cmd+V` clipboard paste are supported.
- **Axis calibration**: Click 4 known reference points on the chart; supports linear / logarithmic (including negative log) affine calibration, with axis names and units.
- **Curve & scatter tracing**: Color-mask based automatic curve tracing (column-by-column scan) and scatter detection (blob clustering), with X/Y step, smoothing interpolation, and diameter filtering; multi-curve separation and color-based scatter grouping are supported.
- **Manual point picking**: Left-click to add, right-click to delete or edit; values can be edited directly in the data table.
- **Grid detection**: Automatic gridline detection to assist point placement.
- **Batch processing**: Pick a folder and the app imports images one by one, extracts curves with the current calibration, and exports CSV automatically.
- **Project management**: Save / open projects (`.prj`), autosave with crash recovery, recent files, multiple tabs, undo / redo.
- **Data export**: xlsx / CSV / JSON; optional headers, metadata comment lines (compatible with `pandas.read_csv` `comment='#'`), and GBK encoding.
- **Bilingual UI (中文 / English)**: One-click switching, fully translated interface.
- **Light & dark themes**: Follows the system, or switch manually.
- **Radix UI component system**: Built on Radix UI Primitives + Lucide icons for accessible focus management, keyboard navigation, and smooth animations.

## Installation

### Option 1: Download a prebuilt package (recommended)

Grab the installer for your platform from [GitHub Releases](https://github.com/ZengZichao/ChartExtractor/releases) (macOS: `.dmg` / `.app`).

### Option 2: Build from source

Prerequisites: Node.js ≥ 22 (or ≥ 20.19) and a stable Rust toolchain.

```bash
npm install
npm run package   # tauri build, produces the platform installer (.app on macOS)
```

On macOS you can additionally build a DMG and sign/notarize:

```bash
scripts/create-dmg.sh   # non-interactive DMG via the built-in hdiutil (no third-party tools)
scripts/notarize.sh     # Developer ID signing + notarization + stapling (requires your own certs/env vars)
```

## Quick Start

1. **Import**: Drag in / open a chart image or PDF, or paste a screenshot with `Ctrl/Cmd+V`.
2. **Calibrate**: Click the 4 known reference points on the chart (Xmin / Xmax / Ymin / Ymax), then choose linear or log scale and enter the values.
3. **Extract**: Left-click to add points manually; or use "Color segmentation → Trace Curve / Detect Scatter" for automatic extraction.
4. **Review & export**: Correct values in the data table, then export as xlsx / CSV / JSON.

For details (batch processing, project management, keyboard shortcuts, troubleshooting, etc.), see the **[User Guide](./docs/USAGE.en.md)**.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + O` | Import image / PDF |
| `Cmd/Ctrl + S` | Save project |
| `Cmd/Ctrl + Z` | Undo |
| `Shift + Cmd/Ctrl + Z` | Redo |
| `Delete` | Delete last point |
| `Space / drag` | Pan canvas |
| `Scroll` | Zoom canvas |
| `F1` | Help |

## Privacy & Security

- Image parsing, data extraction, and export all happen locally with **zero network requests**; outbound call patterns such as `fetch` / `XHR` / `WebSocket` in `src/` are rejected outright by a CI hard rule (`npm run lint:offline`).
- Projects and autosave files are written only to the app data directory on your machine.

## Development

- Frontend: React + TypeScript + Vite
- UI components: Radix UI Primitives (shadcn style) + Lucide React icons
- Desktop shell: Tauri v2 (Rust)
- Common commands:

```bash
npm run dev          # frontend dev server (Vite, port 5173)
npm run typecheck    # strict TypeScript check
npm test             # vitest unit tests + offline privacy scan + i18n consistency scan
npm run package      # build the .app (tauri build)
cargo test           # Rust command-layer unit tests (run inside src-tauri/)
```

## License

Copyright © 2026 Zichao Zeng

Released under the GNU General Public License v3.0 (GPL-3.0). You are free to use, modify, and distribute this software, but any distribution or derivative work must also be licensed under GPL-3.0. See [`LICENSE`](./LICENSE) for details.

## Acknowledgements

The curve tracing, grid detection, scatter detection, and axis calibration algorithms are independent clean-room implementations inspired by the publicly documented algorithm ideas of **WebPlotDigitizer (WPD, GPL-3.0)**; no WPD source code was copied. Thanks to WPD author Ankit Rohatgi for the pioneering work. If you need support for more chart types, check out the original project:

- WebPlotDigitizer: <https://github.com/automeris-io/WebPlotDigitizer>

## Citation

If this tool helps your research, you can cite it as follows (DOI will be added after Zenodo archiving):

```bibtex
@software{zeng2026chartextractor,
  author = {Zeng, Zichao},
  title  = {ChartExtractor: an offline chart data extraction tool},
  year   = {2026},
  url    = {https://github.com/ZengZichao/ChartExtractor}
}
```

---

_ChartExtractor is a lightweight research tool focused on offline privacy and a bilingual (Chinese/English) experience._
