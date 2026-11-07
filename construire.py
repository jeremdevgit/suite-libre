#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE
"""Construit la version hors ligne de chaque outil : un seul fichier HTML autonome par outil, dans dist/.

Usage : python3 construire.py        (Python 3.8 ou plus récent, aucune dépendance)

Chaque fichier produit embarque son icône, ses polices et ses scripts. Sa politique de sécurité (CSP)
n'autorise que les scripts dont l'empreinte SHA-256 correspond exactement au code de ce dépôt, et
n'autorise aucune connexion réseau : l'outil fonctionne entièrement hors ligne.
"""
import base64
import hashlib
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent
OUTILS = {
    "librerr": "LibreRR",
    "libreconvert": "LibreConvert",
    "libreimage": "LibreImage",
    "libreflou": "LibreFlou",
    "librenotes": "LibreNotes",
    "librepass": "LibrePass",
}


def data_uri(chemin: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(chemin.read_bytes()).decode("ascii")


def empreinte(code: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(code.encode("utf-8")).digest()).decode("ascii") + "'"


def construire(dossier: str, nom: str) -> pathlib.Path:
    d = RACINE / dossier
    html = (d / "index.html").read_text(encoding="utf-8")

    # Icône (favicon et icône d'écran d'accueil)
    html = re.sub(r'href="([a-z0-9-]+\.svg)"', lambda m: f'href="{data_uri(d / m.group(1), "image/svg+xml")}"', html)
    # Polices
    html = re.sub(r"url\((fonts/[a-z0-9-]+\.woff2)\)", lambda m: f"url({data_uri(d / m.group(1), 'font/woff2')})", html)

    # Scripts : intégrés dans la page, chacun autorisé par son empreinte
    empreintes = []

    def integrer(m):
        code = (d / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        empreintes.append(empreinte(code))
        return f"<script>{code}</script>"

    html = re.sub(r'<script src="([a-z0-9-]+\.js)"></script>', integrer, html)
    if not empreintes:
        raise SystemExit(f"{dossier} : aucun script trouvé")

    csp = ("default-src 'none'; script-src " + " ".join(empreintes) + "; style-src 'unsafe-inline'; "
           "img-src data: blob:; font-src data:; connect-src data: blob:; media-src data: blob:; worker-src blob:; "
           "base-uri 'none'; form-action 'none'; object-src 'none'")
    html, n = re.subn(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">',
                      f'<meta http-equiv="Content-Security-Policy" content="{csp}">', html)
    if n != 1:
        raise SystemExit(f"{dossier} : balise CSP introuvable")

    # Contrôle : plus aucune ressource externe chargée (les liens <a> restent de simples liens)
    sans_scripts = re.sub(r"<script\b[^>]*>.*?</script\s*>", "", html, flags=re.S | re.I)
    restes = re.findall(r'<(?:script|link|img)[^>]+(?:src|href)="(?!data:|#)([^"]+)"', sans_scripts)
    if restes:
        raise SystemExit(f"{dossier} : ressources non intégrées : {restes}")

    sortie = RACINE / "dist" / f"{nom}-hors-ligne.html"
    sortie.parent.mkdir(exist_ok=True)
    sortie.write_text(html, encoding="utf-8")
    return sortie


def main() -> None:
    lignes = []
    for dossier, nom in OUTILS.items():
        f = construire(dossier, nom)
        lignes.append(f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}")
        print(f"{f.relative_to(RACINE)}  ({f.stat().st_size // 1024} Ko)")
    (RACINE / "dist" / "SHA256SUMS.txt").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print("dist/SHA256SUMS.txt")


if __name__ == "__main__":
    main()
