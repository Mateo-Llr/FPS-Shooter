
import * as THREE from 'three';

/** Couleurs réseau : identiques dans le lobby et en jeu. */
export const SHIRT_COLORS = [
  0xc94f36, 0x2f7fc1, 0x3fa65a, 0xd6a529,
  0x8b4fc9, 0x1fa6a0, 0xd9568f, 0x7d8a96,
  0xe0782a, 0x5568d6, 0x8fb02f, 0xb23b3b,
  0x3b8f8f, 0xa86b3c, 0x6d6dd0, 0xc9c24a
];

// -------------------------------------------------------
// MATÉRIAUX ET GÉOMÉTRIES
// -------------------------------------------------------

const mat = (color, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true
  });

export const box = (parent, [w, h, d], material, x, y, z) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

function sphere(parent, radius, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 9, 6),
    material
  );
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}

function capsule(parent, radius, length, material, x, y, z, segments = 7) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 2, segments),
    material
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, rt, rb, length, material, x, y, z, segments = 8) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, length, segments),
    material
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylinderZ(parent, radius, length, material, x, y, z) {
  const mesh = cylinder(
    parent, radius, radius, length, material, x, y, z, 10
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function detailBox(parent, size, material, x, y, z, rz = 0) {
  const mesh = box(parent, size, material, x, y, z);
  mesh.rotation.z = rz;
  return mesh;
}

function finishShadows(group) {
  group.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// -------------------------------------------------------
// ARMES
// Orientation : le canon pointe vers -Z
// -------------------------------------------------------

export function gunModel(type) {
  const G = new THREE.Group();

  const metal = mat(0x303943, 0.32, 0.8);
  const darkMetal = mat(0x171d24, 0.42, 0.7);
  const polymer = mat(0x252c32, 0.78);
  const rubber = mat(0x11151a, 0.95);
  const wood = mat(0x65452f, 0.82);
  const accent = mat(0xc45b37, 0.55);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x476a78,
    roughness: 0.2,
    metalness: 0.6
  });

  const muzzle = (z, radius = 0.045) => {
    cylinderZ(G, radius, 0.13, darkMetal, 0, 0.03, z);
    cylinderZ(G, radius * 1.3, 0.035, metal, 0, 0.03, z - 0.07);
  };

  const sight = (z) => {
    // Base
    box(G, [0.11, 0.045, 0.16], darkMetal, 0, 0.13, z);

    // Corps du viseur
    box(G, [0.105, 0.14, 0.13], polymer, 0, 0.22, z);

    // Lentille
    box(G, [0.075, 0.075, 0.015], glass, 0, 0.23, z - 0.07);

    // Protection supérieure
    box(G, [0.15, 0.025, 0.15], darkMetal, 0, 0.3, z);
  };

  const grip = (x, y, z, angle = 0) => {
    const p = box(G, [0.115, 0.27, 0.16], polymer, x, y, z);
    p.rotation.x = angle;

    const base = box(G, [0.14, 0.04, 0.18], rubber, x, y - 0.13, z);
    base.rotation.x = angle;
  };

  const rail = (length, z) => {
    box(G, [0.09, 0.035, length], darkMetal, 0, 0.12, z);
  };

  if (type === 'shotgun') {
    // Corps principal
    box(G, [0.22, 0.19, 0.56], metal, 0, 0, 0);

    // Canon
    cylinderZ(G, 0.06, 0.92, darkMetal, 0, 0.045, -0.68);
    cylinderZ(G, 0.075, 0.09, metal, 0, 0.045, -1.14);

    // Tube inférieur
    cylinderZ(G, 0.039, 0.77, metal, 0, -0.09, -0.56);

    // Garde-main
    box(G, [0.19, 0.15, 0.38], wood, 0, -0.015, -0.45);

    // Crosse
    box(G, [0.19, 0.21, 0.43], wood, 0, -0.015, 0.47);
    box(G, [0.2, 0.23, 0.09], rubber, 0, -0.015, 0.73);

    // Poignée
    grip(0, -0.18, 0.14, -0.2);

    // Pontet
    const guard = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.012, 5, 10, Math.PI),
      darkMetal
    );
    guard.position.set(0, -0.12, 0.04);
    G.add(guard);

    // Guidon
    box(G, [0.035, 0.12, 0.04], metal, 0, 0.13, -0.95);

    G.userData.muzzle = -1.2;

  } else if (type === 'sniper') {
    // Châssis
    box(G, [0.19, 0.18, 0.9], metal, 0, 0, 0);

    // Canon long
    cylinderZ(G, 0.034, 1.22, darkMetal, 0, 0.035, -0.99);

    // Frein de bouche
    cylinderZ(G, 0.06, 0.14, metal, 0, 0.035, -1.65);

    // Crosse
    box(G, [0.18, 0.2, 0.55], polymer, 0, -0.02, 0.68);
    box(G, [0.19, 0.23, 0.09], rubber, 0, -0.02, 0.98);

    // Appui-joue
    box(G, [0.17, 0.075, 0.26], rubber, 0, 0.13, 0.57);

    // Lunette
    cylinderZ(G, 0.068, 0.37, darkMetal, 0, 0.22, -0.06);
    cylinderZ(G, 0.084, 0.055, metal, 0, 0.22, -0.23);
    cylinderZ(G, 0.084, 0.055, metal, 0, 0.22, 0.12);

    cylinderZ(G, 0.057, 0.012, glass, 0, 0.22, -0.27);

    // Montage optique
    box(G, [0.09, 0.09, 0.13], metal, 0, 0.12, -0.05);

    // Chargeur
    box(G, [0.14, 0.3, 0.19], polymer, 0, -0.23, -0.03);
    box(G, [0.12, 0.025, 0.16], rubber, 0, -0.39, -0.03);

    // Poignée
    grip(0, -0.19, 0.25, -0.18);

    // Bipied
    [-1, 1].forEach(s => {
      const leg = cylinder(
        G, 0.015, 0.025, 0.37, darkMetal,
        s * 0.11, -0.2, -0.42, 7
      );
      leg.rotation.z = s * -0.22;
    });

    G.userData.muzzle = -1.72;

  } else {
    // Fusil d'assaut
    box(G, [0.23, 0.2, 0.69], metal, 0, 0, 0);

    // Canon
    cylinderZ(G, 0.045, 0.79, darkMetal, 0, 0.035, -0.68);
    muzzle(-1.13);

    // Garde-main
    box(G, [0.2, 0.17, 0.43], polymer, 0, -0.005, -0.45);

    // Rails latéraux
    box(G, [0.045, 0.055, 0.35], darkMetal, 0.12, 0.015, -0.43);
    box(G, [0.045, 0.055, 0.35], darkMetal, -0.12, 0.015, -0.43);

    // Crosse
    box(G, [0.18, 0.18, 0.36], polymer, 0, -0.005, 0.51);
    box(G, [0.2, 0.2, 0.07], rubber, 0, -0.005, 0.72);

    // Chargeur courbé
    const mag = box(G, [0.14, 0.36, 0.2], darkMetal, 0, -0.25, -0.02);
    mag.rotation.x = -0.13;

    box(G, [0.15, 0.045, 0.21], polymer, 0, -0.44, 0.0);

    // Poignée pistolet
    grip(0, -0.19, 0.21, -0.22);

    // Poignée avant
    grip(0, -0.19, -0.48, 0.12);

    // Viseur
    sight(-0.15);

    // Hausse et guidon
    box(G, [0.06, 0.1, 0.055], darkMetal, 0, 0.15, 0.32);
    box(G, [0.045, 0.11, 0.045], metal, 0, 0.13, -0.82);

    // Sélecteur
    sphere(G, 0.035, accent, 0.13, 0.03, 0.1);

    // Détails du boîtier
    box(G, [0.025, 0.12, 0.25], darkMetal, 0.125, -0.005, 0.02);
    box(G, [0.027, 0.1, 0.2], accent, -0.125, 0.015, 0.02);

    G.userData.muzzle = -1.2;
  }

  finishShadows(G);
  return G;
}

// -------------------------------------------------------
// LABEL DU JOUEUR
// -------------------------------------------------------

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');

  ctx.font = '800 54px "Barlow Condensed", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(text, 256, 65);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 256, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      fog: false
    })
  );

  sprite.scale.set(1.8, 0.45, 1);
  sprite.position.set(0, 2.45, 0);

  return sprite;
}

// -------------------------------------------------------
// PERSONNAGE LOW-POLY PREMIUM
// -------------------------------------------------------

export function createCharacter({
  shirt = 0xc94f36,
  label = null
} = {}) {

  // Matériaux
  const skin = mat(0xc99570);
  const skinLight = mat(0xe0ae88);
  const shirtM = mat(shirt);
  const shirtDark = mat(new THREE.Color(shirt).multiplyScalar(0.7));
  const pants = mat(0x303c4b);
  const pantsDark = mat(0x202b39);
  const boots = mat(0x242329);
  const sole = mat(0x111318);
  const armor = mat(0x343b40);
  const armorLight = mat(0x515a5d);
  const straps = mat(0x171d20);
  const metal = mat(0x737b7d, 0.42, 0.65);
  const accent = mat(0xc45b37);
  const hair = mat(0x292522);

  const g = new THREE.Group();
  g.rotation.order = 'YXZ';

  // -----------------------------------------------------
  // BASSIN ET TORSO
  // -----------------------------------------------------

  // Bassin
  capsule(g, 0.255, 0.17, pants, 0, 0.86, 0, 8);

  // Torse
  capsule(g, 0.31, 0.43, shirtM, 0, 1.39, 0, 9);

  // Épaules
  [-1, 1].forEach(s => {
    sphere(g, 0.16, shirtM, s * 0.29, 1.55, 0, 1, 1, 0.92);
  });

  // Col
  cylinder(g, 0.105, 0.13, 0.12, shirtDark, 0, 1.71, 0, 8);

  // -----------------------------------------------------
  // GILET TACTIQUE
  // -----------------------------------------------------

  const vest = new THREE.Group();
  vest.position.set(0, 1.39, -0.12);
  g.add(vest);

  // Plastron
  box(vest, [0.49, 0.44, 0.11], armor, 0, 0, 0);

  // Partie supérieure
  box(vest, [0.42, 0.09, 0.125], armorLight, 0, 0.19, -0.008);

  // Plaques latérales
  [-1, 1].forEach(s => {
    box(vest, [0.1, 0.38, 0.13], armorLight, s * 0.2, -0.015, 0.0);

    // Attaches
    box(vest, [0.055, 0.39, 0.04], straps, s * 0.24, 0.0, 0.065);

    // Poches latérales
    box(vest, [0.12, 0.16, 0.1], armor, s * 0.24, -0.16, -0.045);
  });

  // Poches frontales
  [-1, 0, 1].forEach(s => {
    const x = s * 0.145;
    box(vest, [0.125, 0.16, 0.065], armorLight, x, -0.07, -0.075);
    box(vest, [0.13, 0.035, 0.075], armor, x, 0.025, -0.08);
    box(vest, [0.035, 0.025, 0.018], metal, x, 0.027, -0.123);
  });

  // Sangle centrale
  box(vest, [0.045, 0.43, 0.035], straps, 0, 0, -0.095);

  // Boucle
  box(vest, [0.09, 0.07, 0.035], metal, 0, -0.24, -0.11);

  // -----------------------------------------------------
  // CEINTURE ET ACCESSOIRES
  // -----------------------------------------------------

  box(g, [0.54, 0.09, 0.38], straps, 0, 0.86, 0);

  box(g, [0.11, 0.075, 0.04], metal, 0, 0.86, -0.21);

  [-1, 1].forEach(s => {
    const pouch = box(
      g, [0.13, 0.15, 0.13], armor, s * 0.28, 0.83, -0.02
    );
    pouch.rotation.z = s * -0.08;
  });

  // -----------------------------------------------------
  // TÊTE
  // -----------------------------------------------------

  // Cou
  cylinder(g, 0.095, 0.105, 0.16, skin, 0, 1.76, 0, 8);

  // Crâne
  sphere(g, 0.205, skinLight, 0, 1.99, 0, 1, 1.14, 0.93);

  // Mâchoire
  sphere(g, 0.15, skin, 0, 1.91, -0.055, 1, 0.65, 0.85);

  // Oreilles
  [-1, 1].forEach(s => {
    sphere(g, 0.052, skin, s * 0.195, 1.99, 0, 0.75, 1, 0.8);
  });

  // Cheveux
  sphere(g, 0.19, hair, 0, 2.12, 0.035, 1, 0.65, 0.95);

  // Casque tactique
  sphere(g, 0.205, armor, 0, 2.13, 0, 1.06, 0.67, 1.05);

  // Bordure du casque
  box(g, [0.41, 0.045, 0.31], armorLight, 0, 2.045, -0.025);

  // Visière avant
  box(g, [0.25, 0.025, 0.08], straps, 0, 2.08, -0.18);

  // Attaches casque
  [-1, 1].forEach(s => {
    box(g, [0.045, 0.12, 0.055], straps, s * 0.17, 1.99, -0.01);
  });

  // Visage stylisé
  // Yeux
  [-1, 1].forEach(s => {
    sphere(g, 0.025, hair, s * 0.075, 2.015, -0.184, 1, 1, 0.5);
  });

  // Nez
  sphere(g, 0.032, skin, 0, 1.98, -0.205, 0.8, 1, 0.8);

  // -----------------------------------------------------
  // BRAS ARTICULÉS
  // -----------------------------------------------------

  const arms = [];

  [-1, 1].forEach(s => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.36, 1.55, 0);
    g.add(shoulder);

    // Épaule
    sphere(shoulder, 0.14, shirtM, 0, -0.04, 0);

    // Bras supérieur
    capsule(
      shoulder, 0.105, 0.28, shirtM,
      0, -0.22, 0, 7
    );

    // Protection de coude
    sphere(
      shoulder, 0.105, armor,
      0, -0.43, 0
    );

    // Avant-bras
    capsule(
      shoulder, 0.09, 0.24, shirtDark,
      0, -0.62, 0, 7
    );

    // Brassard
    cylinder(
      shoulder, 0.095, 0.105, 0.07,
      armorLight, 0, -0.54, 0, 7
    );

    // Poignet
    cylinder(
      shoulder, 0.075, 0.085, 0.07,
      straps, 0, -0.77, 0, 7
    );

    // Main
    sphere(
      shoulder, 0.09, skin,
      0, -0.86, -0.015, 0.9, 1, 0.85
    );

    // Gant
    sphere(
      shoulder, 0.087, straps,
      0, -0.86, -0.045, 0.95, 0.85, 1
    );

    // Plaque d'épaule
    sphere(
      shoulder, 0.115, armorLight,
      s * 0.015, -0.055, -0.01, 1.1, 0.65, 1
    );

    arms.push(shoulder);
  });

  // -----------------------------------------------------
  // JAMBES ARTICULÉES
  // -----------------------------------------------------

  const legs = [];

  [-1, 1].forEach(s => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.16, 0.82, 0);
    g.add(hip);

    // Cuisse
    capsule(
      hip, 0.125, 0.3, pants,
      0, -0.2, 0, 8
    );

    // Poche cargo extérieure
    const cargo = box(
      hip, [0.16, 0.19, 0.12],
      pantsDark, s * 0.105, -0.25, -0.015
    );
    cargo.rotation.z = s * -0.04;

    // Rabat poche
    box(
      hip, [0.16, 0.045, 0.13],
      armor, s * 0.105, -0.16, -0.02
    );

    // Genouillère
    sphere(
      hip, 0.125, armor,
      0, -0.46, -0.025, 1, 0.75, 0.65
    );

    // Sangle genouillère
    box(
      hip, [0.24, 0.045, 0.29],
      straps, 0, -0.45, 0
    );

    // Mollet
    capsule(
      hip, 0.095, 0.29, pants,
      0, -0.66, 0.015, 7
    );

    // Protection cheville
    cylinder(
      hip, 0.095, 0.105, 0.1,
      straps, 0, -0.87, 0, 7
    );

    // Chaussure
    const boot = new THREE.Group();
    boot.position.set(0, -0.93, -0.055);
    hip.add(boot);

    sphere(
      boot, 0.13, boots,
      0, 0, -0.025, 1, 0.72, 1.5
    );

    // Semelle
    box(
      boot, [0.25, 0.045, 0.4],
      sole, 0, -0.075, -0.025
    );

    // Renfort avant
    sphere(
      boot, 0.085, armor,
      0, 0.025, -0.11, 1.15, 0.65, 1
    );

    // Lacets
    [-1, 1].forEach(i => {
      box(
        boot, [0.035, 0.012, 0.09],
        metal, i * 0.035, 0.075, -0.055
      );
    });

    legs.push(hip);
  });

  // -----------------------------------------------------
  // ARMES
  // -----------------------------------------------------

  const guns = {};

  for (const type of ['shotgun', 'rifle', 'sniper']) {
    const weapon = gunModel(type);

    weapon.scale.setScalar(0.72);
    weapon.position.set(0.24, 1.28, -0.31);

    // Inclinaison légère pour une position de port plus naturelle
    weapon.rotation.x = 0.035;

    g.add(weapon);
    guns[type] = weapon;
    weapon.visible = false;
  }

  // Positionnement de base
  guns.rifle.visible = true;

  // -----------------------------------------------------
  // FINITIONS
  // -----------------------------------------------------

  finishShadows(g);

  let sprite = null;

  if (label) {
    sprite = makeLabel(label);
    g.add(sprite);
  }

  return {
    group: g,
    arms,
    legs,
    guns,
    label: sprite
  };
}

// -------------------------------------------------------
// AFFICHAGE DES ARMES
// -------------------------------------------------------

export function showGun(character, type) {
  for (const t in character.guns) {
    character.guns[t].visible = t === type;
  }
}

// -------------------------------------------------------
// ANIMATION IDLE
// -------------------------------------------------------

export function poseIdle(ch, t, phase = 0) {
  const breathe = Math.sin(t * 1.8 + phase);
  const sway = Math.sin(t * 0.9 + phase);

  // Bras
  ch.arms[0].rotation.x =
    0.10 + Math.sin(t * 1.3 + phase) * 0.035;

  ch.arms[1].rotation.x =
    1.05 + Math.sin(t * 1.5 + phase) * 0.025;

  // Légère ouverture des bras
  ch.arms[0].rotation.z = -0.045;
  ch.arms[1].rotation.z = 0.045;

  // Jambes
  ch.legs[0].rotation.x = 0;
  ch.legs[1].rotation.x = 0;

  // Respiration et balancement
  ch.group.position.y = 0;
  ch.group.rotation.z = sway * 0.008;

  return 1 + breathe * 0.004;
}

// -------------------------------------------------------
// NETTOYAGE
// -------------------------------------------------------

export function disposeCharacter(ch) {
  ch.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();

    if (o.material) {
      const materials = Array.isArray(o.material)
        ? o.material
        : [o.material];

      for (const m of materials) {
        m.map?.dispose();
        m.dispose();
      }
    }
  });

  ch.group.parent?.remove(ch.group);
}
