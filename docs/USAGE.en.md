# ChartExtractor User Guide (English)

[简体中文](./USAGE.zh.md) | **English**

> See the [README](../README.en.md) for the project overview. This guide matches ChartExtractor v0.1.0. All features run 100% locally and offline — the app never makes network requests.

## Contents

1. [Installation & Launch](#1-installation--launch)
2. [Interface Overview](#2-interface-overview)
3. [Importing Charts](#3-importing-charts)
4. [Axis Calibration](#4-axis-calibration)
5. [Extracting Data](#5-extracting-data)
6. [Editing Data, Undo & Redo](#6-editing-data-undo--redo)
7. [Batch Extraction](#7-batch-extraction)
8. [Project Management: Save / Open / Autosave / Recent Files](#8-project-management-save--open--autosave--recent-files)
9. [Exporting Data](#9-exporting-data)
10. [Tabs & Multi-chart Work](#10-tabs--multi-chart-work)
11. [Theme & Language](#11-theme--language)
12. [Keyboard Shortcuts](#12-keyboard-shortcuts)
13. [FAQ](#13-faq)
14. [Privacy & Security Notes](#14-privacy--security-notes)

---

## 1. Installation & Launch

- **Prebuilt package (recommended)**: Download the macOS installer (`.dmg` / `.app`) from [GitHub Releases](https://github.com/ZengZichao/ChartExtractor/releases), drag ChartExtractor into "Applications", and launch. If macOS warns about an unidentified developer on first launch, right-click the app and choose "Open".
- **Build from source**:

  ```bash
  npm install
  npm run package   # produces the .app (in src-tauri/target/release/bundle/macos/)
  ```

  For a DMG: `scripts/create-dmg.sh` (output in `release/`).

System requirement: macOS 10.15 or later.

## 2. Interface Overview

The main window contains, from top to bottom:

- **Menu bar** (File / Edit / View / Tools / Theme / Help): import, projects, undo/redo, zoom, color picker, grid detection, shortcuts, about.
- **Workflow wizard** (Import → Calibrate → Extract → Export): highlights the current step.
- **Left panel**: shows import / calibration / detection / export parameters depending on the step.
- **Central canvas**: displays the chart; pan, zoom, add points, right-click to edit.
- **Data table** (right/bottom): lists points of each dataset; values are directly editable.
- **Status bar**: current state and hints.

## 3. Importing Charts

Three ways to import:

1. **Drag & drop**: drop an image or PDF onto the main window.
2. **Menu / shortcut**: "File → Import Image/PDF…" or `Cmd/Ctrl + O`.
3. **Clipboard paste**: take a screenshot and press `Cmd/Ctrl + V`.

Notes:

- Common bitmap formats and multi-page PDFs are supported; PDFs render page 1 by default and you can switch pages (each page becomes a dataset).
- Very large images (> 4000 px) prompt for automatic downsampling to keep the app responsive.
- Importing a new chart clears the current calibration and data (you can undo the import with `Cmd+Z`); a confirmation dialog is shown first.

## 4. Axis Calibration

Calibration maps pixel positions to real-world values:

1. Enter the "Calibrate" step and click the **4 known reference points** on the chart as prompted: Xmin, Xmax, Ymin, Ymax (clicking tick-mark intersections is most accurate).
2. Enter the real values for each point in the panel.
3. Choose the scale type:
   - **Linear**: ordinary Cartesian axes.
   - **Logarithmic**: log-scaled axes; **negative log** axes (e.g. pH, log10(1/T)) are also supported.
4. Optionally enter **axis names & units** — they are written into export metadata.
5. Confirm to finish; re-enter the calibration step any time to adjust.

> Tip: pick reference points that are far apart with clearly readable tick values for best accuracy.

## 5. Extracting Data

### 5.1 Manual point picking

- **Left-click** the canvas to add a data point;
- **Right-click** an existing point to delete or edit it;
- Best for few points or when automatic detection struggles.

### 5.2 Automatic extraction (recommended workflow)

Automatic extraction is based on a "color segmentation mask": first isolate your curves/points from the background into a black-and-white mask, then detect on it.

1. **Color segmentation** (Tools → Color Pick Mode, or the detection panel):
   - Use the **color picker** to click the color of the target curve/scatter on the chart;
   - Choose a mode: **Foreground match** (keep pixels close to the picked color; good for light/cluttered backgrounds) or **Background exclude** (exclude pixels close to the picked color);
   - Tune the threshold with **live preview** enabled until the mask shows a clean target.
2. **Automatic curve tracing** (line charts / smooth curves, one Y per X):
   - Parameters: **X step** (scan column spacing; smaller = denser points), **Y step** (vertical search resolution), **smoothing interpolation** (checked = smoother curve);
   - Click "Trace Curve"; results appear as translucent preview points.
3. **Automatic scatter detection** (scatter plots):
   - Parameters: blob **diameter min/max** (filters out large blobs such as legend backgrounds);
   - Click "Detect Scatter"; detected points enter preview.
4. **Preview & apply**: choose to **append** to or **replace** the current dataset.

### 5.3 Multi-curve & grouping

- **Multi-curve separation**: for several differently-colored curves in one chart, pick each color and trace; results go into separate datasets automatically.
- **Color-based scatter grouping**: detected scatters can be clustered by color, one dataset per group.

### 5.4 Grid detection

"Tools → Detect Grid Lines (Preview)" overlays automatically detected gridlines on the canvas to help you judge point placement.

## 6. Editing Data, Undo & Redo

- **Data table**: one table per dataset; X / Y values are directly editable (undoable).
- **Undo / Redo**: `Cmd/Ctrl + Z` / `Shift + Cmd/Ctrl + Z`, covering add, delete, import, clear, and more.
- **Delete last point**: `Delete` or "Edit → Delete Last Point".
- **Clear current dataset**: "Edit → Clear Current Dataset".
- **Remove suspicious points**: one-click removal of noise points mixed into detection results.

## 7. Batch Extraction

For processing a series of charts that share the same coordinate system:

1. Complete **calibration** on a single chart first (batch mode reuses the current calibration).
2. Open the batch panel:
   - **Select Folder**: the app lists the images it finds;
   - **Select Output Folder**: where CSVs are written;
   - Click **Start** — images are imported one by one, traced with the current calibration, and exported to CSV automatically; progress is shown and you can **stop** at any time.
3. A success/skipped summary is shown at the end; images whose size differs from the calibrated chart are skipped automatically.

> Everything runs locally; no data is ever uploaded.

## 8. Project Management: Save / Open / Autosave / Recent Files

- **Save project**: `Cmd/Ctrl + S` or "File → Save Project…" produces a `.prj` file (chart, calibration, datasets & metadata); re-saving backs the old file up as `.prj.bak` automatically.
- **Open project**: "File → Open Project…", or drag a `.prj` file into the window.
- **Sample project**: "File → Open Sample Project…" loads a built-in sample to try the full workflow (confirmation prompt protects your current data).
- **Autosave**: your session is written to the app data directory as you work; after a crash or force quit, the next launch asks whether to **restore** it, and clears it once saved or discarded.
- **Recent files**: "File → Recent Files" reopens recently used charts/projects (up to 20 entries).

## 9. Exporting Data

In the "Export" step you can configure:

| Option | Description |
| --- | --- |
| **Select datasets** | Tick the datasets to export (multi-select) |
| **X / Y column names** | Custom output column names |
| **Merge mode** | **Long** `dataset,X,Y` (pandas-ready) or **Wide** (aligned by X) |
| **Encoding** | UTF-8 (recommended) / GBK (legacy WPS; text-based formats only) |
| **Decimal precision** | Number of decimal places in the output |
| **Include header row** | Whether to write column names |
| **Metadata comment lines** | Writes `#` comments (axis names, units, source…) at the top; keep it off for directly parseable `pandas.read_csv` input (use `comment='#'` when reading to keep the metadata) |

- **Formats**: xlsx (one sheet per dataset) / CSV / JSON (JSON always includes dataset metadata).
- A **full preview** (first 5 rows per dataset) is shown before you click "Export" and choose a destination.

## 10. Tabs & Multi-chart Work

- "+" creates a new tab; multiple charts can stay open, each with its own calibration and datasets;
- Closing a tab with unsaved changes asks for confirmation;
- Different PDF pages can be imported as separate datasets.

## 11. Theme & Language

- **Language**: switch 中文 / English with the "中 / EN" toggle at the right end of the top bar; no restart needed.
- **Theme**: menu "Theme" offers **System / Light / Dark**.

## 12. Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + O` | Import image / PDF |
| `Cmd/Ctrl + V` | Paste screenshot |
| `Cmd/Ctrl + S` | Save project |
| `Cmd/Ctrl + Z` | Undo |
| `Shift + Cmd/Ctrl + Z` | Redo |
| `Delete` | Delete last point |
| `Space (hold) / drag` | Pan canvas |
| `Scroll` | Zoom canvas |
| `F1` | Shortcuts & help |

## 13. FAQ

**Q1: Curve tracing finds nothing?**
Check the segmentation mask — the target curve should appear as a clean white line. Re-pick the color, adjust the threshold, or switch foreground/background mode.

**Q2: Detections include legends or axis text?**
Lower the scatter diameter limit to filter large blobs, tighten the mask threshold, or delete the stray points manually.

**Q3: A PDF fails to open or parse?**
A few encrypted/unusual PDFs cannot be parsed — export the page as an image and import that instead.

**Q4: Large images feel slow?**
Accept the automatic downsampling prompt (≤ 4000 px); calibration and extraction are unaffected (pixel-based calibration adapts).

**Q5: CSV shows garbled Chinese in Excel?**
Export with **GBK** encoding (legacy WPS/some Excel versions), or open with a UTF-8-aware spreadsheet app.

**Q6: I closed the window by mistake — is my data gone?**
Autosave keeps the last session; relaunch the app and choose "Restore".

**Q7: Does the app connect to the network?**
No. Everything is 100% offline; a CI static scan enforces that no network calls exist in `src/`.

## 14. Privacy & Security Notes

- Parsing, calibration, extraction, and export all run on your machine — **no telemetry, no uploads, no third-party requests**.
- Project files, autosave, and the recent-files list live only in the local app data directory (`~/Library/Application Support/com.chartextractor/`).
- All credentials for build/release scripts (`scripts/notarize.sh`) are passed via environment variables; the repository contains no secrets.
