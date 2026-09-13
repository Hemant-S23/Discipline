#!/usr/bin/env python3
"""
scripts/generate_android_icons.py
Generates pixel-perfect, anti-aliased Android launcher icons for Discipline.
Transparent background, only the purple target symbol (#5E6AD2).
"""

import os
from PIL import Image, ImageDraw

COLOR = (94, 106, 210, 255) # #5E6AD2
TRANSPARENT = (0, 0, 0, 0)

# Output directory in git repo
OUT_ROOT = os.path.join(os.path.dirname(__file__), "..", "icons", "android")

SIZES = {
    "mipmap-mdpi":    {"legacy": 48,  "foreground": 108},
    "mipmap-hdpi":    {"legacy": 72,  "foreground": 162},
    "mipmap-xhdpi":   {"legacy": 96,  "foreground": 216},
    "mipmap-xxhdpi":  {"legacy": 144, "foreground": 324},
    "mipmap-xxxhdpi": {"legacy": 192, "foreground": 432},
}

def render_symbol(size, scale_ratio=0.88):
    """
    Renders the Discipline target symbol with 8x supersampling for ultra-crisp edges.
    scale_ratio: fraction of the image canvas diameter occupied by the outer ring.
    """
    scale = 8
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    cx = canvas_size / 2.0
    cy = canvas_size / 2.0
    max_radius = (canvas_size / 2.0) * scale_ratio

    # Based on favicon / brand geometry:
    # Outer radius = max_radius
    # Stroke width = max_radius * 0.20
    # Outer ring: r = max_radius - stroke/2
    # Middle ring: r = max_radius * 0.533
    # Inner circle: r = max_radius * 0.267
    stroke_w = max_radius * 0.20
    r_outer = max_radius - (stroke_w / 2.0)
    r_mid = max_radius * 0.533
    r_inner = max_radius * 0.267

    # Helper to draw ring
    def draw_ring(r, w):
        bbox = [cx - r, cy - r, cx + r, cy + r]
        draw.ellipse(bbox, outline=COLOR, width=int(round(w)))

    # Outer ring
    draw_ring(r_outer, stroke_w)
    # Middle ring
    draw_ring(r_mid, stroke_w)
    # Center dot (filled)
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=COLOR)

    # Downscale with high-quality Lanczos resampling
    final = img.resize((size, size), Image.Resampling.LANCZOS)
    return final

def main():
    os.makedirs(OUT_ROOT, exist_ok=True)
    print(f"Generating Android icons in {OUT_ROOT}...")

    # Store 512x512 preview in icons/icon-transparent-512.png
    preview_512 = render_symbol(512, scale_ratio=0.88)
    preview_path = os.path.join(os.path.dirname(__file__), "..", "icons", "icon-transparent-symbol-512.png")
    preview_512.save(preview_path, "PNG")
    print(f"[OK] Saved {preview_path}")

    for folder, dim in SIZES.items():
        folder_path = os.path.join(OUT_ROOT, folder)
        os.makedirs(folder_path, exist_ok=True)

        # Legacy icons (48, 72, 96, 144, 192) - 88% scale for full coverage
        legacy_img = render_symbol(dim["legacy"], scale_ratio=0.88)
        legacy_path = os.path.join(folder_path, "ic_launcher.png")
        legacy_round_path = os.path.join(folder_path, "ic_launcher_round.png")
        legacy_img.save(legacy_path, "PNG")
        legacy_img.save(legacy_round_path, "PNG")

        # Adaptive foreground (108, 162, 216, 324, 432) - 66% scale for safe zone
        fg_img = render_symbol(dim["foreground"], scale_ratio=0.66)
        fg_path = os.path.join(folder_path, "ic_launcher_foreground.png")
        fg_img.save(fg_path, "PNG")

        print(f"[OK] {folder}: ic_launcher ({dim['legacy']}x{dim['legacy']}), foreground ({dim['foreground']}x{dim['foreground']})")

    # Adaptive XMLs for Android 8.0+
    anydpi_dir = os.path.join(OUT_ROOT, "mipmap-anydpi-v26")
    os.makedirs(anydpi_dir, exist_ok=True)

    adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/transparent"/>
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
    <color name="ic_launcher_background">#00000000</color>
</resources>
'''
    with open(os.path.join(values_dir, "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
        f.write(background_xml)
    print("[OK] values: ic_launcher_background.xml (#00000000 transparent)")

    print("\n[SUCCESS] All Android icon assets generated successfully!")

if __name__ == "__main__":
    main()
