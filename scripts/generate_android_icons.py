#!/usr/bin/env python3
"""
scripts/generate_android_icons.py
Generates pixel-perfect Android launcher icons for Discipline matching the desired compact branding:
- Dark sleek background: #0F1014
- Centered purple symbol: #5E6AD2 at exactly 68.6% of the launcher squircle viewport
"""

import os
from PIL import Image, ImageDraw

COLOR = (94, 106, 210, 255)       # #5E6AD2 brand purple
BG_COLOR = (15, 16, 20, 255)      # #0F1014 sleek dark background
TRANSPARENT = (0, 0, 0, 0)

OUT_ROOT = os.path.join(os.path.dirname(__file__), "..", "icons", "android")

SIZES = {
    "mipmap-mdpi":    {"legacy": 48,  "foreground": 108},
    "mipmap-hdpi":    {"legacy": 72,  "foreground": 162},
    "mipmap-xhdpi":   {"legacy": 96,  "foreground": 216},
    "mipmap-xxhdpi":  {"legacy": 144, "foreground": 324},
    "mipmap-xxxhdpi": {"legacy": 192, "foreground": 432},
}

def render_foreground_symbol(size):
    """
    Renders the adaptive icon foreground (108dp canvas).
    Visible area in Android launcher is 72dp (2/3 of 108dp).
    Target symbol diameter is 68.6% of the 72dp visible squircle.
    """
    scale = 8
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    cx = canvas_size / 2.0
    cy = canvas_size / 2.0
    visible_diameter = canvas_size * (72.0 / 108.0)
    target_diameter = visible_diameter * 0.686
    max_radius = target_diameter / 2.0

    # Exact mathematical geometry matching favicon.svg (R_outer=180, R_mid=114, R_inner=48, stroke=36)
    # Note: Pillow draws stroke inwards from bounding box, so r_mid_outer must be the outer edge (114/180)
    stroke_w = max_radius * (36.0 / 180.0)
    r_mid_outer = max_radius * (114.0 / 180.0)
    r_inner = max_radius * (48.0 / 180.0)

    # Outer ring (outer boundary = max_radius, inner boundary = max_radius - stroke_w)
    draw.ellipse([cx - max_radius, cy - max_radius, cx + max_radius, cy + max_radius], outline=COLOR, width=int(round(stroke_w)))
    # Middle ring (outer boundary = r_mid_outer, inner boundary = r_mid_outer - stroke_w)
    draw.ellipse([cx - r_mid_outer, cy - r_mid_outer, cx + r_mid_outer, cy + r_mid_outer], outline=COLOR, width=int(round(stroke_w)))
    # Inner dot (radius = r_inner)
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=COLOR)

    return img.resize((size, size), Image.Resampling.LANCZOS)

def render_legacy_icon(size, round_icon=False):
    """
    Renders legacy icons with dark #0F1014 background and centered 68.6% symbol.
    """
    scale = 8
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    cx = canvas_size / 2.0
    cy = canvas_size / 2.0
    target_diameter = canvas_size * 0.686
    max_radius = target_diameter / 2.0

    # Exact mathematical geometry matching favicon.svg
    stroke_w = max_radius * (36.0 / 180.0)
    r_mid_outer = max_radius * (114.0 / 180.0)
    r_inner = max_radius * (48.0 / 180.0)

    # Outer ring
    draw.ellipse([cx - max_radius, cy - max_radius, cx + max_radius, cy + max_radius], outline=COLOR, width=int(round(stroke_w)))
    # Middle ring
    draw.ellipse([cx - r_mid_outer, cy - r_mid_outer, cx + r_mid_outer, cy + r_mid_outer], outline=COLOR, width=int(round(stroke_w)))
    # Inner dot
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=COLOR)

    # Apply shape mask
    mask = Image.new("L", (canvas_size, canvas_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if round_icon:
        mask_draw.ellipse([0, 0, canvas_size, canvas_size], fill=255)
    else:
        corner_radius = int(canvas_size * 0.26)
        mask_draw.rounded_rectangle([0, 0, canvas_size, canvas_size], radius=corner_radius, fill=255)

    img.putalpha(mask)
    return img.resize((size, size), Image.Resampling.LANCZOS)

def main():
    os.makedirs(OUT_ROOT, exist_ok=True)
    print(f"Generating Android icons in {OUT_ROOT}...")

    for folder, dim in SIZES.items():
        folder_path = os.path.join(OUT_ROOT, folder)
        os.makedirs(folder_path, exist_ok=True)

        # Adaptive foreground: 108dp canvas, transparent bg, symbol at exact 68.6% of 72dp viewport
        fg_img = render_foreground_symbol(dim["foreground"])
        fg_img.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")

        # Legacy squircle icon
        legacy_img = render_legacy_icon(dim["legacy"], round_icon=False)
        legacy_img.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")

        # Legacy round icon
        round_img = render_legacy_icon(dim["legacy"], round_icon=True)
        round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")

        print(f"[OK] {folder}: ic_launcher ({dim['legacy']}x{dim['legacy']}), foreground ({dim['foreground']}x{dim['foreground']})")

    # Adaptive XMLs for Android 8.0+
    anydpi_dir = os.path.join(OUT_ROOT, "mipmap-anydpi-v26")
    os.makedirs(anydpi_dir, exist_ok=True)

    adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    with open(os.path.join(anydpi_dir, "ic_launcher.xml"), "w", encoding="utf-8") as f:
        f.write(adaptive_xml)
    with open(os.path.join(anydpi_dir, "ic_launcher_round.xml"), "w", encoding="utf-8") as f:
        f.write(adaptive_xml)
    print("[OK] mipmap-anydpi-v26: ic_launcher.xml and ic_launcher_round.xml")

    # Values ic_launcher_background.xml
    values_dir = os.path.join(OUT_ROOT, "values")
    os.makedirs(values_dir, exist_ok=True)
    background_xml = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0F1014</color>
</resources>
'''
    with open(os.path.join(values_dir, "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
        f.write(background_xml)
    print("[OK] values: ic_launcher_background.xml (#0F1014)")

    print("\n[SUCCESS] All Android icon assets generated successfully!")

if __name__ == "__main__":
    main()
