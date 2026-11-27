import * as THREE from 'three';
import { createCharacter, disposeCharacter, showGun, poseIdle, SHIRT_COLORS } from '../game/character.js';
import { teamInfo, shirtFor } from '../game/teams.js';

// Salon plein écran : la scène 3D occupe tout le fond, deux colonnes sans cadre
// (joueurs à gauche, règles de la partie à droite pour l'hôte) s'effacent vers elle.
// API : window.clashRoster.set([{ id, name, host, me }], isHost, onKick) / set(null).

const CSS = `
/* ===== Salon plein écran ===== */
#lobby.lobby-fs {
  position: fixed !important;
  inset: 0 !important;
  z-index: 100;
  padding: 0 !important;
  border: 0 !important;
  background: #0b1014;
  overflow: hidden;
}
#lobby .ic { width: 1em; height: 1em; flex: none; display: block; }

/* Scène 3D = fond plein cadre */
#lobby.lobby-fs #roster {
  position: absolute;
  inset: 0;
  margin: 0;
  border: 0;
  padding: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 50% 78%, rgba(240,120,69,.20), transparent 55%),
    linear-gradient(#18222a, #0b1014);
}
#lobby.lobby-fs #roster canvas {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  display: block;
}
#roster .r-tags {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
#roster .r-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #5d6b72;
  font: 700 24px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .06em;
  pointer-events: none;
  z-index: 1;
}

/* ===== Colonnes latérales : pas de cadre, un dégradé qui s'efface vers la scène ===== */
.lobby-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 10;
  width: 380px;
  padding: 36px 64px 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  overflow: hidden;
  color: #eef1f2;
  background: linear-gradient(90deg, rgba(8,12,16,.95) 0, rgba(8,12,16,.88) calc(100% - 80px), rgba(8,12,16,0) 100%);
  animation: rail-in-left .55s cubic-bezier(.2, .75, .25, 1) both;
}
.lobby-rail.hidden { display: none; }
.lobby-left { left: 0; }
.lobby-right {
  right: 0;
  padding: 36px 36px 32px 64px;
  background: linear-gradient(270deg, rgba(8,12,16,.95) 0, rgba(8,12,16,.88) calc(100% - 80px), rgba(8,12,16,0) 100%);
  animation-name: rail-in-right;
}
@keyframes rail-in-left  { from { opacity: 0; transform: translateX(-28px); } }
@keyframes rail-in-right { from { opacity: 0; transform: translateX(28px); } }
@keyframes rail-fade     { from { opacity: 0; } }

.rail-section { display: flex; flex-direction: column; gap: 8px; }
.lb-label {
  color: #8a98a0;
  font: 500 13px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
.rail-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(173, 190, 200, .16);
  color: #9caab2;
  font: 600 13px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
.rail-count {
  color: #f4f3ee;
  font: 700 19px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .06em;
}

/* Code du salon : l'information à partager, donc la plus grande */
.lb-code { display: flex; flex-direction: column; gap: 6px; }
.rail-code { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#lobby .rail-code #display-code {
  min-width: 0;
  color: #f4f3ee;
  font: 800 60px/1 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .1em;
  text-shadow: none;
}
#lobby .rail-code #copy-code {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(173, 190, 200, .26);
  background: none;
  color: #9caab2;
  font-size: 18px;
  box-shadow: none;
}
#lobby .rail-code #copy-code:hover:not(:disabled) {
  border-color: var(--orange);
  background: rgba(240, 120, 69, .12);
  color: var(--orange-light);
  transform: none;
  box-shadow: none;
}

/* Carte : visible ici pour les invités seulement (l'hôte la choisit à droite) */
.rail-mapinfo { gap: 3px; }
#lobby:has(.lobby-right:not(.hidden)) .rail-mapinfo { display: none; }
.rail-map {
  color: #f4f3ee;
  font: 700 26px/1.1 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .03em;
}
.rail-map-description,
.map-description {
  color: #8a98a0;
  font: 500 13px/1.5 Inter, Arial, sans-serif;
  letter-spacing: 0;
}

/* Joueurs : de simples lignes séparées par un filet */
.rail-players { flex: 1; min-height: 0; gap: 4px; }
.rail-player-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  margin-right: -10px;
  padding-right: 10px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(173, 190, 200, .09);
}
.player-row:last-child { border-bottom: 0; }
.player-swatch {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--swatch, #4a5a64);
}
.player-details, .player-actions, .player-badges { display: flex; align-items: center; }
.player-details { flex: 1; min-width: 0; gap: 10px; }
.player-name {
  overflow: hidden;
  color: #eef1f2;
  font: 700 21px/1.1 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.player-row.me .player-name { color: var(--orange-light); }
.player-badges { gap: 8px; flex: none; }
.player-badge {
  display: inline-flex;
  align-items: center;
  color: #8a98a0;
  font: 600 12px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
.player-badge .ic { width: 15px; height: 15px; }
.player-badge.host { color: var(--orange); }
.player-actions { flex: none; gap: 2px; }
.player-action {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  background: none;
  color: #8a98a0;
  font-size: 17px;
  box-shadow: none;
}
.player-action:hover:not(:disabled) {
  border: 0;
  background: rgba(255, 255, 255, .07);
  color: #f4f3ee;
  transform: none;
  box-shadow: none;
}
.player-action.kick:hover:not(:disabled) { color: #ff8175; }
.player-action.bot-level {
  width: auto;
  height: 28px;
  padding: 0 8px;
  color: #ffd27a;
  font: 700 12px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
.player-action.bot-level:disabled { opacity: 1; cursor: default; }
.player-pending {
  color: #8a98a0;
  font: 500 11px Inter, Arial, sans-serif;
}
/* Sur souris, les actions n'apparaissent qu'au survol de la ligne */
@media (hover: hover) {
  .player-action.friend-add, .player-action.kick { opacity: 0; transition: opacity .15s; }
  .player-row:hover .player-action.friend-add, .player-row:hover .player-action.kick,
  .player-row:focus-within .player-action.friend-add, .player-row:focus-within .player-action.kick { opacity: 1; }
}

/* Statut + actions du bas : du texte, pas des boutons encadrés */
.rail-status #lobby-status {
  margin: 0;
  min-height: 0;
  color: #aab6bb;
  font: 500 14px/1.55 Inter, Arial, sans-serif;
}
.rail-footer {
  padding-top: 8px;
  border-top: 1px solid rgba(173, 190, 200, .16);
  gap: 0;
}
#lobby .rail-footer button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 0;
  border: 0;
  background: none;
  color: #9caab2;
  font: 600 14px Inter, Arial, sans-serif;
  letter-spacing: 0;
  text-align: left;
  box-shadow: none;
}
#lobby .rail-footer button .ic { font-size: 18px; }
#lobby .rail-footer button:hover:not(:disabled) {
  border: 0;
  background: none;
  color: #f4f3ee;
  transform: none;
  box-shadow: none;
}
#lobby .rail-footer #leave-lobby:hover:not(:disabled) { color: #ff8175; }

/* ===== Règles de la partie (hôte) : champs soulignés, comme le pseudo du menu ===== */
.rail-settings { flex: 1; min-height: 0; overflow-y: auto; margin-right: -10px; padding-right: 10px; }
#lobby #host-settings { width: 100%; min-width: 0; }
#lobby .settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 22px;
  margin: 0;
}
#lobby .settings-grid label {
  display: grid;
  gap: 4px;
  min-width: 0;
  margin: 0;
  color: #8a98a0;
  font: 500 13px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
#lobby .settings-grid select {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 6px 28px 9px 0;
  border: 0;
  border-bottom: 1px solid rgba(173, 190, 200, .26);
  border-radius: 0;
  background: transparent url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239caab2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>") no-repeat right 2px center / 18px;
  color: #f4f3ee;
  font: 600 16px Inter, Arial, sans-serif;
  letter-spacing: 0;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
}
#lobby .settings-grid select:hover { border-bottom-color: rgba(173, 190, 200, .55); }
#lobby .settings-grid select:focus {
  border-bottom-color: var(--orange);
  box-shadow: 0 1px 0 var(--orange);
}
#lobby .settings-grid select option { background: #11191f; color: #eef1f2; }
#lobby .settings-grid .map-description { margin-top: 6px; }

.rail-start { margin-top: auto; padding-top: 4px; }
#lobby .rail-start #start-game {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  height: 68px;
  padding: 0 24px;
  border: 0;
  background: linear-gradient(120deg, #f58a55, #d9552f);
  color: #fff;
  font: 800 27px/1 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .08em;
  box-shadow: none;
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
}
#lobby .rail-start #start-game .ic { width: 28px; height: 28px; }
#lobby .rail-start #start-game:hover:not(:disabled) {
  border: 0;
  background: linear-gradient(120deg, #ff9a64, #e8603a);
  transform: none;
  box-shadow: none;
}
#lobby .rail-start #start-game:active:not(:disabled) { filter: brightness(.92); }
#lobby .rail-start #start-game:disabled {
  background: rgba(173, 190, 200, .12);
  color: #6f7e86;
  opacity: 1;
}

#lobby button:focus-visible,
#lobby select:focus-visible { outline: 2px solid #ffd2b8; outline-offset: 2px; }

/* Sélecteur de niveau des bots */
.bot-level-pop {
  position: fixed;
  z-index: 300;
  display: grid;
  grid-template-columns: repeat(5, 34px);
  gap: 2px;
  padding: 10px;
  background: rgba(11, 16, 20, .97);
  border: 1px solid rgba(173, 190, 200, .24);
  box-shadow: 0 14px 40px rgba(0,0,0,.6);
}
.bot-level-pop button {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  background: none;
  color: #dce4e7;
  font: 700 17px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: 0;
}
.bot-level-pop button:hover:not(:disabled) { background: rgba(255,255,255,.08); border: 0; box-shadow: none; transform: none; }
.bot-level-pop button.active { background: #f07845; color: #10151a; }
.bot-level-pop .hint {
  grid-column: 1 / -1;
  padding-top: 6px;
  color: #8a98a0;
  font: 500 11px Inter, Arial, sans-serif;
  text-align: center;
}

/* Noms au-dessus des personnages : du texte posé sur la scène */
#roster .r3d-tag {
  position: absolute;
  left: 0; top: 0;
  white-space: nowrap;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  font: 800 21px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .05em;
  color: #eef1f2;
  text-shadow: 0 1px 2px rgba(0,0,0,.9), 0 0 16px rgba(0,0,0,.75);
  will-change: transform;
  opacity: 0;
  transition: opacity .3s;
}
#roster .r3d-tag.me { color: var(--orange-light); }
#roster .r-tag {
  padding: 0;
  background: none;
  color: var(--orange);
  font: 700 12px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
#roster .r-tag.you { background: none; color: #aab6bb; }

/* ===== Équipes ===== */
.team-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0 6px;
  color: var(--team);
  font: 700 13px Inter, Arial, sans-serif;
  letter-spacing: 0;
}
.team-head:first-child { padding-top: 4px; }
.team-dot { width: 10px; height: 10px; border-radius: 3px; background: var(--team); }
.team-n { margin-left: auto; color: #8a98a0; font-weight: 600; }
.player-row .team-chip {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  margin: 0 -7px;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
}
.player-row .team-chip::after {
  content: '';
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--swatch);
  transition: box-shadow .15s;
}
.player-row .team-chip:hover:not(:disabled) { background: none; border: 0; box-shadow: none; transform: none; }
.player-row .team-chip:hover::after { box-shadow: 0 0 0 4px rgba(255, 255, 255, .16); }
.team-pop { grid-template-columns: repeat(var(--cols, 4), 38px); gap: 4px; }
.team-pop button {
  width: 38px;
  height: 38px;
  background: var(--c);
  color: var(--ink);
  font: 800 16px 'Barlow Condensed', Arial, sans-serif;
}
.team-pop button:hover:not(:disabled) { background: var(--c); filter: brightness(1.15); }
.team-pop button.current { box-shadow: inset 0 0 0 2px #fff; }
.team-pop .hint { padding-top: 8px; }
#roster .r-tag.team { color: inherit; }
#lobby .link-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--orange-light);
  font: 600 13px Inter, Arial, sans-serif;
  letter-spacing: 0;
  text-align: left;
  box-shadow: none;
}
#lobby .link-btn:hover:not(:disabled) { background: none; border: 0; color: #ffd2b8; transform: none; box-shadow: none; }

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .lobby-rail { width: 330px; padding: 28px 48px 24px 24px; }
  .lobby-right { padding: 28px 24px 24px 48px; }
  #lobby .rail-code #display-code { font-size: 50px; }
}
@media (max-width: 760px) {
  .lobby-rail, .lobby-right {
    left: 0;
    right: 0;
    width: auto;
    gap: 16px;
    animation-name: rail-fade;
  }
  .lobby-left {
    top: 0;
    bottom: auto;
    max-height: 40vh;
    overflow-y: auto;
    padding: 16px 18px 36px;
    background: linear-gradient(180deg, rgba(8,12,16,.95) calc(100% - 36px), rgba(8,12,16,0));
  }
  .lobby-right {
    top: auto;
    bottom: 0;
    max-height: 36vh;
    padding: 36px 18px 16px;
    background: linear-gradient(0deg, rgba(8,12,16,.95) calc(100% - 36px), rgba(8,12,16,0));
  }
  .rail-players { flex: none; }
  .rail-player-list { flex: none; max-height: 22vh; }
  #lobby .rail-code #display-code { font-size: 44px; }
  #lobby .settings-grid { gap: 14px; }
  #lobby .rail-start #start-game { height: 56px; font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .lobby-rail { animation: none; }
  #lobby .settings-grid select { transition: none; }
}
`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const WEAPONS = ['rifle', 'shotgun', 'sniper', 'knife'];

/** Couleur CSS du t-shirt d'un joueur, identique à celle de son personnage 3D. */
const shirtCss = p => {
  try {
    const id = p.id ?? [...String(p.name)].reduce((a, c) => a + c.charCodeAt(0), 0);
    return '#' + new THREE.Color(SHIRT_COLORS[id % SHIRT_COLORS.length]).getHexString();
  } catch {
    return '#4a5a64';
  }
};

export class Roster {
  constructor(friends = null) {
    const lobby = document.querySelector('#lobby');
    if (!lobby) return;

    this.entries = new Map();
    this.friends = friends;
    this.list = [];
    this.mouseX = 0;
    this.time = 0;
    this.camTarget = { z: 7.5, y: 2.0 };

    this.injectStyles();
    this.buildLayout(lobby);
    this.initScene();
    window.clashRoster = this;

    this.stage.addEventListener('pointermove', e => {
      const r = this.stage.getBoundingClientRect();
      this.mouseX = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    });
    this.stage.addEventListener('pointerleave', () => { this.mouseX = 0; });
    new ResizeObserver(() => this.resize()).observe(this.stage);

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  buildLayout(lobby) {
    const panel = lobby.querySelector('.lobby-panel');
    const grab = id => (panel || lobby).querySelector(id);

    // Récupère les éléments existants avant de reconstruire la mise en page.
    const displayCode  = grab('#display-code');
    const copyCode     = grab('#copy-code');
    const leaveLobby   = grab('#leave-lobby');
    const openSettings = grab('#open-settings-lobby');
    const hostSettings = grab('#host-settings');
    const startGame    = grab('#start-game');
    const lobbyStatus  = grab('#lobby-status');

    lobby.innerHTML = '';
    lobby.classList.add('lobby-fs');

    // 1) Scène 3D plein écran (fond)
    this.el = document.createElement('div');
    this.el.id = 'roster';
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="r-tags"></div>
      <div class="r-empty">En attente des joueurs…</div>`;
    lobby.appendChild(this.el);

    // 2) Rail gauche — infos du salon
    this.left = document.createElement('aside');
    this.left.className = 'lobby-rail lobby-left';
    this.left.innerHTML = `
      <div class="lb-code">
        <span class="lb-label">Code du salon</span>
        <div class="rail-code"></div>
      </div>
      <div class="rail-section rail-mapinfo">
        <span class="lb-label">Carte</span>
        <div id="lobby-map" class="rail-map">Fonderie</div>
        <div id="lobby-map-description" class="rail-map-description"></div>
      </div>
      <div class="rail-section rail-players">
        <div class="rail-head"><span>Joueurs</span><span class="rail-count">0 / 16</span></div>
        <div class="rail-player-list" aria-live="polite"></div>
      </div>
      <div class="rail-section rail-status"></div>
      <div class="rail-section rail-footer"></div>`;
    lobby.appendChild(this.left);

    // 3) Rail droit — configuration (hôte uniquement)
    this.right = document.createElement('aside');
    this.right.className = 'lobby-rail lobby-right hidden';
    this.right.innerHTML = `
      <div class="rail-head"><span>Règles de la partie</span></div>
      <div class="rail-section rail-settings"></div>
      <div class="rail-section rail-start"></div>`;
    lobby.appendChild(this.right);

    // Réinstalle les éléments dans leurs nouveaux emplacements.
    const codeSlot = this.left.querySelector('.rail-code');
    if (displayCode)  codeSlot.appendChild(displayCode);
    if (copyCode)     codeSlot.appendChild(copyCode);
    if (lobbyStatus)  this.left.querySelector('.rail-status').appendChild(lobbyStatus);
    if (openSettings) this.left.querySelector('.rail-footer').appendChild(openSettings);
    if (leaveLobby)   this.left.querySelector('.rail-footer').appendChild(leaveLobby);
    if (hostSettings) this.right.querySelector('.rail-settings').appendChild(hostSettings);
    if (startGame)    this.right.querySelector('.rail-start').appendChild(startGame);

    this.stage  = this.el;
    this.canvas = this.el.querySelector('canvas');
    this.tags   = this.el.querySelector('.r-tags');
    this.empty  = this.el.querySelector('.r-empty');
    this.count  = this.left.querySelector('.rail-count');
    this.playerList = this.left.querySelector('.rail-player-list');
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 2.2, 0.1, 80);
    this.camera.position.set(0, 2.0, 7.5);

    this.scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x20262b, 1.1));
    const key = new THREE.DirectionalLight(0xffe2bd, 2.4);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 25 });
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xf07845, 2.2);
    rim.position.set(4, 3, -5);
    this.scene.add(rim);

    // Plateau + anneau lumineux
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 64),
      new THREE.MeshStandardMaterial({ color: 0x151c22, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(11.6, 11.8, 64),
      new THREE.MeshBasicMaterial({ color: 0xf07845 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);
  }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Sur viewport étroit (portrait), on élargit le champ pour garder tous les joueurs visibles.
    this.camera.fov = aspect < 1 ? 50 : aspect < 1.4 ? 42 : 36;
    this.camera.updateProjectionMatrix();
  }

  /** players : [{ id, name, host, me }] ou null (salon quitté). isHost contrôle le rail droit. */
  set(players, isHost = false, onKick = null, botOpts = null, teamOpts = null) {
    this.closeLevelPicker();
    if (!Array.isArray(players)) {
      this.list = [];
      this.isHost = false;
      this.onKick = null;
      this.botOpts = null;
      this.teamOpts = null;
      this.right?.classList.add('hidden');
    } else {
      this.list = players.filter(Boolean).slice(0, 16);
      this.isHost = isHost;
      this.onKick = onKick;
      this.botOpts = botOpts; // { onBotLevel(id, niveau), minLevel, maxLevel }
      this.teamOpts = teamOpts; // { on, count, onTeam(id, équipe) }
      this.right?.classList.toggle('hidden', !isHost);
    }
    this.sync();
  }

  setMap(map) {
    const name = this.left?.querySelector('#lobby-map');
    const description = this.left?.querySelector('#lobby-map-description');
    if (name) name.textContent = map.name;
    if (description) description.textContent = map.description;
  }

  sync() {
    if (!this.el) return;
    const teamsOn = !!this.teamOpts?.on;
    const order = [...this.list].sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) ||
      (teamsOn ? (a.team ?? 0) - (b.team ?? 0) : 0) || (a.id ?? 0) - (b.id ?? 0));
    const keep = new Set();

    order.forEach((p, i) => {
      const key = p.id ?? p.name;
      keep.add(key);
      const tkey = teamsOn ? `t${p.team}` : '';
      let e = this.entries.get(key);
      if (e && e.tkey !== tkey) { this.removeEntry(e); this.entries.delete(key); e = null; } // nouveau t-shirt
      if (!e) { e = this.addEntry(key, p, i); e.tkey = tkey; }
      this.updateTag(e, p);
    });

    for (const [key, e] of this.entries) {
      if (keep.has(key)) continue;
      this.removeEntry(e);
      this.entries.delete(key);
    }

    this.layout(order);
    this.count.textContent = `${order.length} / 16`;
    this.empty.style.display = order.length ? 'none' : 'grid';
    this.renderPlayerList(order);
  }

  renderPlayerList(players) {
    this.playerList.replaceChildren();
    const teamsOn = !!this.teamOpts?.on;
    const sizes = {};
    if (teamsOn) for (const p of players) sizes[p.team] = (sizes[p.team] || 0) + 1;
    if (teamsOn) players = [...players].sort((a, b) => (a.team ?? 0) - (b.team ?? 0) || (a.id ?? 0) - (b.id ?? 0));
    let lastTeam = null;
    const icon = id => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
    for (const player of players) {
      if (teamsOn && player.team !== lastTeam) {
        lastTeam = player.team;
        const t = teamInfo(player.team);
        const head = document.createElement('div');
        head.className = 'team-head';
        head.style.setProperty('--team', t.css);
        head.innerHTML = '<i class="team-dot"></i><span class="team-title"></span><span class="team-n"></span>';
        head.querySelector('.team-title').textContent = `Équipe ${t.name}`;
        head.querySelector('.team-n').textContent = String(sizes[player.team]);
        this.playerList.appendChild(head);
      }
      const row = document.createElement('div');
      row.className = 'player-row' + (player.me ? ' me' : '');

      // Pastille = couleur du t-shirt du personnage dans la scène.
      let swatch;
      if (teamsOn) {
        // Pastille = couleur de l'équipe ; cliquable pour soi-même (et pour tous si on est l'hôte).
        const t = teamInfo(player.team);
        if ((player.me || this.isHost) && this.teamOpts.onTeam) {
          swatch = document.createElement('button');
          swatch.type = 'button';
          swatch.className = 'team-chip';
          swatch.title = `Équipe ${t.name} — changer d’équipe`;
          swatch.setAttribute('aria-label', `${player.name || 'Joueur'} : équipe ${t.name}, changer d’équipe`);
          swatch.onclick = () => this.openTeamPicker(swatch, player);
        } else {
          swatch = document.createElement('i');
          swatch.className = 'player-swatch';
        }
        swatch.style.setProperty('--swatch', t.css);
      } else {
        swatch = document.createElement('i');
        swatch.className = 'player-swatch';
        swatch.style.setProperty('--swatch', shirtCss(player));
      }
      row.appendChild(swatch);

      const details = document.createElement('div');
      details.className = 'player-details';
      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = (player.bot ? (player.name || '').replace(/ \(BOT\)$/, '') : player.name) || 'Joueur';
      details.appendChild(name);

      const badges = document.createElement('span');
      badges.className = 'player-badges';
      const badge = (cls, html, label) => {
        const el = document.createElement('span');
        el.className = 'player-badge ' + cls;
        el.innerHTML = html;
        if (label) { el.title = label; el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); }
        badges.appendChild(el);
      };
      if (player.host) badge('host', icon('i-crown'), 'Hôte');
      if (player.bot) badge('bot', icon('i-bot'), 'Bot');
      if (player.me) badge('me', 'toi');
      details.appendChild(badges);
      row.appendChild(details);

      const actions = document.createElement('span');
      actions.className = 'player-actions';
      if (!player.me && player.friendCode && !player.friend && !player.pending && this.friends) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'player-action friend-add';
        add.setAttribute('aria-label', `Envoyer une demande d’ami à ${player.name || 'ce joueur'}`);
        add.title = 'Envoyer une demande d’ami';
        add.innerHTML = icon('i-user-plus');
        add.onclick = () => this.friends.request(player.friendCode);
        actions.appendChild(add);
      } else if (player.pending) {
        const pending = document.createElement('span');
        pending.className = 'player-pending';
        pending.textContent = 'Demande envoyée';
        actions.appendChild(pending);
      }

      if (player.bot) {
        const lvl = document.createElement('button');
        lvl.type = 'button';
        lvl.className = 'player-action bot-level';
        lvl.textContent = `Niv. ${player.level ?? 3}`;
        lvl.title = `Niveau du bot : ${player.level ?? 3} / ${this.botOpts?.maxLevel ?? 10}`;
        lvl.setAttribute('aria-label', `Niveau de ${player.name || 'ce bot'} : ${player.level ?? 3}`);
        if (this.isHost && this.botOpts?.onBotLevel) lvl.onclick = () => this.openLevelPicker(lvl, player);
        else lvl.disabled = true;
        actions.appendChild(lvl);
      }

      if (this.isHost && !player.me) {
        const kick = document.createElement('button');
        kick.type = 'button';
        kick.className = 'player-action kick';
        kick.setAttribute('aria-label', `Expulser ${player.name || 'ce joueur'} du salon`);
        kick.title = 'Expulser du salon';
        kick.innerHTML = icon('i-x');
        kick.onclick = () => this.onKick?.(player.id);
        actions.appendChild(kick);
      }
      row.appendChild(actions);
      this.playerList.appendChild(row);
    }
  }

  /** Petit sélecteur 1-10 ancré à la case de niveau d'un bot. */
  openLevelPicker(anchor, player) {
    this.closeLevelPicker();
    const { minLevel = 1, maxLevel = 10, onBotLevel } = this.botOpts || {};
    const pop = document.createElement('div');
    pop.className = 'bot-level-pop';
    for (let n = minLevel; n <= maxLevel; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(n);
      if (n === player.level) b.classList.add('active');
      b.onclick = () => { this.closeLevelPicker(); onBotLevel?.(player.id, n); };
      pop.appendChild(b);
    }
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = '1 facile, 10 expert';
    pop.appendChild(hint);
    document.body.appendChild(pop);

    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.min(innerWidth - pop.offsetWidth - 8, r.right + 10)}px`;
    pop.style.top = `${clamp(r.top - 6, 8, innerHeight - pop.offsetHeight - 8)}px`;

    this._pickerClose = e => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !pop.contains(e.target)) this.closeLevelPicker();
    };
    this._pickerEl = pop;
    setTimeout(() => {
      if (this._pickerEl !== pop) return;
      document.addEventListener('pointerdown', this._pickerClose, true);
      document.addEventListener('keydown', this._pickerClose, true);
    });
  }

  /** Sélecteur d'équipe : une pastille de couleur par équipe, avec son effectif. */
  openTeamPicker(anchor, player) {
    this.closeLevelPicker();
    const { count = 2, onTeam } = this.teamOpts || {};
    const sizes = Array.from({ length: count }, () => 0);
    for (const p of this.list) if (Number.isInteger(p.team) && p.team < count) sizes[p.team]++;

    const pop = document.createElement('div');
    pop.className = 'bot-level-pop team-pop';
    pop.style.setProperty('--cols', String(Math.min(4, count)));
    const hint = document.createElement('div');
    hint.className = 'hint';
    const describe = t => `Équipe ${teamInfo(t).name} · ${sizes[t]} joueur${sizes[t] > 1 ? 's' : ''}`;
    hint.textContent = describe(player.team);
    for (let t = 0; t < count; t++) {
      const info = teamInfo(t);
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--c', info.css);
      b.style.setProperty('--ink', info.ink);
      b.textContent = sizes[t] ? String(sizes[t]) : '';
      b.title = describe(t);
      b.setAttribute('aria-label', describe(t));
      if (t === player.team) b.classList.add('current');
      b.onclick = () => { this.closeLevelPicker(); onTeam?.(player.id, t); };
      b.onmouseenter = b.onfocus = () => { hint.textContent = describe(t); };
      pop.appendChild(b);
    }
    pop.appendChild(hint);
    document.body.appendChild(pop);

    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.min(innerWidth - pop.offsetWidth - 8, r.right + 10)}px`;
    pop.style.top = `${clamp(r.top - 6, 8, innerHeight - pop.offsetHeight - 8)}px`;

    this._pickerClose = e => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !pop.contains(e.target)) this.closeLevelPicker();
    };
    this._pickerEl = pop;
    setTimeout(() => {
      if (this._pickerEl !== pop) return;
      document.addEventListener('pointerdown', this._pickerClose, true);
      document.addEventListener('keydown', this._pickerClose, true);
    });
  }

  closeLevelPicker() {
    if (!this._pickerEl) return;
    document.removeEventListener('pointerdown', this._pickerClose, true);
    document.removeEventListener('keydown', this._pickerClose, true);
    this._pickerEl.remove();
    this._pickerEl = null;
  }

  removeEntry(e) {
    disposeCharacter(e.ch);
    e.ring.geometry.dispose();
    e.ring.material.dispose();
    this.scene.remove(e.ring);
    e.tag.remove();
  }

  addEntry(key, p, index) {
    const id = p.id ?? [...String(p.name)].reduce((a, c) => a + c.charCodeAt(0), 0);
    const ch = createCharacter({
      shirt: this.teamOpts?.on ? shirtFor(p.team) : SHIRT_COLORS[id % SHIRT_COLORS.length],
      appearance: p.appearance
    });
    showGun(ch, WEAPONS[id % WEAPONS.length]);
    ch.group.scale.setScalar(0.001);
    this.scene.add(ch.group);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.68, 32),
      new THREE.MeshBasicMaterial({ color: 0xf07845, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    this.scene.add(ring);

    const tag = document.createElement('div');
    tag.className = 'r3d-tag';
    this.tags.appendChild(tag);

    const e = {
      key, ch, ring, tag, sig: '', born: this.time + index * 0.08,
      phase: id * 1.7, yaw: 0, x: 0, z: 0, tx: 0, tz: 0, fresh: true
    };
    this.entries.set(key, e);
    return e;
  }

  updateTag(e, p) {
    const teamsOn = !!this.teamOpts?.on;
    const sig = `${p.name}|${!!p.host}|${!!p.me}|${!!p.bot}|${p.level ?? ''}|${teamsOn ? p.team : ''}`;
    if (sig === e.sig) return;
    e.sig = sig;
    e.tag.className = 'r3d-tag' + (p.me ? ' me' : '');
    e.tag.replaceChildren();
    const name = document.createElement('span');
    name.textContent = (p.bot ? (p.name || '').replace(/ \(BOT\)$/, '') : p.name) || 'Joueur';
    e.tag.appendChild(name);
    const badge = (txt, cls) => {
      const b = document.createElement('span');
      b.className = 'r-tag' + (cls ? ' ' + cls : '');
      b.textContent = txt;
      e.tag.appendChild(b);
    };
    if (teamsOn) {
      badge(teamInfo(p.team).name);
      e.tag.lastChild.style.color = teamInfo(p.team).css;
    }
    if (p.host) badge('Hôte');
    if (p.bot)  badge(`Bot ${p.level ?? 3}`, 'you');
    if (p.me)   badge('Toi', 'you');
    e.ring.visible = !!p.me;
  }

  /** Rangées de 6 max, moi au centre devant, les autres rayonnent autour. */
  layout(order) {
    const n = order.length;
    const rows = Math.max(1, Math.ceil(n / 6));
    const base = Math.floor(n / rows), extra = n % rows;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const size = base + (r < extra ? 1 : 0);
      const xs = Array.from({ length: size }, (_, i) => (i - (size - 1) / 2) * 1.5)
        .sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
      for (let i = 0; i < size; i++, idx++) {
        const p = order[idx], e = this.entries.get(p.id ?? p.name);
        if (!e) continue;
        e.tx = xs[i];
        e.tz = -r * 1.7;
        if (e.fresh) { e.x = e.tx; e.z = e.tz; e.fresh = false; }
      }
    }
    this.camTarget = { z: 7.5 + (rows - 1) * 1.6, y: 2.0 + (rows - 1) * 0.6 };
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    // Ne rien dessiner quand le salon est masqué (menu ou partie en cours).
    if (!this.el.offsetParent) return;
    const wantW = Math.round(this.stage.clientWidth * this.renderer.getPixelRatio());
    if (this.canvas.width === 0 || this.canvas.width !== wantW) this.resize();

    this.time += dt;
    const k = 1 - Math.exp(-dt * 6);
    this.camera.position.z += (this.camTarget.z - this.camera.position.z) * k;
    this.camera.position.y += (this.camTarget.y - this.camera.position.y) * k;
    this.camera.lookAt(0, 1.05, -0.5);

    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    const v = new THREE.Vector3();

    for (const e of this.entries.values()) {
      e.x += (e.tx - e.x) * k;
      e.z += (e.tz - e.z) * k;

      const g = e.ch.group;
      const breath = poseIdle(e.ch, this.time, e.phase);
      const pop = ease((this.time - e.born) / 0.45);
      const overshoot = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.08 : 1;
      const s = Math.max(0.001, pop * overshoot);
      g.scale.set(s, s * breath, s);
      g.position.set(e.x, 0, e.z);

      // Face à la caméra (π), légèrement tourné vers le centre, et suit la souris.
      const want = Math.PI - e.x * 0.05 + this.mouseX * 0.45;
      e.yaw += (want - e.yaw) * k;
      if (e.yaw === 0) e.yaw = want;
      g.rotation.y = e.yaw;

      e.ring.position.set(e.x, 0.02, e.z);
      e.ring.scale.setScalar(s);

      v.set(e.x, 2.35 * s, e.z).project(this.camera);
      e.tag.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      e.tag.style.opacity = pop > 0.6 ? 1 : 0;
    }

    this.renderer.render(this.scene, this.camera);
  }
}