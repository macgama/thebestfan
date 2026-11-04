"""Planche de vignettes d'un groupe du catalogue des images.

Usage : python3 -I vignettes.py job.json
job.json : {"out": "...webp", "w": 96, "h": 120, "cols": 16, "files": ["a.webp", ...]}
Chaque image est réduite pour tenir dans une case w x h (sans déformation),
centrée, et les cases sont rangées de gauche à droite, ligne par ligne.
"""
import json, math, sys
from PIL import Image

job = json.load(open(sys.argv[1]))
w, h, cols = job["w"], job["h"], job["cols"]
files = job["files"]
rows = max(1, math.ceil(len(files) / cols))
planche = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
echecs = []
for i, f in enumerate(files):
    try:
        im = Image.open(f)
        im.load()
        im = im.convert("RGBA")
        im.thumbnail((w, h), Image.LANCZOS)
        x = (i % cols) * w + (w - im.width) // 2
        y = (i // cols) * h + (h - im.height) // 2
        planche.alpha_composite(im, (x, y))
    except Exception as e:  # une image illisible laisse sa case vide
        echecs.append(f"{f}: {e}")
planche.save(job["out"], "WEBP", quality=job.get("q", 62), method=5)
print(json.dumps({"echecs": echecs}))
