"""Rebuild v3 icons: python dev/extract-tech-icons-v3.py (Pillow required).

Compare nearest sampling against area reduction and palette-limited sharpening.
No generated artwork, dithering, stretching or CSS downscaling.
"""
from pathlib import Path
import json
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'media/icons_v3'
SOURCE = ROOT / 'media/sprites_v3.png'
REGIONS = [
    (0, 0, 370, 365), (370, 0, 730, 365),
    (730, 0, 1090, 365), (1090, 0, 1448, 365),
    (0, 365, 370, 706), (370, 365, 730, 706),
    (730, 365, 1090, 706), (1090, 365, 1448, 706),
    (0, 706, 370, 1086), (370, 706, 730, 1086),
    (730, 706, 1090, 1086), (1090, 706, 1448, 1086),
]


def reduce_icon(source, method):
    scale = 30 / max(source.size)
    size = tuple(max(1, round(n * scale)) for n in source.size)
    # Pillow's RGBA area resize uses premultiplied alpha, avoiding dark fringes.
    small = source.resize(size, Image.Resampling.NEAREST if method == 'nearest' else Image.Resampling.BOX)
    alpha = small.getchannel('A').point(lambda a: 255 if a >= 100 else 0)
    rgb = small.convert('RGB')
    if method == 'selected':
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=.65, percent=135, threshold=3))
        # Build the palette from visible pixels only; no wasted transparent colours.
        visible = [p for p, a in zip(rgb.get_flattened_data(), alpha.get_flattened_data()) if a]
        swatches = Image.new('RGB', (len(visible), 1))
        swatches.putdata(visible)
        palette = swatches.quantize(colors=48, method=Image.Quantize.MEDIANCUT)
        rgb = rgb.quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB')
    small = rgb.convert('RGBA')
    small.putalpha(alpha)
    canvas = Image.new('RGBA', (32, 32))
    canvas.paste(small, ((32-small.width)//2, (32-small.height)//2))
    assert set(canvas.getchannel('A').get_flattened_data()) <= {0, 255}
    box = canvas.getbbox()
    assert box and min(box[:2]) >= 1 and max(box[2:]) <= 31
    return canvas


def main():
    source = Image.open(SOURCE).convert('RGBA')
    assert source.size == (1448, 1086)
    entries = json.loads((ROOT / 'media/icons_v1/manifest.json').read_text())
    (OUTPUT / 'source').mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'comparison').mkdir(exist_ok=True)
    sheet = Image.new('RGB', (1280, 660), '#0e1517')
    draw = ImageDraw.Draw(sheet)
    cards = []
    manifest = []
    for i, (entry, region) in enumerate(zip(entries, REGIONS)):
        crop = source.crop(region)
        # Ignore near-transparent speckles when finding the useful silhouette.
        bounds = crop.getchannel('A').point(lambda a: 255 if a >= 32 else 0).getbbox()
        assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < crop.width and bounds[3] < crop.height, (entry['id'], bounds)
        crop = crop.crop(bounds)
        crop.save(OUTPUT / 'source' / entry['file'], optimize=True)
        x, y = (i % 4)*320, (i // 4)*220
        draw.text((x+8, y+8), entry['name'], fill='#d6dedf')
        samples = []
        for j, method in enumerate(('nearest', 'area', 'selected')):
            icon = reduce_icon(crop, method)
            relative = entry['file'] if method == 'selected' else 'comparison/' + method + '-' + entry['file']
            icon.save(OUTPUT / relative, optimize=True)
            with Image.open(OUTPUT / relative) as saved:
                assert saved.size == (32, 32) and saved.mode == 'RGBA'
                assert saved.tobytes() == icon.tobytes()
            sheet.paste(icon.resize((96, 96), Image.Resampling.NEAREST), (x+8+j*104, y+34), icon.resize((96, 96), Image.Resampling.NEAREST))
            sheet.paste(icon, (x+40+j*104, y+144), icon)
            draw.text((x+12+j*104, y+189), method, fill='#46d9ff')
            samples.append(f'<figure><img class="large" src="../media/icons_v3/{relative}"><span class="slot"><img src="../media/icons_v3/{relative}" width="32" height="32"></span><figcaption>{method}</figcaption></figure>')
        cards.append(f'<article><h2>{entry["name"]}</h2><div class="samples">{"".join(samples)}</div></article>')
        manifest.append({'id': entry['id'], 'name': entry['name'], 'file': entry['file'], 'size': [32, 32], 'sheetRegion': region, 'trimBounds': bounds, 'sourceFile': 'source/'+entry['file'], 'method': 'area / unsharp .65px 135% / 48 colours / no dither / binary alpha'})
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    (OUTPUT / 'README.md').write_text('''# Technology icons v3

12 transparent 32×32 PNGs extracted from `../sprites_v3.png`. Artwork fits proportionally inside 30×30, leaving a transparent border. Game uses the named PNGs in this folder.

Area sampling integrates source detail instead of skipping pixels. A small unsharp pass restores local contrast; a 48-colour palette with no dithering and binary alpha keeps pixels and silhouettes crisp. Some fine source detail is necessarily lost at 32×32. Display at 32px or integer multiples with `image-rendering: pixelated`.

`source/` retains full-resolution cutouts. `comparison/` contains nearest and unsharpened area alternatives. Regions, names and method are recorded in `manifest.json`.

Rebuild with `python dev/extract-tech-icons-v3.py` (Pillow). The v1 manifest supplies the existing technology/filename mapping. Inspect `dev/tech-icon-preview-v3.html` at actual size and 3× magnification. Original sheet and v1 icons are preserved.
''', encoding='utf-8')
    html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MUSTEAT / v3 sprite comparison</title><style>
    *{box-sizing:border-box}body{background:#080b0b;color:#d6dedf;font:14px monospace;margin:24px}h1{color:#38ff00}p{max-width:850px;line-height:1.6;color:#98a5a8}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px}article{padding:12px;background:#0e1517;border:1px solid #29383c}h2{font-size:14px}.samples{display:flex;justify-content:space-around}figure{margin:0;display:grid;justify-items:center;gap:12px}img{image-rendering:pixelated}.large{width:96px;height:96px}.slot{display:grid;place-items:center;width:36px;height:36px;background:#000;border:1px solid #2c3b40;border-radius:4px}figcaption{color:#46d9ff}@media(max-width:400px){body{margin:12px}}
    </style><h1>MUSTEAT / V3 ICONS</h1><p>Each icon at 3× magnification and actual game size. Compare nearest-neighbour sampling, area reduction, and the selected sharpened 48-colour result. All have hard transparent edges; the selected version is installed in the game.</p><main>'''
    (ROOT / 'dev/tech-icon-preview-v3.html').write_text(html+'\n'.join(cards)+'</main></html>\n', encoding='utf-8')
    (ROOT / '.logs').mkdir(exist_ok=True)
    sheet.save(ROOT / '.logs/tech-v3-comparison.png')
    print('Verified 12 mapped icons and 24 comparison icons: 32x32 RGBA, hard alpha, intact padding.')


if __name__ == '__main__':
    main()
