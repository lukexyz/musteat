# Technology icons

Twelve transparent **32 × 32 PNGs**, named after the technologies in `index.html`.
`manifest.json` maps each filename to its exact game ID and display name.

The supplied artwork was extracted from `media/sprites_v2.png`. White background
was removed, including the enclosed openings in the kitchen loop and mask straps.
Artwork is fitted proportionally within 30 × 30 pixels and centred on a 32 × 32
canvas. Nearest-neighbour resizing introduces no interpolated colours or alpha
blur. Fine source detail cannot all survive at this size.

`source/` retains transparent cutouts at their original resolution for future use.
The original sprite deck is unchanged.

For display, use `width="32" height="32"` and CSS `image-rendering: pixelated`.
Prefer integer multiples (32, 64, 96...) if enlarging them.

Open `dev/tech-icon-preview.html` for actual-size, 4× and original comparisons.
Regenerate with `python dev/extract-tech-icons.py` (Pillow required).

The extraction checks all source crops for clipping, output dimensions,
transparency, exact nearest-neighbour colour preservation and saved PNG integrity.
