import * as THREE from 'three';

/** Couleurs de maillot : une par id réseau (même couleur dans le lobby et en jeu). */
export const SHIRT_COLORS = [
  0xc94f36, 0x2f7fc1, 0x3fa65a, 0xd6a529, 0x8b4fc9, 0x1fa6a0, 0xd9568f, 0x7d8a96,
  0xe0782a, 0x5568d6, 0x8fb02f, 0xb23b3b, 0x3b8f8f, 0xa86b3c, 0x6d6dd0, 0xc9c24a
];

export const box = (parent, [w, h, d], mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

export function gunModel(t) {
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

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 34px "Barlow Condensed", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText(text, 128, 34);
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, fog: false
  }));
  s.scale.set(1.5, 0.375, 1);
  s.position.set(0, 2.42, 0);
  return s;
}

/**
 * Personnage low-poly. Origine = sous les pieds (y = 0 : semelles au sol), il regarde vers -Z.
 * Retourne { group, arms:[gauche, droit], legs:[gauche, droite], guns:{...} }.
 */
export function createCharacter({ shirt = 0xc94f36, label = null } = {}) {
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const skin = M(0xe0ae88), shirtM = M(shirt), pants = M(0x26374e),
    shoes = M(0x171b22), dark = M(0x252b32);
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';

  box(g, [0.62, 0.72, 0.34], shirtM, 0, 1.12, 0);
  box(g, [0.43, 0.43, 0.43], skin, 0, 1.72, 0);
  box(g, [0.46, 0.12, 0.46], dark, 0, 1.95, 0);
  [-1, 1].forEach(s => box(g, [0.055, 0.055, 0.025], dark, s * 0.105, 1.77, -0.22));

  const arms = [], legs = [];
  [-1, 1].forEach(s => {
    const a = new THREE.Group();
    a.position.set(s * 0.39, 1.38, 0);
    g.add(a);
    box(a, [0.23, 0.66, 0.25], shirtM, 0, -0.32, 0);
    box(a, [0.2, 0.18, 0.22], skin, 0, -0.68, 0);
    arms.push(a);

    // Les semelles touchent exactement y = 0.
    const l = new THREE.Group();
    l.position.set(s * 0.16, 0.78, 0);
    g.add(l);
    box(l, [0.25, 0.68, 0.29], pants, 0, -0.34, 0);
    box(l, [0.27, 0.16, 0.39], shoes, 0, -0.7, -0.035);
    legs.push(l);
  });

  const guns = {};
  for (const t of ['shotgun', 'rifle', 'sniper']) {
    const m = gunModel(t);
    m.scale.setScalar(0.7);
    m.position.set(0.2, 1.28, -0.3);
    g.add(m);
    guns[t] = m;
  }

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });

  let sprite = null;
  if (label) { sprite = makeLabel(label); g.add(sprite); }

  return { group: g, arms, legs, guns, label: sprite };
}

export function showGun(ch, type) {
  for (const t in ch.guns) ch.guns[t].visible = t === type;
}

/** Pose d'attente (lobby) : respiration + léger balancement. */
export function poseIdle(ch, t, phase = 0) {
  ch.arms[0].rotation.x = 0.12 + Math.sin(t * 1.3 + phase) * 0.04;
  ch.arms[1].rotation.x = 1.35 + Math.sin(t * 1.6 + phase) * 0.03;
  ch.legs[0].rotation.x = 0;
  ch.legs[1].rotation.x = 0;
  return 1 + Math.sin(t * 1.8 + phase) * 0.006;
}

export function disposeCharacter(ch) {
  ch.group.traverse(o => {
    o.geometry?.dispose();
    const m = o.material;
    if (m) { m.map?.dispose(); m.dispose(); }
  });
  ch.group.parent?.remove(ch.group);
}
