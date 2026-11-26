
import * as THREE from 'three';
import {
  createCharacter,
  disposeCharacter,
  showGun,
  poseIdle,
  SHIRT_COLORS
} from '../game/character.js';

// Lobby plein écran façon Counter-Strike.
// API : window.clashRoster.set([{ id, name, host, me }], isHost, onKick) / set(null).

const CSS = `
/* ===== Lobby plein écran ===== */
#lobby.lobby-fs {
  position: fixed !important;
  inset: 0 !important;
  z-index: 100;
  padding: 0 !important;
  border: 0 !important;
  background: #0b1014;
  overflow: hidden;
}

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
  font: 600 13px Inter, Arial, sans-serif;
  letter-spacing: .18em;
  pointer-events: none;
  z-index: 1;
}

/* Rails latéraux */
.lobby-rail {
  position: absolute;
  top: 24px;
  z-index: 10;
  width: 300px;
  max-height: calc(100vh - 48px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  background: rgba(15, 22, 27, .82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid #39464e;
  box-shadow: 0 20px 60px rgba(0,0,0,.55);
}

.lobby-rail.hidden { display: none; }
.lobby-left { left: 24px; }
.lobby-right { right: 24px; }

.rail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #39464e;
  font: 800 11px Inter, Arial, sans-serif;
  letter-spacing: .2em;
  color: #8a98a0;
}

.rail-count {
  color: #f07845;
  font: 800 14px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .1em;
}

.rail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rail-player-list {
  display: grid;
  gap: 5px;
  max-height: min(42vh, 360px);
  overflow-y: auto;
}

.player-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 7px;
  border: 1px solid rgba(86, 102, 111, .55);
  background: rgba(24, 34, 42, .78);
}

.player-row.me {
  border-color: rgba(240, 120, 69, .55);
}

.player-details,
.player-actions,
.player-badges {
  display: flex;
  align-items: center;
}

.player-details {
  min-width: 0;
  gap: 7px;
}

.player-name {
  overflow: hidden;
  color: #e8edef;
  font: 700 13px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-badges { gap: 4px; }

.player-badge {
  padding: 2px 4px;
  background: #39464e;
  color: #cbd4d8;
  font: 800 8px Inter, Arial, sans-serif;
  letter-spacing: .06em;
}

.player-badge.host {
  background: #f07845;
  color: #10151a;
}

.player-actions { gap: 4px; }

.player-action {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-color: #42515a;
  background: #11191f;
  color: #dce4e7;
  line-height: 1;
}

.player-action:hover:not(:disabled) {
  transform: none;
}

.player-action.friend-add svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.player-action.friend-add span {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #75d990;
  color: #10151a;
  font: 900 12px Arial, sans-serif;
}

.player-action.kick {
  color: #ff8175;
  font-size: 22px;
}

.player-pending {
  color: #89979e;
  font: 700 8px Inter, Arial, sans-serif;
  letter-spacing: .04em;
}

.rail-label {
  font: 800 10px Inter, Arial, sans-serif;
  letter-spacing: .18em;
  color: #5d6b72;
}

.rail-code {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.rail-code #display-code {
  flex: 1;
  padding: 8px 12px;
  background: #18222a;
  border: 1px solid #39464e;
  font: 800 22px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .18em;
  color: #eef1f2;
  text-align: center;
}

.rail-status #lobby-status {
  font: 500 12px Inter, Arial, sans-serif;
  line-height: 1.5;
  color: #8a98a0;
  min-height: 1.5em;
}

.rail-map {
  color: #eef1f2;
  font: 700 14px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .08em;
}

.rail-map-description {
  color: #8a98a0;
  font: 500 10px/1.5 Inter, Arial, sans-serif;
}

.map-description {
  color: #8a98a0;
  font: 500 10px/1.5 Inter, Arial, sans-serif;
  letter-spacing: 0;
}

.rail-footer { margin-top: auto; }
.rail-footer #leave-lobby { width: 100%; }
.rail-settings { flex: 1; }
.rail-start { margin-top: auto; }

.rail-start #start-game {
  width: 100%;
  padding: 12px 14px;
  font: 800 14px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .14em;
}

/* Bots */
.rail-footer #add-bot { width: 100%; }

.player-badge.bot {
  background: #3a4b55;
  color: #e6ecef;
}

.player-action.bot-level {
  color: #ffd27a;
  font: 800 14px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: 0;
}

.player-action.bot-level:disabled {
  opacity: 1;
  cursor: default;
}

.bot-level-pop {
  position: fixed;
  z-index: 300;
  display: grid;
  grid-template-columns: repeat(5, 30px);
  gap: 4px;
  padding: 8px;
  background: rgba(15, 22, 27, .96);
  border: 1px solid #39464e;
  box-shadow: 0 14px 40px rgba(0,0,0,.6);
}

.bot-level-pop button {
  width: 30px;
  height: 30px;
  padding: 0;
  border-color: #42515a;
  background: #11191f;
  color: #dce4e7;
  font: 800 14px 'Barlow Condensed', Arial, sans-serif;
}

.bot-level-pop button.active {
  background: #f07845;
  border-color: #f07845;
  color: #10151a;
}

.bot-level-pop .hint {
  grid-column: 1 / -1;
  color: #8a98a0;
  font: 700 9px Inter, Arial, sans-serif;
  letter-spacing: .14em;
  text-align: center;
}

/* Étiquettes 3D */
#roster .r3d-tag {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(10,15,20,.85);
  border-bottom: 2px solid #4a5a64;
  padding: 3px 9px;
  font: 800 18px 'Barlow Condensed', Arial, sans-serif;
  letter-spacing: .06em;
  color: #eef1f2;
  will-change: transform;
  opacity: 0;
  transition: opacity .3s;
}

#roster .r3d-tag.me {
  border-bottom-color: #f07845;
  color: #ffb487;
}

#roster .r-tag {
  font: 800 9px Inter, Arial, sans-serif;
  letter-spacing: .14em;
  padding: 2px 5px;
  background: #f07845;
  color: #10151a;
}

#roster .r-tag.you {
  background: #3a4b55;
  color: #e6ecef;
}

@media (max-width: 860px) {
  .lobby-rail {
    width: 240px;
    top: 12px;
    padding: 12px;
    max-height: calc(100vh - 24px);
  }

  .lobby-left { left: 12px; }
  .lobby-right { right: 12px; }
  .rail-code #display-code { font-size: 18px; }
}

@media (max-width: 640px) {
  .lobby-rail {
    width: auto;
    left: 8px;
    right: 8px;
    max-height: 34vh;
  }

  .lobby-left {
    top: 8px;
    bottom: auto;
  }

  .lobby-right {
    bottom: 8px;
    top: auto;
  }
}
`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const WEAPONS = ['rifle', 'shotgun', 'sniper', 'knife'];

export class Roster {
  constructor(friends = null) {
    const lobby = document.querySelector('#lobby');
    if (!lobby) return;

    this.lobby = lobby;
    this.disposed = false;
    this.entries = new Map();
    this.friends = friends;
    this.list = [];
    this.mouseX = 0;
    this.time = 0;
    this._projected = new THREE.Vector3();
    this.camTarget = { z: 7.5, y: 2.0 };

    this.injectStyles();
    this.buildLayout(lobby);
    this.initScene();

    window.clashRoster = this;

    this._onPointerMove = e => {
      const r = this.stage.getBoundingClientRect();
      if (!r.width) return;

      this.mouseX = clamp(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -1,
        1
      );
    };

    this._onPointerLeave = () => {
      this.mouseX = 0;
    };

    this.stage.addEventListener(
      'pointermove',
      this._onPointerMove,
      { passive: true }
    );

    this.stage.addEventListener(
      'pointerleave',
      this._onPointerLeave
    );

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);

    this.last = performance.now();
    this.loop = this.loop.bind(this);

    this.renderer.setAnimationLoop(this.loop);
  }

  injectStyles() {
    const existing = document.getElementById('clash-roster-styles');

    if (existing) {
      this.styleEl = existing;
      this.ownsStyles = false;
      return;
    }

    const style = document.createElement('style');
    style.id = 'clash-roster-styles';
    style.textContent = CSS;

    document.head.appendChild(style);

    this.styleEl = style;
    this.ownsStyles = true;
  }

  buildLayout(lobby) {
    const panel = lobby.querySelector('.lobby-panel');

    this.originalPanel = panel;
    this.originalChildren = panel ? null : [...lobby.childNodes];

    const grab = id => (panel || lobby).querySelector(id);

    const displayCode = grab('#display-code');
    const copyCode = grab('#copy-code');
    const leaveLobby = grab('#leave-lobby');
    const openSettings = grab('#open-settings-lobby');
    const hostSettings = grab('#host-settings');
    const startGame = grab('#start-game');
    const lobbyStatus = grab('#lobby-status');

    this.movedNodes = [
      displayCode,
      copyCode,
      leaveLobby,
      openSettings,
      hostSettings,
      startGame,
      lobbyStatus
    ]
      .filter(Boolean)
      .map(node => ({
        node,
        parent: node.parentNode,
        nextSibling: node.nextSibling
      }));

    lobby.innerHTML = '';
    lobby.classList.add('lobby-fs');

    // Scène 3D
    this.el = document.createElement('div');
    this.el.id = 'roster';

    this.el.innerHTML = `
      <canvas></canvas>
      <div class="r-tags"></div>
      <div class="r-empty">EN ATTENTE DES JOUEURS…</div>
    `;

    lobby.appendChild(this.el);

    // Rail gauche
    this.left = document.createElement('aside');
    this.left.className = 'lobby-rail lobby-left';

    this.left.innerHTML = `
      <div class="rail-head">
        <span>SALON</span>
        <span class="rail-count">0 / 16</span>
      </div>

      <div class="rail-section rail-players">
        <div class="rail-label">JOUEURS PRÉSENTS</div>
        <div class="rail-player-list" aria-live="polite"></div>
      </div>

      <div class="rail-section">
        <div class="rail-label">CODE DU SALON</div>
        <div class="rail-code"></div>
      </div>

      <div class="rail-section">
        <div class="rail-label">CARTE SÉLECTIONNÉE</div>
        <div id="lobby-map" class="rail-map">Fonderie</div>
        <div id="lobby-map-description"
             class="rail-map-description"></div>
      </div>

      <div class="rail-section rail-status"></div>
      <div class="rail-section rail-footer"></div>
    `;

    lobby.appendChild(this.left);

    // Rail droit
    this.right = document.createElement('aside');
    this.right.className = 'lobby-rail lobby-right hidden';

    this.right.innerHTML = `
      <div class="rail-head">
        <span>CONFIGURATION</span>
      </div>

      <div class="rail-section rail-settings"></div>
      <div class="rail-section rail-start"></div>
    `;

    lobby.appendChild(this.right);

    // Réinstallation des éléments existants
    const codeSlot = this.left.querySelector('.rail-code');

    if (displayCode) codeSlot.appendChild(displayCode);
    if (copyCode) codeSlot.appendChild(copyCode);

    if (lobbyStatus) {
      this.left.querySelector('.rail-status').appendChild(lobbyStatus);
    }

    if (openSettings) {
      this.left.querySelector('.rail-footer').appendChild(openSettings);
    }

    if (leaveLobby) {
      this.left.querySelector('.rail-footer').appendChild(leaveLobby);
    }

    if (hostSettings) {
      this.right.querySelector('.rail-settings').appendChild(hostSettings);
    }

    if (startGame) {
      this.right.querySelector('.rail-start').appendChild(startGame);
    }

    this.stage = this.el;
    this.canvas = this.el.querySelector('canvas');
    this.tags = this.el.querySelector('.r-tags');
    this.empty = this.el.querySelector('.r-empty');

    this.count = this.left.querySelector('.rail-count');
    this.playerList = this.left.querySelector('.rail-player-list');
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.75)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      36,
      2.2,
      0.1,
      80
    );

    this.camera.position.set(0, 2.0, 7.5);

    this.scene.add(
      new THREE.HemisphereLight(
        0xdbe8f5,
        0x20262b,
        1.1
      )
    );

    const key = new THREE.DirectionalLight(0xffe2bd, 2.4);

    key.position.set(-3, 6, 5);
    key.castShadow = true;

    key.shadow.mapSize.set(1024, 1024);

    Object.assign(key.shadow.camera, {
      left: -9,
      right: 9,
      top: 9,
      bottom: -9,
      near: 1,
      far: 25
    });

    key.shadow.bias = -0.0005;

    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xf07845, 2.2);

    rim.position.set(4, 3, -5);

    this.scene.add(rim);

    // Plateau
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x151c22,
        roughness: 0.85
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    this.scene.add(floor);

    // Anneau lumineux
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(11.6, 11.8, 64),
      new THREE.MeshBasicMaterial({
        color: 0xf07845
      })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;

    this.scene.add(ring);
  }

  resize() {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;

    if (!w || !h || !this.renderer) return;

    if (w === this._width && h === this._height) return;

    this._width = w;
    this._height = h;

    this.renderer.setSize(w, h, false);

    const aspect = w / h;

    this.camera.aspect = aspect;

    this.camera.fov =
      aspect < 1 ? 50 :
      aspect < 1.4 ? 42 :
      36;

    this.camera.updateProjectionMatrix();
  }

  /**
   * players : [{ id, name, host, me }] ou null.
   * isHost contrôle le rail droit.
   */
  set(players, isHost = false, onKick = null, botOpts = null) {
    if (this.disposed) return;

    this.closeLevelPicker();

    if (!Array.isArray(players)) {
      this.list = [];
      this.isHost = false;
      this.onKick = null;
      this.botOpts = null;

      this.right?.classList.add('hidden');
    } else {
      this.list = players
        .filter(p => p && typeof p === 'object')
        .slice(0, 16);

      this.isHost = isHost;
      this.onKick = onKick;
      this.botOpts = botOpts;

      this.right?.classList.toggle('hidden', !isHost);
    }

    this.sync();
  }

  setMap(map) {
    if (this.disposed) return;

    const name = this.left?.querySelector('#lobby-map');
    const description = this.left?.querySelector(
      '#lobby-map-description'
    );

    if (name) {
      name.textContent = map?.name || 'Carte inconnue';
    }

    if (description) {
      description.textContent = map?.description || '';
    }
  }

  sync() {
    if (this.disposed || !this.el) return;

    const order = [...this.list].sort((a, b) =>
      Number(!!b.me) - Number(!!a.me) ||
      String(a.id ?? a.name ?? '').localeCompare(
        String(b.id ?? b.name ?? ''),
        undefined,
        { numeric: true }
      )
    );

    const keep = new Set();

    order.forEach((p, i) => {
      const key = String(p.id ?? p.name ?? `player-${i}`);

      keep.add(key);

      let e = this.entries.get(key);

      if (!e) {
        e = this.addEntry(key, p, i);
      }

      this.updateTag(e, p);
    });

    // Suppression des joueurs absents
    for (const [key, e] of this.entries) {
      if (keep.has(key)) continue;

      disposeCharacter(e.ch);

      this.scene.remove(e.ch.group);

      e.ring.geometry.dispose();
      e.ring.material.dispose();

      this.scene.remove(e.ring);

      e.tag.remove();

      this.entries.delete(key);
    }

    this.layout(order);

    this.count.textContent = `${order.length} / 16`;

    this.empty.style.display = order.length ? 'none' : 'grid';

    this.renderPlayerList(order);
  }

  renderPlayerList(players) {
    this.playerList.replaceChildren();

    for (const player of players) {
      const row = document.createElement('div');

      row.className =
        'player-row' + (player.me ? ' me' : '');

      const details = document.createElement('div');

      details.className = 'player-details';

      const name = document.createElement('span');

      name.className = 'player-name';

      name.textContent = (
        player.bot
          ? (player.name || '').replace(/\s*\(?BOT\)?$/i, '')
          : player.name
      ) || 'Joueur';

      details.appendChild(name);

      const badges = document.createElement('span');

      badges.className = 'player-badges';

      if (player.host) {
        const host = document.createElement('span');

        host.className = 'player-badge host';
        host.textContent = 'HÔTE';

        badges.appendChild(host);
      }

      if (player.bot) {
        const bot = document.createElement('span');

        bot.className = 'player-badge bot';
        bot.textContent = 'BOT';

        badges.appendChild(bot);
      }

      if (player.me) {
        const me = document.createElement('span');

        me.className = 'player-badge';
        me.textContent = 'TOI';

        badges.appendChild(me);
      }

      details.appendChild(badges);
      row.appendChild(details);

      const actions = document.createElement('span');

      actions.className = 'player-actions';

      // Ajouter un ami
      if (
        !player.me &&
        player.friendCode &&
        !player.friend &&
        !player.pending &&
        this.friends
      ) {
        const add = document.createElement('button');

        add.type = 'button';
        add.className = 'player-action friend-add';

        add.setAttribute(
          'aria-label',
          `Envoyer une demande d’ami à ${player.name || 'ce joueur'}`
        );

        add.title = 'Envoyer une demande d’ami';

        add.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5"></circle>
            <path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20"></path>
          </svg>
          <span aria-hidden="true">+</span>
        `;

        add.onclick = () => this.friends.request(player.friendCode);

        actions.appendChild(add);
      } else if (player.pending) {
        const pending = document.createElement('span');

        pending.className = 'player-pending';
        pending.textContent = 'DEMANDE ENVOYÉE';

        actions.appendChild(pending);
      }

      // Niveau du bot
      if (player.bot) {
        const lvl = document.createElement('button');

        lvl.type = 'button';
        lvl.className = 'player-action bot-level';

        lvl.textContent = String(player.level ?? 3);

        lvl.title =
          `Niveau du bot : ${player.level ?? 3} / ${this.botOpts?.maxLevel ?? 10}`;

        lvl.setAttribute(
          'aria-label',
          `Niveau de ${player.name || 'ce bot'} : ${player.level ?? 3}`
        );

        if (this.isHost && this.botOpts?.onBotLevel) {
          lvl.onclick = () => this.openLevelPicker(lvl, player);
        } else {
          lvl.disabled = true;
        }

        actions.appendChild(lvl);
      }

      // Expulsion
      if (this.isHost && !player.me) {
        const kick = document.createElement('button');

        kick.type = 'button';
        kick.className = 'player-action kick';

        kick.setAttribute(
          'aria-label',
          `Expulser ${player.name || 'ce joueur'} du salon`
        );

        kick.title = 'Expulser du salon';
        kick.textContent = '×';

        kick.onclick = () => this.onKick?.(player.id);

        actions.appendChild(kick);
      }

      row.appendChild(actions);
      this.playerList.appendChild(row);
    }
  }

  /** Sélecteur de niveau du bot. */
  openLevelPicker(anchor, player) {
    this.closeLevelPicker();

    const {
      minLevel = 1,
      maxLevel = 10,
      onBotLevel
    } = this.botOpts || {};

    const pop = document.createElement('div');

    pop.className = 'bot-level-pop';

    for (let n = minLevel; n <= maxLevel; n++) {
      const b = document.createElement('button');

      b.type = 'button';
      b.textContent = String(n);

      if (n === player.level) {
        b.classList.add('active');
      }

      b.onclick = () => {
        this.closeLevelPicker();
        onBotLevel?.(player.id, n);
      };

      pop.appendChild(b);
    }

    const hint = document.createElement('div');

    hint.className = 'hint';
    hint.textContent = '1 FACILE · 5 MOYEN · 10 EXPERT';

    pop.appendChild(hint);
    document.body.appendChild(pop);

    const r = anchor.getBoundingClientRect();

    pop.style.left = `${
      Math.min(
        innerWidth - pop.offsetWidth - 8,
        r.right + 10
      )
    }px`;

    pop.style.top = `${
      clamp(
        r.top - 6,
        8,
        innerHeight - pop.offsetHeight - 8
      )
    }px`;

    this._pickerClose = e => {
      if (
        e.type === 'keydown'
          ? e.key === 'Escape'
          : !pop.contains(e.target)
      ) {
        this.closeLevelPicker();
      }
    };

    this._pickerEl = pop;

    setTimeout(() => {
      if (this._pickerEl !== pop) return;

      document.addEventListener(
        'pointerdown',
        this._pickerClose,
        true
      );

      document.addEventListener(
        'keydown',
        this._pickerClose,
        true
      );
    });
  }

  closeLevelPicker() {
    if (!this._pickerEl) return;

    document.removeEventListener(
      'pointerdown',
      this._pickerClose,
      true
    );

    document.removeEventListener(
      'keydown',
      this._pickerClose,
      true
    );

    this._pickerEl.remove();
    this._pickerEl = null;
  }

  addEntry(key, p, index) {
    // Identifiant stable pour les couleurs et animations.
    const seed = [...String(p.id ?? p.name ?? key)].reduce(
      (hash, char) =>
        (hash * 31 + char.charCodeAt(0)) >>> 0,
      7
    );

    const ch = createCharacter({
      shirt: SHIRT_COLORS[seed % SHIRT_COLORS.length],
      appearance: p.appearance
    });

    showGun(ch, WEAPONS[seed % WEAPONS.length]);

    ch.group.scale.setScalar(0.001);

    this.scene.add(ch.group);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.68, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf07845,
        transparent: true,
        opacity: 0.9
      })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;

    this.scene.add(ring);

    const tag = document.createElement('div');

    tag.className = 'r3d-tag';

    this.tags.appendChild(tag);

    const e = {
      key,
      ch,
      ring,
      tag,
      sig: '',
      born: this.time + index * 0.08,
      phase: seed * 1.7,
      yaw: 0,
      x: 0,
      z: 0,
      tx: 0,
      tz: 0,
      fresh: true
    };

    this.entries.set(key, e);

    return e;
  }

  updateTag(e, p) {
    const sig = `${p.name}|${!!p.host}|${!!p.me}|${!!p.bot}|${p.level ?? ''}`;

    if (sig === e.sig) return;

    e.sig = sig;

    e.tag.className =
      'r3d-tag' + (p.me ? ' me' : '');

    e.tag.replaceChildren();

    const name = document.createElement('span');

    name.textContent = (
      p.bot
        ? (p.name || '').replace(/\s*\(?BOT\)?$/i, '')
        : p.name
    ) || 'Joueur';

    e.tag.appendChild(name);

    const badge = (txt, cls) => {
      const b = document.createElement('span');

      b.className = 'r-tag' + (cls ? ' ' + cls : '');
      b.textContent = txt;

      e.tag.appendChild(b);
    };

    if (p.host) badge('HÔTE');

    if (p.bot) {
      badge(`BOT ${p.level ?? 3}`, 'you');
    }

    if (p.me) {
      badge('TOI', 'you');
    }

    e.ring.visible = !!p.me;
  }

  /** Rangées de 6 maximum. */
  layout(order) {
    const n = order.length;

    const rows = Math.max(1, Math.ceil(n / 6));

    const base = Math.floor(n / rows);
    const extra = n % rows;

    let idx = 0;

    for (let r = 0; r < rows; r++) {
      const size = base + (r < extra ? 1 : 0);

      const xs = Array.from(
        { length: size },
        (_, i) => (i - (size - 1) / 2) * 1.5
      ).sort(
        (a, b) => Math.abs(a) - Math.abs(b) || b - a
      );

      for (let i = 0; i < size; i++, idx++) {
        const p = order[idx];

        const e = this.entries.get(
          String(p.id ?? p.name ?? `player-${idx}`)
        );

        if (!e) continue;

        e.tx = xs[i];
        e.tz = -r * 1.7;

        if (e.fresh) {
          e.x = e.tx;
          e.z = e.tz;
          e.fresh = false;
        }
      }
    }

    this.camTarget = {
      z: 7.5 + (rows - 1) * 1.6,
      y: 2.0 + (rows - 1) * 0.6
    };
  }

  loop(now) {
    if (this.disposed) return;

    const dt = Math.min((now - this.last) / 1000, 0.05);

    this.last = now;

    // Ne rien dessiner quand le salon est masqué.
    if (!this.el.offsetParent) return;

    if (!this.stage.clientWidth || !this.stage.clientHeight) {
      return;
    }

    const pixelRatio = this.renderer.getPixelRatio();

    const expectedWidth = Math.round(
      this.stage.clientWidth * pixelRatio
    );

    const expectedHeight = Math.round(
      this.stage.clientHeight * pixelRatio
    );

    if (
      this.canvas.width !== expectedWidth ||
      this.canvas.height !== expectedHeight
    ) {
      this._width = this._height = 0;
      this.resize();
    }

    this.time += dt;

    const k = 1 - Math.exp(-dt * 6);

    // Caméra fluide
    this.camera.position.z +=
      (this.camTarget.z - this.camera.position.z) * k;

    this.camera.position.y +=
      (this.camTarget.y - this.camera.position.y) * k;

    this.camera.lookAt(0, 1.05, -0.5);

    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;

    const v = this._projected;

    for (const e of this.entries.values()) {
      e.x += (e.tx - e.x) * k;
      e.z += (e.tz - e.z) * k;

      const g = e.ch.group;

      const breath = poseIdle(
        e.ch,
        this.time,
        e.phase
      );

      const pop = ease(
        (this.time - e.born) / 0.45
      );

      const overshoot =
        pop < 1
          ? 1 + Math.sin(pop * Math.PI) * 0.08
          : 1;

      const s = Math.max(0.001, pop * overshoot);

      g.scale.set(
        s,
        s * breath,
        s
      );

      g.position.set(e.x, 0, e.z);

      // Orientation vers la caméra.
      const want =
        Math.PI -
        e.x * 0.05 +
        this.mouseX * 0.45;

      // Interpolation angulaire sans saut à ±PI.
      const yawDelta = Math.atan2(
        Math.sin(want - e.yaw),
        Math.cos(want - e.yaw)
      );

      e.yaw += yawDelta * k;

      g.rotation.y = e.yaw;

      // Anneau du joueur local.
      e.ring.position.set(e.x, 0.02, e.z);
      e.ring.scale.setScalar(s);

      // Projection des étiquettes 3D.
      v.set(
        e.x,
        2.35 * s,
        e.z
      ).project(this.camera);

      e.tag.style.transform = `
        translate(
          ${(v.x * 0.5 + 0.5) * w}px,
          ${(-v.y * 0.5 + 0.5) * h}px
        )
        translate(-50%, -100%)
      `;

      e.tag.style.opacity = pop > 0.6 ? 1 : 0;
    }

    this.renderer.render(
      this.scene,
      this.camera
    );
  }

  /**
   * Détruit proprement le roster :
   * boucle, observateur, événements et ressources GPU.
   * Peut être appelé plusieurs fois.
   */
  destroy() {
    if (this.disposed) return;

    this.disposed = true;

    this.closeLevelPicker();

    // Arrêt de la boucle Three.js.
    this.renderer?.setAnimationLoop(null);

    // Arrêt de l'observateur.
    this.resizeObserver?.disconnect();

    // Suppression des événements.
    this.stage?.removeEventListener(
      'pointermove',
      this._onPointerMove
    );

    this.stage?.removeEventListener(
      'pointerleave',
      this._onPointerLeave
    );

    // Nettoyage des personnages.
    for (const entry of this.entries.values()) {
      disposeCharacter(entry.ch);

      this.scene.remove(entry.ch.group);

      entry.ring.geometry.dispose();
      entry.ring.material.dispose();

      this.scene.remove(entry.ring);

      entry.tag.remove();
    }

    this.entries.clear();

    // Libération des ressources statiques.
    this.scene?.traverse(object => {
      if (!object.isMesh) return;

      object.geometry?.dispose();

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        if (!material) continue;

        for (const value of Object.values(material)) {
          if (value?.isTexture) {
            value.dispose();
          }
        }

        material.dispose();
      }
    });

    // Destruction du renderer.
    this.renderer?.dispose();
    this.renderer = null;

    // Restauration des éléments HTML déplacés.
    for (const item of [...(this.movedNodes || [])].reverse()) {
      const {
        node,
        parent,
        nextSibling
      } = item;

      if (parent) {
        parent.insertBefore(
          node,
          nextSibling?.parentNode === parent
            ? nextSibling
            : null
        );
      }
    }

    // Nettoyage CSS.
    if (this.ownsStyles) {
      this.styleEl?.remove();
    }

    // Suppression de la structure du lobby.
    this.el?.remove();
    this.left?.remove();
    this.right?.remove();

    // Restauration du contenu initial.
    if (this.originalPanel) {
      this.lobby?.appendChild(this.originalPanel);
    } else if (this.originalChildren) {
      this.lobby?.append(...this.originalChildren);
    }

    this.lobby?.classList.remove('lobby-fs');

    // Suppression de la référence globale.
    if (window.clashRoster === this) {
      delete window.clashRoster;
    }
  }
}
