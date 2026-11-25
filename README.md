# CLASH//ROOM

Prototype MVP d'un FPS 1v1 navigateur, Three.js + PeerJS + Vite.

## Prérequis
- Node.js 20+
- npm
- Navigateur desktop compatible WebGL et WebRTC

## Lancer en local
```bash
npm install
npm run dev
```
Ouvre l'URL Vite dans deux navigateurs / deux machines. Pour tester entre deux machines, expose le serveur de développement via ton réseau local ou déploie sur HTTPS.

## Build
```bash
npm run build
npm run preview
```

## Déploiement GitHub Pages
1. Crée un dépôt GitHub nommé `clash-room` (ou adapte `base` dans `vite.config.js` au nom exact du dépôt).
2. Envoie tout le contenu du projet sur la branche `main`.
3. Dans GitHub : **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. L'action `.github/workflows/deploy.yml` construit et publie automatiquement le dossier `dist`.
5. Attends la fin du workflow puis ouvre l'URL affichée par GitHub Pages.

Si le dépôt est publié à `https://<pseudo>.github.io/<nom-du-depot>/`, `base` doit être `/<nom-du-depot>/`. La configuration utilise automatiquement `/clash-room/` en CI : change cette valeur si ton dépôt porte un autre nom.

## Commandes utiles
- `npm run dev` : serveur local
- `npm run build` : compilation statique
- `npm run preview` : aperçu du build

## Limites connues du prototype
- Prototype de base : les déplacements sont envoyés par le client et l'hôte tranche les tirs, mais ce n'est pas encore une simulation autoritaire complète et anti-triche.
- Le modèle de dégâts, la validation de ligne de vue et la synchronisation sont volontairement simplifiés ; une vraie version compétitive nécessitera une simulation serveur/hôte à tick fixe.
- PeerJS Cloud est un service public tiers : disponibilité non garantie. Certains NAT/pare-feu peuvent empêcher le P2P direct (TURN peut être nécessaire ; un relais TURN gratuit n'est pas garanti).
- La reconnexion automatique au même salon après fermeture de la connexion n'est pas encore implémentée ; le délai de forfait côté hôte est présent.
- La collision est simplifiée, et les couvertures sont des volumes géométriques.
- Les sons sont reportés en V2.

## Sécurité / réseau
Ne considère pas les messages du navigateur comme fiables. Le code actuel est destiné à des parties privées entre amis, sans protection contre la triche. Ne réutilise pas ce prototype comme base de compétition publique sans revoir l'autorité réseau, la validation des inputs, les limites de fréquence et la gestion de session.
