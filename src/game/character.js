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
 * Hauteur (dans head-model) au-dessus de laquelle les éléments de coiffure « volumineux »
 * (pointes, boucles, crête, mèches...) sont masqués quand un cosmétique recouvre le crâne.
 * Sans ça, ils traversent le chapeau.
 */
export const ACCESSORY_HAIR_CEILING = {
  cap: 2.03, red_cap: 2.03, bucket_hat: 2.03, top_hat: 2.03, crown: 2.02, beanie: 2.03,
  wizard_hat: 2.03, military_helmet: 2.03, space_helmet: 2.03, headphones: 2.02, ninja_mask: 2.02,
  cowboy_hat: 2.03, pirate_hat: 2.03, chef_hat: 2.03, santa_hat: 2.03, beret: 2.03, propeller_cap: 2.03,
  viking_helmet: 2.03, knight_helmet: 2.03, hardhat: 2.03, gaming_headset: 2.02, party_hat: 2.0
};
/** Cosmétiques qui recouvrent entièrement les cheveux. */
export const ACCESSORY_HIDES_ALL_HAIR = new Set(['ninja_mask']);

/**
 * Collection de cosmétiques 3D.
 * Toutes les coordonnées sont exprimées dans head-model (le personnage regarde vers -Z).
 *
 * Repères de la tête :
 *   cube de 0.43, centré en y = 1.72 -> x,z de -0.215 à 0.215, y de 1.505 à 1.935
 *   cheveux : jusqu'à ±0.255 en x/z et y ≈ 2.0
 *   yeux : y 1.74, x ±0.105, devant à z ≈ -0.276 ; sourcils y 1.815 ; nez devant à z ≈ -0.303 ;
 *   bouche y 1.59 ; oreilles x ±0.255, y 1.625-1.795
 *
 * Les couvre-chefs sont donc des volumes en boîtes (comme la tête et les cheveux) de demi-largeur
 * 0.27, entre y = 1.86 et y = 2.03 : ils englobent le crâne ET la coiffure sans que les coins
 * du cube ne dépassent (ce que faisaient les anciens dômes arrondis).
 */
export function accessoryModel(id, opts = {}) {
  const root = new THREE.Group();
  root.name = 'accessory';

  if (!id || id === 'none') return root;

  const mat = (color, metalness = 0, roughness = 0.75, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const glow = (color, intensity = 0.8) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
  const glass = (color, opacity) =>
    new THREE.MeshStandardMaterial({
      color, metalness: 0.2, roughness: 0.08, transparent: true, opacity, depthWrite: false
    });

  const addBox = (size, material, x, y, z, rotation = [0, 0, 0]) => {
    const m = box(root, size, material, x, y, z);
    m.rotation.set(...rotation);
    return m;
  };

  const addSphere = (material, x, y, z, sx, sy, sz, rotation = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(...rotation);
    root.add(m);
    return m;
  };

  const addCylinder = (radius, height, material, x, y, z, rotation = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material);
    m.position.set(x, y, z);
    m.rotation.set(...rotation);
    root.add(m);
    return m;
  };

  const addCone = (radius, height, material, x, y, z, rotation = [0, 0, 0], segments = 8, scale = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), material);
    m.position.set(x, y, z);
    m.rotation.set(...rotation);
    m.scale.set(...scale);
    root.add(m);
    return m;
  };

  const addTorus = (radius, tube, material, x, y, z, rotation = [0, 0, 0], arc = Math.PI * 2) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 20, arc), material);
    m.position.set(x, y, z);
    m.rotation.set(...rotation);
    root.add(m);
    return m;
  };

  /** Chaîne de cylindres effilés : chaque segment [rayonBas, rayonHaut, longueur, inclinaison latérale, inclinaison arrière]. */
  const addLimb = (material, start, side, segments) => {
    const p = new THREE.Vector3(...start);
    const up = new THREE.Vector3(0, 1, 0);
    for (const [rb, rt, len, out, back] of segments) {
      const dir = new THREE.Vector3(
        side * Math.sin(out), Math.cos(out) * Math.cos(back), Math.cos(out) * Math.sin(back)
      ).normalize();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len * 1.06, 8), material);
      m.quaternion.setFromUnitVectors(up, dir);
      m.position.copy(p).addScaledVector(dir, len / 2);
      root.add(m);
      p.addScaledVector(dir, len);
    }
  };

  const black = mat(0x20242c);
  const white = mat(0xe8e5dc);
  const gold = mat(0xe6b83f, 0.75, 0.25);
  const darkGold = mat(0xb98a1e, 0.7, 0.3);
  const silver = mat(0xb9c4cc, 0.8, 0.25);
  const red = mat(0xd64b42);
  const green = mat(0x42a66a);
  const pink = mat(0xe89aa8);

  // Demi-largeur des couvre-chefs : englobe le crâne (0.215) + la coiffure (≈ 0.255).
  const R = 0.27;

  // Masque bas du visage : englobe le nez (devant à -0.303) et la bouche, sans que rien ne traverse.
  const lowerFace = (material, detail) => {
    addBox([0.45, 0.17, 0.11], material, 0, 1.63, -0.265);
    if (detail) detail();
    // Brides jusqu'aux oreilles
    for (const s of [-1, 1]) addBox([0.014, 0.022, 0.2], material, s * 0.228, 1.665, -0.12);
  };

  // Lunettes : cadre en barres (les yeux restent visibles) + verres devant les pupilles.
  const eyewear = ({ frame, lens, thick = 0.018, top = 0.018, rimW = 0.17 }) => {
    const zF = -0.295, zL = -0.292, yE = 1.74;
    for (const s of [-1, 1]) {
      const cx = s * 0.105;
      addBox([rimW - 0.03, 0.088, 0.008], lens, cx, yE, zL);
      addBox([rimW, top, 0.022], frame, cx, yE + 0.046, zF);
      addBox([rimW, thick, 0.022], frame, cx, yE - 0.046, zF);
      addBox([thick, 0.1, 0.022], frame, cx - rimW / 2 + thick / 2, yE, zF);
      addBox([thick, 0.1, 0.022], frame, cx + rimW / 2 - thick / 2, yE, zF);
      // Branches vers les oreilles
      addBox([0.014, 0.016, 0.2], frame, s * 0.224, yE + 0.02, -0.19);
    }
    addBox([0.05, 0.02, 0.022], frame, 0, yE + 0.018, zF);
  };

  // Couvre-chef de type casquette : calotte, plateau, bouton, visière.
  const capShape = (body, brimMat, patchMat) => {
    addBox([2 * R, 0.17, 2 * R], body, 0, 1.945, 0);
    addBox([0.46, 0.035, 0.46], body, 0, 2.0475, 0);
    addBox([0.05, 0.03, 0.05], brimMat, 0, 2.08, 0);
    addBox([0.44, 0.03, 0.2], brimMat, 0, 1.88, -0.37, [-0.14, 0, 0]);
    addBox([0.11, 0.075, 0.012], patchMat, 0, 1.955, -R - 0.002);
  };

  const hairMat = () => mat(opts.hairColor ?? 0x3a2a20);

  // Arceau carré au-dessus des cheveux + écouteurs sur les oreilles.
  const phones = (cup, pad) => {
    addBox([0.6, 0.035, 0.05], black, 0, 2.04, 0);
    for (const s of [-1, 1]) {
      addBox([0.035, 0.27, 0.05], black, s * 0.285, 1.905, 0);
      addBox([0.09, 0.2, 0.16], cup, s * 0.305, 1.71, 0);
      addBox([0.012, 0.1, 0.1], pad, s * 0.355, 1.71, 0);
    }
  };

  switch (id) {
    // CHAPEAUX
    case 'cap':
      capShape(mat(0xe8e5dc), mat(0xc9c5b8), mat(0x397fc4));
      break;

    case 'red_cap':
      capShape(red, mat(0xa8352e), white);
      break;

    case 'bucket_hat': {
      const cloth = mat(0x42a66a);
      addBox([2 * R, 0.15, 2 * R], cloth, 0, 1.955, 0);
      addBox([0.46, 0.03, 0.46], cloth, 0, 2.045, 0);
      addBox([2 * R + 0.02, 0.045, 2 * R + 0.02], mat(0x2f7d4f), 0, 1.9025, 0);
      addBox([0.72, 0.025, 0.72], cloth, 0, 1.87, 0);
      for (const s of [-1, 1]) addBox([0.012, 0.025, 0.025], black, s * (R + 0.004), 1.96, 0);
      break;
    }

    case 'top_hat':
      addBox([0.66, 0.05, 0.66], black, 0, 2.005, 0);            // bord posé sur la coiffure
      addBox([0.36, 0.3, 0.36], black, 0, 2.18, 0);
      addBox([0.39, 0.025, 0.39], black, 0, 2.3425, 0);
      addBox([0.375, 0.07, 0.375], mat(0xb83a33), 0, 2.065, 0);
      addBox([0.07, 0.07, 0.012], gold, 0, 2.065, -0.19);
      break;

    case 'crown': {
      addBox([2 * R, 0.085, 2 * R], gold, 0, 1.9775, 0);
      addBox([2 * R + 0.006, 0.015, 2 * R + 0.006], darkGold, 0, 1.9525, 0);
      const pts = [[-1, -1, 0.15], [0, -1, 0.21], [1, -1, 0.15], [-1, 0, 0.21], [1, 0, 0.21],
        [-1, 1, 0.15], [0, 1, 0.21], [1, 1, 0.15]];
      for (const [sx, sz, h] of pts) {
        addCone(0.065, h, gold, sx * 0.2, 2.02 + h / 2 - 0.005, sz * 0.2, [0, Math.PI / 4, 0], 4);
      }
      addBox([0.05, 0.05, 0.012], red, 0, 1.98, -R - 0.002);
      for (const s of [-1, 1]) addBox([0.012, 0.045, 0.045], mat(0x397fc4), s * (R + 0.002), 1.98, 0);
      break;
    }

    case 'beanie': {
      const wool = mat(0xd64b42);
      addBox([2 * R, 0.17, 2 * R], wool, 0, 1.945, 0);
      addBox([0.46, 0.04, 0.46], wool, 0, 2.05, 0);
      addBox([0.57, 0.075, 0.57], white, 0, 1.8925, 0);
      const rib = mat(0xa8352e);
      addBox([2 * R + 0.006, 0.012, 2 * R + 0.006], rib, 0, 1.975, 0);
      addBox([2 * R + 0.006, 0.012, 2 * R + 0.006], rib, 0, 2.005, 0);
      addSphere(white, 0, 2.13, 0, 0.065, 0.065, 0.065);
      break;
    }

    case 'wizard_hat': {
      const cloth = mat(0x6a3fb0);
      addBox([0.74, 0.03, 0.74], cloth, 0, 1.875, 0);
      addBox([0.56, 0.14, 0.56], cloth, 0, 1.965, 0);
      addBox([0.575, 0.05, 0.575], mat(0x3d2470), 0, 1.92, 0);
      addBox([0.09, 0.08, 0.012], gold, 0, 1.92, -0.292);
      addBox([0.44, 0.14, 0.44], cloth, 0, 2.105, 0);
      addBox([0.33, 0.14, 0.33], cloth, 0, 2.245, 0.015);
      addBox([0.22, 0.14, 0.22], cloth, 0, 2.385, 0.04, [0.12, 0, 0]);
      addCone(0.105, 0.22, cloth, 0, 2.55, 0.1, [0.45, Math.PI / 4, 0], 4);
      for (const [x, y] of [[0, 2.12], [-0.1, 2.08], [0.1, 2.08]]) {
        addBox([0.035, 0.035, 0.012], gold, x, y, -0.222);
      }
      break;
    }

    // BANDEAUX ET BANDANAS
    case 'headband':
      addBox([0.55, 0.07, 0.55], mat(0x397fc4), 0, 1.875, 0);
      addBox([0.34, 0.025, 0.012], white, 0, 1.875, -0.277);
      for (const s of [-1, 1]) addBox([0.05, 0.15, 0.02], mat(0x397fc4), s * 0.04, 1.79, 0.29, [0, 0, s * 0.15]);
      break;

    case 'bandana':
      addBox([0.55, 0.09, 0.55], red, 0, 1.87, 0);
      for (const x of [-0.12, 0, 0.12]) addBox([0.03, 0.03, 0.012], white, x, 1.87, -0.277);
      addBox([0.08, 0.08, 0.06], red, 0, 1.87, 0.29);
      for (const s of [-1, 1]) addBox([0.08, 0.2, 0.02], red, s * 0.045, 1.76, 0.305, [0, 0, s * 0.2]);
      break;

    // LUNETTES
    case 'glasses':
      eyewear({ frame: mat(0x2b2f38, 0.3, 0.4), lens: glass(0xdfeaf2, 0.25) });
      break;

    case 'sunglasses':
      eyewear({
        frame: black, lens: mat(0x0f1722, 0.5, 0.15), thick: 0.022, top: 0.03, rimW: 0.175
      });
      break;

    case 'neon_glasses':
      eyewear({ frame: glow(0x3dff9a, 1.1), lens: glass(0x6bffd6, 0.35), thick: 0.016, top: 0.016 });
      break;

    case 'monocle':
      addTorus(0.062, 0.009, gold, 0.105, 1.74, -0.295);
      addCylinder(0.055, 0.006, glass(0xdfeaf2, 0.25), 0.105, 1.74, -0.293, [Math.PI / 2, 0, 0]);
      addBox([0.008, 0.07, 0.008], gold, 0.15, 1.665, -0.29, [0, 0, 0.35]);
      addBox([0.008, 0.07, 0.008], gold, 0.17, 1.6, -0.28, [0, 0, 0.1]);
      break;

    // MASQUES
    case 'mask':
      lowerFace(mat(0x42a66a), () => addBox([0.45, 0.02, 0.11], mat(0x6cc78c), 0, 1.7, -0.265));
      break;

    case 'medical_mask':
      lowerFace(mat(0x6fb1de), () => {
        for (const y of [1.595, 1.63, 1.665]) addBox([0.4, 0.008, 0.01], white, 0, y, -0.32);
        addBox([0.14, 0.015, 0.012], silver, 0, 1.715, -0.32);
      });
      break;

    case 'ninja_mask': {
      lowerFace(black);
      addBox([2 * R, 0.21, 2 * R], black, 0, 1.945, 0);
      addBox([2 * R + 0.01, 0.045, 2 * R + 0.01], red, 0, 1.862, 0);
      addBox([0.07, 0.04, 0.012], silver, 0, 1.862, -R - 0.006);
      for (const s of [-1, 1]) addBox([0.05, 0.18, 0.02], red, s * 0.04, 1.77, 0.29, [0, 0, s * 0.2]);
      break;
    }

    case 'skull_mask': {
      lowerFace(white, () => {
        addBox([0.05, 0.06, 0.01], black, 0, 1.675, -0.32);
        addBox([0.34, 0.012, 0.01], black, 0, 1.605, -0.32);
        for (let i = -3; i <= 3; i++) addBox([0.012, 0.06, 0.01], black, i * 0.05, 1.575, -0.32);
        addBox([0.012, 0.04, 0.01], black, -0.12, 1.675, -0.32, [0, 0, 0.3]);
        addBox([0.012, 0.04, 0.01], black, 0.12, 1.675, -0.32, [0, 0, -0.3]);
      });
      break;
    }

    // ÉQUIPEMENTS
    case 'headphones':
      phones(mat(0x20242c), mat(0x397fc4));
      break;

    case 'military_helmet': {
      const olive = mat(0x52684a);
      const darkOlive = mat(0x3d4f37);
      addBox([2 * R, 0.165, 2 * R], olive, 0, 1.9425, 0);
      addBox([0.46, 0.04, 0.46], olive, 0, 2.045, 0);
      addBox([0.6, 0.05, 0.6], darkOlive, 0, 1.865, 0);
      addBox([2 * R + 0.01, 0.03, 2 * R + 0.01], darkOlive, 0, 1.96, 0);
      addBox([0.56, 0.1, 0.05], olive, 0, 1.8, 0.29);
      addBox([0.08, 0.08, 0.012], mat(0xd6b84a, 0.4, 0.4), 0, 1.945, -R - 0.002);
      for (const s of [-1, 1]) addBox([0.015, 0.24, 0.03], mat(0x2b3326), s * 0.262, 1.72, -0.12);
      break;
    }

    case 'space_helmet': {
      const frame = mat(0xdfe5ea, 0.3, 0.4);
      addBox([0.56, 0.58, 0.56], glass(0x8dc9e5, 0.2), 0, 1.76, 0);
      addBox([0.64, 0.09, 0.64], frame, 0, 1.47, 0);
      addBox([0.6, 0.045, 0.6], frame, 0, 2.0725, 0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) addBox([0.045, 0.58, 0.045], frame, sx * 0.29, 1.76, sz * 0.29);
        addBox([0.04, 0.08, 0.08], glow(0x3dd6ff, 0.9), sx * 0.325, 1.76, 0);
      }
      addCylinder(0.012, 0.1, silver, 0.2, 2.14, 0.1);
      addSphere(glow(0xff4a3a, 1), 0.2, 2.2, 0.1, 0.03, 0.03, 0.03);
      break;
    }

    // FANTAISIE
    case 'devil_horns':
      for (const s of [-1, 1]) {
        addLimb(red, [s * 0.14, 1.96, -0.02], s, [
          [0.055, 0.042, 0.12, 0.25, 0.15],
          [0.042, 0.028, 0.11, 0.5, 0.25],
          [0.028, 0.004, 0.11, 0.85, 0.35]
        ]);
      }
      break;

    case 'angel_halo':
      addTorus(0.27, 0.022, glow(0xffd84a, 0.9), 0, 2.14, 0, [Math.PI / 2 + 0.08, 0, 0]);
      break;

    case 'cat_ears':
      for (const s of [-1, 1]) {
        addCone(0.11, 0.26, black, s * 0.155, 2.1, -0.01, [0, 0, -s * 0.2], 4, [1, 1, 0.55]);
        addCone(0.065, 0.18, pink, s * 0.152, 2.09, -0.05, [0, 0, -s * 0.2], 4, [1, 1, 0.3]);
      }
      break;

    case 'bunny_ears':
      for (const s of [-1, 1]) {
        addSphere(white, s * 0.12, 2.1, 0, 0.065, 0.21, 0.06, [0, 0, -s * 0.12]);
        addSphere(pink, s * 0.12 + s * 0.004, 2.1, -0.045, 0.03, 0.15, 0.02, [0, 0, -s * 0.12]);
      }
      break;

    case 'robot_antenna':
      addBox([0.08, 0.03, 0.08], silver, 0, 2.01, 0);
      addCylinder(0.018, 0.2, silver, 0, 2.11, 0);
      addSphere(glow(0x42ff8a, 1), 0, 2.23, 0, 0.06, 0.06, 0.06);
      break;

    case 'flower': {
      // Épinglée au-dessus de l'oreille droite, pétales dans le plan YZ (face vers l'extérieur).
      const cx = 0.262, cy = 1.93, cz = -0.07;
      addSphere(gold, cx + 0.012, cy, cz, 0.04, 0.04, 0.04);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI * 2 / 6;
        addSphere(red, cx, cy + Math.cos(a) * 0.07, cz + Math.sin(a) * 0.07, 0.03, 0.05, 0.05);
      }
      addBox([0.012, 0.03, 0.09], green, cx - 0.002, cy - 0.09, cz + 0.07, [0.5, 0, 0]);
      break;
    }

    case 'star': {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + i * Math.PI / 5;
        const r = i % 2 ? 0.055 : 0.12;
        if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
      geo.translate(0, 0, -0.02);
      const star = new THREE.Mesh(geo, glow(0xffd84a, 0.7));
      star.position.set(0, 2.24, 0);
      root.add(star);
      addCylinder(0.012, 0.12, gold, 0, 2.06, 0);
      break;
    }

    case 'earrings':
      for (const s of [-1, 1]) {
        // Anneau vertical (plan YZ) accroché au lobe de l'oreille
        addTorus(0.04, 0.01, gold, s * 0.262, 1.595, 0, [0, Math.PI / 2, 0]);
      }
      break;

    case 'piercing':
      // Piercing de sourcil (côté droit) : deux billes reliées par une barre, collées au sourcil
      addBox([0.008, 0.06, 0.008], silver, 0.13, 1.815, -0.272);
      addSphere(silver, 0.13, 1.845, -0.272, 0.016, 0.016, 0.016);
      addSphere(silver, 0.13, 1.785, -0.272, 0.016, 0.016, 0.016);
      break;

    // ---------------------------------------------------------------- NOUVEAUX CHAPEAUX
    case 'cowboy_hat': {
      const felt = mat(0x8a5a2b), brimM = mat(0x7a4c22);
      addBox([2 * R, 0.17, 2 * R], felt, 0, 1.945, 0);
      addBox([0.42, 0.05, 0.42], felt, 0, 2.055, 0);
      addBox([0.58, 0.025, 0.64], brimM, 0, 1.87, 0);
      for (const s of [-1, 1]) addBox([0.16, 0.025, 0.64], brimM, s * 0.35, 1.895, 0, [0, 0, s * 0.35]); // bords relevés
      addBox([2 * R + 0.01, 0.045, 2 * R + 0.01], mat(0x3b2a1c), 0, 1.9, 0);
      addBox([0.07, 0.05, 0.012], gold, 0, 1.9, -R - 0.008);
      break;
    }

    case 'pirate_hat': {
      const felt = mat(0x1d2027);
      addBox([2 * R, 0.17, 2 * R], felt, 0, 1.945, 0);
      addBox([0.46, 0.03, 0.46], felt, 0, 2.045, 0);
      addBox([0.7, 0.03, 0.7], felt, 0, 1.875, 0);
      for (const s of [-1, 1]) addBox([0.03, 0.16, 0.66], felt, s * 0.363, 1.966, 0, [0, 0, -s * 0.22]);
      addBox([0.66, 0.16, 0.03], felt, 0, 1.966, -0.372, [-0.22, 0, 0]);
      addBox([0.1, 0.075, 0.012], white, 0, 1.962, -0.392, [-0.22, 0, 0]);
      for (const s of [-1, 1]) addBox([0.022, 0.022, 0.012], black, s * 0.025, 1.968, -0.399, [-0.22, 0, 0]);
      addBox([0.7, 0.012, 0.012], gold, 0, 1.892, -0.352);
      break;
    }

    case 'chef_hat': {
      const cloth = mat(0xf2efe6);
      addBox([2 * R, 0.17, 2 * R], cloth, 0, 1.945, 0);
      addBox([0.5, 0.08, 0.5], cloth, 0, 2.07, 0);
      addBox([2 * R + 0.008, 0.012, 2 * R + 0.008], mat(0xd9d5c8), 0, 1.9, 0);
      addSphere(cloth, 0, 2.22, 0, 0.26, 0.16, 0.26);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addSphere(cloth, x * 0.17, 2.17, z * 0.17, 0.17, 0.14, 0.17);
      break;
    }

    case 'party_hat': {
      const cone = mat(0xe0559a);
      addCone(0.17, 0.38, cone, 0, 2.18, 0, [-0.08, 0, 0.06]);
      addTorus(0.128, 0.012, mat(0xffd84a), 0, 2.1, 0, [Math.PI / 2 - 0.08, 0, 0.06]);
      addTorus(0.088, 0.012, mat(0x4ac8ff), 0, 2.2, 0, [Math.PI / 2 - 0.08, 0, 0.06]);
      addSphere(gold, 0.018, 2.37, 0.03, 0.04, 0.04, 0.04);
      break;
    }

    case 'santa_hat': {
      const cloth = mat(0xd22f2f), fur = mat(0xf4f1ea);
      addBox([2 * R, 0.17, 2 * R], cloth, 0, 1.945, 0);
      addBox([0.58, 0.09, 0.58], fur, 0, 1.9, 0);
      addLimb(cloth, [0, 2.03, 0], 1, [
        [0.2, 0.16, 0.14, 0, 0.2], [0.16, 0.12, 0.13, 0, 0.7],
        [0.12, 0.09, 0.12, 0, 1.3], [0.09, 0.07, 0.1, 0, 2.0]
      ]);
      addSphere(fur, 0, 2.235, 0.345, 0.06, 0.06, 0.06);
      break;
    }

    case 'beret': {
      const wool = mat(0x7a2b3a);
      const tilt = new THREE.Group();
      tilt.position.set(0, 1.99, 0);
      tilt.rotation.z = 0.08;
      root.add(tilt);
      box(tilt, [0.56, 0.09, 0.56], wool, 0, 0, 0);
      const second = box(tilt, [0.56, 0.086, 0.56], wool, 0, 0, 0);
      second.rotation.y = Math.PI / 4;
      box(tilt, [0.04, 0.04, 0.04], black, 0, 0.065, 0);
      break;
    }

    case 'propeller_cap': {
      capShape(mat(0x397fc4), mat(0xd64b42), mat(0xffd84a));
      addCylinder(0.012, 0.06, silver, 0, 2.1, 0);
      addBox([0.36, 0.012, 0.07], mat(0xffd84a), 0, 2.135, 0, [0, 0.5, 0]);
      addBox([0.36, 0.012, 0.07], mat(0xd64b42), 0, 2.133, 0, [0, 0.5 + Math.PI / 2, 0]);
      break;
    }

    // ---------------------------------------------------------------- NOUVEAUX ÉQUIPEMENTS
    case 'viking_helmet': {
      const steel = mat(0x9aa4ad, 0.8, 0.35), bone = mat(0xece3c9);
      addBox([2 * R, 0.17, 2 * R], steel, 0, 1.945, 0);
      addBox([0.46, 0.03, 0.46], steel, 0, 2.045, 0);
      addBox([0.04, 0.03, 0.5], steel, 0, 2.07, 0);
      addBox([2 * R + 0.01, 0.04, 2 * R + 0.01], mat(0x6d5a2a, 0.6, 0.4), 0, 1.88, 0);
      addBox([0.04, 0.14, 0.02], steel, 0, 1.79, -0.275);
      for (const s of [-1, 1]) {
        addLimb(bone, [s * 0.27, 1.93, 0], s, [
          [0.05, 0.045, 0.1, 1.35, 0], [0.045, 0.035, 0.1, 0.95, 0],
          [0.035, 0.022, 0.1, 0.45, 0], [0.022, 0.006, 0.1, 0.1, 0]
        ]);
      }
      break;
    }

    case 'knight_helmet': {
      const steel = mat(0x9aa4ad, 0.8, 0.35);
      addBox([0.66, 0.56, 0.58], steel, 0, 1.76, 0);
      addBox([0.05, 0.56, 0.02], mat(0xc4ccd3, 0.8, 0.3), 0, 1.76, -0.292);
      addBox([0.46, 0.045, 0.012], black, 0, 1.76, -0.292);
      for (const y of [1.66, 1.6, 1.54]) addBox([0.03, 0.025, 0.012], black, 0.14, y, -0.292);
      addBox([0.07, 0.14, 0.34], red, 0, 2.11, 0);
      addBox([0.3, 0.03, 0.3], steel, 0, 2.055, 0);
      break;
    }

    case 'hardhat': {
      const yellow = mat(0xf2c230);
      addBox([2 * R, 0.17, 2 * R], yellow, 0, 1.945, 0);
      addBox([0.6, 0.03, 0.6], yellow, 0, 1.865, 0);
      addBox([0.4, 0.025, 0.14], yellow, 0, 1.87, -0.34, [-0.08, 0, 0]);
      addBox([0.1, 0.04, 0.5], mat(0xd9a820), 0, 2.05, 0);
      addBox([0.1, 0.06, 0.04], glow(0xfff2b0, 0.9), 0, 1.975, -R - 0.012);
      break;
    }

    case 'gaming_headset': {
      phones(mat(0x20242c), mat(0xd64b42));
      addBox([0.012, 0.012, 0.2], black, -0.3, 1.64, -0.18);
      addBox([0.23, 0.012, 0.012], black, -0.19, 1.64, -0.285);
      addBox([0.045, 0.045, 0.04], black, -0.065, 1.64, -0.285);
      addBox([0.047, 0.047, 0.012], glow(0xff3b3b, 0.9), -0.065, 1.64, -0.305);
      break;
    }

    // ---------------------------------------------------------------- NOUVELLES LUNETTES
    case 'pilot_goggles': {
      const leather = mat(0x6b4a2b);
      addBox([0.55, 0.05, 0.55], leather, 0, 1.9, 0);
      for (const s of [-1, 1]) {
        addCylinder(0.068, 0.05, gold, s * 0.09, 1.9, -0.3, [Math.PI / 2, 0, 0]);
        addCylinder(0.052, 0.054, glass(0xffb347, 0.65), s * 0.09, 1.9, -0.302, [Math.PI / 2, 0, 0]);
      }
      addBox([0.05, 0.02, 0.03], gold, 0, 1.9, -0.29);
      break;
    }

    case 'cyber_visor': {
      const visor = new THREE.MeshStandardMaterial({
        color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.45, depthWrite: false
      });
      addBox([0.46, 0.1, 0.03], visor, 0, 1.745, -0.3);
      addBox([0.48, 0.016, 0.04], black, 0, 1.8, -0.3);
      addBox([0.48, 0.016, 0.04], black, 0, 1.69, -0.3);
      for (const s of [-1, 1]) {
        addBox([0.016, 0.03, 0.22], black, s * 0.228, 1.745, -0.19);
        addBox([0.03, 0.06, 0.07], glow(0x00e5ff, 1), s * 0.236, 1.745, -0.07);
      }
      break;
    }

    case 'eyepatch': {
      addBox([0.115, 0.1, 0.016], black, -0.105, 1.74, -0.292);
      addBox([0.55, 0.022, 0.02], black, 0, 1.86, -0.268);
      addBox([0.55, 0.022, 0.02], black, 0, 1.86, 0.268);
      for (const s of [-1, 1]) addBox([0.02, 0.022, 0.55], black, s * 0.265, 1.86, 0);
      addBox([0.014, 0.078, 0.012], black, -0.1525, 1.82, -0.29, [0, 0, 0.64]);
      break;
    }

    // ---------------------------------------------------------------- VISAGE
    case 'mustache': {
      const hm = hairMat();
      addBox([0.11, 0.03, 0.045], hm, 0, 1.618, -0.272);
      for (const s of [-1, 1]) addBox([0.05, 0.025, 0.04], hm, s * 0.085, 1.626, -0.27, [0, 0, s * 0.45]);
      break;
    }

    case 'beard': {
      const hm = hairMat();
      for (const s of [-1, 1]) {
        addBox([0.15, 0.17, 0.09], hm, s * 0.15, 1.59, -0.25);
        addBox([0.03, 0.14, 0.2], hm, s * 0.23, 1.62, -0.115);
      }
      addBox([0.3, 0.07, 0.1], hm, 0, 1.54, -0.255);
      addBox([0.2, 0.03, 0.05], hm, 0, 1.618, -0.272);
      addBox([0.1, 0.06, 0.06], hm, 0, 1.485, -0.26);
      break;
    }

    case 'clown_nose':
      addSphere(mat(0xe8322f, 0, 0.35), 0, 1.665, -0.315, 0.065, 0.065, 0.065);
      for (const s of [-1, 1]) addBox([0.07, 0.07, 0.01], mat(0xe8322f), s * 0.15, 1.64, -0.218);
      break;

    // ---------------------------------------------------------------- NOUVELLE FANTAISIE
    case 'unicorn_horn': {
      const d = new THREE.Vector3(0, Math.cos(0.4), -Math.sin(0.4));
      const base = new THREE.Vector3(0, 2.0, -0.12), len = 0.38;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, len, 8), mat(0xfaf3ff, 0.1, 0.4));
      horn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      horn.position.copy(base).addScaledVector(d, len / 2);
      root.add(horn);
      for (const t of [0.25, 0.5, 0.75]) {
        const ring = addTorus(0.06 * (1 - t) + 0.008, 0.008, gold, 0, 0, 0);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
        ring.position.copy(base).addScaledVector(d, len * t);
      }
      break;
    }

    case 'bear_ears':
      for (const s of [-1, 1]) {
        addSphere(mat(0x8b5a2b), s * 0.17, 2.05, -0.02, 0.11, 0.11, 0.06);
        addSphere(mat(0xd9b48a), s * 0.17, 2.05, -0.07, 0.065, 0.065, 0.02);
      }
      break;

    case 'alien_antennae':
      for (const s of [-1, 1]) {
        addLimb(mat(0x56c26a), [s * 0.1, 1.99, -0.02], s, [
          [0.014, 0.012, 0.12, 0.25, 0.1], [0.012, 0.01, 0.12, 0.35, 0.05]
        ]);
        addSphere(glow(0xb6ff3d, 0.9), s * 0.18, 2.24, -0.003, 0.05, 0.05, 0.05);
      }
      break;

    case 'laurel': {
      const leaf = mat(0x7a9a3a);
      const o = 0.275;
      addBox([0.55, 0.014, 0.02], gold, 0, 1.875, -0.268);
      addBox([0.55, 0.014, 0.02], gold, 0, 1.875, 0.268);
      for (const s of [-1, 1]) addBox([0.02, 0.014, 0.55], gold, s * 0.268, 1.875, 0);
      let k = 0;
      for (let i = -3; i <= 3; i++) for (const z of [-o, o]) {
        const tilt = (k++ % 2 ? 1 : -1) * 0.5;
        addBox([0.07, 0.035, 0.022], leaf, i * 0.08, 1.875 + (tilt > 0 ? 0.015 : -0.015), z, [0, 0, tilt]);
      }
      for (let i = -2; i <= 2; i++) for (const x of [-o, o]) {
        const tilt = (k++ % 2 ? 1 : -1) * 0.5;
        addBox([0.022, 0.035, 0.07], leaf, x, 1.875 + (tilt > 0 ? 0.015 : -0.015), i * 0.09, [tilt, 0, 0]);
      }
      break;
    }

    // ---------------------------------------------------------------- BIJOUX
    case 'nose_ring':
      addTorus(0.03, 0.007, gold, 0, 1.62, -0.3);
      break;

    default:
      // Accessoire inconnu : groupe vide, sans erreur.
      break;
  }

  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = !o.material.transparent;
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

  const accessory = accessoryModel(look?.accessory, { hairColor: hair.color.getHex() });
  headModel.add(accessory);

  // Les cosmétiques qui recouvrent le crâne (chapeaux, casques, cagoule) masquent les éléments de
  // coiffure qui les traverseraient (pointes, boucles, crête, mèches...).
  const hairCeiling = ACCESSORY_HAIR_CEILING[look?.accessory];
  if (hairCeiling !== undefined) {
    if (ACCESSORY_HIDES_ALL_HAIR.has(look.accessory)) {
      hairGroup.visible = false;
    } else {
      const volumetric = /^hair-(spike|volume|ridge|quiff|lock|sweep|part|tuft)/;
      let hidden = 0;
      for (const part of hairGroup.children) {
        if (!volumetric.test(part.name)) continue;
        part.geometry.computeBoundingBox();
        const top = part.position.y + part.geometry.boundingBox.max.y * part.scale.y;
        if (top > hairCeiling) { part.visible = false; hidden++; }
      }
      // L'afro n'a pas de coque : sans ses grosses masses, on lui en redonne une sous le chapeau.
      if (hairStyle === 'afro' && hidden) shell({ t: 0.04, top: 0.075, sideBottom: 1.74, backBottom: 1.66 });
    }
  }

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
