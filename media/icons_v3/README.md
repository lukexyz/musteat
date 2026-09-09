# Technology icons v3

12 transparent 32×32 PNGs extracted from `../sprites_v3.png`. Artwork fits proportionally inside 30×30, leaving a transparent border. Game uses the named PNGs in this folder.

Area sampling integrates source detail instead of skipping pixels. A small unsharp pass restores local contrast; a 48-colour palette with no dithering and binary alpha keeps pixels and silhouettes crisp. Some fine source detail is necessarily lost at 32×32. Display at 32px or integer multiples with `image-rendering: pixelated`.

`source/` retains full-resolution cutouts. `comparison/` contains nearest and unsharpened area alternatives. Regions, names and method are recorded in `manifest.json`.

Rebuild with `python dev/extract-tech-icons-v3.py` (Pillow). The v1 manifest supplies the existing technology/filename mapping. Inspect `dev/tech-icon-preview-v3.html` at actual size and 3× magnification. Original sheet and v1 icons are preserved.
