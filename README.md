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

## Tester comme sur GitHub Pages
Depuis la racine du projet, lance :
```bash
python clash_room.py test
```
Le script construit le site avec le chemin de base de GitHub Pages (`/FPS-Shooter/`), puis démarre l'aperçu de production. Ouvre `http://127.0.0.1:4173/FPS-Shooter/` et utilise `Ctrl+C` pour arrêter le serveur.

## Déploiement GitHub Pages
1. Utilise un dépôt GitHub nommé `FPS-Shooter` (ou adapte `base` dans `vite.config.js` au nom exact du dépôt).
2. Envoie tout le contenu du projet sur la branche `main`.
3. Dans GitHub : **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. L'action `.github/workflows/deploy.yml` construit et publie automatiquement le dossier `dist`.
5. Attends la fin du workflow puis ouvre l'URL affichée par GitHub Pages.

Si le dépôt est publié à `https://<pseudo>.github.io/<nom-du-depot>/`, `base` doit être `/<nom-du-depot>/`. La configuration utilise `/FPS-Shooter/` en CI.

Pour construire et envoyer les changements sur `main` avec une confirmation :
```bash
python clash_room.py upload
```
Le script crée un commit et le pousse vers `origin/main`, ce qui déclenche le workflow GitHub Pages. Il refuse de continuer si la branche courante n'est pas `main` ou si des changements sont déjà indexés.

## Commandes utiles
- `npm run dev` : serveur local
- `npm run build` : compilation statique
- `npm run preview` : aperçu du build
- `python clash_room.py test` : aperçu local avec le chemin de publication GitHub Pages
- `python clash_room.py upload` : commit et envoi vers GitHub après confirmation

## Limites connues du prototype
- Prototype de base : les déplacements sont envoyés par le client et l'hôte tranche les tirs, mais ce n'est pas encore une simulation autoritaire complète et anti-triche.
- Le modèle de dégâts, la validation de ligne de vue et la synchronisation sont volontairement simplifiés ; une vraie version compétitive nécessitera une simulation serveur/hôte à tick fixe.
- PeerJS Cloud est un service public tiers : disponibilité non garantie. Certains NAT/pare-feu peuvent empêcher le P2P direct (TURN peut être nécessaire ; un relais TURN gratuit n'est pas garanti).
- La reconnexion automatique au même salon après fermeture de la connexion n'est pas encore implémentée ; le délai de forfait côté hôte est présent.
- La collision est simplifiée, et les couvertures sont des volumes géométriques.
- Les sons sont reportés en V2.

## Sécurité / réseau
Ne considère pas les messages du navigateur comme fiables. Le code actuel est destiné à des parties privées entre amis, sans protection contre la triche. Ne réutilise pas ce prototype comme base de compétition publique sans revoir l'autorité réseau, la validation des inputs, les limites de fréquence et la gestion de session.
