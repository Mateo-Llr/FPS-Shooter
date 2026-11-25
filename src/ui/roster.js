import * as THREE from 'three';
import { createCharacter, disposeCharacter, showGun, poseIdle, SHIRT_COLORS } from '../game/character.js';

// Lobby 3D façon Counter-Strike : les joueurs du salon sont debout sur une scène,
// avec leur pseudo au-dessus de la tête. API : window.clashRoster.set([{ id, name, host, me }]) / set(null).

const CSS = `
#roster{margin:6px 0 22px;border:1px solid #39464e;background:#0f161b}
#roster .r-head{display:flex;justify-content:space-between;padding:8px 14px;font:800 11px Inter,Arial,sans-serif;letter-spacing:.2em;color:#8a98a0;border-bottom:1px solid #39464e}
#roster .r-stage{position:relative;height:300px;overflow:hidden;
  background:radial-gradient(ellipse at 50% 85%,rgba(240,120,69,.22),transparent 60%),linear-gradient(#18222a,#0b1014)}
#roster canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#roster .r-tags{position:absolute;inset:0;pointer-events:none}
#roster .r3d-tag{position:absolute;left:0;top:0;white-space:nowrap;display:flex;align-items:center;gap:6px;
  background:rgba(10,15,20,.82);border-bottom:2px solid #4a5a64;padding:3px 9px;
  font:800 17px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.06em;color:#eef1f2;will-change:transform;opacity:0;transition:opacity .3s}
#roster .r3d-tag.me{border-bottom-color:#f07845;color:#ffb487}
#roster .r-tag{font:800 9px Inter,Arial,sans-serif;letter-spacing:.14em;padding:2px 5px;background:#f07845;color:#10151a}
#roster .r-tag.you{background:#3a4b55;color:#e6ecef}
#roster .r-empty{position:absolute;inset:0;display:grid;place-items:center;color:#5d6b72;font:600 13px Inter,Arial,sans-serif;letter-spacing:.14em;pointer-events:none}
@media (max-width:600px){#roster .r-stage{height:230px}}`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const WEAPONS = ['rifle', 'shotgun', 'sniper'];

export class Roster {
  constructor() {
    const panel = document.querySelector('#lobby .lobby-panel');
    const ref = document.querySelector('#host-settings');
    if (!panel || !ref) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.el = document.createElement('div');
    this.el.id = 'roster';
    this.el.innerHTML = `
      <div class="r-head"><span>JOUEURS</span><span class="r-count">0 / 16</span></div>
      <div class="r-stage">
        <canvas></canvas>
        <div class="r-tags"></div>
        <div class="r-empty">EN ATTENTE DES JOUEURS…</div>
      </div>`;
    panel.insertBefore(this.el, ref);

    this.stage = this.el.querySelector('.r-stage');
    this.canvas = this.el.querySelector('canvas');
    this.tags = this.el.querySelector('.r-tags');
    this.empty = this.el.querySelector('.r-empty');
    this.count = this.el.querySelector('.r-count');

    this.entries = new Map();
    this.mouseX = 0;
    this.time = 0;
    this.camTarget = { z: 8.5, y: 1.9 };

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

  initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 2.2, 0.1, 80);
    this.camera.position.set(0, 1.9, 8.5);

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
      new THREE.CircleGeometry(11, 64),
      new THREE.MeshStandardMaterial({ color: 0x151c22, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(10.6, 10.8, 64),
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** players : [{ id, name, host, me }] ou null (salon quitté). */
  set(players) {
    this.list = Array.isArray(players) ? players.filter(Boolean).slice(0, 16) : [];
    this.sync();
  }

  sync() {
    if (!this.el) return;
    const order = [...this.list].sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || (a.id ?? 0) - (b.id ?? 0));
    const keep = new Set();

    order.forEach((p, i) => {
      const key = p.id ?? p.name;
      keep.add(key);
      let e = this.entries.get(key);
      if (!e) e = this.addEntry(key, p, i);
      this.updateTag(e, p);
    });

    for (const [key, e] of this.entries) {
      if (keep.has(key)) continue;
      disposeCharacter(e.ch);
      e.ring.geometry.dispose();
      e.ring.material.dispose();
      this.scene.remove(e.ring);
      e.tag.remove();
      this.entries.delete(key);
    }

    this.layout(order);
    this.count.textContent = `${order.length} / 16`;
    this.empty.style.display = order.length ? 'none' : 'grid';
  }

  addEntry(key, p, index) {
    const id = p.id ?? [...String(p.name)].reduce((a, c) => a + c.charCodeAt(0), 0);
    const ch = createCharacter({ shirt: SHIRT_COLORS[id % SHIRT_COLORS.length] });
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
    const sig = `${p.name}|${!!p.host}|${!!p.me}`;
    if (sig === e.sig) return;
    e.sig = sig;
    e.tag.className = 'r3d-tag' + (p.me ? ' me' : '');
    e.tag.replaceChildren();
    const name = document.createElement('span');
    name.textContent = p.name || 'Joueur';
    e.tag.appendChild(name);
    const badge = (txt, cls) => {
      const b = document.createElement('span');
      b.className = 'r-tag' + (cls ? ' ' + cls : '');
      b.textContent = txt;
      e.tag.appendChild(b);
    };
    if (p.host) badge('HÔTE');
    if (p.me) badge('TOI', 'you');
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
    this.camTarget = { z: 8.5 + (rows - 1) * 1.7, y: 1.9 + (rows - 1) * 0.7 };
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    // Ne rien dessiner quand le salon est masqué (menu ou partie en cours).
    if (!this.el.offsetParent) return;
    if (this.canvas.width === 0 || this.canvas.width !== Math.round(this.stage.clientWidth * this.renderer.getPixelRatio())) this.resize();

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
