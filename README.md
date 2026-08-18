# WebRTC Video Puzzle

Application web de puzzle vidéo solo et collaboratif, construite en HTML5, CSS3 et JavaScript vanilla.

## État actuel

- Interface responsive selon le cahier des charges UI/UX.
- Mode solo avec plateau interactif et grilles 6, 9, 12 et 16 pièces.
- Grille 4 pièces volontairement absente.
- Chronomètre, progression, mélange, contrôles caméra/micro visuels, onglets et partage de session.
- Base prête pour brancher le signaling WebRTC et le découpage Canvas des flux vidéo.

## Lancer localement

Les fichiers statiques doivent être servis en HTTP(S), jamais avec `file://`.

Avec Python :

```bash
python -m http.server 4173
```

Puis ouvrir <http://localhost:4173>.

## Déploiement GitHub Pages

Le workflow dans `.github/workflows/deploy-pages.yml` publiera automatiquement le contenu à chaque push sur `main`. Le dépôt doit être configuré dans GitHub avec Pages utilisant GitHub Actions.

## Architecture prévue

- `index.html` : structure de l'application.
- `styles.css` : système visuel et responsive.
- `app.js` : état local du puzzle et interactions UI.
- `server/` : futur serveur léger WebSocket pour le signaling SDP/ICE.
