import * as THREE from 'three';
import { APPEARANCE_OPTIONS, normalizeAppearance } from './customization.js';
import { editorAssets } from './editor-assets.js';

/** Couleurs de maillot : une par id réseau (même couleur dans le lobby et en jeu). */
export const SHIRT_COLORS = [
  0xc94f36, 0x2f7fc1, 0x3fa65a, 0xd6a529, 0x8b4fc9, 0x1fa6a0, 0xd9568f, 0x7d8a96,
  0xe0782a, 0x5568d6, 0x8fb02f, 0xb23b3b, 0x3b8f8f, 0xa86b3c, 0x6d6dd0, 0xc9c24a
];

export const box = (parent, [w, h, d], mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.name = `mesh-${parent.children.length}`;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

/** Couteau tactique : lame extrudée (pointe, dos droit, tranchant), gouttière, garde, manche strié, pommeau. */
function buildKnife(G, { black, accent }) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xd3dade, metalness: 0.95, roughness: 0.16, side: THREE.DoubleSide });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x39424a, metalness: 0.9, roughness: 0.35 });
  const K = new THREE.Group();

  // Lame : profil dessiné à plat puis tourné (longueur → -Z, largeur → X, épaisseur → Y).
  const L = 0.42, w = 0.04;
  const shape = new THREE.Shape();
  shape.moveTo(0, w);
  shape.lineTo(L * 0.62, w);
  shape.quadraticCurveTo(L * 0.9, w * 0.9, L, -0.004);
  shape.quadraticCurveTo(L * 0.72, -w * 1.15, L * 0.3, -w);
  shape.lineTo(0, -w);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8
  });
  geo.translate(0, 0, -0.006);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, -pos.getY(i), pos.getZ(i), -pos.getX(i));
  geo.computeVertexNormals();
  const blade = new THREE.Mesh(geo, steel);
  blade.position.z = -0.03;
  K.add(blade);
  box(K, [0.014, 0.0215, 0.2], darkSteel, -0.012, 0, -0.23); // gouttière

  // Garde
  box(K, [0.13, 0.03, 0.024], darkSteel, 0, 0, -0.02);
  box(K, [0.02, 0.034, 0.03], accent, 0.065, 0, -0.02);
  box(K, [0.02, 0.034, 0.03], accent, -0.065, 0, -0.02);

  // Manche strié + pommeau
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.22, 10), black);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.12;
  K.add(handle);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.012, 10), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.04 + i * 0.037;
    K.add(ring);
  }
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.03, 10), darkSteel);
  pommel.rotation.x = Math.PI / 2;
  pommel.position.z = 0.245;
  K.add(pommel);

  K.rotation.z = -Math.PI / 2; // lame verticale, tranchant vers le bas
  G.add(K);
}

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
  } else if (t === 'knife') {
    buildKnife(G, { black, accent });
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


/**
 * Collection de cosmétiques 3D.
 * Toutes les coordonnées sont exprimées dans head-model.
 * Le personnage regarde vers -Z.
 */
export function accessoryModel(id) {
  const root = new THREE.Group();
  root.name = 'accessory';

  if (!id || id === 'none') return root;

  const mat = (color, metalness = 0, roughness = 0.75) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });

  const addBox = (size, material, x, y, z, rotation = [0, 0, 0]) => {
    const m = box(root, size, material, x, y, z);
    m.rotation.set(...rotation);
    return m;
  };

  const addSphere = (material, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    root.add(m);
    return m;
  };

  const addCylinder = (radius, height, material, x, y, z, rotation = [0, 0, 0]) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 12),
      material
    );
    m.position.set(x, y, z);
    m.rotation.set(...rotation);
    root.add(m);
    return m;
  };

  const addCone = (radius, height, material, x, y, z, rotation = [0, 0, 0]) => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 8),
      material
    );
    m.position.set(x, y, z);
    m.rotation.set(...rotation);
    root.add(m);
    return m;
  };

  const addTorus = (radius, tube, material, x, y, z, rotation = [0, 0, 0]) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 6, 16),
      material
    );
    m.position.set(x, y, z);
    m.rotation.set(...rotation);
    root.add(m);
    return m;
  };

  const black = mat(0x20242c);
  const white = mat(0xe8e5dc);
  const gold = mat(0xe6b83f, 0.75, 0.25);
  const silver = mat(0xb9c4cc, 0.8, 0.25);
  const red = mat(0xd64b42);
  const blue = mat(0x397fc4);
  const purple = mat(0x9560d1);
  const green = mat(0x42a66a);

  switch (id) {
    // CHAPEAUX
    case 'cap':
      addSphere(white, 0, 1.92, 0.015, 0.245, 0.13, 0.245);
      addBox([0.46, 0.035, 0.2], white, 0, 1.89, -0.19);
      break;

    case 'red_cap':
      addSphere(red, 0, 1.92, 0.015, 0.245, 0.13, 0.245);
      addBox([0.46, 0.035, 0.2], red, 0, 1.89, -0.19);
      break;

    case 'bucket_hat':
      addBox([0.54, 0.045, 0.54], green, 0, 1.94, 0);
      addSphere(green, 0, 1.99, 0.01, 0.18, 0.13, 0.18);
      break;

    case 'top_hat':
      addBox([0.53, 0.045, 0.53], black, 0, 1.95, 0);
      addCylinder(0.16, 0.3, black, 0, 2.11, 0);
      addBox([0.3, 0.025, 0.3], gold, 0, 2.03, -0.01);
      break;

    case 'crown':
      addBox([0.44, 0.055, 0.42], gold, 0, 1.96, 0);
      for (let i = -2; i <= 2; i++) {
        addCone(0.055, 0.16, gold, i * 0.095, 2.065, 0);
      }
      break;

    case 'beanie':
      addSphere(red, 0, 1.94, 0, 0.235, 0.18, 0.235);
      addBox([0.45, 0.065, 0.44], white, 0, 1.84, 0);
      addSphere(white, 0, 2.105, 0, 0.055, 0.055, 0.055);
      break;

    case 'wizard_hat':
      addBox([0.55, 0.04, 0.55], purple, 0, 1.95, 0);
      addCone(0.25, 0.52, purple, 0, 2.21, 0);
      addSphere(gold, 0, 1.99, -0.02, 0.035, 0.035, 0.035);
      break;

    // BANDEAUX ET BANDANAS
    case 'headband':
    case 'bandana':
      addBox([0.47, 0.07, 0.48], id === 'bandana' ? red : blue, 0, 1.86, 0);
      addBox([0.44, 0.035, 0.025], white, 0, 1.86, -0.24);
      if (id === 'bandana') {
        addBox([0.12, 0.08, 0.13], red, 0.22, 1.79, 0.13, [0, 0, -0.4]);
      }
      break;

    // LUNETTES
    case 'glasses':
    case 'sunglasses':
    case 'neon_glasses': {
      const frame = id === 'neon_glasses' ? green : black;
      const lens = id === 'glasses' ? white : mat(0x172d45, 0.2, 0.2);
      for (const side of [-1, 1]) {
        addBox([0.18, 0.105, 0.035], frame, side * 0.105, 1.76, -0.245);
        addBox([0.135, 0.065, 0.012], lens, side * 0.105, 1.76, -0.266);
      }
      addBox([0.07, 0.025, 0.025], frame, 0, 1.78, -0.25);
      break;
    }

    case 'monocle':
      addTorus(0.075, 0.012, gold, 0.105, 1.76, -0.25);
      addBox([0.012, 0.12, 0.012], gold, 0.105, 1.66, -0.24);
      break;

    // MASQUES
    case 'mask':
    case 'ninja_mask':
    case 'medical_mask': {
      const material = id === 'ninja_mask' ? black :
        id === 'medical_mask' ? blue : green;
      addBox([0.36, 0.15, 0.045], material, 0, 1.65, -0.255);
      addBox([0.36, 0.025, 0.025], white, 0, 1.70, -0.28);
      break;
    }

    case 'skull_mask':
      addBox([0.36, 0.19, 0.045], white, 0, 1.65, -0.255);
      addBox([0.09, 0.07, 0.025], black, -0.09, 1.67, -0.282);
      addBox([0.09, 0.07, 0.025], black, 0.09, 1.67, -0.282);
      addBox([0.12, 0.035, 0.025], black, 0, 1.61, -0.282);
      break;

    // ÉQUIPEMENTS
    case 'headphones':
      addTorus(0.22, 0.035, black, 0, 1.79, 0.015);
      for (const side of [-1, 1]) {
        addBox([0.09, 0.19, 0.09], black, side * 0.235, 1.76, 0);
        addBox([0.065, 0.12, 0.025], blue, side * 0.235, 1.76, -0.05);
      }
      break;

    case 'military_helmet':
      addSphere(mat(0x52684a), 0, 1.96, 0, 0.255, 0.16, 0.255);
      addBox([0.48, 0.04, 0.44], mat(0x52684a), 0, 1.91, -0.015);
      break;

    case 'space_helmet':
      addSphere(mat(0x8dc9e5, 0.35, 0.2), 0, 1.77, 0, 0.3, 0.31, 0.3);
      addBox([0.37, 0.22, 0.035], mat(0x347caa, 0.6, 0.2), 0, 1.77, -0.265);
      break;

    // FANTAISIE
    case 'devil_horns':
      for (const side of [-1, 1]) {
        addCone(0.075, 0.27, red, side * 0.16, 2.08, 0,
          [0, 0, side * -0.32]);
      }
      break;

    case 'angel_halo':
      addTorus(0.2, 0.025, gold, 0, 2.13, 0);
      break;

    case 'cat_ears':
      for (const side of [-1, 1]) {
        addCone(0.12, 0.25, black, side * 0.16, 2.02, 0);
      }
      break;

    case 'bunny_ears':
      for (const side of [-1, 1]) {
        addSphere(white, side * 0.12, 2.08, 0, 0.065, 0.21, 0.06);
        addSphere(red, side * 0.12, 2.08, -0.05, 0.025, 0.15, 0.012);
      }
      break;

    case 'robot_antenna':
      addCylinder(0.018, 0.2, silver, 0, 2.04, 0);
      addSphere(green, 0, 2.15, 0, 0.06, 0.06, 0.06);
      break;

    case 'flower':
      addSphere(gold, 0.19, 1.96, -0.06, 0.055, 0.055, 0.055);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        addSphere(red,
          0.19 + Math.cos(a) * 0.075,
          1.96 + Math.sin(a) * 0.075,
          -0.06,
          0.045, 0.045, 0.035);
      }
      break;

    case 'star':
      addCone(0.13, 0.24, gold, 0, 2.08, 0);
      break;

    case 'earrings':
      for (const side of [-1, 1]) {
        addTorus(0.045, 0.012, gold, side * 0.26, 1.62, -0.015,
          [Math.PI / 2, 0, 0]);
      }
      break;

    case 'piercing':
      addSphere(silver, 0.14, 1.68, -0.28, 0.025, 0.025, 0.025);
      break;

    default:
      // Accessoire inconnu : groupe vide, sans erreur.
      break;
  }

  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.userData.cosmetic = id;
    }
  });

  return root;
}

function drawInputIcon(g, inputType) {
  g.save();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (inputType === 'gamepad') {
    g.beginPath();
    g.moveTo(12, 34);
    g.lineTo(19, 20);
    g.quadraticCurveTo(21, 17, 26, 17);
    g.lineTo(53, 17);
    g.quadraticCurveTo(59, 17, 61, 23);
    g.lineTo(67, 39);
    g.quadraticCurveTo(69, 46, 63, 46);
    g.quadraticCurveTo(59, 46, 54, 41);
    g.lineTo(24, 41);
    g.quadraticCurveTo(19, 46, 15, 46);
    g.quadraticCurveTo(9, 46, 11, 39);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(25, 25); g.lineTo(25, 35);
    g.moveTo(20, 30); g.lineTo(30, 30);
    g.moveTo(52, 27); g.lineTo(52, 28);
    g.moveTo(59, 33); g.lineTo(59, 34);
    g.stroke();
  } else {
    g.strokeRect(11, 18, 57, 29);
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 5; column++) {
        g.strokeRect(17 + column * 9, 23 + row * 9, 5, 4);
      }
    }
    g.beginPath();
    g.moveTo(27, 42); g.lineTo(52, 42);
    g.stroke();
  }
  g.restore();
}

function renderLabel(sprite, text, inputType) {
  const canvas = sprite.userData.labelCanvas;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  drawInputIcon(g, inputType);
  g.font = '800 31px "Barlow Condensed", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText(String(text).slice(0, 16), 235, 34);
  g.fillStyle = '#ffffff';
  g.fillText(String(text).slice(0, 16), 235, 34);
  sprite.material.map.needsUpdate = true;
}

function makeLabel(text, inputType) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 64;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, fog: false
  }));
  s.userData.labelCanvas = c;
  s.scale.set(1.5, 0.375, 1);
  s.position.set(0, 2.42, 0);
  renderLabel(s, text, inputType);
  return s;
}

export function updateCharacterLabel(character, text, inputType) {
  if (character.label) renderLabel(character.label, text, inputType);
}

/**
 * Personnage low-poly. Origine = sous les pieds (y = 0 : semelles au sol), il regarde vers -Z.
 * Retourne { group, arms:[gauche, droit], legs:[gauche, droite], guns:{...} }.
 */
export function createCharacter({ shirt = 0xc94f36, label = null, inputType = 'keyboard', appearance = null } = {}) {
  const look = appearance ? normalizeAppearance(appearance) : null;
  const color = (category, fallback) => {
    if (!look) return fallback;
    const hex = APPEARANCE_OPTIONS[category].find(option => option.id === look[category]).color;
    return Number.parseInt(hex.slice(1), 16);
  };
  const M = (c, appearanceCategory = null) => {
    const material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    if (appearanceCategory) material.userData.appearanceCategory = appearanceCategory;
    return material;
  };
  const skin = M(color('skin', 0xe0ae88), 'skin'), shirtM = M(color('shirt', shirt), 'shirt'),
    pants = M(color('pants', 0x26374e), 'pants'), shoes = M(color('shoes', 0x171b22), 'shoes'),
    dark = M(0x252b32);
  const g = new THREE.Group();
  g.name = 'agent';
  g.rotation.order = 'YXZ';
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 1.5;
  const headModel = new THREE.Group();
  headModel.name = 'head-model';
  headModel.position.y = -1.5;
  head.add(headModel);
  g.add(head);

  const torso = new THREE.Group();
  torso.name = 'torso';
  g.add(torso);
  box(torso, [0.62, 0.72, 0.34], shirtM, 0, 1.12, 0);
  // --- TÊTE ---
  box(headModel, [0.43, 0.43, 0.43], skin, 0, 1.72, 0);

  // --- CHEVEUX : GÉOMÉTRIE CORRIGÉE ---

  const hair = M(color('hairColor', 0x493326), 'hairColor');

  const hairGroup = new THREE.Group();
  hairGroup.name = 'hair';
  headModel.add(hairGroup);

  const hairStyle = look?.hairStyle ?? 'classic';

  // Toutes les coordonnées sont exprimées dans headModel.
  // Le visage regarde vers -Z.
  // Le sommet du crâne est à y = 1.935.

  // Repères du crâne (coordonnées de head-model, visage vers -Z) :
  // cube de 0.43 centré en y = 1.72 -> demi-côté 0.215, sommet 1.935, base 1.505.
  const SKULL_R = 0.215;
  const SKULL_TOP = 1.935;

  const hairBox = (name, size, x, y, z, rotation = [0, 0, 0]) => {
    const mesh = box(hairGroup, size, hair, x, y, z);
    if (name) mesh.name = name;
    mesh.rotation.set(...rotation);
    return mesh;
  };

  const hairBall = (x, y, z, sx, sy = sx, sz = sx) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hair);
    mesh.name = `hair-volume-${hairGroup.children.length}`;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    hairGroup.add(mesh);
    return mesh;
  };

  /**
   * Coque de cheveux : dessus + deux côtés + arrière (+ frange), tous de même épaisseur et
   * qui se recouvrent aux angles, donc sans trou ni plaque flottante.
   *  t          épaisseur des côtés / de l'arrière
   *  topT       débord du dessus (>= t)
   *  top        épaisseur du dessus
   *  sideBottom / backBottom   hauteur où s'arrêtent les côtés / l'arrière
   *  sideFront  z où commencent les pattes (plus petit = plus près du front)
   *  fringe     hauteur de la frange (0 = aucune, max ~0.08 pour ne pas cacher les sourcils)
   *  taper      ajoute une bande plus fine en bas (dégradé)
   * Retourne la hauteur de la surface du dessus.
   */
  const shell = ({
    t = 0.035, topT = t, top = 0.08, sideBottom = 1.80, backBottom = sideBottom,
    sideFront = -0.12, fringe = 0, taper = false
  } = {}) => {
    const r = SKULL_R, sk = SKULL_TOP;
    const outer = r + t;
    const topBase = sk - 0.012;
    hairBox('hair-top', [2 * (r + topT), top, 2 * (r + topT)], 0, topBase + top / 2, 0);

    const sideH = sk - sideBottom;
    const sideDepth = outer - sideFront;
    for (const [s, name] of [[-1, 'hair-side-l'], [1, 'hair-side-r']]) {
      hairBox(name, [t + 0.01, sideH, sideDepth],
        s * (r + t / 2 - 0.005), sideBottom + sideH / 2, (sideFront + outer) / 2);
    }

    const backH = sk - backBottom;
    hairBox('hair-back', [2 * outer, backH, t + 0.01], 0, backBottom + backH / 2, r + t / 2 - 0.005);

    if (fringe > 0) {
      hairBox('hair-fringe', [2 * (r + topT), fringe + 0.004, topT + 0.01],
        0, sk + 0.004 - (fringe + 0.004) / 2, -(r + topT / 2 - 0.005));
    }

    if (taper) {
      const o = r + 0.012;
      hairBox('hair-nape', [2 * o, 0.08, 0.022], 0, backBottom - 0.04 + 0.004, r + 0.006);
      for (const [s, name] of [[-1, 'hair-temple-l'], [1, 'hair-temple-r']]) {
        hairBox(name, [0.022, 0.07, o - sideFront], s * (r + 0.006), sideBottom - 0.035 + 0.004, (sideFront + o) / 2);
      }
    }
    return topBase + top;
  };

  // Pointes : cônes qui partent de baseY et s'écartent du centre de la tête.
  const spikes = (list, baseY, height = 0.2, width = 0.065, lean = 1.5) => {
    for (const [x, z, variation = 1] of list) {
      const h = height * variation;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(width, h, 5), hair);
      spike.name = `hair-spike-${hairGroup.children.length}`;
      spike.position.set(x, baseY + h / 2 - 0.01, z);
      spike.rotation.set(z * lean, 0, -x * lean);
      hairGroup.add(spike);
    }
  };

  const ringPoints = (radius, count, offset = 0) => Array.from({ length: count }, (_, i) => {
    const a = offset + (i / count) * Math.PI * 2;
    return [Math.sin(a) * radius, Math.cos(a) * radius];
  });

  switch (hairStyle) {

    // Très court : fine coque près du crâne.
    case 'buzz': {
      shell({ t: 0.015, top: 0.035, sideBottom: 1.84, backBottom: 1.80, sideFront: -0.08 });
      break;
    }

    // Dégradé : dessus plus épais, côtés et nuque qui s'affinent.
    case 'fade': {
      shell({ t: 0.02, topT: 0.035, top: 0.09, sideBottom: 1.86, backBottom: 1.84, sideFront: -0.06, fringe: 0.06, taper: true });
      break;
    }

    // Afro : grosse masse centrale, volume arrière et petites boucles sur le contour.
    case 'afro': {
      hairBall(0, 1.99, 0.035, 0.30, 0.26, 0.30);
      hairBall(0, 1.86, 0.11, 0.27, 0.21, 0.25);
      // Boucles sur les côtés et l'arrière seulement (rien sur le front, sinon elles ressemblent à des yeux).
      ringPoints(0.27, 12, Math.PI / 12).filter(([, z]) => z > 0.02).forEach(([x, z], i) => {
        hairBall(x, 1.95 + (i % 2) * 0.05, z + 0.035, 0.1);
      });
      break;
    }

    // Bouclés : coque fine recouverte de boucles réparties sur le dessus, les côtés et l'arrière.
    case 'curly': {
      const topY = shell({ t: 0.02, top: 0.04, sideBottom: 1.82, backBottom: 1.78 });
      for (const x of [-0.13, 0, 0.13]) {
        for (const z of [-0.12, 0, 0.13]) hairBall(x, topY + 0.015, z, 0.085, 0.08, 0.085);
      }
      ringPoints(0.19, 10).filter(([, z]) => z > -0.12).forEach(([x, z]) => hairBall(x, topY - 0.005, z, 0.08));
      ringPoints(0.225, 14).filter(([, z]) => z > -0.1).forEach(([x, z]) => hairBall(x, 1.885, z, 0.085));
      ringPoints(0.225, 14).filter(([, z]) => z > 0.12).forEach(([x, z]) => hairBall(x, 1.775, z, 0.08));
      break;
    }

    // Crête : côtés rasés, bande centrale d'avant en arrière, pointes dessus.
    case 'mohawk': {
      const topY = shell({ t: 0.015, top: 0.03, sideBottom: 1.83, backBottom: 1.78, sideFront: -0.06 });
      hairBox('hair-ridge', [0.11, 0.09, 0.44], 0, topY - 0.01 + 0.045, 0);
      spikes([-0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18].map((z, i) => [0, z, i % 2 ? 0.85 : 1.05]),
        topY + 0.08, 0.17, 0.06, 1.6);
      break;
    }

    // Longs : jusqu'aux épaules, côtés et arrière continus.
    case 'long': {
      shell({ t: 0.04, top: 0.075, sideBottom: 1.50, backBottom: 1.40, sideFront: -0.13, fringe: 0.075 });
      break;
    }

    // Carré : s'arrête à la mâchoire.
    case 'bob': {
      shell({ t: 0.04, top: 0.075, sideBottom: 1.60, backBottom: 1.58, sideFront: -0.13, fringe: 0.075 });
      break;
    }

    // Queue de cheval : coque + attache + queue qui s'effile vers l'arrière.
    case 'ponytail': {
      shell({ t: 0.035, top: 0.075, sideBottom: 1.80, backBottom: 1.74, fringe: 0.075 });
      const angle = 0.2;                                    // la queue s'écarte de la tête vers le bas
      const dir = new THREE.Vector3(0, -Math.cos(angle), Math.sin(angle));
      const origin = new THREE.Vector3(0, 1.87, 0.275);
      hairBall(origin.x, origin.y, origin.z, 0.075);
      [[0.12, 0.1], [0.1, 0.085], [0.075, 0.07]].forEach(([w, d], i) => {
        const length = 0.14;
        const c = origin.clone().addScaledVector(dir, (i + 0.5) * length);
        hairBox(`hair-tail-${i}`, [w, length + 0.01, d], c.x, c.y, c.z, [-angle, 0, 0]);
      });
      break;
    }

    // Chignon : coque + gros volume sur l'arrière du crâne.
    case 'bun': {
      const topY = shell({ t: 0.035, top: 0.075, sideBottom: 1.80, backBottom: 1.76, fringe: 0.075 });
      hairBall(0, topY + 0.05, 0.14, 0.125);
      break;
    }

    // Raie sur le côté : deux masses qui retombent de part et d'autre de la raie.
    case 'sidepart': {
      const topY = shell({ t: 0.035, top: 0.07, sideBottom: 1.80, backBottom: 1.78, fringe: 0.075 });
      hairBox('hair-sweep', [0.27, 0.04, 0.4], -0.075, topY + 0.005, 0, [0, 0, 0.1]);
      hairBox('hair-part', [0.15, 0.03, 0.4], 0.13, topY, 0, [0, 0, -0.1]);
      break;
    }

    // Undercut : côtés rasés, dessus long relevé vers l'avant.
    case 'undercut': {
      const topY = shell({ t: 0.015, topT: 0.03, top: 0.1, sideBottom: 1.84, backBottom: 1.80, sideFront: -0.06, fringe: 0.07, taper: true });
      hairBox('hair-lock', [0.3, 0.07, 0.36], 0, topY + 0.01, -0.02);
      hairBox('hair-quiff', [0.28, 0.08, 0.12], 0, topY + 0.03, -0.19, [0.3, 0, 0]);
      break;
    }

    // Hérissés : coque + pointes réparties sur tout le dessus, orientées vers l'extérieur.
    case 'spiky': {
      const topY = shell({ t: 0.03, top: 0.06, sideBottom: 1.78, backBottom: 1.76 });
      const list = [[0, 0, 1.15]];
      ringPoints(0.1, 6).forEach(([x, z], i) => list.push([x, z, i % 2 ? 0.9 : 1.05]));
      ringPoints(0.185, 10, Math.PI / 10).forEach(([x, z], i) => list.push([x, z, i % 2 ? 0.75 : 0.9]));
      spikes(list, topY, 0.21, 0.065, 1.5);
      break;
    }

    // Classique : coque, frange et petite mèche qui retombe à gauche.
    case 'classic':
    default: {
      const topY = shell({ t: 0.035, top: 0.075, sideBottom: 1.80, backBottom: 1.78, fringe: 0.075 });
      hairBox('hair-tuft', [0.24, 0.05, 0.22], -0.06, topY + 0.01, -0.09, [0, 0, 0.08]);
      break;
    }
  }

  // --- OREILLES ---
  // Les cheveux longs et le carré recouvrent les oreilles : on ne les crée pas pour éviter
  // qu'elles ne traversent la coiffure.
  if (hairStyle !== 'long' && hairStyle !== 'bob') {
    box(headModel, [0.09, 0.17, 0.15], skin, -0.255, 1.71, 0);
    box(headModel, [0.09, 0.17, 0.15], skin, 0.255, 1.71, 0);
  }

  // --- VISAGE ---
  const face = new THREE.Group();
  face.name = 'face';
  face.position.set(0, -0.02, -0.025);
  headModel.add(face);

  // Yeux
  const eye = M(0x25232a);
  const eyeWhite = M(0xf1e9dc);

  [-1, 1].forEach(s => {
    box(face, [0.085, 0.075, 0.025], eyeWhite,
      s * 0.105, 1.76, -0.222);

    box(face, [0.045, 0.055, 0.018], eye,
      s * 0.105, 1.76, -0.242);
  });

  // Sourcils
  const brow = hair;

  [-1, 1].forEach(s => {
    const b = box(face, [0.105, 0.035, 0.035], brow,
      s * 0.105, 1.835, -0.225);

    b.rotation.z = s * -0.08;
  });

  // Nez très discret
  box(face, [0.065, 0.075, 0.065], skin,
    0, 1.69, -0.245);

  // Bouche
  const mouth = M(0x75443e);
  box(face, [0.105, 0.025, 0.025], mouth,
    0, 1.61, -0.225);

  const accessory = accessoryModel(look?.accessory);
  headModel.add(accessory);

  const arms = [], legs = [];
  [-1, 1].forEach(s => {
    const a = new THREE.Group();
    a.name = s < 0 ? 'arm-left' : 'arm-right';
    a.position.set(s * 0.39, 1.38, 0);
    g.add(a);
    box(a, [0.23, 0.66, 0.25], shirtM, 0, -0.32, 0);
    if (look?.shirtStyle === 'stripes') {
      box(a, [0.035, 0.5, 0.012], M(0xe7d4be), 0, -0.32, -0.13);
    }
    box(a, [0.2, 0.18, 0.22], skin, 0, -0.68, 0);
    arms.push(a);

    // Les semelles touchent exactement y = 0.
    const l = new THREE.Group();
    l.name = s < 0 ? 'leg-left' : 'leg-right';
    l.position.set(s * 0.16, 0.78, 0);
    g.add(l);
    box(l, [0.25, 0.68, 0.29], pants, 0, -0.34, 0);
    box(l, [0.27, 0.16, 0.39], shoes, 0, -0.7, -0.035);
    legs.push(l);
  });
  if (look?.shirtStyle === 'stripes') {
    const stripe = M(0xe7d4be);
    box(torso, [0.045, 0.58, 0.018], stripe, -0.12, 1.12, -0.176);
    box(torso, [0.045, 0.58, 0.018], stripe, 0.12, 1.12, -0.176);
  } else if (look?.shirtStyle === 'jacket') {
    const trim = M(0x202a32);
    box(torso, [0.09, 0.69, 0.02], trim, -0.22, 1.12, -0.17);
    box(torso, [0.09, 0.69, 0.02], trim, 0.22, 1.12, -0.17);
    box(torso, [0.025, 0.58, 0.018], M(0xd8d5ca), 0, 1.12, -0.182);
  }

  const guns = {};
  const gripPositions = {
    shotgun: [0, -0.18, 0.14],
    rifle: [0, -0.19, 0.13],
    sniper: [0, -0.18, 0.2]
  };
  // Le couteau se tient lame vers l'avant, sans l'inclinaison des armes à feu.
  const KNIFE_POSE = { position: [0, -0.7, -0.15], rotationX: 0 };
  const armPose = 1.35;
  for (const t of ['shotgun', 'rifle', 'sniper', 'knife']) {
    const m = gunModel(t);
    m.scale.setScalar(0.7);
    if (t === 'knife') {
      m.rotation.x = KNIFE_POSE.rotationX;
      m.position.set(...KNIFE_POSE.position);
    } else {
      m.rotation.x = -armPose;
      const grip = new THREE.Vector3(...gripPositions[t])
        .multiplyScalar(0.7)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), m.rotation.x);
      m.position.set(-grip.x, -0.68 - grip.y, -grip.z);
    }
    m.name = `gun-${t}`;
    m.userData.gunType = t;
    arms[1].add(m);
    guns[t] = m;
  }

  for (const part of editorAssets.character.additions || []) {
    const geometries = {
      box: () => new THREE.BoxGeometry(1, 1, 1),
      sphere: () => new THREE.SphereGeometry(0.5, 16, 12),
      cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      cone: () => new THREE.ConeGeometry(0.5, 1, 12)
    };
    const geometry = geometries[part.geometry]?.();
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, M(Number.parseInt(part.color.slice(1), 16)));
    mesh.name = part.name;
    mesh.userData.editorId = `custom:${part.id}`;
    mesh.userData.editorCustomId = part.id;
    mesh.position.fromArray(part.position);
    mesh.rotation.fromArray([...part.rotation, 'XYZ']);
    mesh.scale.fromArray(part.scale);
    g.add(mesh);
  }

  const transforms = editorAssets.character.transforms || {};
  g.traverse(object => {
    if (object === g || object.userData.editorCustomId) return;
    // L'identifiant contient la variante (hair:afro, accessory:cap, gun-rifle) : chaque coupe,
    // accessoire et arme garde ses propres réglages.
    const parts = [];
    for (let node = object; node && node !== g; node = node.parent) {
      parts.unshift(
        node === hairGroup ? `hair:${hairStyle}`
          : node === accessory ? `accessory:${look?.accessory ?? 'none'}`
            : node.name || `part-${node.parent.children.indexOf(node)}`
      );
    }
    object.userData.editorId = parts.join('/');
    const editableColor = object.material?.color && !object.material.userData.appearanceCategory;
    // Valeurs du code, avant réglages enregistrés : l'éditeur s'en sert pour « Réinitialiser »
    // et pour n'enregistrer que ce qui a vraiment été modifié.
    object.userData.editorDefault = {
      p: object.position.clone(),
      r: object.rotation.clone(),
      s: object.scale.clone(),
      c: object.isMesh && editableColor ? object.material.color.getHex() : null
    };
    const saved = transforms[object.userData.editorId];
    if (!saved) return;
    if (saved.position) object.position.fromArray(saved.position);
    if (saved.rotation) object.rotation.fromArray([...saved.rotation, 'XYZ']);
    if (saved.scale) object.scale.fromArray(saved.scale);
    if (saved.color && editableColor) object.material.color.set(saved.color);
  });

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const editorBase = {
    head: head.rotation.clone(),
    arms: arms.map(arm => arm.rotation.clone()),
    legs: legs.map(leg => leg.rotation.clone())
  };

  let sprite = null;
  if (label) { sprite = makeLabel(label, inputType); g.add(sprite); }

  return {
    group: g,
    arms,
    legs,
    head,
    guns,
    label: sprite,
    editorBase,
    motion: { time: 0, phase: 0, run: 0, aim: 0 }
  };
}

export function showGun(ch, type) {
  for (const t in ch.guns) ch.guns[t].visible = t === type;
}

/** Animation de locomotion et de visée pour les personnages visibles à la troisième personne. */
export function animateCharacter(ch, dt, { speed = 0, aiming = false, pitch = 0, crouched = false } = {}) {
  const base = ch.editorBase;
  const motion = ch.motion;
  const blend = 1 - Math.exp(-Math.min(dt, 0.05) * 10);
  const targetRun = THREE.MathUtils.clamp((speed - 0.35) / 4.5, 0, 1);
  motion.run += (targetRun - motion.run) * blend;
  motion.aim += ((aiming ? 1 : 0) - motion.aim) * blend;
  motion.time += dt;
  motion.phase += dt * (5.5 + Math.min(speed, 9) * 0.85);

  const run = motion.run;
  const aim = motion.aim;
  const step = Math.sin(motion.phase);
  const stride = crouched ? 0.62 : 1;
  const aimPitch = THREE.MathUtils.clamp(pitch, -1.1, 1.1) * 0.42;
  ch.head.rotation.x = (base?.head.x || 0) + THREE.MathUtils.clamp(pitch, -0.8, 0.8) * 0.65;
  const leftArmAim = (base?.arms[0].x || 0) + 1.12 + aimPitch;
  const rightArmAim = (base?.arms[1].x || 0) + 1.48 + aimPitch;
  const breathing = Math.sin(motion.time * 2.1) * (1 - run) * 0.025;

  ch.arms[0].rotation.x =
    THREE.MathUtils.lerp((base?.arms[0].x || 0) + 0.06 + breathing + Math.sin(motion.phase + Math.PI) * 0.78 * run * stride, leftArmAim, aim);
  ch.arms[1].rotation.x =
    THREE.MathUtils.lerp((base?.arms[1].x || 0) + 0.72 + breathing + step * 0.32 * run * stride, rightArmAim, aim);
  ch.arms[0].rotation.z = (base?.arms[0].z || 0) + THREE.MathUtils.lerp(0, 0.28, aim);
  ch.arms[1].rotation.z = (base?.arms[1].z || 0) + THREE.MathUtils.lerp(0, -0.12, aim);

  ch.legs[0].rotation.x = (base?.legs[0].x || 0) + step * 0.62 * run * stride;
  ch.legs[1].rotation.x = (base?.legs[1].x || 0) - step * 0.62 * run * stride;
}

/** Pose d'attente (lobby) : respiration + léger balancement. */
export function poseIdle(ch, t, phase = 0) {
  const base = ch.editorBase;
  ch.arms[0].rotation.x = (base?.arms[0].x || 0) + 0.12 + Math.sin(t * 1.3 + phase) * 0.04;
  ch.arms[1].rotation.x = (base?.arms[1].x || 0) + 0.72 + Math.sin(t * 1.6 + phase) * 0.035;
  ch.arms[0].rotation.z = base?.arms[0].z || 0;
  ch.arms[1].rotation.z = base?.arms[1].z || 0;
  ch.legs[0].rotation.x = base?.legs[0].x || 0;
  ch.legs[1].rotation.x = base?.legs[1].x || 0;
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
