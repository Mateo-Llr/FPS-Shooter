
import * as THREE from 'three';
import { World } from './world.js';
import { PlayerController } from './player.js';
import { WeaponSystem, WEAPONS } from './weapons.js';
import { HUD } from './hud.js';
import { MSG } from '../network/protocol.js';

export class Game {
  constructor(canvas, network) {
    this.canvas = canvas;
    this.network = network;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8999ad);
    this.scene.fog = new THREE.Fog(0x8999ad, 28, 90);

    this.camera = new THREE.PerspectiveCamera(
      75,
      innerWidth / innerHeight,
      0.1,
      150
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true
    });

    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.world = new World(this.scene);
    this.controller = new PlayerController(
      this.camera,
      canvas,
      this.world
    );

    this.weapon = new WeaponSystem();
    this.hud = new HUD();
    this.clock = new THREE.Clock();

    this.active = false;
    this.host = false;
    this.health = 100;
    this.remoteHealth = 100;

    this.remote = {
      x: 0,
      y: 0,
      z: -7,
      yaw: 0
    };

    this.previousRemote = { x: 0, z: -7 };
    this.remoteMoving = false;
    this.remoteWalkTime = 0;

    this.score = [0, 0];
    this.elapsed = 0;
    this.deadUntil = 0;
    this.config = null;
    this.enemyMesh = null;

    this.effects = [];
    this.weaponModel = null;
    this.muzzleFlash = null;
    this.muzzleLight = null;
    this.weaponRecoil = 0;
    this.hitmarkerUntil = 0;

    this.buildLighting();
    this.buildRemote();
    this.buildWeaponView();
    this.buildCrosshair();

    this.bindNetwork();
    this.bindKeys();

    addEventListener('resize', () => this.resize());

    this.animate();
  }

  // --------------------------------------------------
  // ÉCLAIRAGE
  // --------------------------------------------------

  buildLighting() {
    const ambient = new THREE.HemisphereLight(
      0xdceaff,
      0x35404b,
      2.1
    );

    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffedcf, 2.6);
    sun.position.set(-12, 25, 10);
    sun.castShadow = false;

    this.scene.add(sun);
  }

  // --------------------------------------------------
  // PERSONNAGE ADVERSE ARTICULÉ
  // --------------------------------------------------

  buildRemote() {
    const group = new THREE.Group();

    const skin = new THREE.MeshStandardMaterial({
      color: 0xe0ae88,
      roughness: 0.8
    });

    const shirt = new THREE.MeshStandardMaterial({
      color: 0xc94f36,
      roughness: 0.75
    });

    const pants = new THREE.MeshStandardMaterial({
      color: 0x26374e,
      roughness: 0.9
    });

    const shoes = new THREE.MeshStandardMaterial({
      color: 0x171b22,
      roughness: 0.8
    });

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.72, 0.34),
      shirt
    );

    torso.position.y = 1.12;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.43, 0.43, 0.43),
      skin
    );

    head.position.y = 1.72;
    group.add(head);

    const face = new THREE.MeshStandardMaterial({
      color: 0x252b32,
      roughness: 0.7
    });

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 0.025),
        face
      );

      eye.position.set(side * 0.105, 1.77, -0.22);
      group.add(eye);
    }

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.025, 0.025),
      face
    );

    mouth.position.set(0, 1.64, -0.225);
    group.add(mouth);

    this.remoteArms = [];
    this.remoteLegs = [];

    for (const side of [-1, 1]) {
      const armPivot = new THREE.Group();

      armPivot.position.set(side * 0.39, 1.38, 0);
      group.add(armPivot);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.23, 0.66, 0.25),
        shirt
      );

      arm.position.y = -0.32;
      armPivot.add(arm);

      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.18, 0.22),
        skin
      );

      hand.position.y = -0.68;
      armPivot.add(hand);

      this.remoteArms.push(armPivot);

      const legPivot = new THREE.Group();

      legPivot.position.set(side * 0.16, 0.76, 0);
      group.add(legPivot);

      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.68, 0.29),
        pants
      );

      leg.position.y = -0.34;
      legPivot.add(leg);

      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.16, 0.39),
        shoes
      );

      shoe.position.set(0, -0.7, -0.035);
      legPivot.add(shoe);

      this.remoteLegs.push(legPivot);
    }

    this.enemyMesh = group;
    this.scene.add(group);
  }

  // --------------------------------------------------
  // ARME EN VUE SUBJECTIVE
  // --------------------------------------------------

  buildWeaponView() {
    const weaponGroup = new THREE.Group();

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x202832,
      metalness: 0.75,
      roughness: 0.3
    });

    const black = new THREE.MeshStandardMaterial({
      color: 0x10151c,
      metalness: 0.4,
      roughness: 0.55
    });

    const accent = new THREE.MeshStandardMaterial({
      color: 0xd85b32,
      metalness: 0.25,
      roughness: 0.45
    });

    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.2, 0.62),
      darkMetal
    );

    receiver.position.set(0, 0, 0);
    weaponGroup.add(receiver);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.7, 8),
      black
    );

    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.045, -0.56);
    weaponGroup.add(barrel);

    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.16, 0.34),
      black
    );

    stock.position.set(0, -0.015, 0.43);
    weaponGroup.add(stock);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.27, 0.16),
      black
    );

    grip.position.set(0, -0.19, 0.13);
    grip.rotation.x = -0.18;
    weaponGroup.add(grip);

    const sightBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.18),
      accent
    );

    sightBase.position.set(0, 0.14, -0.13);
    weaponGroup.add(sightBase);

    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.12, 0.06),
      black
    );

    sight.position.set(0, 0.23, -0.13);
    weaponGroup.add(sight);

    const frontGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.19, 0.13),
      black
    );

    frontGrip.position.set(0, -0.14, -0.35);
    weaponGroup.add(frontGrip);

    // Main droite stylisée.
    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0xc28e70,
      roughness: 0.85
    });

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.14, 0.24),
      handMaterial
    );

    hand.position.set(0.19, -0.22, 0.08);
    weaponGroup.add(hand);

    const supportHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.13, 0.2),
      handMaterial
    );

    supportHand.position.set(-0.13, -0.16, -0.35);
    weaponGroup.add(supportHand);

    weaponGroup.position.set(0.34, -0.31, -0.65);
    weaponGroup.rotation.set(-0.035, -0.045, -0.025);

    this.camera.add(weaponGroup);
    this.weaponModel = weaponGroup;

    // Flash de bouche.
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffbd50,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    const flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.4, 8),
      flashMaterial
    );

    flash.rotation.x = -Math.PI / 2;
    flash.position.set(0, 0.045, -0.98);
    weaponGroup.add(flash);

    this.muzzleFlash = flash;

    const light = new THREE.PointLight(0xff9b35, 0, 4);
    light.position.set(0, 0.05, -0.9);
    weaponGroup.add(light);

    this.muzzleLight = light;
  }

  // --------------------------------------------------
  // VISEUR
  // --------------------------------------------------

  buildCrosshair() {
    const element = document.createElement('div');

    element.id = 'game-crosshair';

    element.innerHTML = `
      <span class="crosshair-line horizontal"></span>
      <span class="crosshair-line vertical"></span>
      <span class="crosshair-dot"></span>
    `;

    Object.assign(element.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      width: '22px',
      height: '22px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: '20',
      display: 'none'
    });

    const style = document.createElement('style');

    style.textContent = `
      #game-crosshair .crosshair-line {
        position: absolute;
        display: block;
        background: white;
        border-radius: 2px;
        box-shadow: 0 0 3px #000;
      }

      #game-crosshair .horizontal {
        width: 18px;
        height: 2px;
        left: 2px;
        top: 10px;
      }

      #game-crosshair .vertical {
        width: 2px;
        height: 18px;
        left: 10px;
        top: 2px;
      }

      #game-crosshair .crosshair-dot {
        position: absolute;
        width: 3px;
        height: 3px;
        left: 9.5px;
        top: 9.5px;
        background: #ff693d;
        border-radius: 50%;
      }

      #game-crosshair.hit {
        filter: drop-shadow(0 0 5px #ff4938);
        transform: translate(-50%, -50%) scale(1.5);
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(element);

    this.crosshair = element;
  }

  // --------------------------------------------------
  // RÉSEAU
  // --------------------------------------------------

  bindNetwork() {
    this.network.on(MSG.INPUT, data => {
      if (this.host) this.receiveInput(data);
    });

    this.network.on(MSG.STATE, data => {
      if (!this.host) this.applyState(data);
    });

    this.network.on(MSG.GAMEOVER, data => {
      this.finish(data.reason || 'Fin de partie');
    });

    this.network.on(MSG.EVENT, data => {
      if (data.kind === 'hit') {
        this.showDamage(data.damage);
        this.showHitmarker();
      }
    });

    this.network.on(MSG.DISCONNECTED, () => {
      this.remoteDisconnected();
    });
  }

  bindKeys() {
    document.addEventListener('keydown', e => {
      if (!this.active) return;

      if (e.code === 'Digit1') this.chooseWeapon('shotgun');
      if (e.code === 'Digit2') this.chooseWeapon('rifle');
      if (e.code === 'Digit3') this.chooseWeapon('sniper');

      if (e.code === 'KeyR') {
        this.weapon.reload();
      }
    });

    this.controller.onShoot = shot => this.shoot(shot);
  }

  chooseWeapon(name) {
    if (
      this.config.weapon !== 'all' &&
      this.config.weapon !== name
    ) {
      return;
    }

    this.weapon.select(name);
  }

  // --------------------------------------------------
  // DÉMARRAGE
  // --------------------------------------------------

  start(config, host, youName, enemyName) {
    this.config = config;
    this.host = host;
    this.youName = youName;
    this.enemyName = enemyName;

    this.health = 100;
    this.remoteHealth = 100;
    this.score = [0, 0];
    this.elapsed = 0;
    this.active = true;
    this.deadUntil = 0;
    this.disconnectDeadline = null;

    this.effects.forEach(effect => this.removeEffect(effect));
    this.effects = [];

    this.controller.position = {
      x: 0,
      y: 0,
      z: host ? 7 : -7
    };

    this.controller.yaw = host ? Math.PI : 0;
    this.controller.pitch = 0;
    this.controller.enabled = true;

    this.weapon.select(
      config.weapon === 'all' ? 'rifle' : config.weapon
    );

    document.querySelector('#menu')?.classList.add('hidden');
    document.querySelector('#lobby')?.classList.add('hidden');
    document.querySelector('#game')?.classList.remove('hidden');

    this.hud.show();
    this.hud.clearMessage();

    document.querySelector('#lock-hint')?.classList.remove('hidden');

    if (this.crosshair) {
      this.crosshair.style.display = 'block';
    }

    this.updateHUD();
  }

  // --------------------------------------------------
  // SYNCHRONISATION ADVERSAIRE
  // --------------------------------------------------

  receiveInput(data) {
    if (!data.input) return;

    const next = data.input;

    const dx = next.x - this.remote.x;
    const dz = next.z - this.remote.z;

    this.remoteMoving = Math.hypot(dx, dz) > 0.002;

    this.previousRemote = {
      x: this.remote.x,
      z: this.remote.z
    };

    this.remote = next;

    this.enemyMesh.position.set(
      this.remote.x,
      0,
      this.remote.z
    );

    this.enemyMesh.rotation.y = this.remote.yaw;

    if (data.shot) {
      this.validateShot(data.shot, 0);
    }
  }

  // --------------------------------------------------
  // VALIDATION DES TIRS
  // --------------------------------------------------

  validateShot(shot, target = 0) {
    if (!this.active) return;

    const from = {
      x: this.controller.position.x,
      y: this.controller.position.y,
      z: this.controller.position.z
    };

    const to = {
      x: this.remote.x,
      y: this.remote.y,
      z: this.remote.z
    };

    const dx = to.x - from.x;
    const dz = to.z - from.z;

    const dist = Math.hypot(dx, dz);

    // Direction avant réelle de la caméra Three.js.
    const aimX = -Math.sin(shot.yaw);
    const aimZ = -Math.cos(shot.yaw);

    const dot = (
      dx * aimX + dz * aimZ
    ) / Math.max(dist, 0.001);

    const weaponStats = WEAPONS[shot.weapon];

    if (!weaponStats) return;

    const range = weaponStats.range || 0;
    const spread = shot.weapon === 'shotgun' ? 0.82 : 0.96;

    // Tolérance verticale simple pour viser la silhouette.
    const verticalAim = Math.abs(shot.pitch || 0) < 0.45;

    if (
      dot > spread &&
      dist < range &&
      verticalAim &&
      this.world.hasLineOfSight(from, to)
    ) {
      const damage = weaponStats.damage;

      if (target === 0) {
        this.health = Math.max(0, this.health - damage);
      } else {
        this.remoteHealth = Math.max(0, this.remoteHealth - damage);
      }

      this.network.send(MSG.EVENT, {
        kind: 'hit',
        damage
      });

      this.spawnImpact(
        new THREE.Vector3(to.x, 1.1, to.z)
      );

      if (target === 0 && this.health <= 0) {
        this.eliminate(0);
      }

      if (target === 1 && this.remoteHealth <= 0) {
        this.eliminate(1);
      }
    }
  }

  // --------------------------------------------------
  // TIR ET EFFETS VISUELS
  // --------------------------------------------------

  shoot(shot) {
    if (
      !this.active ||
      this.deadUntil > performance.now()
    ) {
      return;
    }

    if (!this.weapon.consume()) {
      this.weapon.reload();
      return;
    }

    this.playWeaponRecoil();
    this.spawnTracer(shot);

    if (this.host) {
      this.validateShot(shot, 1);
    } else {
      this.network.send(MSG.INPUT, {
        input: this.controller.snapshot(),
        shot
      });
    }
  }

  playWeaponRecoil() {
    this.weaponRecoil = 1;

    if (this.muzzleFlash) {
      this.muzzleFlash.material.opacity = 1;
      this.muzzleFlash.scale.setScalar(
        0.8 + Math.random() * 0.7
      );
    }

    if (this.muzzleLight) {
      this.muzzleLight.intensity = 5;
    }
  }

  spawnTracer(shot) {
    const origin = this.camera.position.clone();

    const direction = new THREE.Vector3(
      -Math.sin(shot.yaw) * Math.cos(shot.pitch || 0),
      Math.sin(shot.pitch || 0),
      -Math.cos(shot.yaw) * Math.cos(shot.pitch || 0)
    ).normalize();

    const range = WEAPONS[shot.weapon]?.range || 30;

    const end = origin.clone().addScaledVector(
      direction,
      Math.min(range, 35)
    );

    const geometry = new THREE.BufferGeometry().setFromPoints([
      origin,
      end
    ]);

    const material = new THREE.LineBasicMaterial({
      color: 0xffd58a,
      transparent: true,
      opacity: 0.95
    });

    const line = new THREE.Line(geometry, material);

    this.scene.add(line);

    this.effects.push({
      object: line,
      life: 0.075,
      maxLife: 0.075,
      type: 'tracer'
    });
  }

  spawnImpact(position) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffa34c
    });

    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      material
    );

    spark.position.copy(position);
    this.scene.add(spark);

    this.effects.push({
      object: spark,
      life: 0.18,
      maxLife: 0.18,
      type: 'impact'
    });
  }

  showDamage(amount) {
    const canvas = document.createElement('canvas');

    canvas.width = 256;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 8;
    ctx.strokeStyle = '#40140e';
    ctx.strokeText(`-${amount}`, 128, 64);

    ctx.fillStyle = '#ff6246';
    ctx.fillText(`-${amount}`, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);

    sprite.position.set(
      this.remote.x,
      2.25 + Math.random() * 0.3,
      this.remote.z
    );

    sprite.scale.set(0.9, 0.45, 1);

    this.scene.add(sprite);

    this.effects.push({
      object: sprite,
      life: 0.9,
      maxLife: 0.9,
      type: 'damage'
    });
  }

  showHitmarker() {
    if (!this.crosshair) return;

    this.crosshair.classList.add('hit');
    this.hitmarkerUntil = performance.now() + 120;

    this.crosshair.style.filter =
      'drop-shadow(0 0 7px #ff5038)';
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];

      effect.life -= dt;

      if (effect.type === 'damage') {
        effect.object.position.y += dt * 0.65;

        effect.object.material.opacity = Math.max(
          0,
          effect.life / effect.maxLife
        );
      }

      if (effect.type === 'impact') {
        const scale = 1 + dt * 5;
        effect.object.scale.multiplyScalar(scale);
      }

      if (effect.life <= 0) {
        this.removeEffect(effect);
        this.effects.splice(i, 1);
      }
    }

    if (
      this.crosshair &&
      this.hitmarkerUntil &&
      performance.now() > this.hitmarkerUntil
    ) {
      this.crosshair.classList.remove('hit');
      this.crosshair.style.filter = '';
      this.hitmarkerUntil = 0;
    }
  }

  removeEffect(effect) {
    this.scene.remove(effect.object);

    effect.object.geometry?.dispose();

    if (Array.isArray(effect.object.material)) {
      effect.object.material.forEach(m => m.dispose());
    } else {
      effect.object.material?.map?.dispose();
      effect.object.material?.dispose();
    }
  }

  // --------------------------------------------------
  // ANIMATION DES PERSONNAGES ET DE L'ARME
  // --------------------------------------------------

  updateCharacterAnimation(dt) {
    if (this.remoteMoving) {
      this.remoteWalkTime += dt * 10;
    }

    const swing = this.remoteMoving
      ? Math.sin(this.remoteWalkTime) * 0.55
      : 0;

    this.remoteArms[0].rotation.x = swing;
    this.remoteArms[1].rotation.x = -swing;

    this.remoteLegs[0].rotation.x = -swing;
    this.remoteLegs[1].rotation.x = swing;
  }

  updateWeaponAnimation(dt) {
    if (!this.weaponModel) return;

    this.weaponRecoil = Math.max(
      0,
      this.weaponRecoil - dt * 7
    );

    const recoil = this.weaponRecoil;

    this.weaponModel.position.z = -0.65 + recoil * 0.12;
    this.weaponModel.position.y = -0.31 - recoil * 0.07;
    this.weaponModel.rotation.x = -0.035 + recoil * 0.12;

    if (this.muzzleFlash) {
      this.muzzleFlash.material.opacity = Math.max(
        0,
        this.muzzleFlash.material.opacity - dt * 14
      );
    }

    if (this.muzzleLight) {
      this.muzzleLight.intensity = Math.max(
        0,
        this.muzzleLight.intensity - dt * 40
      );
    }
  }

  // --------------------------------------------------
  // MORT ET SCORE
  // --------------------------------------------------

  eliminate(victim) {
    if (!this.host) return;

    const scorer = victim === 0 ? 1 : 0;

    this.score[scorer]++;

    this.network.send(MSG.STATE, {
      state: this.statePayload()
    });

    if (
      this.config.mode === 'kills' &&
      this.score[scorer] >= this.config.target
    ) {
      this.end(
        scorer === 0
          ? 'Victoire de l’hôte'
          : 'Victoire de l’adversaire'
      );

      return;
    }

    if (victim === 0) {
      this.health = 100;
    } else {
      this.remoteHealth = 100;
    }

    this.deadUntil = performance.now() + 2000;

    if (victim === 0) {
      this.controller.position = {
        x: 0,
        y: 0,
        z: 7
      };
    }
  }

  statePayload() {
    return {
      health: this.health,
      remoteHealth: this.remoteHealth,
      score: this.score,
      remote: this.remote,
      hostPos: this.controller.snapshot(),
      time: this.remaining()
    };
  }

  applyState(data) {
    const s = data.state;

    if (!s) return;

    this.health = s.remoteHealth ?? 100;
    this.remoteHealth = s.health;

    this.score = s.score;
    this.remote = s.hostPos;

    this.enemyMesh.position.set(
      this.remote.x,
      0,
      this.remote.z
    );

    this.enemyMesh.rotation.y = this.remote.yaw;

    this.remoteScore = s.score?.[0] ?? 0;
    this.remoteTime = s.time;
  }

  // --------------------------------------------------
  // HUD
  // --------------------------------------------------

  remaining() {
    return this.config.mode === 'time'
      ? Math.max(0, this.config.duration - this.elapsed)
      : 0;
  }

  updateHUD() {
    const youScore = this.host
      ? this.score[0]
      : this.score[1];

    const enemyScore = this.host
      ? this.score[1]
      : this.score[0];

    this.hud.update({
      health: this.health,
      youScore,
      enemyScore,
      time: this.config.mode === 'time'
        ? this.remaining()
        : this.config.duration,
      weapon: this.weapon.stats(),
      ammo: this.weapon.ammo[this.weapon.current],
      youName: this.youName,
      enemyName: this.enemyName
    });
  }

  // --------------------------------------------------
  // FIN DE PARTIE
  // --------------------------------------------------

  end(reason) {
    this.active = false;
    this.controller.enabled = false;

    this.network.send(MSG.GAMEOVER, { reason });

    this.finish(reason);
  }

  finish(reason) {
    this.active = false;
    this.controller.enabled = false;

    document.exitPointerLock?.();

    if (this.crosshair) {
      this.crosshair.style.display = 'none';
    }

    this.hud.message(
      `${reason} — ${this.score[0]} / ${this.score[1]}. Recharge la page pour revenir au menu.`
    );
  }

  remoteDisconnected() {
    if (!this.active) return;

    if (this.host) {
      this.controller.enabled = false;

      this.hud.message(
        'Adversaire déconnecté — reconnexion pendant 30 secondes…'
      );

      this.disconnectDeadline = performance.now() + 30000;
    } else {
      this.hud.message(
        'Connexion perdue. Retourne au salon et réessaie.'
      );
    }
  }

  // --------------------------------------------------
  // REDIMENSIONNEMENT
  // --------------------------------------------------

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(innerWidth, innerHeight);
  }

  // --------------------------------------------------
  // BOUCLE PRINCIPALE
  // --------------------------------------------------

  animate = () => {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.active) {
      if (!this.disconnectDeadline) {
        this.controller.update(dt);
      }

      if (this.host) {
        this.elapsed += dt;

        if (
          this.config.mode === 'time' &&
          this.remaining() <= 0
        ) {
          this.end(
            this.score[0] >= this.score[1]
              ? 'Temps écoulé — hôte vainqueur'
              : 'Temps écoulé — adversaire vainqueur'
          );
        }

        if (
          this.disconnectDeadline &&
          performance.now() > this.disconnectDeadline
        ) {
          this.end('Victoire par forfait');
          this.disconnectDeadline = null;
        }

        if (
          this.deadUntil &&
          performance.now() > this.deadUntil
        ) {
          this.deadUntil = 0;
          this.health = 100;
        }

        this.network.send(MSG.STATE, {
          state: {
            health: this.health,
            remoteHealth: this.remoteHealth,
            score: this.score,
            hostPos: this.controller.snapshot(),
            remote: this.remote,
            time: this.remaining()
          }
        });
      } else {
        this.network.send(MSG.INPUT, {
          input: this.controller.snapshot()
        });
      }

      this.updateHUD();
      this.updateCharacterAnimation(dt);
      this.updateWeaponAnimation(dt);
      this.updateEffects(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
