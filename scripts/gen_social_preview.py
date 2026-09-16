#!/usr/bin/env python3
"""Generate a 1280x640 social preview image for the ChartExtractor GitHub repo."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1280, 640
OUT = os.path.join(os.path.dirname(__file__), "..", "social-preview.png")

# --- font resolution: prefer a CJK-capable sans that also covers Latin ---
FONT_CANDIDATES = [
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),   # CJK + Latin
    ("/System/Library/Fonts/STHeiti Light.ttc", 1),      # CJK + Latin
    ("/System/Library/Fonts/Supplemental/Arial.ttf", 0),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
]
FONT_PATH, FONT_IDX = None, 0
for p, i in FONT_CANDIDATES:
    if os.path.exists(p):
        FONT_PATH, FONT_IDX = p, i
        break

def font(sz):
    if FONT_PATH:
        return ImageFont.truetype(FONT_PATH, sz, index=FONT_IDX)
    return ImageFont.load_default()

def fit_text(draw, text, max_w, start_sz, min_sz=16):
    """Return (font, size) that fits text within max_w."""
    sz = start_sz
    while sz > min_sz:
        f = font(sz)
        if draw.textlength(text, font=f) <= max_w:
            return f, sz
        sz -= 1
    return font(min_sz), min_sz

# --- background gradient (#0d1117 -> #161b22) ---
img = Image.new("RGB", (W, H), (13, 17, 23))
px = img.load()
top, bot = (13, 17, 23), (22, 27, 34)
for y in range(H):
    t = y / (H - 1)
    px_row = tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3))
    for x in range(W):
        px[x, y] = px_row

d = ImageDraw.Draw(img)

# --- left chart motif ---
ACCENT = (88, 166, 255)
ACCENT2 = (63, 185, 80)
GRID = (48, 54, 61)
ax0, ay0, ax1, ay1 = 90, 430, 470, 200
for i in range(1, 5):
    gy = ay0 + (ay1 - ay0) * i / 4
    d.line([(ax0, gy), (ax1, gy)], fill=GRID, width=1)
    gx = ax0 + (ax1 - ax0) * i / 4
    d.line([(gx, ay0), (gx, ay1)], fill=GRID, width=1)
d.line([(ax0, ay0), (ax1, ay0)], fill=(201, 209, 217), width=3)
d.line([(ax0, ay0), (ax0, ay1)], fill=(201, 209, 217), width=3)
pts = [(ax0, 412), (ax0 + 70, 360), (ax0 + 140, 372),
       (ax0 + 210, 300), (ax0 + 280, 318), (ax0 + 350, 250), (ax1, 232)]
d.line(pts, fill=ACCENT, width=5, joint="curve")
for (x, y) in pts:
    d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=ACCENT2, outline=(13, 17, 23))

# --- right text block (auto-fit within right margin) ---
tx = 545
right_margin = 40
max_w = W - tx - right_margin

title = "ChartExtractor"
tf, tsz = fit_text(d, title, max_w, 84)
d.text((tx, 140), title, font=tf, fill=(255, 255, 255))

subtitle = "从图表中精确提取数据 · 纯本地离线运行"
sf, ssz = fit_text(d, subtitle, max_w, 34)
d.text((tx, 262), subtitle, font=sf, fill=(201, 209, 217))

tagline = "Import image / PDF · Calibrate axes · Trace curves · Export data"
gf, gsz = fit_text(d, tagline, max_w, 22, min_sz=15)
d.text((tx, 320), tagline, font=gf, fill=(139, 148, 158))

# badges
badges = ["Tauri", "Rust", "Offline", "macOS"]
bx, by, pad_x = tx, 400, 18
for b in badges:
    bf = font(24)
    bw = d.textlength(b, font=bf) + pad_x * 2
    d.rounded_rectangle([bx, by, bx + bw, by + 44], radius=22,
                        fill=(31, 36, 43), outline=(48, 54, 61), width=2)
    d.text((bx + pad_x, by + 9), b, font=bf, fill=ACCENT)
    bx += bw + 16

d.text((tx, 480), "Developer-ID signed & notarized · GPL-3.0",
       font=font(22), fill=(139, 148, 158))

img.save(OUT, "PNG")
print("wrote", os.path.abspath(OUT))
print("font:", FONT_PATH, "idx", FONT_IDX)
