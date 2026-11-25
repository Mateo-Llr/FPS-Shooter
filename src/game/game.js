import * as THREE from 'three';
import { World } from './world.js';
import { PlayerController } from './player.js';
import { WeaponSystem, WEAPONS } from './weapons.js';
import { HUD } from './hud.js';
import { createCharacter, disposeCharacter, showGun, animateCharacter, gunModel, box, SHIRT_COLORS } from './character.js';
import { MSG, MAX_PLAYERS } from '../network/protocol.js';
import { settings } from '../ui/settings.js';
import { normalizeAppearance } from './customization.js';
import { GAMEPAD_BUTTONS, GamepadState } from './gamepad.js';
import { progress } from './progress.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};
const rnd = () => Math.random() * 2 - 1;

const NET_DT = 1 / 20;
const RESPAWN_TIME = 3;
const SPAWN_PROTECTION = 1500;
const WEAPON_IDS = ['shotgun', 'rifle', 'sniper', 'knife'];

// Mode « capture du drapeau » : drapeau au centre de la carte.
// Il faut rester SEUL dans la zone `seconds` secondes (cumulées) pour atteindre 100 %.
const FLAG = { x: 0, z: 0, radius: 3, seconds: 20 };
const shirtOf = id => SHIRT_COLORS[id % SHIRT_COLORS.length];

const G_SPH = new THREE.SphereGeometry(1, 6, 6);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 5);
const G_HOLE = new THREE.CircleGeometry(0.06, 8);
const M_SPARK = new THREE.MeshBasicMaterial({ color: 0xffc060 });
const M_BLOOD = new THREE.MeshBasicMaterial({ color: 0xb01818 });
const M_DUST = new THREE.MeshBasicMaterial({ color: 0xc4c0b2 });
const M_HOLE = new THREE.MeshBasicMaterial({ color: 0x0d0d0d });

// --- État compact du joueur : [x, y, z, yaw, pitch, accroupi, arme, visée] ---
const r2 = v => Math.round(v * 100) / 100;
const encode = s => [r2(s.x), r2(s.y || 0), r2(s.z), r2(s.yaw || 0), r2(s.pitch || 0), s.crouch ? 1 : 0, Math.max(0, WEAPON_IDS.indexOf(s.w)), s.aim ? 1 : 0];
const decode = a => ({
  x: clampN(a[0], -40, 40), y: clampN(a[1], -1, 8), z: clampN(a[2], -40, 40),
  yaw: a[3], pitch: a[4], crouch: !!a[5], w: WEAPON_IDS[a[6]] || 'rifle', aim: !!a[7]
});
const validPos = a => Array.isArray(a) && a.length >= 7 && a.every(Number.isFinite);
const validShot = s => !!s && !!WEAPONS[s.weapon] &&
  Array.isArray(s.o) && s.o.length === 3 && s.o.every(Number.isFinite) &&
  Array.isArray(s.d) && s.d.length >= 1 && s.d.length <= 10 &&
  s.d.every(a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite));

const UI_CSS = `
#kill-feed{position:fixed;top:92px;right:22px;z-index:60;display:grid;gap:6px;justify-items:end;pointer-events:none}
.feed-item{background:rgba(10,15,20,.82);border-right:3px solid #8a98a0;padding:6px 12px;font:700 15px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.06em;color:#dfe5e8;animation:feed-in .25s ease}
.feed-item.mine{border-right-color:#f07845;color:#ffb487}
.feed-item.victim{border-right-color:#ff3b30;color:#ff8c84}
@keyframes feed-in{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
#banner{position:fixed;left:50%;top:60%;transform:translate(-50%,-50%);z-index:60;text-align:center;pointer-events:none;opacity:0}
#banner b{display:block;font:900 54px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.12em;color:#ff8a4a;text-shadow:0 4px 18px #000}
#banner small{font:700 16px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.2em;color:#fff;text-shadow:0 2px 8px #000}
#banner.show{animation:banner 1.8s ease forwards}
@keyframes banner{0%{opacity:0;transform:translate(-50%,-50%) scale(1.7)}12%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%) scale(1)}}
#vignette{position:fixed;inset:0;z-index:55;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(190,10,10,.75) 100%)}
#death-screen{position:fixed;inset:0;z-index:58;pointer-events:none;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;
background:radial-gradient(ellipse at center,rgba(40,0,0,.15),rgba(30,0,0,.8));backdrop-filter:grayscale(.85) blur(1.5px);opacity:0;transition:opacity .5s}
#death-screen.show{opacity:1}
#death-screen .t{font:900 76px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.18em;color:#ff4a3c;text-shadow:0 4px 30px #000}
#death-screen .s{font:700 20px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.16em;color:#eee}
#death-screen .c{margin-top:14px;font:800 30px 'Barlow Condensed',Arial,sans-serif;color:#ffb487;letter-spacing:.1em}
#game-crosshair.hit{transform:translate(-50%,-50%) scale(1.6)!important}
#scope{position:fixed;inset:0;z-index:15;pointer-events:none;opacity:0;
background:linear-gradient(#000,#000) center/1px 62vmin no-repeat,linear-gradient(#000,#000) center/62vmin 1px no-repeat,
radial-gradient(circle at center,transparent 0,transparent 31vmin,#000 31.3vmin)}
#scoreboard{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;pointer-events:none;background:rgba(5,8,11,.55)}
#scoreboard.show{display:flex;animation:sb-in .2s ease}
#scoreboard.final{pointer-events:auto;background:rgba(5,8,11,.82);backdrop-filter:blur(4px)}
@keyframes sb-in{from{opacity:0}to{opacity:1}}
.sb-panel{width:min(94vw,680px);background:linear-gradient(145deg,rgba(35,46,54,.97),rgba(13,19,24,.98));border:1px solid #45545d;border-top:3px solid #f07845;padding:26px 30px;text-align:center;box-shadow:0 25px 90px #000a}
.sb-title{font:900 58px/1 'Barlow Condensed',Arial,sans-serif;letter-spacing:.16em}
.sb-title.win{color:#7fe08a}.sb-title.lose{color:#ff5a4a}.sb-title.draw{color:#ffc46b}.sb-title.info{color:#eef1f2}
.sb-sub{font:700 15px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.2em;color:#9caab2;margin:6px 0 20px}
.sb-panel table{width:100%;border-collapse:collapse;font:700 20px 'Barlow Condensed',Arial,sans-serif}
.sb-panel th{font-size:12px;letter-spacing:.18em;color:#8a98a0;padding:6px 10px;text-align:center;border-bottom:1px solid #46545b}
.sb-panel td{padding:12px 10px;text-align:center;border-bottom:1px solid #2a363d;font-variant-numeric:tabular-nums}
.sb-panel td:nth-child(2),.sb-panel th:nth-child(2){text-align:left}
.sb-panel tr.me td{background:rgba(240,120,69,.14);color:#ffb487}
.sb-panel tr.top td:nth-child(3){color:#7fe08a}
.sb-panel em{font:800 10px Inter,Arial,sans-serif;letter-spacing:.14em;background:#f07845;color:#10151a;padding:2px 6px;margin-left:8px;font-style:normal}
.sb-hint{margin-top:16px;font:600 11px Inter,Arial,sans-serif;letter-spacing:.16em;color:#7d8b92}
#sb-menu{margin-top:24px;width:100%}
.sb-actions{display:flex;gap:10px;margin-top:22px}
.sb-actions>button,.sb-replay-actions button{flex:1;min-width:0}
.sb-replay-actions{display:flex;flex:1;gap:10px}
.sb-actions #sb-menu{width:auto;margin-top:0}
.sb-scroll{max-height:56vh;overflow-y:auto}
.sb-panel.compact td{padding:5px 10px;font-size:16px}
.sb-panel.compact .sb-title{font-size:44px}
.sb-panel tr.gone td{opacity:.4}
.sb-panel em.gone{background:#46545b;color:#cfd8dc}
#flag-hud{position:fixed;top:92px;left:50%;transform:translateX(-50%);z-index:50;width:min(86vw,340px);text-align:center;pointer-events:none;display:none}
#flag-hud .fh-status{font:800 15px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.16em;color:#fff;text-shadow:0 2px 8px #000}
#flag-hud.mine .fh-status{color:#7fe08a}
#flag-hud.contested .fh-status{color:#ff6a5a}
#flag-hud .fh-bar{height:8px;margin:6px 0;background:rgba(10,15,20,.8);border:1px solid #45545d;overflow:hidden}
#flag-hud .fh-bar i{display:block;height:100%;width:0;background:#f07845;transition:width .15s linear}
#flag-hud .fh-meta{display:flex;justify-content:space-between;font:700 13px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.1em;color:#cfd8dc;text-shadow:0 2px 6px #000}`;

export class Game {
  constructor(canvas, network) {
    this.canvas = canvas;
    this.network = network;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 150);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera); // indispensable pour afficher l'arme en vue subjective

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.world = new World(this.scene);
    this.controller = new PlayerController(this.camera, canvas, this.world);
    this.weapon = new WeaponSystem();
    this.hud = new HUD();
    this.timer = new THREE.Clock();

    this.active = false;
    this.host = false;
    this.me = 0;
    this.names = [];          // names[id] = pseudo ou null
    this.appearances = [];
    this.ids = [];            // ids des joueurs encore présents
    this.roster = [];         // ids de tous les joueurs du début de partie (scoreboard)
    this.gone = new Set();    // ids des joueurs partis
    this.remotes = new Map(); // id -> { id, ch, r (affiché), n (réseau), ... }

    this.resetArrays();
    this.elapsed = 0;
    this.clockValue = 0;
    this.config = null;
    this.over = false;
    this.forfeit = false;
    this.endAt = 0;
    this.replayVotes = new Set();

    this.fx = [];
    this.death = null;
    this.timeScale = 1;
    this.slowUntil = 0;
    this.shake = 0;
    this.fovPunch = 0;
    this.moveSpeed = 0;
    this.lastPos = { x: 0, z: 0 };
    this.bobT = 0;
    this.reloadK = 0;
    this.ads = 0;
    this.finalShown = false;
    this.sbHeld = false;
    this.weaponRecoil = 0;
    this.knifeSwing = 0;
    this.hitmarkerUntil = 0;
    this.netAcc = 0;
    this.gamepad = new GamepadState();

    this.buildWeaponView();
    this.buildCrosshair();
    this.buildUI();
    this.bindNetwork();
    this.bindKeys();

    addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => {
      document.querySelector('#lock-hint')?.classList.toggle('hidden', document.pointerLockElement === this.canvas);
    });

    this.animate();
  }

  resetArrays() {
    const arr = f => Array.from({ length: MAX_PLAYERS }, f);
    this.hp = arr(() => 100);
    this.dead = arr(() => false);
    this.invuln = arr(() => 0);
    this.pending = arr(() => null);
    this.lastSpawn = arr(() => null);
    this.score = arr(() => 0);
    this.stats = arr(() => ({ d: 0, h: 0 }));
    this.capture = arr(() => 0); // % de capture du drapeau, propre à chaque joueur
    this.zone = -1;              // id du joueur seul sur le drapeau, -1 = vide, -2 = contesté
  }

  nameOf(id) { return this.names[id] || 'Joueur'; }

  // ============ CONSTRUCTION DE LA SCÈNE ============

  /** Crée le modèle 3D d'un adversaire (un par joueur distant). */
  addRemote(id, spawn) {
    const ch = createCharacter({
      shirt: SHIRT_COLORS[id % SHIRT_COLORS.length],
      label: this.nameOf(id),
      appearance: this.appearances[id]
    });
    this.scene.add(ch.group);
    ch.group.position.set(spawn.x, 0, spawn.z);
    ch.group.rotation.y = spawn.yaw;
    const r = { x: spawn.x, y: 0, z: spawn.z, yaw: spawn.yaw, pitch: 0, crouch: false, w: 'rifle', aim: false };
    this.remotes.set(id, { id, ch, r, n: { ...r }, deadT: null });
  }

  removeRemote(id) {
    const rem = this.remotes.get(id);
    if (!rem) return;
    disposeCharacter(rem.ch);
    this.remotes.delete(id);
  }

  buildWeaponView() {
    const W = new THREE.Group();
    this.guns = {};
    for (const t of WEAPON_IDS) {
      this.guns[t] = gunModel(t);
      W.add(this.guns[t]);
    }
    const skin = new THREE.MeshStandardMaterial({ color: 0xc28e70, roughness: 0.85 });
    box(W, [0.19, 0.14, 0.24], skin, 0.19, -0.22, 0.08);
    box(W, [0.17, 0.13, 0.2], skin, -0.13, -0.16, -0.35);

    W.position.set(0.34, -0.31, -0.65);
    this.camera.add(W);
    this.weaponModel = W;

    this.muzzleFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xffbd50, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.muzzleFlash.rotation.x = -Math.PI / 2;
    this.muzzleFlash.position.set(0, 0.045, -0.98);
    W.add(this.muzzleFlash);

    this.muzzleLight = new THREE.PointLight(0xff9b35, 0, 6);
    this.muzzleLight.position.set(0, 0.05, -0.9);
    W.add(this.muzzleLight);
  }

  buildCrosshair() {
    const el = document.createElement('div');
    el.id = 'game-crosshair';
    el.innerHTML = '<span class="crosshair-line horizontal"></span><span class="crosshair-line vertical"></span><span class="crosshair-dot"></span>';
    Object.assign(el.style, {
      position: 'fixed', left: '50%', top: '50%', width: '22px', height: '22px',
      transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: '20', display: 'none',
      transition: 'transform .08s'
    });
    const style = document.createElement('style');
    style.textContent = `
      #game-crosshair .crosshair-line{position:absolute;display:block;background:#fff;border-radius:2px;box-shadow:0 0 3px #000}
      #game-crosshair .horizontal{width:7px;height:2px;top:10px;left:0}
      #game-crosshair .horizontal::after{content:'';position:absolute;left:15px;top:0;width:7px;height:2px;background:#fff;box-shadow:0 0 3px #000}
      #game-crosshair .vertical{width:2px;height:7px;left:10px;top:0}
      #game-crosshair .vertical::after{content:'';position:absolute;top:15px;left:0;width:2px;height:7px;background:#fff;box-shadow:0 0 3px #000}
      #game-crosshair .crosshair-dot{position:absolute;width:3px;height:3px;left:9.5px;top:9.5px;background:#ff693d;border-radius:50%}` + UI_CSS;
    document.head.appendChild(style);
    document.body.appendChild(el);
    this.crosshair = el;
  }

  buildUI() {
    const add = (id, html = '') => {
      const e = document.createElement('div');
      e.id = id;
      e.innerHTML = html;
      document.body.appendChild(e);
      return e;
    };
    this.feedEl = add('kill-feed');
    this.bannerEl = add('banner', '<b></b><small></small>');
    this.vignetteEl = add('vignette');
    this.scopeEl = add('scope');
    this.sbEl = add('scoreboard');
    this.flagEl = add('flag-hud', '<div class="fh-status"></div><div class="fh-bar"><i></i></div><div class="fh-meta"><span class="fh-me"></span><span class="fh-lead"></span></div>');
    this.deathEl = add('death-screen', '<div class="t">ÉLIMINÉ</div><div class="s"></div><div class="c"></div>');
  }

  // ============ AUDIO (synthétisé, aucun fichier) ============

  audio() { return (this.ac ??= new (window.AudioContext || window.webkitAudioContext)()); }

  beep(f, d, type = 'sine', v = 0.1) {
    try {
      const c = this.audio(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + d);
    } catch { /* audio indisponible */ }
  }

  bang(w, vol) {
    try {
      const c = this.audio(), n = (c.sampleRate * 0.3) | 0, b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
      const dec = { shotgun: 5, rifle: 11, sniper: 6 }[w] || 8;
      for (let i = 0; i < n; i++) a[i] = rnd() * Math.exp(-(i / n) * dec);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass';
      f.frequency.value = { shotgun: 900, rifle: 2400, sniper: 1700 }[w] || 2000;
      g.gain.value = vol;
      s.buffer = b; s.connect(f); f.connect(g); g.connect(c.destination);
      s.start();
    } catch { /* audio indisponible */ }
  }

  // ============ RÉSEAU ============
  // Topologie en étoile : l'hôte (id 0) est autoritaire. Les invités lui envoient leur position
  // (INPUT) et leurs tirs (EVENT shot) ; l'hôte diffuse l'état de TOUS les joueurs (STATE) et relaie
  // les tirs aux autres invités.

  bindNetwork() {
    const n = this.network;
    n.on(MSG.INPUT, d => { if (this.host) this.receiveInput(d); });
    n.on(MSG.STATE, d => { if (!this.host) this.applyState(d); });
    n.on(MSG.EVENT, d => {
      if (!this.active || !d) return;
      if (this.host) { if (d.kind === 'shot') this.hostReceiveShot(d.from, d.shot); }
      else this.handleEvent(d);
    });
    n.on(MSG.GAMEOVER, d => {
      if (this.host || !this.active) return;
      if (Array.isArray(d.score)) this.score = d.score;
      if (Array.isArray(d.stats)) this.stats = d.stats;
      if (Array.isArray(d.cap)) this.capture = d.cap;
      this.finish(d.reason || 'Fin de partie', '', d.winner ?? -1);
    });
    n.on('peer-left', d => this.playerLeft(d.id));
    n.on('disconnected', () => {
      if (this.active && !this.host) this.finish('Connexion perdue avec l’hôte', 'CONNEXION PERDUE', -2);
    });
  }

  snap() {
    return {
      ...this.controller.snapshot(),
      crouch: this.controller.crouched,
      w: this.weapon.current,
      aim: this.controller.aiming
    };
  }

  /** Hôte : reçoit la position d'un invité. */
  receiveInput(d) {
    const rem = this.remotes.get(d.from);
    if (!rem || !validPos(d.input)) return;
    Object.assign(rem.n, decode(d.input));
  }

  /** Invité : reçoit l'état autoritaire (vie, scores, positions de tous les joueurs). */
  applyState({ state: s }) {
    if (!s || !this.active) return;
    this.hp = s.hp;
    this.score = s.score;
    this.dead = s.dead;
    this.clockValue = s.time;
    if (Array.isArray(s.cap)) this.capture = s.cap;
    if (Number.isFinite(s.zone)) this.zone = s.zone;
    for (const [id, a] of Object.entries(s.pos || {})) {
      const i = +id;
      if (i === this.me || !validPos(a)) continue;
      const rem = this.remotes.get(i);
      if (rem) Object.assign(rem.n, decode(a));
    }
  }

  /** Hôte : applique localement ET diffuse un événement. */
  emit(ev) {
    this.network.send(MSG.EVENT, ev);
    this.handleEvent(ev);
  }

  handleEvent(ev) {
    if (!this.active || !ev) return;
    switch (ev.kind) {
      case 'shot':
        if (ev.shooter !== this.me && validShot(ev.shot)) this.renderShot(ev.shot, false);
        break;
      case 'hit': this.onHit(ev); break;
      case 'kill': this.onKill(ev); break;
      case 'respawn': this.onRespawn(ev); break;
      case 'left': this.onLeft(ev); break;
    }
  }

  /** Hôte : un invité s'est déconnecté pendant la partie. */
  playerLeft(id) {
    if (!this.active || !this.host || !this.ids.includes(id)) return;
    this.dead[id] = true;
    this.pending[id] = null;
    this.emit({ kind: 'left', who: id });
    if (this.ids.length < 2 && !this.over) {
      this.over = true;
      this.forfeit = true;
      this.endAt = performance.now() + 500;
    }
  }

  onLeft(ev) {
    const name = this.nameOf(ev.who);
    this.removeRemote(ev.who);
    this.ids = this.ids.filter(i => i !== ev.who);
    this.gone.add(ev.who);
    this.dead[ev.who] = true;
    this.addFeed(`${name} a quitté la partie`, '');
  }

  // ============ DÉMARRAGE ============

  /** names[id] = pseudo (null si absent). `me` = mon id réseau (0 = hôte). */
  start(config, me, names, appearances = []) {
    this.world.dispose();
    this.world = new World(this.scene, config.map || this.world.map.id);
    this.controller.world = this.world;
    this.config = { ...config, map: this.world.map.id, gameMode: config.gameMode === 'flag' ? 'flag' : 'deathmatch' };
    this.host = this.network.isHost;
    this.me = me;
    this.names = (names || []).map(n => n ?? null);
    this.appearances = (appearances || []).map(appearance =>
      appearance ? normalizeAppearance(appearance) : null
    );
    this.ids = this.names.map((n, i) => (n != null ? i : -1)).filter(i => i >= 0);
    this.roster = this.ids.slice();
    this.gone = new Set();

    this.resetArrays();
    this.buildFlag();
    this.elapsed = 0;
    this.clockValue = config.mode === 'time' ? config.duration : 0;
    this.over = false;
    this.forfeit = false;
    this.endAt = 0;
    this.replayVotes.clear();
    this.finalShown = false;
    this.hideScoreboard();
    this.death = null;
    this.timeScale = 1;
    this.netAcc = 0;

    this.fx.forEach(f => this.disposeFx(f));
    this.fx = [];
    this.feedEl.innerHTML = '';
    this.deathEl.classList.remove('show');
    this.deathEl.style.display = 'none';

    // Spawns initiaux déterministes : tous les clients calculent la même chose.
    const spawnOf = id => this.world.spawns[this.ids.indexOf(id) % this.world.spawns.length];

    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    for (const id of this.ids) if (id !== this.me) this.addRemote(id, spawnOf(id));

    const mine = spawnOf(this.me);
    this.controller.position = { x: mine.x, y: 0, z: mine.z };
    this.controller.yaw = mine.yaw;
    this.controller.pitch = 0;
    this.controller.velocityY = 0;
    this.controller.firing = false;
    this.controller.aiming = false;
    this.ads = 0;
    this.controller.enabled = true;
    this.lastPos = { x: mine.x, z: mine.z };
    this.weaponModel.visible = true;

    this.weapon.reset();
    this.knifeSwing = 0;
    this.chooseWeapon(config.weapon === 'all' ? 'rifle' : config.weapon, true);

    document.querySelector('#menu')?.classList.add('hidden');
    document.querySelector('#lobby')?.classList.add('hidden');
    document.querySelector('#game')?.classList.remove('hidden');
    document.querySelector('#hud .crosshair')?.remove(); // un seul viseur
    const mode = document.querySelector('#match-mode');
    if (mode) mode.textContent = this.isFlag() ? 'CAPTURE DU DRAPEAU' : config.mode === 'time' ? 'MEILLEUR SCORE' : `PREMIER À ${config.target}`;

    this.hud.show();
    this.hud.clearMessage();
    if (this.isFlag()) this.hud.message('Seul sur le drapeau au centre, tu captures. À plusieurs, plus personne ne progresse.');
    document.querySelector('#lock-hint')?.classList.remove('hidden');
    this.crosshair.style.display = 'block';
    this.active = true;
    progress.startMatch();
    this.updateHUD();
  }

  bindKeys() {
    document.addEventListener('keydown', e => {
      if (!this.active || this.death) return;
      const keys = settings.data.keys;
      if (e.code === keys.weapon1) this.chooseWeapon('shotgun');
      if (e.code === keys.weapon2) this.chooseWeapon('rifle');
      if (e.code === keys.weapon3) this.chooseWeapon('sniper');
      if (e.code === keys.weapon4) this.chooseWeapon('knife');
      if (e.code === keys.reload) this.weapon.reload();
    });
    document.addEventListener('wheel', e => {
      if (!this.active || this.death || document.pointerLockElement !== this.canvas) return;

      const available = this.config.weapon === 'all'
        ? ['shotgun', 'rifle', 'sniper', 'knife']
        : [this.config.weapon, 'knife'];
      const current = available.indexOf(this.weapon.current);
      const direction = e.deltaY > 0 ? 1 : -1;
      const next = (current + direction + available.length) % available.length;

      e.preventDefault();
      this.chooseWeapon(available[next]);
    }, { passive: false });
    this.controller.onShoot = () => this.shoot();

    // Tab maintenu : scoreboard en cours de partie
    document.addEventListener('keydown', e => {
      if (e.code !== 'Tab') return;
      e.preventDefault();
      if (this.active) this.sbHeld = true;
    });
    document.addEventListener('keyup', e => {
      if (e.code !== 'Tab' || this.finalShown) return;
      this.sbHeld = false;
      this.hideScoreboard();
    });
  }

  chooseWeapon(name, force = false) {
    if (!force && name !== 'knife' && this.config.weapon !== 'all' && this.config.weapon !== name) return;
    this.weapon.select(name);
    this.controller.weapon = name; // synchronise cadence et dégâts côté contrôleur
  }

  // ============ TIR ============

  shoot() {
    if (!this.active || this.death) return;
    if (!this.weapon.consume()) return;

    const w = this.weapon.current;
    const { yaw, pitch } = this.controller;
    const base = V(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const moving = this.moveSpeed > 0.8, air = !this.controller.grounded, a = this.ads > 0.6;
    const hip = { shotgun: 0.03, rifle: 0.012, sniper: 0.05 }[w] ?? 0;
    const aim = { shotgun: 0.01, rifle: 0.002, sniper: 0 }[w] ?? 0;
    const movingSpread = { shotgun: 0.006, rifle: 0.02, sniper: a ? 0.03 : 0.06 }[w] ?? 0;
    const spread = (a ? aim : hip) + (moving ? movingSpread : 0) + (air && w !== 'knife' ? 0.04 : 0);
    const n = w === 'shotgun' ? 8 : 1;
    // Plombs répartis dans un petit disque autour du curseur (1er plomb au centre)
    const right = V(Math.cos(yaw), 0, -Math.sin(yaw)), up = new THREE.Vector3().crossVectors(right, base).normalize();
    const o = this.camera.position;
    const dirs = [];
    for (let i = 0; i < n; i++) {
      const r = i === 0 ? 0 : Math.sqrt(Math.random()) * spread, t = Math.random() * Math.PI * 2;
      const d = base.clone().addScaledVector(right, Math.cos(t) * r).addScaledVector(up, Math.sin(t) * r).normalize();
      dirs.push([d.x, d.y, d.z]);
    }
    const shot = { weapon: w, o: [o.x, o.y, o.z], d: dirs };

    if (w === 'knife') this.knifeSwing = 1;
    this.renderShot(shot, true);

    if (w !== 'knife') {
      const kick = { shotgun: 0.05, rifle: 0.009, sniper: 0.06 }[w] * (a ? 0.6 : 1);
      this.controller.pitch += kick;
      this.controller.yaw += rnd() * kick * 0.5;
      this.weaponRecoil = 1;
      this.muzzleFlash.material.opacity = 1;
      this.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.7);
      this.muzzleLight.intensity = 8;
      this.bang(w, 0.35);
    }

    if (this.host) {
      this.relayShot(this.me, shot);
      this.resolveShot(this.me, shot);
    } else {
      this.network.send(MSG.EVENT, { kind: 'shot', shot });
    }
  }

  /** Hôte : reçoit le tir d'un invité, l'affiche, le résout, le relaie aux autres. */
  hostReceiveShot(from, shot) {
    if (!this.remotes.has(from) || !validShot(shot)) return;
    this.renderShot(shot, false);
    this.relayShot(from, shot);
    this.resolveShot(from, shot);
  }

  /** Hôte : envoie le tir de `shooter` à tous les invités sauf lui-même. */
  relayShot(shooter, shot) {
    for (const id of this.ids) {
      if (id === 0 || id === shooter) continue;
      this.network.sendTo(id, MSG.EVENT, { kind: 'shot', shot, shooter });
    }
  }

  /** Effets visuels/sonores d'un tir (le mien ou celui d'un adversaire). */
  renderShot(shot, mine) {
    if (shot.weapon === 'knife') return;
    const o = V(...shot.o), range = WEAPONS[shot.weapon]?.range ?? 30;
    const first = V(...shot.d[0]);
    let muzzle;
    if (mine) {
      muzzle = V(0, 0, 0);
      this.muzzleFlash.getWorldPosition(muzzle);
    } else {
      muzzle = o.clone().addScaledVector(first, 0.8).add(V(0, -0.25, 0));
      const dist = o.distanceTo(this.camera.position);
      this.bang(shot.weapon, Math.max(0, 0.3 * (1 - dist / 55)));
    }
    for (const a of shot.d) {
      const dir = V(...a).normalize();
      const wall = this.world.rayDistance(o, dir, range);
      const end = o.clone().addScaledVector(dir, Math.min(wall, range));
      this.tracer(muzzle, end, mine);
      if (wall < range) this.wallImpact(end, dir);
    }
  }

  tracer(a, b, mine) {
    const len = a.distanceTo(b);
    if (len < 0.1) return;
    const m = new THREE.Mesh(G_CYL, new THREE.MeshBasicMaterial({
      color: 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    const r = mine ? 0.012 : 0.02;
    m.scale.set(r, len, r);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    this.addFx(m, 0.09, (f, dt, k) => { f.obj.material.opacity = 1 - k; }, true);
  }

  wallImpact(p, dir) {
    this.burst(p, M_SPARK, 4, 3, 0.25, 0.018);
    this.burst(p, M_DUST, 3, 1.2, 0.5, 0.04);
    const h = new THREE.Mesh(G_HOLE, M_HOLE);
    h.position.copy(p).addScaledVector(dir, -0.02);
    h.lookAt(p.clone().sub(dir));
    this.addFx(h, 10, null, false);
  }

  burst(p, mat, count, speed, life, size = 0.035) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(G_SPH, mat);
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      m.position.copy(p);
      const v = V(rnd(), Math.abs(rnd()) + 0.3, rnd()).multiplyScalar(speed);
      this.addFx(m, life * (0.6 + Math.random() * 0.6), (f, dt) => {
        v.y -= 9 * dt;
        f.obj.position.addScaledVector(v, dt);
        f.obj.scale.multiplyScalar(1 - dt * 2);
      }, false);
    }
  }

  addFx(obj, life, upd, own) {
    this.scene.add(obj);
    this.fx.push({ obj, life, max: life, upd, own });
  }

  disposeFx(f) {
    this.scene.remove(f.obj);
    if (f.own) {
      f.obj.material?.map?.dispose();
      f.obj.material?.dispose();
    }
  }

  updateFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      f.upd?.(f, dt, 1 - f.life / f.max);
      if (f.life <= 0) {
        this.disposeFx(f);
        this.fx.splice(i, 1);
      }
    }
    if (this.hitmarkerUntil && performance.now() > this.hitmarkerUntil) {
      this.crosshair.classList.remove('hit');
      this.crosshair.style.filter = '';
      this.hitmarkerUntil = 0;
    }
  }

  // ============ LOGIQUE AUTORITAIRE (HÔTE) ============

  posOf(i) {
    if (i === this.me) {
      const p = this.controller.position;
      return { x: p.x, y: p.y, z: p.z, crouch: this.controller.crouched };
    }
    return this.remotes.get(i)?.n ?? { x: 999, y: 0, z: 999, crouch: false };
  }

  resolveShot(shooter, shot) {
    const now = performance.now();
    if (this.over || this.dead[shooter]) return;
    const st = WEAPONS[shot.weapon];
    if (!st || !shot.d?.length) return;

    const o = V(...shot.o), per = st.damage / shot.d.length, tmp = V(0, 0, 0);

    // Cibles potentielles : tous les autres joueurs vivants et non protégés.
    const targets = [];
    for (const v of this.ids) {
      if (v === shooter || this.dead[v] || this.invuln[v] > now) continue;
      const p = this.posOf(v), y = p.y || 0, s = p.crouch ? 0.78 : 1;
      targets.push({
        v,
        body: new THREE.Box3(V(p.x - 0.34, y, p.z - 0.34), V(p.x + 0.34, y + 1.5 * s, p.z + 0.34)),
        head: new THREE.Sphere(V(p.x, y + 1.74 * s, p.z), 0.27)
      });
    }
    if (!targets.length) return;

    const acc = new Map(); // victime -> { dmg, head, p }
    for (const a of shot.d.slice(0, 10)) {
      const dir = V(...a).normalize(), ray = new THREE.Ray(o, dir);
      const wall = this.world.rayDistance(o, dir, st.range);
      let best = null;
      for (const tg of targets) {
        let t = Infinity, isHead = false, hp = null;
        if (ray.intersectSphere(tg.head, tmp)) { t = o.distanceTo(tmp); isHead = true; hp = tmp.clone(); }
        if (ray.intersectBox(tg.body, tmp)) {
          const tb = o.distanceTo(tmp);
          if (tb < t) { t = tb; isHead = false; hp = tmp.clone(); }
        }
        if (t < wall && t <= st.range && (!best || t < best.t)) best = { v: tg.v, t, isHead, hp };
      }
      if (!best) continue;
      let k = best.isHead ? 2 : 1;
      if (shot.weapon === 'shotgun') k *= 1 - 0.6 * (best.t / st.range);
      const e = acc.get(best.v) ?? { dmg: 0, head: false, p: null };
      e.dmg += per * k;
      e.head ||= best.isHead;
      e.p = best.hp;
      acc.set(best.v, e);
    }

    for (const [v, e] of acc) {
      const dmg = Math.round(e.dmg);
      if (dmg > 0 && !this.dead[v]) this.applyDamage(shooter, v, dmg, e.head, shot.weapon, e.p);
    }
  }

  applyDamage(shooter, victim, dmg, head, weapon, p) {
    this.hp[victim] = Math.max(0, this.hp[victim] - dmg);
    this.emit({ kind: 'hit', shooter, victim, damage: dmg, head, hp: this.hp[victim], p: [p.x, p.y, p.z] });
    if (this.hp[victim] <= 0) this.kill(shooter, victim, weapon, head);
  }

  kill(killer, victim, weapon, head) {
    this.score[killer]++;
    this.dead[victim] = true;

    // Respawn aléatoire, loin de TOUS les autres joueurs vivants (anti spawn-kill)
    const others = this.ids.filter(i => i !== victim && !this.dead[i]).map(i => this.posOf(i));
    const spawn = this.world.pickSpawn(others, this.lastSpawn[victim]);
    this.lastSpawn[victim] = spawn;
    this.pending[victim] = { spawn, at: performance.now() + RESPAWN_TIME * 1000 };

    const kp = this.posOf(killer);
    this.emit({ kind: 'kill', killer, victim, weapon, head, score: this.score.slice(), kx: kp.x, kz: kp.z });

    if (!this.isFlag() && this.config.mode === 'kills' && this.score[killer] >= this.config.target && !this.over) {
      this.over = true;
      this.endAt = performance.now() + 2800;
    }
  }

  hostTick(raw, now) {
    this.elapsed += raw;
    this.clockValue = this.config.mode === 'time' ? Math.max(0, this.config.duration - this.elapsed) : this.elapsed;

    if (!this.over && this.config.mode === 'time' && this.clockValue <= 0) {
      this.over = true;
      this.endAt = now + 300;
    }
    if (this.over && this.endAt && now > this.endAt) {
      this.endAt = 0;
      this.end(this.verdict());
      return;
    }

    if (!this.over && this.isFlag()) this.flagTick(raw, now);

    if (!this.over) {
      for (const i of this.ids) {
        const pend = this.pending[i];
        if (this.dead[i] && pend && now >= pend.at) {
          this.pending[i] = null;
          this.dead[i] = false;
          this.hp[i] = 100;
          this.invuln[i] = now + SPAWN_PROTECTION;
          this.emit({ kind: 'respawn', who: i, x: pend.spawn.x, z: pend.spawn.z, yaw: pend.spawn.yaw });
        }
      }
    }
  }

  verdict() {
    if (this.forfeit) {
      return { reason: 'Victoire par forfait', winner: this.ids[0] ?? this.me };
    }
    if (this.isFlag()) {
      const best = Math.max(...this.ids.map(i => this.capture[i]));
      const first = this.ids.filter(i => this.capture[i] === best);
      if (best <= 0 || first.length > 1) return { reason: 'Égalité', winner: -1 };
      const name = this.nameOf(first[0]);
      return {
        reason: best >= 100 ? `${name} a capturé le drapeau` : `Victoire de ${name} (${Math.floor(best)} % de capture)`,
        winner: first[0]
      };
    }
    const top = Math.max(...this.ids.map(i => this.score[i]));
    const leaders = this.ids.filter(i => this.score[i] === top);
    if (leaders.length > 1) return { reason: 'Égalité', winner: -1 };
    return { reason: `Victoire de ${this.nameOf(leaders[0])}`, winner: leaders[0] };
  }

  // ============ ÉVÉNEMENTS (HÔTE + INVITÉS) ============

  onHit(ev) {
    this.hp[ev.victim] = ev.hp;
    const p = V(...ev.p);
    this.burst(p, M_BLOOD, ev.head ? 14 : 8, 3, 0.5, 0.04);
    if (ev.victim === this.me) {
      this.hud.showDamage(ev.damage);
      this.flashVignette();
      this.shake = 0.03;
      this.beep(110, 0.18, 'sawtooth', 0.15);
    } else if (ev.shooter === this.me) {
      this.showHitmarker(ev.head);
      this.damageSprite(ev.damage, ev.head, p);
      this.beep(ev.head ? 1500 : 950, 0.06, 'square', 0.07);
    }
  }

  addFeed(text, cls) {
    const item = document.createElement('div');
    item.className = 'feed-item' + (cls ? ' ' + cls : '');
    item.textContent = text;
    this.feedEl.appendChild(item);
    setTimeout(() => item.remove(), 5000);
    while (this.feedEl.children.length > 5) this.feedEl.firstChild.remove();
  }

  onKill(ev) {
    this.score = ev.score;
    this.dead[ev.victim] = true;
    this.stats[ev.victim].d++;
    if (ev.head) this.stats[ev.killer].h++;
    if (ev.killer === this.me) progress.record({ type: 'kill', weapon: ev.weapon, head: !!ev.head });
    if (ev.victim === this.me) progress.record({ type: 'death' });
    const nm = i => this.nameOf(i);

    this.addFeed(
      `${nm(ev.killer)}  ▸  ${WEAPONS[ev.weapon]?.label ?? ''}${ev.head ? '  ⌖' : ''}  ▸  ${nm(ev.victim)}`,
      ev.killer === this.me ? 'mine' : ev.victim === this.me ? 'victim' : ''
    );

    if (ev.victim === this.me) {
      this.startDeath(ev, nm(ev.killer));
      return;
    }

    // L'adversaire s'effondre
    const rem = this.remotes.get(ev.victim);
    if (rem) {
      rem.deadT = 0;
      this.burst(V(rem.r.x, 1.2, rem.r.z), M_BLOOD, 26, 4, 0.8, 0.05);
    }
    // Scène d'élimination (ralenti + zoom) seulement pour mon propre kill
    if (ev.killer === this.me) {
      this.banner(ev.head ? 'TIR À LA TÊTE' : 'ÉLIMINATION', `${nm(ev.victim)} · ${WEAPONS[ev.weapon]?.label ?? ''}`);
      this.timeScale = 0.3;
      this.slowUntil = performance.now() + 450;
      this.fovPunch = -10;
      this.beep(660, 0.12, 'triangle', 0.12);
      setTimeout(() => this.beep(990, 0.18, 'triangle', 0.12), 110);
    }
  }

  onRespawn(ev) {
    this.dead[ev.who] = false;
    this.hp[ev.who] = 100;
    if (ev.who === this.me) {
      this.death = null;
      this.deathEl.classList.remove('show');
      setTimeout(() => { if (!this.death) this.deathEl.style.display = 'none'; }, 500);
      const c = this.controller;
      c.position = { x: ev.x, y: 0, z: ev.z };
      c.yaw = ev.yaw;
      c.pitch = 0;
      c.velocityY = 0;
      c.enabled = true;
      this.weaponModel.visible = true;
      this.weapon.reset();
      this.lastPos = { x: ev.x, z: ev.z };
      this.crosshair.style.display = 'block';
    } else {
      const rem = this.remotes.get(ev.who);
      if (!rem) return;
      rem.deadT = null;
      rem.ch.group.rotation.x = 0;
      rem.ch.group.position.y = 0;
      Object.assign(rem.r, { x: ev.x, y: 0, z: ev.z, yaw: ev.yaw });
      Object.assign(rem.n, { x: ev.x, y: 0, z: ev.z, yaw: ev.yaw });
    }
  }

  startDeath(ev, killerName) {
    const p = this.controller.position;
    this.controller.enabled = false;
    this.controller.firing = false;
    this.controller.aiming = false;
    this.crosshair.style.display = 'none';
    this.death = {
      t: 0,
      sy: this.camera.position.y,
      sp: this.controller.pitch,
      yaw: this.controller.yaw,
      ty: Math.atan2(-(ev.kx - p.x), -(ev.kz - p.z)), // se tourne vers le tueur
      end: performance.now() + RESPAWN_TIME * 1000
    };
    this.deathEl.style.display = 'flex';
    void this.deathEl.offsetWidth;
    this.deathEl.classList.add('show');
    this.deathEl.querySelector('.s').textContent = `PAR ${killerName.toUpperCase()} · ${WEAPONS[ev.weapon]?.label ?? ''}${ev.head ? ' · TÊTE' : ''}`;
    this.beep(90, 0.5, 'sawtooth', 0.18);
  }

  updateDeathCam(dt) {
    const d = this.death, p = this.controller.position;
    d.t += dt;
    const k = ease(d.t / 0.7);
    this.camera.position.set(p.x, lerp(d.sy, 0.3, k), p.z);
    this.camera.rotation.set(lerp(d.sp, -0.2, k), lerpAngle(d.yaw, d.ty, k * 0.85), k * 0.9);
    const left = Math.max(0, Math.ceil((d.end - performance.now()) / 1000));
    this.deathEl.querySelector('.c').textContent = `RÉAPPARITION DANS ${left}`;
  }

  // ============ EFFETS UI ============

  banner(title, sub) {
    const b = this.bannerEl;
    b.querySelector('b').textContent = title;
    b.querySelector('small').textContent = sub;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  flashVignette() {
    const v = this.vignetteEl;
    v.style.transition = 'none';
    v.style.opacity = 1;
    void v.offsetWidth;
    v.style.transition = 'opacity .7s ease-out';
    v.style.opacity = 0;
  }

  showHitmarker(head) {
    this.crosshair.classList.add('hit');
    this.crosshair.style.filter = `drop-shadow(0 0 7px ${head ? '#ff2a1a' : '#ffffff'})`;
    this.hitmarkerUntil = performance.now() + 130;
  }

  damageSprite(amount, head, pos) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.font = 'bold 72px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.strokeStyle = '#2a0c08';
    g.strokeText(`-${amount}`, 128, 64);
    g.fillStyle = head ? '#ffd23a' : '#ff6246';
    g.fillText(`-${amount}`, 128, 64);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false
    }));
    s.position.set(pos.x + rnd() * 0.3, Math.max(pos.y, 1.2) + 0.5, pos.z + rnd() * 0.3);
    s.scale.set(1.1, 0.55, 1);
    this.addFx(s, 0.9, (f, dt, k) => {
      f.obj.position.y += dt * 0.8;
      f.obj.material.opacity = 1 - k * k;
    }, true);
  }

  // ============ ANIMATIONS ============

  updateRemotes(dt) {
    const k = 1 - Math.exp(-dt * 18);
    for (const rem of this.remotes.values()) {
      const { r, n, ch } = rem, m = ch.group;
      const px = r.x, pz = r.z;
      r.x = lerp(r.x, n.x, k);
      r.y = lerp(r.y, n.y || 0, k);
      r.z = lerp(r.z, n.z, k);
      r.yaw = lerpAngle(r.yaw, n.yaw || 0, k);
      r.pitch = lerp(r.pitch, n.pitch || 0, k);
      r.crouch = !!n.crouch;

      m.position.x = r.x; m.position.z = r.z;
      m.rotation.y = r.yaw;

      if (rem.deadT !== null) {
        // Allongé sur le dos : le corps repose sur le sol (pas dedans).
        rem.deadT += dt;
        const f = ease(rem.deadT / 0.5);
        m.rotation.x = f * (Math.PI / 2);
        m.position.y = 0.3 * f;
        if (ch.label) ch.label.visible = false;
        continue;
      }
      if (ch.label) ch.label.visible = !this.dead[rem.id];
      m.rotation.x = 0;
      m.position.y = Math.max(0, r.y); // les pieds ne passent jamais sous le sol
      m.scale.y = lerp(m.scale.y, r.crouch ? 0.78 : 1, k);
      showGun(ch, n.w || 'rifle');
      const speed = dt > 0 ? Math.hypot(r.x - px, r.z - pz) / dt : 0;
      animateCharacter(ch, dt, {
        speed,
        aiming: !!n.aim && n.w !== 'knife',
        pitch: r.pitch,
        crouched: r.crouch
      });
    }
  }

  updateWeaponAnimation(dt) {
    const W = this.weaponModel;
    this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 8);
    const r = this.weaponRecoil;
    this.knifeSwing = Math.max(0, this.knifeSwing - dt / 0.32);
    const swing = this.weapon.current === 'knife'
      ? Math.sin((1 - this.knifeSwing) * Math.PI)
      : 0;

    this.bobT += dt * Math.min(this.moveSpeed, 9) * 1.5;
    const mv = Math.min(1, this.moveSpeed / 5);
    const reload = this.weapon.isReloading() ? 1 : 0;
    this.reloadK = lerp(this.reloadK, reload, Math.min(1, dt * 9));

    const a = this.ads, cur = this.weapon.current;
    for (const t in this.guns) this.guns[t].visible = t === cur;
    W.visible = !this.death && !(cur === 'sniper' && a > 0.6);
    const mz = this.guns[cur].userData.muzzle;
    if (mz != null) {
      this.muzzleFlash.position.z = mz - 0.05;
      this.muzzleLight.position.z = mz + 0.1;
    }
    const bob = (1 - a) * mv;
    W.position.set(
      lerp(0.34, 0, a) + Math.sin(this.bobT) * 0.008 * bob + swing * 0.12,
      lerp(-0.31, -0.26, a) - r * 0.06 - this.reloadK * 0.22 + Math.abs(Math.cos(this.bobT)) * 0.008 * bob,
      lerp(-0.65, -0.55, a) + r * 0.12
    );
    W.rotation.set(-0.035 * (1 - a) + r * 0.1 - this.reloadK * 0.5 + swing * 0.45, -0.045 * (1 - a), (-0.025 + this.reloadK * 0.5) * (1 - a) - swing * 1.1);

    this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - dt * 16);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 60);
  }

  // ============ MODE CAPTURE DU DRAPEAU ============

  isFlag() { return this.config?.gameMode === 'flag'; }

  inZone(p) {
    return Math.hypot(p.x - FLAG.x, p.z - FLAG.z) <= FLAG.radius && (p.y || 0) < 2.5;
  }

  /**
   * Hôte : seul un joueur vivant, SEUL dans la zone, progresse. À plusieurs, rien ne bouge pour personne.
   * Chaque joueur garde son propre pourcentage : personne ne peut le vider.
   */
  flagTick(dt, now) {
    const inside = this.ids.filter(i => !this.dead[i] && this.inZone(this.posOf(i)));
    this.zone = inside.length === 1 ? inside[0] : inside.length ? -2 : -1;
    if (this.zone < 0) return;
    const id = this.zone;
    this.capture[id] = Math.min(100, this.capture[id] + dt / FLAG.seconds * 100);
    if (this.capture[id] >= 100) {
      this.over = true;
      this.endAt = now + 2000;
    }
  }

  buildFlag() {
    this.disposeFlag();
    if (!this.isFlag()) return;

    const group = new THREE.Group();
    group.position.set(FLAG.x, 0, FLAG.z);

    const zoneMat = () => new THREE.MeshBasicMaterial({ color: 0xcfc9b8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(FLAG.radius - 0.15, FLAG.radius, 64), zoneMat());
    const disc = new THREE.Mesh(new THREE.CircleGeometry(FLAG.radius - 0.15, 64), zoneMat());
    for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2; group.add(m); }
    ring.position.y = 0.035;
    disc.position.y = 0.03;
    disc.material.opacity = 0.1;

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xb8c0c6, metalness: 0.7, roughness: 0.35 })
    );
    pole.position.y = 2.1;
    group.add(pole);

    const clothGeo = new THREE.PlaneGeometry(1.5, 0.9);
    clothGeo.translate(0.75, 0, 0); // pivot sur le mât
    const cloth = new THREE.Mesh(clothGeo, new THREE.MeshBasicMaterial({ color: 0xcfc9b8, side: THREE.DoubleSide }));
    cloth.position.set(0.06, 0.7, 0);
    group.add(cloth);

    this.scene.add(group);
    this.flagObj = { group, ring, disc, cloth, t: 0, k: 0 };
  }

  disposeFlag() {
    if (!this.flagObj) return;
    this.scene.remove(this.flagObj.group);
    this.flagObj.group.traverse(o => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.flagObj = null;
  }

  /** Animation du drapeau : il monte avec le pourcentage du joueur qui capture (ou du meilleur). */
  updateFlag(dt) {
    const f = this.flagObj;
    if (!f) return;
    f.t += dt;

    let focus = this.zone >= 0 ? this.zone : -1;
    if (focus < 0) {
      let best = 0;
      for (const i of this.ids) if (this.capture[i] > best) { best = this.capture[i]; focus = i; }
    }

    f.k = lerp(f.k, focus >= 0 ? this.capture[focus] / 100 : 0, Math.min(1, dt * 6));
    f.cloth.position.y = 0.7 + f.k * 2.9;
    f.cloth.rotation.y = Math.sin(f.t * 3) * 0.18;
    f.cloth.material.color.set(focus >= 0 ? shirtOf(focus) : 0xcfc9b8);

    let ringColor = 0xcfc9b8, ringOpacity = 0.45;
    if (this.zone === -2) { ringColor = 0xff3b30; ringOpacity = 0.55 + Math.sin(f.t * 8) * 0.2; }
    else if (this.zone >= 0) { ringColor = shirtOf(this.zone); ringOpacity = 0.8; }
    f.ring.material.color.set(ringColor);
    f.ring.material.opacity = ringOpacity;
    f.disc.material.color.set(ringColor);
  }

  updateFlagHUD() {
    const el = this.flagEl;
    if (!el) return;
    const flag = this.isFlag();
    el.style.display = flag ? 'block' : 'none';
    if (!flag) return;

    const z = this.zone, me = this.me;
    let text = 'REJOINS LE DRAPEAU AU CENTRE';
    if (z === me) text = 'TU CAPTURES LE DRAPEAU';
    else if (z >= 0) text = `${this.nameOf(z).toUpperCase()} CAPTURE LE DRAPEAU`;
    else if (z === -2) text = 'ZONE CONTESTÉE · PROGRESSION BLOQUÉE';

    let lead = -1;
    for (const i of this.ids) {
      if (i !== me && (lead < 0 || this.capture[i] > this.capture[lead])) lead = i;
    }

    el.classList.toggle('mine', z === me);
    el.classList.toggle('contested', z === -2);
    el.querySelector('.fh-status').textContent = text;
    el.querySelector('.fh-bar i').style.width = `${this.capture[me]}%`;
    el.querySelector('.fh-me').textContent = `TOI · ${Math.floor(this.capture[me])} %`;
    el.querySelector('.fh-lead').textContent = lead >= 0 ? `${this.nameOf(lead).toUpperCase()} · ${Math.floor(this.capture[lead])} %` : '';
  }

  // ============ HUD / FIN ============

  updateHUD() {
    const w = this.weapon.stats();
    // À droite du HUD : le meilleur adversaire du moment.
    const flag = this.isFlag();
    const metric = i => flag ? this.capture[i] : this.score[i];
    const show = i => flag ? `${Math.floor(this.capture[i])}%` : this.score[i];
    let best = null;
    for (const i of this.ids) {
      if (i === this.me) continue;
      if (best === null || metric(i) > metric(best)) best = i;
    }
    this.updateFlagHUD();
    this.hud.update({
      health: this.hp[this.me],
      youScore: show(this.me),
      enemyScore: best === null ? 0 : show(best),
      time: this.clockValue,
      weapon: { label: w.label + (this.weapon.isReloading() ? ' · RECHARGE…' : '') },
      ammo: this.weapon.getAmmo(),
      youName: this.nameOf(this.me),
      enemyName: best === null ? '—' : this.nameOf(best)
    });
  }

  end(v) {
    this.active = false;
    this.controller.enabled = false;
    this.network.send(MSG.GAMEOVER, { reason: v.reason, winner: v.winner, score: this.score, stats: this.stats, cap: this.capture });
    this.finish(v.reason, '', v.winner);
  }

  finish(reason, title = '', winner = -1) {
    if (this.finalShown) return;
    progress.endMatch({
      won: winner === this.me,
      players: this.roster.length || this.ids.length,
      mode: this.config?.mode || 'kills',
      aborted: false
    });
    this.active = false;
    this.controller.enabled = false;
    this.death = null;
    this.sbHeld = false;
    this.deathEl.classList.remove('show');
    this.deathEl.style.display = 'none';
    this.weaponModel.visible = true;
    document.exitPointerLock?.();
    this.scopeEl.style.opacity = 0;
    this.crosshair.style.display = 'none';
    this.hud.clearMessage();
    this.finalShown = true;
    this.showScoreboard(true, reason, title, winner);
    if (this.onFinish?.() === false) this.updateReplayState([], false);
  }

  // ============ SCOREBOARD ============

  showScoreboard(final = false, reason = '', title = '', winner = -1) {
    const me = this.me;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const flag = this.isFlag();
    const metric = i => flag ? this.capture[i] : this.score[i];
    const order = this.roster.slice().sort((a, b) => metric(b) - metric(a) || this.score[b] - this.score[a] || this.stats[a].d - this.stats[b].d);
    const top = order.length ? metric(order[0]) : 0;
    const uniqueTop = order.filter(i => metric(i) === top).length === 1;

    let label = 'SCOREBOARD', cls = 'info';
    if (final) {
      if (title) { label = title; cls = 'lose'; }
      else if (winner === me) { label = 'VICTOIRE'; cls = 'win'; }
      else if (winner === -1) { label = 'ÉGALITÉ'; cls = 'draw'; }
      else { label = 'DÉFAITE'; cls = 'lose'; }
    }

    const rows = order.map((i, r) => {
      const d = this.stats[i].d, k = this.score[i];
      const classes = [i === me ? 'me' : '', r === 0 && uniqueTop ? 'top' : '', this.gone.has(i) ? 'gone' : ''].join(' ').trim();
      return `<tr class="${classes}"><td>${r + 1}</td>` +
        `<td>${esc(this.nameOf(i))}${i === 0 ? '<em>HÔTE</em>' : ''}${this.gone.has(i) ? '<em class="gone">PARTI</em>' : ''}</td>` +
        (flag ? `<td>${Math.floor(this.capture[i])}%</td>` : '') +
        `<td>${k}</td><td>${d}</td><td>${(d ? k / d : k).toFixed(2)}</td><td>${this.stats[i].h}</td></tr>`;
    }).join('');

    const mode = flag ? 'CAPTURE DU DRAPEAU' : this.config?.mode === 'time' ? 'MEILLEUR SCORE AU TEMPS' : `PREMIER À ${this.config?.target}`;
    this.sbEl.innerHTML = `<div class="sb-panel${order.length > 8 ? ' compact' : ''}">
      <div class="sb-title ${cls}">${esc(label)}</div>
      <div class="sb-sub">${esc(final ? reason : mode)}</div>
      <div class="sb-scroll"><table><thead><tr><th>#</th><th>JOUEUR</th>${flag ? '<th>DRAPEAU</th>' : ''}<th>ÉLIMS</th><th>MORTS</th><th>K/D</th><th>TÊTES</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${final ? `<div id="sb-replay-status" class="sb-hint"></div>
        <div class="sb-actions">
          <div class="sb-replay-actions">
            <button id="sb-replay" class="primary">REJOUER</button>
            ${this.network.isHost ? '<button id="sb-confirm" class="primary" hidden>VALIDER</button>' : ''}
            <button id="sb-cancel" hidden>ANNULER</button>
          </div>
          <button id="sb-menu">RETOUR AU MENU PRINCIPAL</button>
        </div>` : '<div class="sb-hint">RELÂCHE TAB POUR FERMER</div>'}
    </div>`;
    this.sbEl.classList.toggle('final', final);
    this.sbEl.classList.add('show');
    if (final) {
      this.sbEl.querySelector('#sb-replay').onclick = () => this.onReplayVote?.();
      this.sbEl.querySelector('#sb-cancel').onclick = () => this.onReplayVote?.();
      this.sbEl.querySelector('#sb-menu').onclick = () => location.reload();
      this.updateReplayState([...this.replayVotes]);
    }
  }

  updateReplayState(votes, available = true) {
    this.replayVotes = new Set(votes);
    const replay = this.sbEl.querySelector('#sb-replay');
    const confirm = this.sbEl.querySelector('#sb-confirm');
    const status = this.sbEl.querySelector('#sb-replay-status');
    if (!replay || !status) return;

    const hasVoted = this.replayVotes.has(this.me);
    replay.hidden = !available || hasVoted;
    const cancel = this.sbEl.querySelector('#sb-cancel');
    if (cancel) cancel.hidden = !available || !hasVoted;
    const guestReady = [...this.replayVotes].some(id => id !== 0);
    if (confirm) {
      confirm.hidden = !available || !hasVoted;
      confirm.disabled = !guestReady;
      confirm.onclick = () => this.onReplayConfirm?.();
    }
    status.textContent = !available
      ? 'La reconnexion au salon est nécessaire pour rejouer.'
      : this.network.isHost && !guestReady
        ? 'Clique sur REJOUER, puis attends qu’un autre joueur soit prêt.'
        : `${this.replayVotes.size} joueur${this.replayVotes.size > 1 ? 's' : ''} prêt${this.replayVotes.size > 1 ? 's' : ''} à rejouer.`;
  }

  hideScoreboard() {
    this.sbEl.classList.remove('show', 'final');
  }

  updateGamepad() {
    const pad = this.gamepad.pad();
    if (!pad) {
      this.gamepad.update();
      return;
    }

    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.BACK)) {
      this.sbHeld = !this.finalShown;
    }
    if (!this.gamepad.held(GAMEPAD_BUTTONS.BACK)) {
      if (this.sbHeld) {
        this.sbHeld = false;
        this.hideScoreboard();
      }
    }

    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.WEST)) this.weapon.reload();
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.NORTH)) this.cycleWeapon(1);
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.LB)) this.cycleWeapon(-1);
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.RB)) this.cycleWeapon(1);
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.DPAD_UP)) this.chooseWeapon('rifle');
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.DPAD_RIGHT)) this.chooseWeapon('shotgun');
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.DPAD_DOWN)) this.chooseWeapon('sniper');
    if (this.gamepad.pressedNow(GAMEPAD_BUTTONS.DPAD_LEFT)) this.chooseWeapon('knife');
    this.gamepad.update();
  }

  cycleWeapon(direction) {
    if (!this.active || this.death) return;
    const available = this.config.weapon === 'all'
      ? ['shotgun', 'rifle', 'sniper', 'knife']
      : [this.config.weapon, 'knife'];
    const current = available.indexOf(this.weapon.current);
    const next = (current + direction + available.length) % available.length;
    this.chooseWeapon(available[next]);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // ============ BOUCLE PRINCIPALE ============

  animate = () => {
    requestAnimationFrame(this.animate);

    const raw = Math.min(this.timer.getDelta(), 0.05), now = performance.now();
    if (this.slowUntil && now > this.slowUntil) { this.slowUntil = 0; this.timeScale = 1; }
    const dt = raw * this.timeScale;

    if (this.active) {
      progress.tickPlay(dt);
      this.updateGamepad();
      this.controller.update(dt);

      const p = this.controller.position;
      this.moveSpeed = dt > 0 ? Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) / dt : 0;
      this.lastPos = { x: p.x, z: p.z };

      if (this.death) this.updateDeathCam(dt);

      // Tremblement de caméra + FOV dynamique (sprint, punch d'élimination)
      if (this.shake > 0) {
        this.camera.rotation.x += rnd() * this.shake;
        this.camera.rotation.z += rnd() * this.shake;
        this.shake = Math.max(0, this.shake - raw * 0.12);
      }
      this.fovPunch = lerp(this.fovPunch, 0, Math.min(1, raw * 6));
      // Visée (clic droit) : zoom, lunette du sniper
      const wn = this.weapon.current;
      const aimWanted = this.controller.aiming && this.controller.enabled && !this.death && wn !== 'knife';
      this.ads = lerp(this.ads, aimWanted ? 1 : 0, Math.min(1, raw * 10));
      const scoped = wn === 'sniper' ? Math.max(0, (this.ads - 0.6) / 0.4) : 0;
      this.scopeEl.style.opacity = scoped;
      this.crosshair.style.opacity = scoped > 0.5 ? 0 : 1;
      const adsFov = { shotgun: 62, rifle: 58, sniper: 20 }[wn] ?? 75;
      const baseFov = lerp(this.controller.sprinting && this.moveSpeed > 3 ? 82 : 75, adsFov, this.ads);
      this.camera.fov = lerp(this.camera.fov, baseFov + this.fovPunch, Math.min(1, raw * 8));
      this.camera.updateProjectionMatrix();

      if (this.host) this.hostTick(raw, now);

      // Synchronisation réseau à 20 Hz
      this.netAcc += raw;
      if (this.active && this.netAcc >= NET_DT) {
        this.netAcc = 0;
        if (this.host) {
          const pos = {};
          for (const id of this.ids) {
            pos[id] = encode(id === this.me ? this.snap() : (this.remotes.get(id)?.n ?? { x: 0, z: 0 }));
          }
          this.network.send(MSG.STATE, {
            state: {
              hp: this.hp, score: this.score, dead: this.dead, time: this.clockValue, pos,
              ...(this.isFlag() ? { cap: this.capture.map(v => Math.round(v * 10) / 10), zone: this.zone } : {})
            }
          });
        } else {
          this.network.send(MSG.INPUT, { input: encode(this.snap()) });
        }
      }

      this.updateRemotes(dt);
      this.updateFlag(dt);
      this.updateWeaponAnimation(dt);
      this.updateFx(dt);
      if (this.sbHeld && !this.finalShown) this.showScoreboard(false);
      this.updateHUD();
    }

    this.renderer.render(this.scene, this.camera);
  };
}
