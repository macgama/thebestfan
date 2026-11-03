"""Essai : segmentation de vetements (SegFormer) sur des Fanzzy 3D + recoloration aux couleurs Young Boys.

Lecture seule sur les images du jeu. Sorties : essai-couleurs-club.jpg et resultats.txt dans ce dossier.
"""
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont
from transformers import AutoModelForSemanticSegmentation, SegformerImageProcessor

MODELE = "mattmdjaga/segformer_b2_clothes"
JEU = Path(r"C:\Users\gaelm\Documents\GitHub\thebestfan\public\img")
ICI = Path(__file__).resolve().parent

IMAGES = [
    "fanzzy/RP4/e1/base/neutre.png",
    "fanzzy/RP4/e3/base/pousse.png",
    "fanzzy/RP5/e2/base/joie.png",
    "fanzzy/RP6/e1/base/pousse.png",
    "fanzzy/RP6/e3/base/neutre.png",
    "fanzzy/RP7/e2/base/neutre.png",
    "fanzzy/RP7/e3/base/joie.png",
    "fanzzy/RP8/e1/base/joie.png",
    "fanzzy/RP8/e2/base/pousse.png",
    "fanzzy/RP20/e2/base/neutre.png",
    "fanzzy/RP20/e3/base/joie.png",
    "ultime/RP5-e2.34204833.webp",
]

JAUNE = np.array([253, 225, 0], float)   # jaune YB
NOIR = np.array([38, 38, 40], float)     # noir "relevé" pour garder un peu d'ombrage visible
CLASSES_JAUNE = {"Hat", "Scarf"}
CLASSES_NOIR = {"Upper-clothes", "Dress"}

PALETTE = {
    "Hat": (255, 200, 0), "Hair": (140, 80, 30), "Sunglasses": (0, 255, 255), "Upper-clothes": (230, 30, 30),
    "Skirt": (255, 120, 200), "Pants": (40, 80, 230), "Dress": (180, 0, 180), "Belt": (120, 120, 0),
    "Left-shoe": (90, 60, 40), "Right-shoe": (90, 60, 40), "Face": (255, 170, 140), "Left-leg": (250, 210, 170),
    "Right-leg": (250, 210, 170), "Left-arm": (250, 140, 90), "Right-arm": (250, 140, 90), "Bag": (0, 200, 120),
    "Scarf": (0, 230, 60),
}


def police(taille):
    for nom in ("segoeui.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            pass
    return ImageFont.load_default()


def recolorer(rgb, masque, couleur):
    if not masque.any():
        return rgb
    lum = rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114
    med = max(np.median(lum[masque]), 1.0)
    facteur = (lum[masque] / med)[:, None]
    rgb = rgb.copy()
    rgb[masque] = np.clip(couleur[None, :] * facteur, 0, 255)
    return rgb


def main():
    proc = SegformerImageProcessor.from_pretrained(MODELE)
    model = AutoModelForSemanticSegmentation.from_pretrained(MODELE).eval()
    id2label = model.config.id2label

    vignettes, lignes, temps = [], [], []
    for rel in IMAGES:
        chemin = JEU / rel
        src = Image.open(chemin).convert("RGBA")
        fond = Image.new("RGBA", src.size, (255, 255, 255, 255))
        img = Image.alpha_composite(fond, src).convert("RGB")
        alpha = np.array(src)[..., 3] > 10

        t0 = time.perf_counter()
        with torch.no_grad():
            out = model(**proc(images=img, return_tensors="pt"))
            logits = torch.nn.functional.interpolate(out.logits, size=img.size[::-1], mode="bilinear", align_corners=False)
            seg = logits.argmax(1)[0].numpy()
        dt = time.perf_counter() - t0
        temps.append(dt)
        seg[~alpha] = 0

        rgb = np.array(img).astype(float)
        noms = {i: id2label[i] for i in np.unique(seg) if i != 0}
        total = alpha.sum()
        parts = {n: 100 * (seg == i).sum() / total for i, n in noms.items()}
        parts = {n: p for n, p in sorted(parts.items(), key=lambda kv: -kv[1]) if p >= 0.2}

        # (b) masque colore
        couche = rgb.copy()
        for i, n in noms.items():
            m = seg == i
            couche[m] = 0.45 * rgb[m] + 0.55 * np.array(PALETTE.get(n, (128, 128, 128)))
        # (c) recoloration
        ids = {n: i for i, n in noms.items()}
        mj = np.isin(seg, [ids[n] for n in CLASSES_JAUNE if n in ids])
        mn = np.isin(seg, [ids[n] for n in CLASSES_NOIR if n in ids])
        reco = recolorer(recolorer(rgb, mj, JAUNE), mn, NOIR)

        lignes.append(f"{rel} : {dt:.2f} s | " + ", ".join(f"{n} {p:.1f}%" for n, p in parts.items()))
        print(lignes[-1], flush=True)
        vignettes.append((rel, img, Image.fromarray(couche.astype(np.uint8)), Image.fromarray(reco.astype(np.uint8)), parts))

    planche(vignettes)
    with open(ICI / "resultats.txt", "w", encoding="utf-8") as f:
        f.write(f"Modele : {MODELE} (CPU, torch {torch.__version__})\n")
        f.write(f"Temps total d'inference : {sum(temps):.1f} s pour {len(temps)} images "
                f"(moyenne {sum(temps)/len(temps):.2f} s/image, chargement du modele non compte)\n\n")
        f.write("Par image (temps | classes detectees, % de la silhouette) :\n")
        f.write("\n".join(lignes) + "\n")


def planche(vignettes):
    PW, PH = 290, 500          # taille d'un panneau
    HAUT, LEG = 30, 90         # bandeau titre, bande legende
    VW = PW * 3 + 10
    W = VW * 2 + 20
    VH = HAUT + PH + LEG
    lignes = (len(vignettes) + 1) // 2
    H = 60 + lignes * (VH + 10)
    page = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(page)
    d.text((10, 10), "Essai segmentation vetements (" + MODELE + ") -> recoloration Young Boys : chapeau+echarpe jaune, haut/robe noir",
           fill="black", font=police(22))
    f_titre, f_leg = police(17), police(14)
    for k, (rel, a, b, c, parts) in enumerate(vignettes):
        x0 = 10 + (k % 2) * (VW + 10)
        y0 = 60 + (k // 2) * (VH + 10)
        d.rectangle([x0 - 2, y0 - 2, x0 + VW - 8, y0 + VH - 4], outline=(200, 200, 200))
        d.text((x0 + 4, y0 + 4), rel, fill="black", font=f_titre)
        for j, im in enumerate((a, b, c)):
            t = im.copy()
            t.thumbnail((PW, PH))
            page.paste(t, (x0 + j * PW + (PW - t.width) // 2, y0 + HAUT + (PH - t.height) // 2))
        # legende sous le panneau masque
        lx, ly = x0 + 6, y0 + HAUT + PH + 4
        for n, p in parts.items():
            texte = f"{n} {p:.0f}%"
            w = d.textlength(texte, font=f_leg) + 26
            if lx + w > x0 + VW - 10:
                lx, ly = x0 + 6, ly + 20
            d.rectangle([lx, ly + 3, lx + 12, ly + 15], fill=PALETTE.get(n, (128, 128, 128)), outline="black")
            d.text((lx + 16, ly), texte, fill="black", font=f_leg)
            lx += w
    page.save(ICI / "essai-couleurs-club.jpg", quality=85, optimize=True)


if __name__ == "__main__":
    main()
