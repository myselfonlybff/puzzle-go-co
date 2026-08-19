# WebRTC Video Puzzle

Application web de puzzle vidéo solo et collaboratif, construite en HTML5, CSS3 et JavaScript vanilla.

## État actuel

- Interface responsive selon le cahier des charges UI/UX.
- Mode solo avec plateau interactif et grilles 6, 9, 12 et 16 pièces.
- Grille 4 pièces volontairement absente.
- Chronomètre, progression, mélange, contrôles caméra/micro visuels, onglets et partage de session.
- Base prête pour brancher le signaling WebRTC et le découpage Canvas des flux vidéo.

## Tester le parcours solo

Les fichiers statiques doivent être servis en HTTP(S), jamais avec `file://`.

Avec Python pour tester l'interface :

```bash
python -m http.server 4173
```

Puis ouvrir <http://localhost:4173>.

Le bouton "Prendre une photo" demande la permission au clic, ouvre une prévisualisation, puis coupe la caméra après confirmation. Un lien contenant `?session=PUZ-7K4M` ouvre le parcours invité : le joueur saisit seulement son nom et demande l'accès à l'hôte.

## Tester le multijoueur local

Le multijoueur nécessite Node.js et le serveur WebSocket du dossier `server/` :

```bash
npm install
npm start
```

Ouvrir ensuite `http://localhost:4173` dans deux fenêtres. Dans la première, choisir une image et commencer la partie. Copier le lien d'invitation, l'ouvrir dans la seconde fenêtre, saisir un nom, puis accepter la demande dans la première fenêtre. L'image, l'ordre des pièces, le chrono et le chat sont alors partagés par la room.

## Déploiement GitHub Pages

Le workflow dans `.github/workflows/deploy-pages.yml` publiera automatiquement le contenu à chaque push sur `main`. Le dépôt doit être configuré dans GitHub avec Pages utilisant GitHub Actions.

GitHub Pages héberge le frontend statique, mais ne peut pas exécuter `server/signaling.js`. Pour le multijoueur public, déployer ce serveur Node sur Render, Railway, Fly.io ou un autre hébergeur WebSocket, puis renseigner son URL `wss://.../signal` dans `app.js`.

## Architecture

- `index.html` : structure de l'application.
- `styles.css` : système visuel et responsive.
- `app.js` : état local du puzzle et interactions UI.
- `server/` : futur serveur léger WebSocket pour le signaling SDP/ICE.
