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

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];

    // Ciel + brouillard atmosphérique
    const sky = tex(512, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, '#3f6490'); gr.addColorStop(.5, '#a9bfcf'); gr.addColorStop(1, '#ead9bd');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    sky.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = sky;
    scene.fog = new THREE.Fog(0xa9bfcf, 30, 85);

    // Lumières + ombres
    scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x4a4a52, 1.5));
    const sun = new THREE.DirectionalLight(0xffe2bd, 2.6);
    sun.position.set(-14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 70 });
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

    this.box(0, -0.35, 0, 40, .5, 40, this.materials.ground, false);

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
    [[-12, -12], [12, 12], [12, -12], [-12, 12]].forEach(([x, z]) => {
      const l = new THREE.PointLight(0xff9a60, 12, 16, 1.6);
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

    // Points de réapparition (9 répartis, orientés vers le centre)
    this.spawns = [[-15, 15], [15, -15], [0, 16], [0, -16], [-16, -5], [16, 5], [-4, 6], [4, -6], [-17, -17], [17, 17]]
      .map(([x, z]) => ({ x, z, yaw: Math.atan2(x, z) }));
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
      const nx = Math.max(c.x - c.hw - .42, Math.min(c.x + c.hw + .42, p.x));
      const nz = Math.max(c.z - c.hd - .42, Math.min(c.z + c.hd + .42, p.z));
      const dx = p.x - nx, dz = p.z - nz;
      if (dx * dx + dz * dz < .42 * .42) {
        if (Math.abs(dx) > Math.abs(dz)) p.x = nx + Math.sign(dx || 1) * .43;
        else p.z = nz + Math.sign(dz || 1) * .43;
      }
    }
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

  /** Spawn aléatoire parmi les 3 plus éloignés de l'adversaire (anti spawn-kill). */
  pickSpawn(avoid, last) {
    const list = this.spawns
      .filter(s => s !== last)
      .map(s => ({ s, d: Math.hypot(s.x - avoid.x, s.z - avoid.z) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    return list[Math.floor(Math.random() * list.length)].s;
  }
}
