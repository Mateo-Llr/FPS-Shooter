import * as THREE from 'three';
import { World } from './world.js';
import { PlayerController } from './player.js';
import { WeaponSystem, WEAPONS } from './weapons.js';
import { HUD } from './hud.js';
import { MSG } from '../network/protocol.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};
const rnd = () => Math.random() * 2 - 1;

const NET_DT = 1 / 30;
const RESPAWN_TIME = 3;
const SPAWN_PROTECTION = 1500;

const G_SPH = new THREE.SphereGeometry(1, 6, 6);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 5);
const G_HOLE = new THREE.CircleGeometry(0.06, 8);
const M_SPARK = new THREE.MeshBasicMaterial({ color: 0xffc060 });
const M_BLOOD = new THREE.MeshBasicMaterial({ color: 0xb01818 });
const M_DUST = new THREE.MeshBasicMaterial({ color: 0xc4c0b2 });
const M_HOLE = new THREE.MeshBasicMaterial({ color: 0x0d0d0d });

const box = (parent, [w, h, d], mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

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
#sb-menu{margin-top:24px;width:100%}`;

export class Game {
  constructor(canvas, network) {
    this.canvas = canvas;
    this.network = network;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 150);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera); // indispensable pour afficher l'arme en vue subjective

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    this.hp = [100, 100];
    this.dead = [false, false];
    this.invuln = [0, 0];
    this.pending = [null, null];
    this.lastSpawn = [null, null];
    this.score = [0, 0];
    this.elapsed = 0;
    this.clockValue = 0;
    this.config = null;

    this.remote = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouch: false };
    this.remoteNet = { ...this.remote };
    this.remoteMoving = false;
    this.remoteWalkTime = 0;
    this.enemyDead = null;

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
    this.stats = [{ d: 0, h: 0 }, { d: 0, h: 0 }];
    this.finalShown = false;
    this.sbHeld = false;
    this.weaponRecoil = 0;
    this.hitmarkerUntil = 0;
    this.netAcc = 0;

    this.buildRemote();
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

  // ============ CONSTRUCTION DE LA SCÈNE ============

  buildRemote() {
    const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const skin = M(0xe0ae88), shirt = M(0xc94f36), pants = M(0x26374e),
      shoes = M(0x171b22), dark = M(0x252b32), gun = M(0x151a20);
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';

    box(g, [0.62, 0.72, 0.34], shirt, 0, 1.12, 0);
    box(g, [0.43, 0.43, 0.43], skin, 0, 1.72, 0);
    box(g, [0.46, 0.12, 0.46], dark, 0, 1.95, 0);
    [-1, 1].forEach(s => box(g, [0.055, 0.055, 0.025], dark, s * 0.105, 1.77, -0.22));

    this.remoteArms = [];
    this.remoteLegs = [];
    [-1, 1].forEach(s => {
      const a = new THREE.Group();
      a.position.set(s * 0.39, 1.38, 0);
      g.add(a);
      box(a, [0.23, 0.66, 0.25], shirt, 0, -0.32, 0);
      box(a, [0.2, 0.18, 0.22], skin, 0, -0.68, 0);
      this.remoteArms.push(a);

      const l = new THREE.Group();
      l.position.set(s * 0.16, 0.76, 0);
      g.add(l);
      box(l, [0.25, 0.68, 0.29], pants, 0, -0.34, 0);
      box(l, [0.27, 0.16, 0.39], shoes, 0, -0.7, -0.035);
      this.remoteLegs.push(l);
    });
    this.enemyGuns = {};
    for (const t of ['shotgun', 'rifle', 'sniper']) {
      const m = this.gunModel(t);
      m.scale.setScalar(0.7);
      m.position.set(0.2, 1.28, -0.3);
      g.add(m);
      this.enemyGuns[t] = m;
    }

    g.traverse(o => { o.castShadow = true; });
    this.enemyMesh = g;
    this.scene.add(g);
  }

  gunModel(t) {
    const mat = (c, m, r) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
    const metal = mat(0x202832, 0.75, 0.3), black = mat(0x10151c, 0.4, 0.55), accent = mat(0xd85b32, 0.25, 0.45),
      wood = mat(0x6b4425, 0.1, 0.7), green = mat(0x2d3a2e, 0.3, 0.6);
    const G = new THREE.Group();
    const cyl = (r, len, m, y, z) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m);
      c.rotation.x = Math.PI / 2;
      c.position.set(0, y, z);
      G.add(c);
    };
    if (t === 'shotgun') {
      box(G, [0.22, 0.18, 0.5], metal, 0, 0, 0);
      cyl(0.06, 0.85, black, 0.04, -0.62);
      cyl(0.045, 0.7, metal, -0.06, -0.55);
      box(G, [0.15, 0.13, 0.3], wood, 0, -0.06, -0.45);
      box(G, [0.18, 0.2, 0.42], wood, 0, -0.02, 0.45);
      box(G, [0.12, 0.25, 0.15], wood, 0, -0.18, 0.14);
      G.userData.muzzle = -1.05;
    } else if (t === 'sniper') {
      box(G, [0.18, 0.17, 0.8], metal, 0, 0, 0);
      cyl(0.032, 1.1, black, 0.03, -0.85);
      cyl(0.065, 0.42, black, 0.17, -0.1);
      cyl(0.078, 0.06, accent, 0.17, -0.33);
      box(G, [0.17, 0.22, 0.5], green, 0, -0.02, 0.6);
      box(G, [0.12, 0.25, 0.15], black, 0, -0.18, 0.2);
      box(G, [0.1, 0.2, 0.12], black, 0, -0.17, -0.1);
      G.userData.muzzle = -1.4;
    } else {
      box(G, [0.24, 0.2, 0.62], metal, 0, 0, 0);
      cyl(0.05, 0.7, black, 0.045, -0.56);
      box(G, [0.19, 0.16, 0.34], black, 0, -0.015, 0.43);
      box(G, [0.12, 0.27, 0.16], black, 0, -0.19, 0.13).rotation.x = -0.18;
      box(G, [0.12, 0.08, 0.18], accent, 0, 0.14, -0.13);
      box(G, [0.055, 0.12, 0.06], black, 0, 0.23, -0.13);
      box(G, [0.12, 0.19, 0.13], black, 0, -0.14, -0.35);
      box(G, [0.1, 0.3, 0.12], accent, 0, -0.22, -0.02);
      G.userData.muzzle = -0.93;
    }
    return G;
  }

  buildWeaponView() {
    const W = new THREE.Group();
    this.guns = {};
    for (const t of ['shotgun', 'rifle', 'sniper']) {
      this.guns[t] = this.gunModel(t);
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

  bindNetwork() {
    this.network.on(MSG.INPUT, data => { if (this.host) this.receiveInput(data); });
    this.network.on(MSG.STATE, data => { if (!this.host) this.applyState(data); });
    this.network.on(MSG.EVENT, data => this.handleEvent(data));
    this.network.on(MSG.GAMEOVER, data => {
      if (data.score) this.score = data.score;
      this.finish(data.reason || 'Fin de partie');
    });
    this.network.on(MSG.DISCONNECTED, () => this.remoteDisconnected());
  }

  snap() {
    return { ...this.controller.snapshot(), crouch: this.controller.crouched, w: this.weapon.current };
  }

  /** Hôte : reçoit la position de l'invité. */
  receiveInput(data) {
    if (!data.input) return;
    Object.assign(this.remoteNet, data.input);
    if (this.disconnectDeadline) {
      this.disconnectDeadline = null;
      this.controller.enabled = !this.death;
      this.hud.clearMessage();
    }
  }

  /** Invité : reçoit l'état autoritaire de l'hôte. */
  applyState({ state: s }) {
    if (!s) return;
    this.hp = s.hp;
    this.score = s.score;
    this.dead = s.dead;
    this.clockValue = s.time;
    Object.assign(this.remoteNet, s.hostPos);
  }

  emit(ev) {
    this.network.send(MSG.EVENT, ev);
    this.handleEvent(ev);
  }

  handleEvent(ev) {
    if (!this.active || !ev) return;
    switch (ev.kind) {
      case 'shot':
        this.renderShot(ev.shot, false);
        if (this.host) this.resolveShot(1, ev.shot);
        break;
      case 'hit': this.onHit(ev); break;
      case 'kill': this.onKill(ev); break;
      case 'respawn': this.onRespawn(ev); break;
    }
  }

  // ============ DÉMARRAGE ============

  start(config, host, youName, enemyName) {
    this.config = config;
    this.host = host;
    this.me = host ? 0 : 1;
    this.youName = youName;
    this.enemyName = enemyName;

    this.hp = [100, 100];
    this.dead = [false, false];
    this.invuln = [0, 0];
    this.pending = [null, null];
    this.lastSpawn = [null, null];
    this.score = [0, 0];
    this.elapsed = 0;
    this.clockValue = config.mode === 'time' ? config.duration : 0;
    this.over = false;
    this.endAt = 0;
    this.stats = [{ d: 0, h: 0 }, { d: 0, h: 0 }];
    this.finalShown = false;
    this.hideScoreboard();
    this.death = null;
    this.enemyDead = null;
    this.disconnectDeadline = null;
    this.timeScale = 1;

    this.fx.forEach(f => this.disposeFx(f));
    this.fx = [];
    this.feedEl.innerHTML = '';
    this.deathEl.classList.remove('show');
    this.deathEl.style.display = 'none';

    const mine = this.world.spawns[this.me], theirs = this.world.spawns[1 - this.me];
    this.controller.position = { x: mine.x, y: 0, z: mine.z };
    this.controller.yaw = mine.yaw;
    this.controller.pitch = 0;
    this.controller.velocityY = 0;
    this.controller.firing = false;
    this.controller.aiming = false;
    this.ads = 0;
    this.controller.enabled = true;
    this.lastPos = { x: mine.x, z: mine.z };

    this.remote = { x: theirs.x, y: 0, z: theirs.z, yaw: theirs.yaw, pitch: 0, crouch: false };
    this.remoteNet = { ...this.remote };
    this.enemyMesh.rotation.set(0, theirs.yaw, 0);
    this.enemyMesh.position.set(theirs.x, 0, theirs.z);
    this.weaponModel.visible = true;

    this.weapon.reset();
    this.chooseWeapon(config.weapon === 'all' ? 'rifle' : config.weapon, true);

    document.querySelector('#menu')?.classList.add('hidden');
    document.querySelector('#lobby')?.classList.add('hidden');
    document.querySelector('#game')?.classList.remove('hidden');
    document.querySelector('#hud .crosshair')?.remove(); // un seul viseur
    const mode = document.querySelector('#match-mode');
    if (mode) mode.textContent = config.mode === 'time' ? 'MEILLEUR SCORE' : `PREMIER À ${config.target}`;

    this.hud.show();
    this.hud.clearMessage();
    document.querySelector('#lock-hint')?.classList.remove('hidden');
    this.crosshair.style.display = 'block';
    this.active = true;
    this.updateHUD();
  }

  bindKeys() {
    document.addEventListener('keydown', e => {
      if (!this.active || this.death) return;
      if (e.code === 'Digit1') this.chooseWeapon('shotgun');
      if (e.code === 'Digit2') this.chooseWeapon('rifle');
      if (e.code === 'Digit3') this.chooseWeapon('sniper');
      if (e.code === 'KeyR') this.weapon.reload();
    });
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
    if (!force && this.config.weapon !== 'all' && this.config.weapon !== name) return;
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
    const hip = { shotgun: 0.03, rifle: 0.012, sniper: 0.05 }[w], aim = { shotgun: 0.01, rifle: 0.002, sniper: 0 }[w];
    const spread = (a ? aim : hip) + (moving ? { shotgun: 0.006, rifle: 0.02, sniper: a ? 0.03 : 0.06 }[w] : 0) + (air ? 0.04 : 0);
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

    this.renderShot(shot, true);

    // Recul de la visée
    const kick = { shotgun: 0.05, rifle: 0.009, sniper: 0.06 }[w] * (a ? 0.6 : 1);
    this.controller.pitch += kick;
    this.controller.yaw += rnd() * kick * 0.5;
    this.weaponRecoil = 1;
    this.muzzleFlash.material.opacity = 1;
    this.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.7);
    this.muzzleLight.intensity = 8;
    this.bang(w, 0.35);

    if (this.host) {
      this.network.send(MSG.EVENT, { kind: 'shot', shot });
      this.resolveShot(0, shot);
    } else {
      this.network.send(MSG.EVENT, { kind: 'shot', shot });
    }
  }

  /** Effets visuels/sonores d'un tir (le mien ou celui de l'adversaire). */
  renderShot(shot, mine) {
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
    return this.remoteNet;
  }

  resolveShot(shooter, shot) {
    const v = 1 - shooter, now = performance.now();
    if (this.over || this.dead[shooter] || this.dead[v] || this.invuln[v] > now) return;
    const st = WEAPONS[shot.weapon];
    if (!st || !shot.d?.length) return;

    const o = V(...shot.o), p = this.posOf(v), s = p.crouch ? 0.78 : 1;
    const body = new THREE.Box3(V(p.x - 0.34, p.y, p.z - 0.34), V(p.x + 0.34, p.y + 1.5 * s, p.z + 0.34));
    const head = new THREE.Sphere(V(p.x, p.y + 1.74 * s, p.z), 0.27);
    const per = st.damage / shot.d.length, tmp = V(0, 0, 0);
    let dmg = 0, headHit = false, hitPoint = null;

    for (const a of shot.d.slice(0, 10)) {
      const dir = V(...a).normalize(), ray = new THREE.Ray(o, dir);
      const wall = this.world.rayDistance(o, dir, st.range);
      let t = Infinity, isHead = false, hp = null;
      if (ray.intersectSphere(head, tmp)) { t = o.distanceTo(tmp); isHead = true; hp = tmp.clone(); }
      if (ray.intersectBox(body, tmp)) {
        const tb = o.distanceTo(tmp);
        if (tb < t) { t = tb; isHead = false; hp = tmp.clone(); }
      }
      if (t < wall && t <= st.range) {
        let k = isHead ? 2 : 1;
        if (shot.weapon === 'shotgun') k *= 1 - 0.6 * (t / st.range);
        dmg += per * k;
        headHit ||= isHead;
        hitPoint = hp;
      }
    }

    dmg = Math.round(dmg);
    if (dmg > 0) this.applyDamage(shooter, v, dmg, headHit, shot.weapon, hitPoint);
  }

  applyDamage(shooter, victim, dmg, head, weapon, p) {
    this.hp[victim] = Math.max(0, this.hp[victim] - dmg);
    this.emit({ kind: 'hit', shooter, victim, damage: dmg, head, hp: this.hp[victim], p: [p.x, p.y, p.z] });
    if (this.hp[victim] <= 0) this.kill(shooter, victim, weapon, head);
  }

  kill(killer, victim, weapon, head) {
    this.score[killer]++;
    this.dead[victim] = true;

    // Respawn aléatoire, loin de l'adversaire (anti spawn-kill)
    const spawn = this.world.pickSpawn(this.posOf(killer), this.lastSpawn[victim]);
    this.lastSpawn[victim] = spawn;
    this.pending[victim] = { spawn, at: performance.now() + RESPAWN_TIME * 1000 };

    const kp = this.posOf(killer);
    this.emit({ kind: 'kill', killer, victim, weapon, head, score: this.score.slice(), kx: kp.x, kz: kp.z });

    if (this.config.mode === 'kills' && this.score[killer] >= this.config.target) {
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
    if (this.disconnectDeadline && now > this.disconnectDeadline) {
      this.disconnectDeadline = null;
      this.end('Victoire par forfait');
      return;
    }

    if (!this.over) {
      for (const i of [0, 1]) {
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
    const [a, b] = this.score;
    if (a === b) return 'Égalité';
    const w = a > b ? 0 : 1;
    return `Victoire de ${w === this.me ? this.youName : this.enemyName}`;
  }

  // ============ ÉVÉNEMENTS (HÔTE + INVITÉ) ============

  onHit(ev) {
    this.hp[ev.victim] = ev.hp;
    const p = V(...ev.p);
    this.burst(p, M_BLOOD, ev.head ? 14 : 8, 3, 0.5, 0.04);
    if (ev.victim === this.me) {
      this.hud.showDamage(ev.damage);
      this.flashVignette();
      this.shake = 0.03;
      this.beep(110, 0.18, 'sawtooth', 0.15);
    } else {
      this.showHitmarker(ev.head);
      this.damageSprite(ev.damage, ev.head, p);
      this.beep(ev.head ? 1500 : 950, 0.06, 'square', 0.07);
    }
  }

  onKill(ev) {
    this.score = ev.score;
    this.dead[ev.victim] = true;
    this.stats[ev.victim].d++;
    if (ev.head) this.stats[ev.killer].h++;
    const nm = i => (i === this.me ? this.youName : this.enemyName);

    const item = document.createElement('div');
    item.className = 'feed-item' + (ev.killer === this.me ? ' mine' : ev.victim === this.me ? ' victim' : '');
    item.textContent = `${nm(ev.killer)}  ▸  ${WEAPONS[ev.weapon]?.label ?? ''}${ev.head ? '  ⌖' : ''}  ▸  ${nm(ev.victim)}`;
    this.feedEl.appendChild(item);
    setTimeout(() => item.remove(), 5000);
    while (this.feedEl.children.length > 4) this.feedEl.firstChild.remove();

    if (ev.victim === this.me) {
      this.startDeath(ev, nm(ev.killer));
    } else {
      // Scène d'élimination : l'adversaire s'effondre, ralenti + zoom
      this.enemyDead = 0;
      const c = V(this.remote.x, 1.2, this.remote.z);
      this.burst(c, M_BLOOD, 26, 4, 0.8, 0.05);
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
      this.enemyDead = null;
      this.enemyMesh.rotation.x = 0;
      this.enemyMesh.position.y = 0;
      Object.assign(this.remote, { x: ev.x, z: ev.z, yaw: ev.yaw });
      Object.assign(this.remoteNet, { x: ev.x, z: ev.z, yaw: ev.yaw });
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

  updateRemote(dt) {
    const r = this.remote, n = this.remoteNet, k = 1 - Math.exp(-dt * 18);
    const px = r.x, pz = r.z;
    r.x = lerp(r.x, n.x, k); r.y = lerp(r.y, n.y || 0, k); r.z = lerp(r.z, n.z, k);
    r.yaw = lerpAngle(r.yaw, n.yaw || 0, k);
    r.crouch = !!n.crouch;
    this.remoteMoving = dt > 0 && Math.hypot(r.x - px, r.z - pz) / dt > 0.6;

    const m = this.enemyMesh;
    m.position.x = r.x; m.position.z = r.z;
    m.rotation.y = r.yaw;
    if (this.enemyDead !== null) {
      this.enemyDead += dt;
      const f = ease(this.enemyDead / 0.5);
      m.rotation.x = f * (Math.PI / 2);
      m.position.y = 0.12 * f;
      return;
    }
    m.position.y = r.y;
    m.scale.y = lerp(m.scale.y, r.crouch ? 0.78 : 1, k);
    const ew = n.w || 'rifle';
    for (const t in this.enemyGuns) this.enemyGuns[t].visible = t === ew;

    if (this.remoteMoving) this.remoteWalkTime += dt * 10;
    const swing = this.remoteMoving ? Math.sin(this.remoteWalkTime) * 0.55 : 0;
    this.remoteArms[0].rotation.x = swing;
    this.remoteArms[1].rotation.x = 1.35 + swing * 0.08; // bras armé pointé vers l'avant
    this.remoteLegs[0].rotation.x = -swing;
    this.remoteLegs[1].rotation.x = swing;
  }

  updateWeaponAnimation(dt) {
    const W = this.weaponModel;
    this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 8);
    const r = this.weaponRecoil;

    this.bobT += dt * Math.min(this.moveSpeed, 9) * 1.5;
    const mv = Math.min(1, this.moveSpeed / 5);
    const reload = this.weapon.isReloading() ? 1 : 0;
    this.reloadK = lerp(this.reloadK, reload, Math.min(1, dt * 9));

    const a = this.ads, cur = this.weapon.current;
    for (const t in this.guns) this.guns[t].visible = t === cur;
    W.visible = !this.death && !(cur === 'sniper' && a > 0.6);
    const mz = this.guns[cur].userData.muzzle;
    this.muzzleFlash.position.z = mz - 0.05;
    this.muzzleLight.position.z = mz + 0.1;
    const bob = (1 - a) * mv;
    W.position.set(
      lerp(0.34, 0, a) + Math.sin(this.bobT) * 0.008 * bob,
      lerp(-0.31, -0.26, a) - r * 0.06 - this.reloadK * 0.22 + Math.abs(Math.cos(this.bobT)) * 0.008 * bob,
      lerp(-0.65, -0.55, a) + r * 0.12
    );
    W.rotation.set(-0.035 * (1 - a) + r * 0.1 - this.reloadK * 0.5, -0.045 * (1 - a), (-0.025 + this.reloadK * 0.5) * (1 - a));

    this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - dt * 16);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 60);
  }

  // ============ HUD / FIN ============

  updateHUD() {
    const w = this.weapon.stats();
    this.hud.update({
      health: this.hp[this.me],
      youScore: this.score[this.me],
      enemyScore: this.score[1 - this.me],
      time: this.clockValue,
      weapon: { label: w.label + (this.weapon.isReloading() ? ' · RECHARGE…' : '') },
      ammo: this.weapon.getAmmo(),
      youName: this.youName,
      enemyName: this.enemyName
    });
  }

  end(reason) {
    this.active = false;
    this.controller.enabled = false;
    this.network.send(MSG.GAMEOVER, { reason, score: this.score });
    this.finish(reason);
  }

  finish(reason, title = '') {
    if (this.finalShown) return;
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
    this.showScoreboard(true, reason, title);
  }

  // ============ SCOREBOARD ============

  showScoreboard(final = false, reason = '', title = '') {
    const me = this.me, foe = 1 - me;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const name = i => (i === me ? this.youName : this.enemyName) || 'Joueur';
    const order = [0, 1].sort((a, b) => this.score[b] - this.score[a] || this.stats[a].d - this.stats[b].d);
    const diff = this.score[me] - this.score[foe];

    let label = 'SCOREBOARD', cls = 'info';
    if (final) {
      label = title || (/forfait/i.test(reason) || diff > 0 ? 'VICTOIRE' : diff < 0 ? 'DÉFAITE' : 'ÉGALITÉ');
      cls = title ? 'lose' : label === 'VICTOIRE' ? 'win' : label === 'DÉFAITE' ? 'lose' : 'draw';
    }

    const rows = order.map((i, r) => {
      const d = this.stats[i].d, k = this.score[i];
      const topClass = r === 0 && this.score[0] !== this.score[1] ? ' top' : '';
      return `<tr class="${i === me ? 'me' : ''}${topClass}"><td>${r + 1}</td>` +
        `<td>${esc(name(i))}${i === 0 ? '<em>HÔTE</em>' : ''}</td>` +
        `<td>${k}</td><td>${d}</td><td>${(d ? k / d : k).toFixed(2)}</td><td>${this.stats[i].h}</td></tr>`;
    }).join('');

    const mode = this.config?.mode === 'time' ? 'MEILLEUR SCORE AU TEMPS' : `PREMIER À ${this.config?.target}`;
    this.sbEl.innerHTML = `<div class="sb-panel">
      <div class="sb-title ${cls}">${label}</div>
      <div class="sb-sub">${esc(final ? reason : mode)}</div>
      <table><thead><tr><th>#</th><th>JOUEUR</th><th>ÉLIMS</th><th>MORTS</th><th>K/D</th><th>TÊTES</th></tr></thead><tbody>${rows}</tbody></table>
      ${final ? '<button id="sb-menu" class="primary">RETOUR AU MENU PRINCIPAL</button>' : '<div class="sb-hint">RELÂCHE TAB POUR FERMER</div>'}
    </div>`;
    this.sbEl.classList.toggle('final', final);
    this.sbEl.classList.add('show');
    if (final) {
      // Repart sur un menu propre : ferme la connexion (beforeunload) et recharge l'application.
      this.sbEl.querySelector('#sb-menu').onclick = () => location.reload();
    }
  }

  hideScoreboard() {
    this.sbEl.classList.remove('show', 'final');
  }

  remoteDisconnected() {
    if (!this.active) return;
    if (this.host) {
      this.controller.enabled = false;
      this.hud.message('Adversaire déconnecté — reconnexion pendant 30 secondes…');
      this.disconnectDeadline = performance.now() + 30000;
    } else {
      this.finish('Connexion perdue avec l’hôte', 'CONNEXION PERDUE');
    }
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
      if (!this.disconnectDeadline) this.controller.update(dt);

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
      const aimWanted = this.controller.aiming && this.controller.enabled && !this.death;
      this.ads = lerp(this.ads, aimWanted ? 1 : 0, Math.min(1, raw * 10));
      const scoped = wn === 'sniper' ? Math.max(0, (this.ads - 0.6) / 0.4) : 0;
      this.scopeEl.style.opacity = scoped;
      this.crosshair.style.opacity = scoped > 0.5 ? 0 : 1;
      const adsFov = { shotgun: 62, rifle: 58, sniper: 20 }[wn];
      const baseFov = lerp(this.controller.sprinting && this.moveSpeed > 3 ? 82 : 75, adsFov, this.ads);
      this.camera.fov = lerp(this.camera.fov, baseFov + this.fovPunch, Math.min(1, raw * 8));
      this.camera.updateProjectionMatrix();

      if (this.host) this.hostTick(raw, now);

      // Synchronisation réseau à 30 Hz
      this.netAcc += raw;
      if (this.active && this.netAcc >= NET_DT) {
        this.netAcc = 0;
        if (this.host) {
          this.network.send(MSG.STATE, {
            state: {
              hp: this.hp, score: this.score, dead: this.dead, time: this.clockValue,
              hostPos: this.snap()
            }
          });
        } else {
          this.network.send(MSG.INPUT, { input: this.snap() });
        }
      }

      this.updateRemote(dt);
      this.updateWeaponAnimation(dt);
      this.updateFx(dt);
      if (this.sbHeld && !this.finalShown) this.showScoreboard(false);
      this.updateHUD();
    }

    this.renderer.render(this.scene, this.camera);
  };
}
