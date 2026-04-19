from PIL import Image, ImageDraw
import os

base = "/Users/farazmacmini/Documents/Tony the dev Projects/SequenceForFriends/client/sequence-app/assets"
os.makedirs(base, exist_ok=True)

# === 1. App Icon (1024x1024) ===
size = 1024
img = Image.new("RGBA", (size, size), (10, 14, 26, 255))
draw = ImageDraw.Draw(img)
center = size // 2

# Card shape in center
card_w, card_h = 600, 700
card_x1 = (size - card_w) // 2
card_y1 = (size - card_h) // 2
draw.rounded_rectangle([card_x1, card_y1, card_x1 + card_w, card_y1 + card_h], radius=40, fill=(18, 24, 48, 255))

# Chip sequence - diagonal connected line
chip_positions = [
    (center - 60, center - 140),
    (center, center - 70),
    (center - 80, center),
    (center + 80, center),
    (center, center + 70),
]
chip_colors = [
    (59, 130, 246),
    (34, 197, 94),
    (59, 130, 246),
    (34, 197, 94),
    (59, 130, 246),
]

# Draw connecting lines first (behind chips)
for i in range(len(chip_positions) - 1):
    draw.line([chip_positions[i], chip_positions[i+1]], fill=(100, 120, 180, 120), width=4)

for (cx, cy), color in zip(chip_positions, chip_colors):
    # Outer glow
    for r in range(45, 35, -1):
        alpha = int(50 * (1 - (r - 35) / 10))
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*color, alpha))
    # Main circle
    draw.ellipse([cx-32, cy-32, cx+32, cy+32], fill=color)
    # Inner highlight
    draw.ellipse([cx-14, cy-22, cx+8, cy-6], fill=(255, 255, 255, 70))

img.save(f"{base}/icon.png", "PNG")
print(f"Icon saved to {base}/icon.png")

# === 2. Splash Screen (2048x2732) ===
w, h = 2048, 2732
splash = Image.new("RGBA", (w, h), (10, 14, 26, 255))
sdraw = ImageDraw.Draw(splash)
cx, cy = w // 2, h // 2 - 150

chips = [
    (cx, cy - 180, (59, 130, 246)),
    (cx - 120, cy - 60, (34, 197, 94)),
    (cx + 120, cy - 60, (34, 197, 94)),
    (cx - 70, cy + 100, (59, 130, 246)),
    (cx + 70, cy + 100, (59, 130, 246)),
]

for i in range(len(chips) - 1):
    sdraw.line([(chips[i][0], chips[i][1]), (chips[i+1][0], chips[i+1][1])], fill=(100, 120, 180, 80), width=6)

for x, y, color in chips:
    for r in range(72, 52, -1):
        alpha = int(35 * (1 - (r - 52) / 20))
        sdraw.ellipse([x-r, y-r, x+r, y+r], fill=(*color, alpha))
    sdraw.ellipse([x-50, y-50, x+50, y+50], fill=color)
    sdraw.ellipse([x-25, y-38, x+18, y-14], fill=(255, 255, 255, 50))

# Subtle title placeholder bar
title_y = cy + 240
sdraw.rounded_rectangle([cx - 280, title_y, cx + 280, title_y + 90], radius=20, fill=(255, 255, 255, 25))

splash.save(f"{base}/splash.png", "PNG")
print(f"Splash saved to {base}/splash.png")

# === 3. Adaptive Icon Foreground (1024x1024, transparent bg) ===
adaptive = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
adraw = ImageDraw.Draw(adaptive)
a_center = 512

a_chips = [
    (a_center - 80, a_center - 100, (59, 130, 246)),
    (a_center, a_center - 40, (34, 197, 94)),
    (a_center - 80, a_center + 20, (59, 130, 246)),
    (a_center + 80, a_center + 20, (34, 197, 94)),
    (a_center, a_center + 80, (59, 130, 246)),
]

for i in range(len(a_chips) - 1):
    adraw.line([(a_chips[i][0], a_chips[i][1]), (a_chips[i+1][0], a_chips[i+1][1])], fill=(100, 120, 180, 100), width=4)

for x, y, color in a_chips:
    for r in range(40, 28, -1):
        alpha = int(45 * (1 - (r - 28) / 12))
        adraw.ellipse([x-r, y-r, x+r, y+r], fill=(*color, alpha))
    adraw.ellipse([x-28, y-28, x+28, y+28], fill=color)
    adraw.ellipse([x-14, y-20, x+8, y-6], fill=(255, 255, 255, 50))

adaptive.save(f"{base}/adaptive-icon.png", "PNG")
print(f"Adaptive icon saved to {base}/adaptive-icon.png")

# === 4. Favicon (48x48) ===
favicon = img.resize((48, 48), Image.Resampling.LANCZOS)
favicon.save(f"{base}/favicon.png", "PNG")
print(f"Favicon saved to {base}/favicon.png")

print("\nAll assets generated successfully!")