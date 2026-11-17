"""Render launcher art for both shells from art/seraph-logo.svg:
Android TV banner + legacy launcher icon, and the Tizen icon."""
import subprocess
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1])
LOGO = ROOT / "art" / "seraph-logo.svg"
FONT_BOLD = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
SURFACE = (0x1E, 0x1E, 0x2E)
LOW = (0x18, 0x18, 0x25)

def logo(width):
    png = subprocess.run(["rsvg-convert", "-w", str(width), str(LOGO)], check=True, capture_output=True).stdout
    return Image.open(BytesIO(png)).convert("RGBA")

def tile(size):
    """App icon: the mark on a rounded surface tile."""
    t = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(t).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=SURFACE)
    m = logo(int(size * 0.8))
    t.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return t

def tracked(d, xy, text, font, fill, spacing):
    """Letter-spaced text (spacing as a fraction of the font size)."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill, anchor="lm")
        x += font.getlength(ch) + font.size * spacing

def banner(path, scale=2):
    w, h = 320 * scale, 180 * scale
    img = Image.new("RGBA", (w, h), LOW)
    px = img.load()
    for y in range(h):  # soft surface glow behind the mark
        for x in range(w):
            d = ((x - 70 * scale) ** 2 + (y - h / 2) ** 2) ** 0.5 / (150 * scale)
            t = max(0.0, 1 - d)
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(LOW, SURFACE)) + (255,)
    m = logo(int(118 * scale))
    img.alpha_composite(m, (int(12 * scale), (h - m.height) // 2))
    d = ImageDraw.Draw(img)
    tracked(d, (int(138 * scale), h / 2 - 4 * scale), "SERAPH", ImageFont.truetype(FONT_BOLD, int(34 * scale)), (0xCD, 0xD6, 0xF4), 0.08)
    tracked(d, (int(140 * scale), h / 2 + 24 * scale), "HOME THEATER", ImageFont.truetype(FONT_BOLD, int(12 * scale)), (0xCB, 0xA6, 0xF7), 0.12)
    img.convert("RGB").save(path)

banner(ROOT / "android/app/src/main/res/drawable-xhdpi/banner.png")
tile(96).save(ROOT / "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png")
tile(512).save(ROOT / "tizen/icon.png")
print("art written")
