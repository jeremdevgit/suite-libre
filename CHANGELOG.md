# Historique des versions

## 1.2.0 — 2026-11-18 — LibreDetour

- **Nouvel outil LibreDetour** : détourage de photos et de vidéos, entièrement dans le navigateur, sans dépendance ni réseau.
  - Photos : JPEG en PNG ou WEBP transparent ; méthodes Automatique (GrabCut : modèles de couleurs et coupe minimale de graphe), Cadre, Fond uni (pipette, anti-reflet) et Photo du fond (différence avec une photo sans le sujet).
  - Retouche au pinceau et à la baguette magique (Garder / Retirer), annuler / rétablir, vues Résultat, Retouche, Masque et Avant / après.
  - Bords : bords fins (filtre guidé, cheveux), rétrécir / élargir, adoucir, retrait des petites taches, sujet unique, trous bouchés, correction du liseré de couleur du fond.
  - Nouveau fond : couleur, dégradé, flou du fond d’origine, noir et blanc (sujet en couleur), image ; ombre portée, contour autocollant ; cadrage ajusté au sujet, carré, 4:5, 9:16, 16:9, 3:2, taille maximale ; export masque noir et blanc ; plusieurs photos détourées d’un coup en ZIP.
  - Vidéos : fond vert ou uni (pipette sur l’aperçu), caméra fixe avec fond calculé automatiquement (médiane des images) ou pris sur une image, cadre de limitation ; caméra en direct ; enregistrement WEBM avec le son, suite d’images PNG transparentes en ZIP, image actuelle en PNG ; début et fin.
- Tests des algorithmes (`node --test tests/*.test.js`) ajoutés à l’intégration continue.

### English

- **New tool LibreDetour**: background removal for photos and videos, fully in the browser. Automatic subject, frame, plain/green background and background-photo methods; brush and magic wand retouching; fine edges, decontamination; new backgrounds, shadow, sticker outline, social-media framing; batch ZIP. Videos: green screen or fixed camera with automatic background, live camera, WEBM recording or transparent PNG sequence.

## 1.1.1 — 2026-11-07 — Sécurité

- Contrôle des ressources hors ligne : analyse HTML structurée avec HTMLParser. Éditeur documenté.

### English

- Parse offline HTML resources structurally. Document publisher identity.


## 1.1.0 — 2026-11-06

**English**

- **8 languages** in all six tools and the home page: English, French, Spanish, German, Italian, Portuguese, Chinese and Japanese. The browser language is picked automatically, a menu at the top of each page lets you switch, and your choice is remembered.
- Numbers, dates and units follow the chosen language (decimal separator, day and month names, MB/Mo symbols…).
- LibrePass: passphrases use English words outside the French interface.
- Offline versions: every language is included in each file.

**Français**

- **8 langues** dans les six outils et la page d'accueil : français, anglais, espagnol, allemand, italien, portugais, chinois et japonais. La langue du navigateur est choisie automatiquement, un menu en haut de chaque page permet d'en changer, et le choix est retenu.
- Nombres, dates et unités affichés selon la langue choisie (séparateur décimal, noms des jours et des mois, symboles Mo/MB…).
- LibrePass : phrases de passe en mots anglais dans les autres langues que le français.
- Versions hors ligne : toutes les langues sont incluses dans chaque fichier.

## 2026-11-05 — Publication open source

- Page d'accueil : section « Mes autres logiciels » ; crédit de chaque outil relié aux autres logiciels de l'auteur.
- Code publié sous licence GNU GPL v3 ou ultérieure.
- Politique de sécurité du contenu (CSP) intégrée à chaque page, y compris hors ligne (scripts autorisés par empreinte SHA-256, aucune connexion réseau).
- LibreRR : message d'erreur échappé avant affichage ; lien de téléchargement de la version hors ligne vers les Releases GitHub.
- Script `construire.py` pour reconstruire les versions hors ligne à partir du code source.

## LibreRR 1.1 — 2026-11-03

- Bouton Télécharger pour enregistrer le QR code directement.
- Lien pour télécharger la version hors ligne depuis la page en ligne.

## LibreRR 1.0, LibreConvert 1.0, LibreImage 1.0, LibreFlou 1.0, LibreNotes 1.0, LibrePass 1.0 — 2026-11-03

- **LibreRR** : huit types de contenu (lien, mail, texte, Wi-Fi, téléphone, SMS, contact, lieu) ; couleurs, dégradés, formes des points et des coins, logo au centre ; export PNG, SVG, JPEG ou WEBP.
- **LibreConvert** : unités, calculs de dates avec jours fériés, fuseaux horaires et bases numériques.
- **LibreImage** : compression, redimensionnement et retrait des métadonnées (GPS, appareil, date) ; téléchargement image par image ou en ZIP.
- **LibreFlou** : rectangles, ellipses et pinceau, avec flou, pixels ou masque pour chaque zone ; zones déplaçables et redimensionnables, annulation, enregistrement à la taille d'origine sans métadonnées.
- **LibreNotes** : moyennes pondérées par matière et par évaluation, mention et note à viser ; export CSV.
- **LibrePass** : mots de passe et phrases de passe aléatoires, test de solidité avec conseils.
