
import { settings } from "../ui/settings.js";

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.75;

export const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, v));

export class PlayerController {
  constructor(camera, canvas, world) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;

    this.position = { x: 0, y: 0, z: 7 };
    this.yaw = Math.PI;
    this.pitch = 0;

    this.velocityY = 0;
    this.grounded = true;

    this.keys = {};
    this.crouched = false;
    this.sprinting = false;
    this.enabled = false;

    this.onShoot = null;
    this.lastShot = 0;
    this.weapon = "rifle";

    this.firing = false;
    this.aiming = false;
    this.camHeight = 1.68;
    this.bind();
  }

  bind() {
    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener("blur", () => {
      this.keys = {};
    });

    this.canvas.addEventListener("click", () => {
      if (
        this.enabled &&
        document.pointerLockElement !== this.canvas
      ) {
        this.canvas.requestPointerLock?.();
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (
        !this.enabled ||
        document.pointerLockElement !== this.canvas
      ) {
        return;
      }

      const sens = (this.camera.fov / 75) * settings.data.sens; // réduite quand on zoome
      this.yaw -= e.movementX * 0.0022 * sens;

      this.pitch = clamp(
        this.pitch - e.movementY * 0.0022 * sens,
        -1.35,
        1.35
      );
    });

    document.addEventListener("mousedown", (e) => {
      if (
        e.button === 0 &&
        this.enabled &&
        document.pointerLockElement === this.canvas
      ) {
        this.firing = true;
        this.tryShoot();
      }
    });

    document.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousedown", (e) => {
      if (e.button === 2 && this.enabled && document.pointerLockElement === this.canvas) this.aiming = true;
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button === 2) this.aiming = false;
      if (e.button === 0) this.firing = false;
    });

    document.addEventListener("pointerlockchange", () => {
      this.firing = false;
      if (document.pointerLockElement !== this.canvas) {
        this.keys = {};
      }
    });
  }

  tryShoot() {
    const stats = {
      shotgun: [850, 60],
      rifle: [150, 25],
      sniper: [1100, 80],
    }[this.weapon];

    if (!stats) return;

    const now = performance.now();

    if (now - this.lastShot < stats[0]) return;

    this.lastShot = now;

    this.onShoot?.({
      weapon: this.weapon,
      yaw: this.yaw,
      pitch: this.pitch,
      damage: stats[1],
    });
  }

  update(dt) {
    if (!this.enabled) return;

    // Tir automatique du fusil d'assaut (clic maintenu).
    if (this.firing && this.weapon === "rifle") this.tryShoot();

    // Limite les gros déplacements en cas de ralentissement.
    dt = Math.min(dt, 0.05);

    const bind = settings.data.keys;

    this.crouched = !!this.keys[bind.crouch];
    this.sprinting = !!this.keys[bind.sprint];

    const speed = this.crouched
      ? 3
      : this.sprinting
        ? 8
        : 5.2;

    /*
     * Commandes : configurables dans Paramètres > Contrôles
     * (par défaut : touches W/A/S/D par position physique, donc ZQSD en AZERTY).
     *
     * La direction est calculée à partir de la caméra.
     * Cela corrige notamment l'inversion avant/arrière.
     */
    const forward =
      (this.keys[bind.forward] ? 1 : 0) -
      (this.keys[bind.back] ? 1 : 0);

    const side =
      (this.keys[bind.right] ? 1 : 0) -
      (this.keys[bind.left] ? 1 : 0);

    // Normalisation pour éviter d'aller plus vite en diagonale.
    const length = Math.hypot(forward, side) || 1;

    const f = forward / length;
    const s = side / length;

    // Vecteurs cohérents avec l'orientation réelle de la caméra.
    const dx =
      -Math.sin(this.yaw) * f +
      Math.cos(this.yaw) * s;

    const dz =
      -Math.cos(this.yaw) * f -
      Math.sin(this.yaw) * s;

    this.position.x += dx * speed * (this.aiming ? 0.6 : 1) * dt;
    this.position.z += dz * speed * (this.aiming ? 0.6 : 1) * dt;

    this.world.resolve(this.position);

    // Saut et gravité.
    if (this.keys[bind.jump] && this.grounded) {
      this.velocityY = 7.2; // permet de monter sur les bidons et caisses
      this.grounded = false;
    }

    this.velocityY -= 18 * dt;
    this.position.y += this.velocityY * dt;

    // Sol ou sommet d'un obstacle (bidon, caisse) sous les pieds.
    const floor = this.world.floorAt ? this.world.floorAt(this.position) : 0;
    this.grounded = false;

    if (this.position.y <= floor && this.velocityY <= 0) {
      this.position.y = floor;
      this.velocityY = 0;
      this.grounded = true;
    }

    // Position de la caméra FPS.
    // Hauteur des yeux (modèle : tête à ~1.72) avec transition douce accroupi/debout.
    const targetHeight = this.crouched ? 1.28 : 1.68;
    this.camHeight += (targetHeight - this.camHeight) * Math.min(1, dt * 10);
    const cameraHeight = this.camHeight;

    this.camera.position.set(
      this.position.x,
      this.position.y + cameraHeight,
      this.position.z
    );

    this.camera.rotation.order = "YXZ";

    this.camera.rotation.set(
      this.pitch,
      this.yaw,
      0
    );
  }

  snapshot() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  setPosition(p) {
    if (!p) return;

    this.position.x = p.x ?? 0;
    this.position.y = p.y ?? 0;
    this.position.z = p.z ?? 0;
  }
}
