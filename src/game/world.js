import * as THREE from 'three';

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

const floor = () => tex(256, (g, s) => {
  g.fillStyle = '#5d6467'; g.fillRect(0, 0, s, s);
  speckle(g, s, 9000);
  g.fillStyle = 'rgba(0,0,0,.08)';
  for (let i = 0; i < 6; i++) g.beginPath(), g.arc(Math.random() * s, Math.random() * s, 20 + Math.random() * 30, 0, 7), g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
  g.strokeRect(0, 0, s, s);
});

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
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];

    // Ciel + brouillard atmosphérique
    scene.background = skyTexture();
    scene.fog = new THREE.Fog(0xa9bfcf, 30, 85);

    // Lumières + ombres
    scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x303743, 1.2));
    const sun = new THREE.DirectionalLight(0xffe2bd, 2.4);
    sun.position.set(-14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: .92, ...o });
    this.materials = {
      ground: M(floor()),
      wall: M(panel('#8b9190')),
      dark: M(panel('#3b444b')),
      orange: M(crate('#c96d3d', '#7a3a1c')),
      blue: M(crate('#4f6c80', '#2b3f4e')),
      barrel: new THREE.MeshStandardMaterial({ color: 0x9b3a2a, metalness: .5, roughness: .45 })
    };

    this.box(0, -0.25, 0, 40, .5, 40, this.materials.ground, false); // dessus du sol = y 0

    // Limites de l'arène
    this.box(0, 2, -20, 40, 4, .8, this.materials.dark);
    this.box(0, 2, 20, 40, 4, .8, this.materials.dark);
    this.box(-20, 2, 0, .8, 4, 40, this.materials.dark);
    this.box(20, 2, 0, .8, 4, 40, this.materials.dark);

    // Couvertures (symétriques)
    [
      [-8, 1, -7, 4, 2, 2, 'orange'], [8, 1, 7, 4, 2, 2, 'orange'],
      [8, 1, -7, 3, 2, 2, 'blue'], [-8, 1, 7, 3, 2, 2, 'blue'],
      [0, 1, -10, 7, 2, 1.2, 'wall'], [0, 1, 10, 7, 2, 1.2, 'wall'],
      [-13, .65, 0, 1.5, 1.3, 4, 'orange'], [13, .65, 0, 1.5, 1.3, 4, 'orange'],
      [-5, 1.5, 0, 1.2, 3, 1.2, 'dark'], [5, 1.5, 0, 1.2, 3, 1.2, 'dark'],
      [-13, 2, -12, 6, 4, 5, 'wall'], [13, 2, 12, 6, 4, 5, 'wall'],
      [0, 1, -2, 2, 2, 2, 'blue'], [0, 1, 2, 2, 2, 2, 'blue']
    ].forEach(([x, y, z, w, h, d, m]) => this.box(x, y, z, w, h, d, this.materials[m]));

    // Bidons
    [[-3, -5], [3, 5], [-10, 3], [10, -3], [-3.8, -4.2]].forEach(([x, z]) => this.barrel(x, z));

    // Néons le long des murs + lumières d'ambiance
    const neon = new THREE.MeshBasicMaterial({ color: 0xff8a4a });
    [[0, -19.55, 40, .12, .12], [0, 19.55, 40, .12, .12], [-19.55, 0, .12, .12, 40], [19.55, 0, .12, .12, 40]]
      .forEach(([x, z, w, h, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neon);
        m.position.set(x, 3.3, z);
        scene.add(m);
      });
    [
      { color: 0xff925e, intensity: 18, x: -11, z: -11 },
      { color: 0x669de0, intensity: 16, x: 11, z: 11 }
    ].forEach(({ color, intensity, x, z }) => {
      const l = new THREE.PointLight(color, intensity, 22, 1.8);
      l.position.set(x, 3.4, z);
      scene.add(l);
    });

    // Marquages au sol
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xcfc9b8 });
    for (let x = -16; x <= 16; x += 4) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(.08, .012, 32), lineMat);
      line.position.set(x, .006, 0);
      scene.add(line);
    }

    // Points de réapparition (18, pour 16 joueurs max, orientés vers le centre)
    this.spawns = [
      [-15, 15], [15, -15], [0, 16], [0, -16], [-16, -5], [16, 5], [-4, 6], [4, -6], [-17, -17], [17, 17],
      [-8, 16], [8, -16], [-17, 8], [17, -8], [-9, 0], [9, 0], [-12, 17], [12, -17]
    ].map(([x, z]) => ({ x, z, yaw: Math.atan2(x, z) }));
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
    this.scene.add(mesh);
    if (collide) this.addCollider(x, y, z, w, h, d);
    return mesh;
  }

  barrel(x, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 1.1, 16), this.materials.barrel);
    m.position.set(x, .55, z);
    m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
    this.addCollider(x, .55, z, .9, 1.1, .9);
  }

  resolve(p) {
    p.x = Math.max(-18.8, Math.min(18.8, p.x));
    p.z = Math.max(-18.8, Math.min(18.8, p.z));
    for (const c of this.colliders) {
      if (c.box.max.y <= p.y + 0.1) continue; // on est au-dessus : pas de collision latérale
      const nx = Math.max(c.x - c.hw - .42, Math.min(c.x + c.hw + .42, p.x));
      const nz = Math.max(c.z - c.hd - .42, Math.min(c.z + c.hd + .42, p.z));
      const dx = p.x - nx, dz = p.z - nz;
      if (dx * dx + dz * dz < .42 * .42) {
        if (Math.abs(dx) > Math.abs(dz)) p.x = nx + Math.sign(dx || 1) * .43;
        else p.z = nz + Math.sign(dz || 1) * .43;
      }
    }
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
