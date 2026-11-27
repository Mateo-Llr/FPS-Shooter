import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

/**
 * Bots : joueurs contrôlés par l'hôte.
 * Pour le réseau et le rendu ce sont de simples joueurs distants : l'IA écrit leur état dans
 * `remote.n` (position, orientation, arme), l'hôte le diffuse comme celui des invités, et leurs tirs
 * passent par le même chemin que ceux d'un joueur (renderShot + relayShot + resolveShot).
 */

// Niveaux 1 à 10 (5 = moyen, 3 = défaut). Trois points d'ancrage interpolés linéairement :
// niveau 1 = très facile, niveau 5 = moyen, niveau 10 = redoutable.
export const BOT_LEVEL_MIN = 1;
export const BOT_LEVEL_MAX = 10;
export const BOT_LEVEL_DEFAULT = 3;

const ANCHORS = [
  [1,  { react: 800, err: 0.095, turn: 2.6, speed: 0.72, fireMul: 2.2, burst: [2, 3], pause: [900, 1500], sight: 22, strafe: 0.2,  head: 0 }],
  [5,  { react: 380, err: 0.04,  turn: 5.5, speed: 0.92, fireMul: 1.3, burst: [3, 5], pause: [350, 800],  sight: 34, strafe: 0.7,  head: 0.15 }],
  [10, { react: 150, err: 0.012, turn: 10,  speed: 1.0,  fireMul: 1.0, burst: [6, 10], pause: [120, 350], sight: 48, strafe: 1,    head: 0.4 }]
];

export const clampBotLevel = n => {
  const v = Math.round(+n);
  return Number.isFinite(v) ? Math.max(BOT_LEVEL_MIN, Math.min(BOT_LEVEL_MAX, v)) : BOT_LEVEL_DEFAULT;
};

/** Paramètres d'IA pour un niveau 1-10. `easy` / `hard` activent les comportements propres aux extrêmes. */
export const botParams = level => {
  const n = clampBotLevel(level);
  const i = n <= ANCHORS[1][0] ? 0 : 1;
  const [n0, a] = ANCHORS[i], [n1, b] = ANCHORS[i + 1];
  const t = (n - n0) / (n1 - n0);
  const mix = (x, y) => x + (y - x) * t;
  const pair = (x, y) => [Math.round(mix(x[0], y[0])), Math.round(mix(x[1], y[1]))];
  return {
    level: n,
    react: mix(a.react, b.react), err: mix(a.err, b.err), turn: mix(a.turn, b.turn),
    speed: mix(a.speed, b.speed), fireMul: mix(a.fireMul, b.fireMul),
    burst: pair(a.burst, b.burst), pause: pair(a.pause, b.pause),
    sight: mix(a.sight, b.sight), strafe: mix(a.strafe, b.strafe), head: mix(a.head, b.head),
    easy: n <= 2,  // ne part pas à la chasse, recharge plus lentement
    hard: n >= 8   // s'accroupit au sniper, saute en combat, vise au fusil d'assaut
  };
};

export const BOT_NAMES = [
  'Nova', 'Raptor', 'Viper', 'Echo', 'Blaze', 'Ghost', 'Titan', 'Pixel',
  'Havoc', 'Rogue', 'Comet', 'Onyx', 'Zephyr', 'Talon', 'Cipher'
];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ≈ [-1, 1]
const angDiff = (a, b) => ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const yawTo = (dx, dz) => Math.atan2(-dx, -dz); // même convention que le joueur : avant = (-sin, -cos)

const CROWN = { x: 0, z: 0 };   // même position que CROWN_POS dans game.js
const BOMB_SPEED_BONUS = 1.15;  // même bonus que pour un joueur porteur de bombe

// ============================================================================
// Navigation : grille 1 m + A*
// ============================================================================

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class NavGrid {
  constructor(world, cell = 1) {
    this.cell = cell;
    this.minX = -world.halfWidth;
    this.minZ = -world.halfDepth;
    this.w = Math.ceil(world.halfWidth * 2 / cell);
    this.d = Math.ceil(world.halfDepth * 2 / cell);
    this.blocked = new Uint8Array(this.w * this.d);

    const margin = 0.55; // rayon du joueur + marge
    for (let iz = 0; iz < this.d; iz++) {
      for (let ix = 0; ix < this.w; ix++) {
        const x = this.minX + (ix + 0.5) * cell, z = this.minZ + (iz + 0.5) * cell;
        let b = 0;
        for (const c of world.colliders) {
          if (c.box.max.y < 0.6) continue; // trop bas pour gêner
          if (Math.abs(x - c.x) < c.hw + margin && Math.abs(z - c.z) < c.hd + margin) { b = 1; break; }
        }
        this.blocked[iz * this.w + ix] = b;
      }
    }
  }

  cellOf(x, z) {
    return [
      clamp(Math.floor((x - this.minX) / this.cell), 0, this.w - 1),
      clamp(Math.floor((z - this.minZ) / this.cell), 0, this.d - 1)
    ];
  }
  center(ix, iz) { return { x: this.minX + (ix + 0.5) * this.cell, z: this.minZ + (iz + 0.5) * this.cell }; }
  isBlocked(ix, iz) { return ix < 0 || iz < 0 || ix >= this.w || iz >= this.d || this.blocked[iz * this.w + ix] === 1; }
  walkable(x, z) { const [ix, iz] = this.cellOf(x, z); return !this.isBlocked(ix, iz); }

  /** Cellule libre la plus proche (spirale), ou null. */
  nearestFree(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    if (!this.isBlocked(cx, cz)) return [cx, cz];
    for (let r = 1; r <= 8; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!this.isBlocked(cx + dx, cz + dz)) return [cx + dx, cz + dz];
        }
      }
    }
    return null;
  }

  lineClear(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(dist / 0.4));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  randomPoint() {
    for (let i = 0; i < 40; i++) {
      const ix = randInt(0, this.w - 1), iz = randInt(0, this.d - 1);
      if (!this.isBlocked(ix, iz)) return this.center(ix, iz);
    }
    return this.center(Math.floor(this.w / 2), Math.floor(this.d / 2));
  }

  /** A* 8 directions + lissage du chemin. Renvoie une liste de points {x, z} ou null. */
  findPath(ax, az, bx, bz) {
    const s = this.nearestFree(ax, az), t = this.nearestFree(bx, bz);
    if (!s || !t) return null;
    const n = this.w * this.d;
    const g = new Float32Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const si = s[1] * this.w + s[0], ti = t[1] * this.w + t[0];
    const h = i => {
      const dx = Math.abs(i % this.w - t[0]), dz = Math.abs(Math.floor(i / this.w) - t[1]);
      return dx + dz - 0.5858 * Math.min(dx, dz);
    };
    const heap = new MinHeap();
    g[si] = 0;
    heap.push(h(si), si);
    let guard = 0;
    while (heap.size && guard++ < 8000) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === ti) break;
      const cx = cur % this.w, cz = Math.floor(cur / this.w);
      for (const [dx, dz] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (this.isBlocked(nx, nz)) continue;
        if (dx && dz && (this.isBlocked(cx + dx, cz) || this.isBlocked(cx, cz + dz))) continue; // pas de coin coupé
        const ni = nz * this.w + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dz ? 1.4142 : 1);
        if (ng < g[ni]) { g[ni] = ng; parent[ni] = cur; heap.push(ng + h(ni), ni); }
      }
    }
    if (si !== ti && parent[ti] === -1) return null;

    const cells = [];
    for (let i = ti; i !== -1; i = parent[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map(i => this.center(i % this.w, Math.floor(i / this.w)));
    pts.push({ x: bx, z: bz });

    // Lissage : on saute directement au point le plus lointain encore visible
    const out = [];
    let anchor = { x: ax, z: az }, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }
}

// ============================================================================
// Un bot
// ============================================================================

class BotController {
  constructor(mgr, id, level, spawn) {
    this.mgr = mgr;
    this.g = mgr.game;
    this.id = id;
    this.lv = botParams(level);
    this.respawn(spawn);
    this.thinkT = rand(0, 0.15);
  }

  respawn(s) {
    const g = this.g;
    this.p = { x: s.x, y: 0, z: s.z };
    this.vy = 0;
    this.grounded = true;
    this.yaw = s.yaw || 0;
    this.pitch = 0;
    this.crouch = false;
    this.aiming = false;
    this.ammo = {};
    for (const [k, w] of Object.entries(WEAPONS)) if (!w.melee) this.ammo[k] = w.capacity;
    this.weapon = g.isBomb() ? 'knife' : (g.availableWeapons().find(w => w !== 'knife') || 'knife');
    this.reloading = false;
    this.reloadUntil = 0;
    this.reloadWeapon = this.weapon;
    this.nextShot = 0;
    this.pauseUntil = 0;
    this.burstLeft = 0;
    this.target = -1;
    this.seenAt = -1e9;
    this.reactT = 0;
    this.aimHead = false;
    this.lastSeen = null;
    this.lookAt = null;
    this.goal = null;
    this.path = [];
    this.pathGoal = null;
    this.repathAt = 0;
    this.roamUntil = 0;
    this.fleeUntil = 0;
    this.pathOnlyUntil = 0;
    this.strafeDir = 1;
    this.strafeT = 0;
    this.noise = { yaw: 0, pitch: 0 };
    this.noiseT = 0;
    this.weaponT = 0;
    this.stuckCheck = 0.4;
    this.stuckN = 0;
    this.lastPos = { x: s.x, z: s.z };
    this.jumpReq = false;
    this.sprint = false;
    this.fighting = false;
    this.moveSpeed = 0;
  }

  eye() { return V(this.p.x, this.p.y + (this.crouch ? 1.28 : 1.68), this.p.z); }

  update(dt, now) {
    const g = this.g, rem = g.remotes.get(this.id);
    if (!rem) return;
    if (g.dead[this.id] || g.over) { this.moveSpeed = 0; return; }

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = rand(0.1, 0.18);
      this.think(now);
    }
    this.fighting = this.target >= 0 && now - this.seenAt < 450 &&
      !(g.isBomb() && g.bombHolder !== this.id);

    const wish = this.steer(dt, now);
    this.move(dt, now, wish);
    this.aim(dt, now, wish);
    this.fight(dt, now);

    Object.assign(rem.n, {
      x: this.p.x, y: this.p.y, z: this.p.z,
      yaw: this.yaw, pitch: this.pitch,
      crouch: this.crouch, w: this.weapon, aim: this.aiming
    });
  }

  // ---------------------------------------------------------------- perception

  enemies(now) {
    const g = this.g;
    if (g.isBomb() && g.bombHolder !== this.id) return [];
    return g.ids.filter(v =>
      v !== this.id && g.isEnemy(this.id, v) && !g.dead[v] && !(g.invuln[v] > now) && !(g.isBomb() && g.bombNoTag[v] > now)
    );
  }

  nearestEnemy() {
    const g = this.g, p = this.p;
    let best = -1, bd = Infinity;
    for (const v of g.ids) {
      if (v === this.id || g.dead[v] || !g.isEnemy(this.id, v)) continue;
      const q = g.posOf(v), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /** Ligne de vue vers un joueur : { dist, dir, pos } ou null. Vision à 360° à courte portée, ~120° au-delà. */
  look(v) {
    const g = this.g, tp = g.posOf(v), eye = this.eye();
    const chest = V(tp.x, (tp.y || 0) + (tp.crouch ? 0.8 : 1.1), tp.z);
    const to = chest.clone().sub(eye), dist = to.length();
    if (dist > this.lv.sight || dist < 1e-3) return dist < 1e-3 ? { dist, dir: V(0, 0, -1), pos: tp } : null;
    to.divideScalar(dist);
    if (dist > 7) {
      const hl = Math.hypot(to.x, to.z) || 1;
      const dot = (to.x * -Math.sin(this.yaw) + to.z * -Math.cos(this.yaw)) / hl;
      if (dot < Math.cos(1.05)) return null;
    }
    if (g.world.rayDistance(eye, to, dist) < dist - 0.4) return null;
    return { dist, dir: to, pos: tp };
  }

  think(now) {
    const g = this.g, mode = g.config.gameMode;

    let best = -1, bestScore = Infinity;
    for (const v of this.enemies(now)) {
      const info = this.look(v);
      if (!info) continue;
      let score = info.dist;
      if (mode === 'crown' && g.crownHolder === v) score -= 25;
      if (score < bestScore) { bestScore = score; best = v; }
    }
    if (best >= 0) {
      if (best !== this.target) {
        if (this.target < 0 || now - this.seenAt > 1200) this.reactT = this.lv.react * rand(0.8, 1.25);
        this.target = best;
        this.aimHead = Math.random() < this.lv.head;
      }
      this.seenAt = now;
      const q = g.posOf(best);
      this.lastSeen = { x: q.x, z: q.z, t: now };
    } else if (this.target >= 0 && (now - this.seenAt > 600 || !this.enemies(now).includes(this.target))) {
      this.target = -1;
    }

    this.chooseGoal(now);
  }

  // ---------------------------------------------------------------- objectifs

  chooseGoal(now) {
    const g = this.g, p = this.p, me = this.id, mode = g.config.gameMode;

    if (mode === 'bomb') {
      if (g.bombHolder === me) { // chasseur : le joueur le plus proche qui n'est pas immunisé
        let best = null, bd = Infinity;
        for (const v of g.alive()) {
          if (v === me || g.dead[v] || !g.isEnemy(me, v)) continue;
          const q = g.posOf(v), d = Math.hypot(q.x - p.x, q.z - p.z) + (g.bombNoTag[v] > now ? 30 : 0);
          if (d < bd) { bd = d; best = q; }
        }
        if (best) this.goal = { x: best.x, z: best.z };
      } else if (g.sameTeam(me, g.bombHolder)) { // le porteur est un allié : rien à fuir
        if (!this.goal || now >= this.roamUntil) {
          this.roamUntil = now + rand(3000, 5000);
          this.goal = this.mgr.nav.randomPoint();
        }
      } else {
        this.fleeGoal(now, g.bombHolder);
      }
    } else if (mode === 'crown') {
      const h = g.crownHolder;
      if (h < 0) this.goal = { x: CROWN.x, z: CROWN.z };
      else if (h === me) this.fleeGoal(now, this.nearestEnemy());
      else { const q = g.posOf(h); this.goal = { x: q.x, z: q.z }; }
    } else if (mode === 'flag') {
      // Chaque bot vise un point différent dans la zone pour ne pas se gêner (une zone contestée ne progresse pas)
      const f = g.flag, a = me * 2.4, r = f.radius * 0.45;
      this.goal = { x: f.x + Math.cos(a) * r, z: f.z + Math.sin(a) * r };
    } else if (this.lastSeen && now - this.lastSeen.t < 4000) {
      this.goal = { x: this.lastSeen.x, z: this.lastSeen.z };
    } else if (!this.goal || now >= this.roamUntil) {
      this.roamUntil = now + rand(4000, 7000);
      const e = this.lv.easy ? -1 : this.nearestEnemy();
      if (e >= 0) { // les bots confirmés partent à la chasse, avec une marge d'erreur
        const q = g.posOf(e);
        this.goal = { x: q.x + rand(-5, 5), z: q.z + rand(-5, 5) };
      } else {
        this.goal = this.mgr.nav.randomPoint();
      }
    }
  }

  /** Fuite : on choisit un point éloigné de la menace, pas trop loin de nous. */
  fleeGoal(now, threat) {
    const g = this.g, p = this.p;
    const q = threat >= 0 ? g.posOf(threat) : { x: 0, z: 0 };
    if (this.goal && now < this.fleeUntil && Math.hypot(q.x - this.goal.x, q.z - this.goal.z) > 10) return;
    this.fleeUntil = now + rand(1200, 2200);
    let best = null, bs = -Infinity;
    for (let i = 0; i < 10; i++) {
      const c = this.mgr.nav.randomPoint();
      const score = Math.hypot(c.x - q.x, c.z - q.z) - Math.hypot(c.x - p.x, c.z - p.z) * 0.35 + rand(0, 4);
      if (score > bs) { bs = score; best = c; }
    }
    if (best) this.goal = best;
  }

  // ---------------------------------------------------------------- déplacement

  steer(dt, now) {
    const g = this.g, lv = this.lv, p = this.p;
    this.sprint = false;

    if (this.fighting && now > this.pathOnlyUntil) {
      const tp = g.posOf(this.target);
      const dx = tp.x - p.x, dz = tp.z - p.z, dist = Math.hypot(dx, dz) || 1;
      const nx = dx / dist, nz = dz / dist;
      const knife = this.weapon === 'knife';
      const pref = knife ? 0.5 : this.weapon === 'shotgun' ? 4 : this.weapon === 'sniper' ? 26 : 12;
      const radial = knife ? 1 : clamp((dist - pref) / 5, -1, 1);
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeT = rand(0.6, 1.8);
      }
      const s = knife ? 0 : this.strafeDir * lv.strafe;
      const wx = nx * radial - nz * s, wz = nz * radial + nx * s;
      const l = Math.hypot(wx, wz);
      if (l < 0.05) return { x: 0, z: 0 };
      const k = Math.min(1, l) / l;
      return { x: wx * k, z: wz * k };
    }

    const goal = this.goal;
    if (!goal) return { x: 0, z: 0 };
    this.ensurePath(now);
    while (this.path.length && Math.hypot(this.path[0].x - p.x, this.path[0].z - p.z) < 0.75) this.path.shift();
    const wp = this.path[0] || goal;
    const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.6 && !this.path.length) return { x: 0, z: 0 };
    this.sprint = Math.hypot(goal.x - p.x, goal.z - p.z) > 10;
    return { x: dx / d, z: dz / d };
  }

  ensurePath(now) {
    const goal = this.goal, mgr = this.mgr;
    const moved = !this.pathGoal || Math.hypot(this.pathGoal.x - goal.x, this.pathGoal.z - goal.z) > 2;
    if (!moved && now < this.repathAt) return;
    if (mgr.pathBudget <= 0) return;
    mgr.pathBudget--;
    this.path = mgr.nav.findPath(this.p.x, this.p.z, goal.x, goal.z) || [];
    this.pathGoal = { x: goal.x, z: goal.z };
    this.repathAt = now + rand(900, 1600);
  }

  move(dt, now, wish) {
    const g = this.g, p = this.p, lv = this.lv;
    const len = Math.hypot(wish.x, wish.z);
    const before = { x: p.x, z: p.z };

    this.crouch = lv.hard && this.weapon === 'sniper' && this.fighting;

    if (len > 0.01) {
      let speed = (this.sprint ? 8 : 5.2) * lv.speed * (this.crouch ? 0.58 : 1);
      if (g.isBomb() && g.bombHolder === this.id) speed *= BOMB_SPEED_BONUS;
      const next = { x: p.x + wish.x * speed * dt, y: p.y, z: p.z + wish.z * speed * dt };
      // Capture du drapeau : un bot qui défend la zone ne la quitte pas en plein combat
      const stayInZone = g.isFlag() && this.fighting && g.inZone(p) && !g.inZone(next);
      if (!stayInZone) { p.x = next.x; p.z = next.z; }
      g.world.resolve(p);
    }

    // Bloqué ? On refait le chemin, on saute et on change de côté.
    this.stuckCheck -= dt;
    if (this.stuckCheck <= 0) {
      this.stuckCheck = 0.4;
      const moved = Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z);
      this.lastPos = { x: p.x, z: p.z };
      if (len > 0.3 && moved < 0.25) {
        if (++this.stuckN >= 2) {
          this.stuckN = 0;
          this.pathOnlyUntil = now + 1200;
          this.repathAt = 0;
          this.jumpReq = true;
          this.strafeDir *= -1;
        }
      } else {
        this.stuckN = 0;
      }
    }

    // Saut et gravité (mêmes constantes que le joueur)
    if (this.grounded && (this.jumpReq || (lv.hard && this.fighting && Math.random() < dt * 0.25))) {
      this.vy = 7.2;
      this.grounded = false;
      this.jumpReq = false;
    }
    this.vy -= 18 * dt;
    p.y += this.vy * dt;
    const floor = g.world.floorAt ? g.world.floorAt(p) : 0;
    this.grounded = false;
    if (p.y <= floor && this.vy <= 0) { p.y = floor; this.vy = 0; this.grounded = true; }

    this.moveSpeed = dt > 0 ? Math.hypot(p.x - before.x, p.z - before.z) / dt : 0;
  }

  // ---------------------------------------------------------------- visée

  aim(dt, now, wish) {
    const p = this.p, lv = this.lv;
    let ty = this.yaw, tp = this.pitch;

    if (this.fighting) {
      const t = this.g.posOf(this.target);
      if (now >= this.noiseT) { // petit tremblement de visée, plus fort quand on bouge ou que la cible est loin
        const dist = Math.hypot(t.x - p.x, t.z - p.z);
        const m = lv.err * (1 + dist / 28) * (this.moveSpeed > 1 ? 1.5 : 1);
        this.noise = { yaw: gauss() * m, pitch: gauss() * m * 0.7 };
        this.noiseT = now + rand(200, 420);
      }
      const eyeY = p.y + (this.crouch ? 1.28 : 1.68);
      const h = (this.aimHead ? 1.62 : 1.1) * (t.crouch ? 0.78 : 1);
      const dx = t.x - p.x, dz = t.z - p.z, dy = (t.y || 0) + h - eyeY;
      ty = yawTo(dx, dz) + this.noise.yaw;
      tp = Math.atan2(dy, Math.hypot(dx, dz)) + this.noise.pitch;
    } else if (this.lookAt && now < this.lookAt.until) {
      ty = yawTo(this.lookAt.x - p.x, this.lookAt.z - p.z);
      tp = 0;
    } else if (Math.hypot(wish.x, wish.z) > 0.2) {
      ty = yawTo(wish.x, wish.z);
      tp = 0;
    }

    const maxTurn = lv.turn * dt * (this.fighting ? 1 : 0.8);
    this.yaw += clamp(angDiff(ty, this.yaw), -maxTurn, maxTurn);
    this.pitch = clamp(this.pitch + clamp(tp - this.pitch, -maxTurn, maxTurn), -1.2, 1.2);
    this.aiming = this.fighting && (this.weapon === 'sniper' || (lv.hard && this.weapon === 'rifle'));
  }

  // ---------------------------------------------------------------- combat

  pickWeapon() {
    const g = this.g;
    if (g.isBomb()) return 'knife';
    const guns = g.availableWeapons().filter(w => w !== 'knife');
    if (!guns.length) return 'knife';
    if (guns.length === 1) return guns[0];
    let d = 15;
    if (this.target >= 0) {
      const q = g.posOf(this.target);
      d = Math.hypot(q.x - this.p.x, q.z - this.p.z);
    }
    if (d < 6 && guns.includes('shotgun')) return 'shotgun';
    if (d > 28 && guns.includes('sniper')) return 'sniper';
    return guns.includes('rifle') ? 'rifle' : guns[0];
  }

  startReload(now) {
    if (this.weapon === 'knife' || this.reloading) return;
    this.reloading = true;
    this.reloadWeapon = this.weapon;
    this.reloadUntil = now + WEAPONS[this.weapon].reloadTime * (this.lv.easy ? 1.2 : 1);
  }

  fight(dt, now) {
    const g = this.g;
    if (this.reloading && now >= this.reloadUntil) {
      this.ammo[this.reloadWeapon] = WEAPONS[this.reloadWeapon].capacity;
      this.reloading = false;
    }

    this.weaponT -= dt;
    if (this.weaponT <= 0 && !this.reloading) {
      this.weaponT = rand(0.6, 1.1);
      this.weapon = this.pickWeapon();
    }

    const st = WEAPONS[this.weapon];
    if (!this.fighting) {
      this.burstLeft = 0;
      if (!st.melee && !this.reloading && this.ammo[this.weapon] < st.capacity * 0.4) this.startReload(now);
      return;
    }
    if (this.reloading || now < this.nextShot || now < this.pauseUntil) return;

    this.reactT -= dt * 1000;
    if (this.reactT > 0) return;

    // Géométrie vers la cible (sans test de mur : la cible est visible, on l'a vérifié au dernier `think`)
    const q = g.posOf(this.target), eye = this.eye();
    const dx = q.x - eye.x, dy = (q.y || 0) + 1.1 - eye.y, dz = q.z - eye.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const look = V(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const angle = Math.acos(clamp((look.x * dx + look.y * dy + look.z * dz) / dist, -1, 1));

    if (st.melee) {
      if (Math.hypot(dx, dz) <= 2.3 && angle < 0.8) this.fire(now, st);
      return;
    }
    if (dist > st.range + 3) return;
    if (angle > 0.03 + 0.5 / Math.max(2, dist)) return; // pas encore aligné
    if (this.ammo[this.weapon] <= 0) { this.startReload(now); return; }
    this.fire(now, st);
  }

  fire(now, st) {
    const g = this.g, w = this.weapon, lv = this.lv;
    const base = V(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const eye = this.eye();
    const right = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const up = new THREE.Vector3().crossVectors(right, base).normalize();
    const moving = this.moveSpeed > 0.8, air = !this.grounded, a = this.aiming;
    const hip = { shotgun: 0.03, rifle: 0.012, sniper: 0.05 }[w] ?? 0;
    const tight = { shotgun: 0.01, rifle: 0.002, sniper: 0 }[w] ?? 0;
    const mv = { shotgun: 0.006, rifle: 0.02, sniper: a ? 0.03 : 0.06 }[w] ?? 0;
    const spread = (a ? tight : hip) + (moving ? mv : 0) + (air && w !== 'knife' ? 0.04 : 0);
    const n = w === 'shotgun' ? 8 : 1;
    const dirs = [];
    for (let i = 0; i < n; i++) {
      const r = i === 0 ? 0 : Math.sqrt(Math.random()) * spread, t = Math.random() * Math.PI * 2;
      const d = base.clone().addScaledVector(right, Math.cos(t) * r).addScaledVector(up, Math.sin(t) * r).normalize();
      dirs.push([d.x, d.y, d.z]);
    }
    const shot = { weapon: w, o: [eye.x, eye.y, eye.z], d: dirs };

    if (w !== 'knife') {
      g.renderShot(shot, false);
      g.relayShot(this.id, shot);
    }
    g.resolveShot(this.id, shot);

    this.nextShot = now + st.cooldown * lv.fireMul;
    if (st.melee) return;
    if (--this.ammo[w] <= 0) { this.startReload(now); return; }
    if (w === 'rifle') { // tirs par rafales
      if (this.burstLeft <= 0) this.burstLeft = randInt(lv.burst[0], lv.burst[1]);
      if (--this.burstLeft <= 0) this.pauseUntil = now + rand(lv.pause[0], lv.pause[1]);
    }
  }
}

// ============================================================================
// Gestionnaire
// ============================================================================

export class BotManager {
  constructor(game) {
    this.game = game;
    this.bots = new Map();
    this.nav = null;
    this.pathBudget = 0;
  }

  /** À appeler après la création des joueurs distants (hôte uniquement : les invités n'ont rien à calculer). */
  reset() {
    this.bots.clear();
    this.nav = null;
    const g = this.game;
    if (!g.host || !g.config?.bots?.length) return;
    this.nav = new NavGrid(g.world);
    for (const { id, level } of g.config.bots) {
      const rem = g.remotes.get(id);
      if (!rem) continue;
      this.bots.set(id, new BotController(this, id, level, { x: rem.n.x, z: rem.n.z, yaw: rem.n.yaw }));
    }
  }

  has(id) { return this.bots.has(id); }

  update(dt, now) {
    if (!this.bots.size || this.game.over) return;
    this.pathBudget = 3;
    for (const bot of this.bots.values()) bot.update(Math.min(dt, 0.05), now);
  }

  respawn(ev) {
    this.bots.get(ev.who)?.respawn({ x: ev.x, z: ev.z, yaw: ev.yaw });
  }

  /** Un bot touché se tourne vers son agresseur et part à sa recherche. */
  noticeHit(victim, shooter, now) {
    const bot = this.bots.get(victim);
    if (!bot || shooter === victim) return;
    const q = this.game.posOf(shooter);
    bot.lastSeen = { x: q.x, z: q.z, t: now };
    bot.lookAt = { x: q.x, z: q.z, until: now + 900 };
    bot.roamUntil = 0;
  }
}
