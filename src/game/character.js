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
    box(G, [0.07, 0.08, 0.3], black, 0, -0.02, 0.12);
    box(G, [0.16, 0.055, 0.07], metal, 0, 0.02, -0.06);
    box(G, [0.065, 0.07, 0.38], metal, 0, 0.035, -0.28);
    box(G, [0.045, 0.035, 0.1], accent, 0, 0.035, -0.52);
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
export function createCharacter({ shirt = 0xc94f36, label = null, appearance = null } = {}) {
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

  // Cheveux : volume principal
  const hair = M(color('hairColor', 0x493326), 'hairColor');
  const hairGroup = new THREE.Group();
  hairGroup.name = 'hair';
  headModel.add(hairGroup);
  const hairStyle = look?.hairStyle ?? 'classic';
  const hairBox = (size, x, y, z) => box(hairGroup, size, hair, x, y, z);
  const hairBall = (x, y, z, scale) => {
    const curl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), hair);
    curl.name = `curl-${hairGroup.children.length}`;
    curl.position.set(x, y, z);
    curl.scale.set(...scale);
    hairGroup.add(curl);
  };
  const crown = (height = 0.15, y = 1.96, width = 0.47) =>
    hairBox([width, height, 0.47], 0, y, 0);
  const fringe = () => hairBox([0.43, 0.1, 0.13], 0, 1.88, -0.19);
  const sides = (height = 0.19, y = 1.82, width = 0.09) => {
    hairBox([width, height, 0.44], -0.2, y, 0);
    hairBox([width, height, 0.44], 0.2, y, 0);
  };
  const spikes = (count, height, width = 0.09) => {
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.085;
      const spikeHeight = height * (i % 2 === 0 ? 1 : 0.76);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(width, spikeHeight, 5), hair);
      spike.name = `spike-${hairGroup.children.length}`;
      spike.position.set(x, 2.04 + spikeHeight * 0.18, 0);
      spike.rotation.z = (i - (count - 1) / 2) * 0.15;
      hairGroup.add(spike);
    }
  };

  if (hairStyle === 'buzz') {
    crown(0.07, 1.94, 0.44);
    sides(0.12, 1.82, 0.035);
  } else if (hairStyle === 'fade') {
    crown(0.12, 1.96, 0.46);
    sides(0.14, 1.82, 0.045);
    fringe();
  } else if (hairStyle === 'afro') {
    hairBall(0, 1.98, 0, [1.35, 1.15, 1.3]);
    [[-0.18, 1.99, -0.14], [0, 2.09, -0.12], [0.18, 1.99, -0.14],
      [-0.2, 1.91, 0.08], [0.2, 1.91, 0.08]].forEach(([x, y, z]) =>
      hairBall(x, y, z, [0.95, 0.9, 0.95]));
  } else if (hairStyle === 'curly') {
    crown(0.1, 1.96, 0.46);
    for (const x of [-0.16, 0, 0.16]) {
      for (const z of [-0.15, 0.04, 0.2]) {
        hairBall(x, z < 0 ? 2.01 : 2.03, z, [0.82, 0.78, 0.82]);
      }
    }
    hairBall(-0.21, 1.84, 0.02, [0.65, 0.85, 0.85]);
    hairBall(0.21, 1.84, 0.02, [0.65, 0.85, 0.85]);
  } else if (hairStyle === 'mohawk') {
    crown(0.055, 1.92, 0.44);
    sides(0.11, 1.81, 0.04);
    hairBox([0.15, 0.18, 0.42], 0, 2.02, 0);
    spikes(5, 0.2, 0.075);
    fringe();
  } else if (hairStyle === 'long' || hairStyle === 'bob' || hairStyle === 'ponytail') {
    crown();
    fringe();
    const length = hairStyle === 'long' ? 0.5 : hairStyle === 'bob' ? 0.35 : 0.2;
    const y = hairStyle === 'long' ? 1.68 : hairStyle === 'bob' ? 1.75 : 1.82;
    sides(length, y, 0.1);
    if (hairStyle === 'ponytail') {
      hairBox([0.14, 0.34, 0.14], 0.12, 1.7, 0.26);
      hairBox([0.16, 0.05, 0.16], 0.12, 1.86, 0.26);
    }
  } else if (hairStyle === 'bun') {
    crown();
    fringe();
    sides();
    hairBall(0, 2.04, 0.2, [0.75, 0.75, 0.75]);
  } else if (hairStyle === 'sidepart') {
    crown();
    fringe();
    sides();
    hairBox([0.24, 0.08, 0.15], 0.08, 1.92, -0.15);
    hairBox([0.12, 0.045, 0.12], -0.11, 2.045, -0.04);
  } else if (hairStyle === 'undercut') {
    crown(0.16, 1.97);
    fringe();
    sides(0.12, 1.78, 0.04);
    hairBox([0.24, 0.09, 0.15], 0.1, 1.93, -0.15);
  } else {
    crown();
    fringe();
    sides();
    if (hairStyle === 'spiky') {
      spikes(7, 0.25, 0.08);
    } else if (hairStyle === 'classic') {
      hairBox([0.23, 0.08, 0.15], -0.075, 2.035, -0.14);
      hairBox([0.16, 0.06, 0.13], 0.09, 1.99, -0.17);
    } else {
      hairBox([0.16, 0.07, 0.13], -0.1, 2.045, -0.06);
      hairBox([0.13, 0.06, 0.12], 0.1, 2.045, 0.02);
    }
  }

  // --- OREILLES ---
  box(headModel, [0.09, 0.17, 0.15], skin, -0.255, 1.71, 0);
  box(headModel, [0.09, 0.17, 0.15], skin, 0.255, 1.71, 0);

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

  const accessory = new THREE.Group();
  accessory.name = 'accessory';
  headModel.add(accessory);
  if (look?.accessory === 'cap') {
    const cap = M(0xd1d2cb);
    box(accessory, [0.49, 0.1, 0.48], cap, 0, 2.015, 0);
    box(accessory, [0.48, 0.035, 0.22], cap, 0, 1.965, -0.2);
  } else if (look?.accessory === 'headband') {
    box(accessory, [0.47, 0.065, 0.48], M(0xf07845), 0, 1.86, 0);
    box(accessory, [0.44, 0.07, 0.025], M(0xf07845), 0, 1.86, -0.23);
  } else if (look?.accessory === 'glasses') {
    const frame = M(0x252b32);
    box(accessory, [0.17, 0.1, 0.035], frame, -0.105, 1.76, -0.245);
    box(accessory, [0.17, 0.1, 0.035], frame, 0.105, 1.76, -0.245);
    box(accessory, [0.08, 0.03, 0.03], frame, 0, 1.78, -0.25);
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
    sniper: [0, -0.18, 0.2],
    knife: [0, -0.02, 0.12]
  };
  const armPose = 1.35;
  for (const t of ['shotgun', 'rifle', 'sniper', 'knife']) {
    const m = gunModel(t);
    m.scale.setScalar(0.7);
    m.rotation.x = -armPose;
    const grip = new THREE.Vector3(...gripPositions[t])
      .multiplyScalar(0.7)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), m.rotation.x);
    m.position.set(-grip.x, -0.68 - grip.y, -grip.z);
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
    const parts = [];
    for (let node = object; node && node !== g; node = node.parent) {
      parts.unshift(node.name || `part-${node.parent.children.indexOf(node)}`);
    }
    object.userData.editorId = parts.join('/');
    const saved = transforms[object.userData.editorId];
    if (!saved) return;
    if (saved.position) object.position.fromArray(saved.position);
    if (saved.rotation) object.rotation.fromArray([...saved.rotation, 'XYZ']);
    if (saved.scale) object.scale.fromArray(saved.scale);
    if (saved.color && object.material?.color && !object.material.userData.appearanceCategory) {
      object.material.color.set(saved.color);
    }
  });

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const editorBase = {
    head: head.rotation.clone(),
    arms: arms.map(arm => arm.rotation.clone()),
    legs: legs.map(leg => leg.rotation.clone())
  };

  let sprite = null;
  if (label) { sprite = makeLabel(label); g.add(sprite); }

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
