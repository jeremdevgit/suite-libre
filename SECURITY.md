# Security

**English** · [Français](#sécurité)

## Reporting a vulnerability

Please **do not** open a public issue for a security flaw.
Use GitHub's private reporting: the repository's **Security** tab → **Report a vulnerability**.
Describe the problem, the tool affected, the steps to reproduce it and, if possible, a suggested fix.
You will get an answer as soon as possible; the fix will ship in a new release, crediting you if you agree.

## Supported versions

Only the latest release (*Releases* page) receives fixes.

## What the tools guarantee

- All processing happens in the browser: no data is sent to a server.
- Every page enforces a strict Content Security Policy (CSP); in the offline versions, each script is allowed by its SHA-256 hash.
- No external resource (script, font, image) is loaded.

## Out of scope

- A browser extension or malware already on the device can read the page's content: this is true of any website.
- The strength shown by LibrePass is an estimate: it does not replace a password manager or two-factor authentication.

---

# Sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir de ticket public pour une faille de sécurité.
Utilise le signalement privé de GitHub : onglet **Security** du dépôt → **Report a vulnerability**.
Décris le problème, l'outil concerné, les étapes pour le reproduire et, si possible, une piste de correction.
Tu recevras une réponse dès que possible ; la correction sera publiée dans une nouvelle version, avec ton accord pour être cité.

## Versions suivies

Seule la dernière version publiée (page *Releases*) reçoit des correctifs.

## Ce que garantissent les outils

- Tout le traitement se fait dans le navigateur : aucune donnée n'est envoyée à un serveur.
- Chaque page applique une politique de sécurité du contenu (CSP) stricte ; dans les versions hors ligne, chaque script est autorisé par son empreinte SHA-256.
- Aucune ressource externe (script, police, image) n'est chargée.

## Hors périmètre

- Une extension de navigateur ou un logiciel malveillant déjà présent sur l'appareil peut lire ce que contient la page : c'est le cas pour tout site web.
- La solidité affichée par LibrePass est une estimation : elle ne remplace pas un gestionnaire de mots de passe ni la double authentification.
