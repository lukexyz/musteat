"""Extract the supplied sprite deck without generating or repainting artwork.

Run from any directory: python dev/extract-tech-icons.py (requires Pillow).
"""
from collections import deque
from pathlib import Path
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "media/sprites_v2.png"
OUTPUT = ROOT / "media/icons_v1"
# Hand-checked regions: the supplied sheet is not an exact regular grid.
SPRITES = [
    ("trainers", "Hazmat Trainers", "hazmat-trainers", (0, 30, 239, 244)),
    ("hover", "Hoverbike", "hoverbike", (240, 25, 480, 244)),
    ("drones", "Drone Swarm", "drone-swarm", (481, 30, 763, 235)),
    ("teleport", "Teleport Licence (Expired)", "teleport-licence-expired", (764, 20, 940, 245)),
    ("vats", "Vat Farm Franchise", "vat-farm-franchise", (0, 245, 242, 465)),
    ("pipeline", "Nutrient Pipeline", "nutrient-pipeline", (245, 245, 478, 465)),
    ("cannon", "Orbital Drop Cannon", "orbital-drop-cannon", (480, 245, 706, 465)),
    ("clones", "Runner Cloning Vats", "runner-cloning-vats", (708, 245, 940, 465)),
    ("timeloop", "Time-Loop Kitchen", "time-loop-kitchen", (0, 466, 241, 693)),
    ("portal", "Ministry Lunch Portal", "ministry-lunch-portal", (245, 466, 467, 693)),
    ("pod", "Thermal Pod", "thermal-pod", (469, 466, 706, 693)),
    ("mask", "Filtration Mask", "filtration-mask", (708, 466, 940, 693)),
]


def cutout(source, region, interior_background=()):
    im = source.crop(region).convert("RGBA")
    width, height = im.size
    pixels = im.load()
    visited = set()
    queue = deque([(x, y) for x in range(width) for y in (0, height - 1)] +
                  [(x, y) for y in range(height) for x in (0, width - 1)])
    queue.extend((x - region[0], y - region[1]) for x, y in interior_background)
    # Remove only edge-connected white, retaining white details on the objects.
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < width and 0 <= y < height) or (x, y) in visited:
            continue
        visited.add((x, y))
        if min(pixels[x, y][:3]) < 240:
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    bounds = im.getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0, (region, bounds)
    assert bounds[2] < width and bounds[3] < height, (region, bounds)
    return im.crop(bounds), bounds


def fit(im, size=32):
    scale = (size - 2) / max(im.size)
    dimensions = tuple(max(1, round(n * scale)) for n in im.size)
    small = im.resize(dimensions, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (size, size))
    canvas.paste(small, ((size - small.width) // 2, (size - small.height) // 2))
    # Nearest-neighbour must introduce no new colours or blurred alpha edges.
    assert set(canvas.get_flattened_data()).issubset(set(im.get_flattened_data()) | {(0, 0, 0, 0)})
    assert set(canvas.getchannel("A").get_flattened_data()) <= {0, 255}
    assert canvas.getbbox() and canvas.getbbox()[0] >= 1
    return canvas


def main():
    source = Image.open(SOURCE)
    (OUTPUT / "source").mkdir(parents=True, exist_ok=True)
    manifest = []
    cards = []
    for gear_id, name, slug, region in SPRITES:
        # Visually identified empty openings enclosed by straps / pipework.
        interior_background = {"timeloop": [(140, 535)],
                               "mask": [(840, 523), (907, 570)]}.get(gear_id, [])
        original, bounds = cutout(source, region, interior_background)
        icon = fit(original)
        original.save(OUTPUT / "source" / f"{slug}.png", optimize=True)
        icon.save(OUTPUT / f"{slug}.png", optimize=True)
        with Image.open(OUTPUT / f"{slug}.png") as saved:
            assert saved.size == (32, 32) and saved.mode == "RGBA"
            assert saved.tobytes() == icon.tobytes()
        manifest.append({"id": gear_id, "name": name, "file": f"{slug}.png",
                         "size": [32, 32], "sourceFile": f"source/{slug}.png",
                         "sourceSize": list(original.size), "sheetRegion": list(region),
                         "trimBounds": list(bounds), "interiorBackgroundSeeds": interior_background})
        cards.append(f'''<article><h2>{name}</h2><code>{gear_id}</code>
          <div class="samples"><figure><span class="slot"><img src="../media/icons_v1/{slug}.png" width="32" height="32"></span><figcaption>32px · game size</figcaption></figure>
          <figure><img src="../media/icons_v1/{slug}.png" width="128" height="128"><figcaption>4× pixel inspection</figcaption></figure>
          <figure><img class="original" src="../media/icons_v1/source/{slug}.png"><figcaption>Original cutout</figcaption></figure></div>
          <small>{slug}.png</small></article>''')
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    preview = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>MUSTEAT · Tech icon inspection</title><style>
    *{box-sizing:border-box}body{margin:24px;background:#080b0b;color:#ccd5d7;font:14px monospace}
    h1{color:#38ff00}p,figcaption,small,code{color:#8b9b9f}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px}
    article{background:#0e1619;border:1px solid #29383c;padding:16px}h2{font-size:16px;margin:0 0 8px}code{color:#46d9ff}
    .samples{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:180px}figure{margin:0;text-align:center}
    img{image-rendering:pixelated;object-fit:contain}img.original{width:128px;height:128px;image-rendering:auto}
    figcaption{font-size:10px;margin-top:10px}.slot{width:36px;height:36px;background:#000;border:1px solid #2c3b40;border-radius:4px;display:inline-grid;place-items:center}
    @media(max-width:450px){body{margin:12px}main{grid-template-columns:1fr}.samples{flex-wrap:wrap}}
    </style><h1>MUSTEAT / TECH ICONS</h1><p>32×32 transparent PNGs. Nearest-neighbour resizing. Left: actual 36px game slot. Middle: the same pixels at 4×. Right: preserved source detail.</p><main>'''
    (ROOT / "dev/tech-icon-preview.html").write_text(preview + "\n".join(cards) + "</main></html>\n", encoding="utf-8")
    print(f"Verified {len(manifest)} named 32×32 transparent PNGs; original cutouts retained.")


if __name__ == "__main__":
    main()
