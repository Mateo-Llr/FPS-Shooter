import * as THREE from 'three';
import { editorAssets } from './editor-assets.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const tex = (size, draw) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const speckle = (g, s, n) => {
  for (let i = 0; i < n; i++) {
    const v = (Math.random() * 255) | 0;
    g.fillStyle = `rgba(${v},${v},${v},.09)`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
};

const panel = (base, line = 'rgba(0,0,0,.38)') => tex(256, (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  speckle(g, s, 5000);
  g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(1, 1, s - 2, s - 2);
  g.beginPath(); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
});

const crate = (base, band) => tex(256, (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  speckle(g, s, 5000);
  g.strokeStyle = band; g.lineWidth = 16; g.strokeRect(12, 12, s - 24, s - 24);
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(20, 20); g.lineTo(s - 20, s - 20); g.moveTo(s - 20, 20); g.lineTo(20, s - 20); g.stroke();
});

const floor = (base) => tex(256, (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  speckle(g, s, 9000);
  g.fillStyle = 'rgba(0,0,0,.08)';
  for (let i = 0; i < 6; i++) g.beginPath(), g.arc(Math.random() * s, Math.random() * s, 20 + Math.random() * 30, 0, 7), g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
  g.strokeRect(0, 0, s, s);
});

export const MAPS = editorAssets.maps;
export const DEFAULT_MAP_ID = MAPS[0].id;
export const getMap = id => MAPS.find(map => map.id === id) || MAPS[0];

const skyTexture = () => {
  const width = 1024, height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const gradient = g.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#14243b');
  gradient.addColorStop(0.24, '#2b4964');
  gradient.addColorStop(0.43, '#8296a3');
  gradient.addColorStop(0.52, '#d7ad8a');
  gradient.addColorStop(0.61, '#687784');
  gradient.addColorStop(0.8, '#354257');
  gradient.addColorStop(1, '#18253a');
  g.fillStyle = gradient;
  g.fillRect(0, 0, width, height);

  const sunX = width * 0.72, sunY = height * 0.52;
  const glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, width * 0.24);
  glow.addColorStop(0, 'rgba(255, 213, 166, 0.48)');
  glow.addColorStop(0.28, 'rgba(255, 173, 120, 0.2)');
  glow.addColorStop(1, 'rgba(255, 153, 110, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, width, height);

  const cloudWidth = 512, cloudHeight = 256;
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = cloudWidth;
  cloudCanvas.height = cloudHeight;
  const cloudContext = cloudCanvas.getContext('2d');
  const image = cloudContext.createImageData(cloudWidth, cloudHeight);
  let seed = 0x5eed1234;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const layers = [[5, 4, 0.52], [12, 8, 0.31], [26, 16, 0.17]].map(([cols, rows, weight]) => ({
    cols,
    rows,
    weight,
    values: Array.from({ length: cols * rows }, random)
  }));
  const smooth = value => value * value * (3 - 2 * value);
  const sample = (layer, u, v) => {
    const x = u * layer.cols, y = v * (layer.rows - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = smooth(x - x0), ty = smooth(y - y0);
    const x1 = (x0 + 1) % layer.cols, y1 = Math.min(y0 + 1, layer.rows - 1);
    const a = layer.values[y0 * layer.cols + x0];
    const b = layer.values[y0 * layer.cols + x1];
    const c = layer.values[y1 * layer.cols + x0];
    const d = layer.values[y1 * layer.cols + x1];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
  };

  for (let y = 0; y < cloudHeight; y++) {
    const v = (y + 0.5) / cloudHeight;
    const horizon = Math.exp(-(((v - 0.51) / 0.14) ** 2));
    const highWisps = 0.38 * Math.exp(-(((v - 0.37) / 0.065) ** 2));
    const band = Math.min(1, horizon + highWisps);
    const warmth = THREE.MathUtils.clamp((v - 0.42) / 0.2, 0, 1);
    for (let x = 0; x < cloudWidth; x++) {
      const u = x / cloudWidth;
      const field = layers.reduce((sum, layer) => sum + sample(layer, u, v) * layer.weight, 0);
      const density = THREE.MathUtils.clamp((field - 0.39) / 0.34, 0, 1);
      const alpha = Math.round(density * band * 150);
      const index = (y * cloudWidth + x) * 4;
      image.data[index] = 192 + warmth * 48;
      image.data[index + 1] = 211 - warmth * 17;
      image.data[index + 2] = 226 - warmth * 48;
      image.data[index + 3] = alpha;
    }
  }
  cloudContext.putImageData(image, 0, 0);
  g.drawImage(cloudCanvas, 0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
};

export class World {
  constructor(scene, mapId = DEFAULT_MAP_ID) {
    this.scene = scene;
    this.map = getMap(mapId);
    this.colliders = [];
    this.objects = [];
    this.materialSet = new Set();
    this.halfWidth = this.map.halfWidth;
    this.halfDepth = this.map.halfDepth;

    // Ciel + brouillard atmosphérique
    scene.background = skyTexture();
    scene.fog = new THREE.Fog(this.map.id === 'ruins' ? 0xb8a98c : 0xa9bfcf, 42, Math.max(this.halfWidth, this.halfDepth) * 3);

    // Lumières + ombres
    this.add(new THREE.HemisphereLight(0xdbe8f5, this.map.id === 'ruins' ? 0x514735 : 0x303743, 1.2));
    const sun = new THREE.DirectionalLight(0xffe2bd, 2.4);
    sun.position.set(-14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -this.halfWidth, right: this.halfWidth,
      top: this.halfDepth, bottom: -this.halfDepth, near: 1, far: 100
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.add(sun);

    const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: .92, ...o });
    this.materials = {
      ground: M(floor(this.map.colors.floor)),
      wall: M(panel(this.map.colors.wall)),
      dark: M(panel(this.map.colors.dark)),
      orange: M(crate(this.map.colors.orange, '#52382c')),
      blue: M(crate(this.map.colors.blue, '#293d43')),
      barrel: new THREE.MeshStandardMaterial({ color: this.map.colors.barrel, metalness: .5, roughness: .45 })
    };
    for (const material of Object.values(this.materials)) this.materialSet.add(material);

    this.box(0, -0.25, 0, this.halfWidth * 2, .5, this.halfDepth * 2, this.materials.ground, false); // dessus du sol = y 0

    // Limites de l'arène
    this.box(0, 2, -this.halfDepth, this.halfWidth * 2, 4, .8, this.materials.dark);
    this.box(0, 2, this.halfDepth, this.halfWidth * 2, 4, .8, this.materials.dark);
    this.box(-this.halfWidth, 2, 0, .8, 4, this.halfDepth * 2, this.materials.dark);
    this.box(this.halfWidth, 2, 0, .8, 4, this.halfDepth * 2, this.materials.dark);

    this.map.covers.forEach(([x, y, z, w, h, d, m], index) => {
      const cover = this.box(x, y, z, w, h, d, this.materials[m]);
      cover.name = `Cover ${index + 1}`;
      cover.userData.editorId = `cover:${index}`;
      cover.userData.editorType = 'cover';
      cover.userData.mapCoverIndex = index;
    });

    // Bidons
    this.map.barrels.forEach(([x, z]) => this.barrel(x, z));

    // Néons le long des murs + lumières d'ambiance
    const neon = new THREE.MeshBasicMaterial({ color: 0xff8a4a });
    [
      [0, -this.halfDepth + .45, this.halfWidth * 2, .12, .12],
      [0, this.halfDepth - .45, this.halfWidth * 2, .12, .12],
      [-this.halfWidth + .45, 0, .12, .12, this.halfDepth * 2],
      [this.halfWidth - .45, 0, .12, .12, this.halfDepth * 2]
    ]
      .forEach(([x, z, w, h, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neon);
        m.position.set(x, 3.3, z);
        this.add(m);
      });
    [
      { color: 0xff925e, intensity: 18, x: -11, z: -11 },
      { color: 0x669de0, intensity: 16, x: 11, z: 11 }
    ].forEach(({ color, intensity, x, z }) => {
      const l = new THREE.PointLight(color, intensity, 22, 1.8);
      l.position.set(x, 3.4, z);
      this.add(l);
    });

    // Marquages au sol
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xcfc9b8 });
    for (let x = -this.halfWidth + 4; x < this.halfWidth; x += 4) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(.08, .012, this.halfDepth * 2 - 8), lineMat);
      line.position.set(x, .006, 0);
      this.add(line);
    }

    // Points de réapparition (20, pour 16 joueurs max, orientés vers le centre)
    this.spawns = Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      const position = {
        x: Math.cos(angle) * (this.halfWidth - 4.5),
        y: 0,
        z: Math.sin(angle) * (this.halfDepth - 4.5)
      };
      this.resolve(position);
      return { ...position, yaw: Math.atan2(position.x, position.z) };
    });
  }

  add(object) {
    this.objects.push(object);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        this.materialSet.add(material);
      }
    }
    this.scene.add(object);
    return object;
  }

  dispose() {
    for (const object of this.objects) {
      this.scene.remove(object);
      object.geometry?.dispose();
    }
    for (const material of this.materialSet) {
      material.map?.dispose();
      material.dispose();
    }
    this.scene.background?.dispose();
    this.objects = [];
    this.colliders = [];
  }

  addCollider(x, y, z, w, h, d) {
    this.colliders.push({
      x, z, hw: w / 2, hd: d / 2,
      box: new THREE.Box3(V(x - w / 2, y - h / 2, z - d / 2), V(x + w / 2, y + h / 2, z + d / 2))
    });
  }

  box(x, y, z, w, h, d, mat, collide = true) {
    const g = new THREE.BoxGeometry(w, h, d);
    // UV proportionnels aux dimensions (tuile = 2 m) : textures non étirées
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * dims[f][0] / 2, uv.getY(k) * dims[f][1] / 2);
      }
    }
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = collide;
    mesh.receiveShadow = true;
    this.add(mesh);
    if (collide) this.addCollider(x, y, z, w, h, d);
    return mesh;
  }

  barrel(x, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 1.1, 16), this.materials.barrel);
    m.position.set(x, .55, z);
    m.castShadow = m.receiveShadow = true;
    this.add(m);
    this.addCollider(x, .55, z, .9, 1.1, .9);
  }

  resolve(p) {
    const radius = .42;
    p.x = Math.max(-this.halfWidth + .8 + radius, Math.min(this.halfWidth - .8 - radius, p.x));
    p.z = Math.max(-this.halfDepth + .8 + radius, Math.min(this.halfDepth - .8 - radius, p.z));

    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const c of this.colliders) {
        if (c.box.max.y <= p.y + 0.1) continue; // on est au-dessus : pas de collision latérale
        const minX = c.x - c.hw, maxX = c.x + c.hw;
        const minZ = c.z - c.hd, maxZ = c.z + c.hd;
        const nx = Math.max(minX, Math.min(maxX, p.x));
        const nz = Math.max(minZ, Math.min(maxZ, p.z));
        const dx = p.x - nx, dz = p.z - nz;
        const distanceSq = dx * dx + dz * dz;

        if (distanceSq >= radius * radius) continue;
        if (distanceSq > 1e-8) {
          const distance = Math.sqrt(distanceSq);
          const push = radius - distance;
          p.x += dx / distance * push;
          p.z += dz / distance * push;
        } else {
          const edges = [
            { distance: p.x - minX, x: minX - radius, z: p.z },
            { distance: maxX - p.x, x: maxX + radius, z: p.z },
            { distance: p.z - minZ, x: p.x, z: minZ - radius },
            { distance: maxZ - p.z, x: p.x, z: maxZ + radius }
          ].sort((a, b) => a.distance - b.distance);
          p.x = edges[0].x;
          p.z = edges[0].z;
        }
        moved = true;
      }
      if (!moved) break;
    }
    p.x = Math.max(-this.halfWidth + 1.22, Math.min(this.halfWidth - 1.22, p.x));
    p.z = Math.max(-this.halfDepth + 1.22, Math.min(this.halfDepth - 1.22, p.z));
  }

  /** Hauteur du sol sous le joueur : 0, ou le dessus d'un obstacle franchissable. */
  floorAt(p) {
    let h = 0;
    for (const c of this.colliders) {
      const top = c.box.max.y;
      if (top > h && top <= p.y + 0.35 && Math.abs(p.x - c.x) < c.hw + 0.15 && Math.abs(p.z - c.z) < c.hd + 0.15) h = top;
    }
    return h;
  }

  /** Distance jusqu'au premier obstacle (mur, caisse, sol) le long d'un rayon. */
  rayDistance(origin, dir, max = 100) {
    const ray = new THREE.Ray(origin, dir);
    const hit = V(0, 0, 0);
    let best = max;
    for (const c of this.colliders) {
      if (ray.intersectBox(c.box, hit)) best = Math.min(best, origin.distanceTo(hit));
    }
    if (dir.y < -1e-4) best = Math.min(best, -origin.y / dir.y);
    return best;
  }

  /** Spawn aléatoire parmi les 3 les plus éloignés de tous les joueurs fournis (anti spawn-kill). */
  pickSpawn(avoid, last) {
    const pts = (Array.isArray(avoid) ? avoid : [avoid]).filter(Boolean);
    const list = this.spawns
      .filter(s => s !== last)
      .map(s => ({ s, d: pts.length ? Math.min(...pts.map(p => Math.hypot(s.x - p.x, s.z - p.z))) : 0 }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    return list[Math.floor(Math.random() * list.length)].s;
  }
}
