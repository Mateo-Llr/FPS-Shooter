
import { settings } from "../ui/settings.js";
import { GAMEPAD_BUTTONS, GamepadState } from "./gamepad.js";

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
    this.lastShot = null;
    this.weapon = "rifle";
    this.inputType = "keyboard";

    this.firing = false;
    this.aiming = false;
    this.mouseFiring = false;
    this.mouseAiming = false;
    this.gamepadFiring = false;
    this.gamepadAiming = false;
    this.gamepad = new GamepadState();
    this.gamepadJumpHeld = false;
    this.camHeight = 1.68;
    this.speedMultiplier = 1; // ex. porteur de la bombe
    this.bind();
  }

  bind() {
    document.addEventListener("keydown", (e) => {
      if (
        this.enabled &&
        document.pointerLockElement === this.canvas &&
        e.code !== "Escape"
      ) {
        e.preventDefault();
      }
    }, true);

    document.addEventListener("keydown", (e) => {
      if (this.enabled && !e.repeat) this.inputType = "keyboard";
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
      this.mouseAiming = false;
      this.mouseFiring = false;
      this.aiming = this.gamepadAiming;
      this.firing = this.gamepadFiring;
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

      this.inputType = "keyboard";
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
        this.inputType = "keyboard";
        this.mouseFiring = true;
        this.firing = true;
        this.tryShoot();
      }
    });

    document.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousedown", (e) => {
      if (e.button === 2 && this.enabled && document.pointerLockElement === this.canvas) {
        this.inputType = "keyboard";
        this.mouseAiming = true;
        this.aiming = true;
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        this.mouseAiming = false;
        this.aiming = this.gamepadAiming;
      }
      if (e.button === 0) {
        this.mouseFiring = false;
        this.firing = this.gamepadFiring;
      }
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== this.canvas) {
        this.keys = {};
        this.mouseAiming = false;
        this.mouseFiring = false;
        this.aiming = this.gamepadAiming;
        this.firing = this.gamepadFiring;
      }
    });
  }

  tryShoot() {
    const stats = {
      shotgun: [850, 60],
      rifle: [150, 25],
      sniper: [1100, 80],
      knife: [450, 50],
    }[this.weapon];

    if (!stats) return;

    const now = performance.now();

    if (this.lastShot !== null && now - this.lastShot < stats[0]) return;

    this.lastShot = now;

    this.onShoot?.({
      weapon: this.weapon,
      yaw: this.yaw,
      pitch: this.pitch,
      damage: stats[1],
    });
  }

  update(dt) {
    if (!this.enabled) {
      this.gamepad.update();
      return;
    }

    const pad = this.gamepad.pad();
    const gamepadForward = this.gamepad.axis(1);
    const gamepadSide = this.gamepad.axis(0);
    const gamepadLookX = this.gamepad.axis(2);
    const gamepadLookY = this.gamepad.axis(3);

    if (pad && (
      gamepadForward || gamepadSide || gamepadLookX || gamepadLookY ||
      pad.buttons.some(button => button.pressed || button.value > 0.18)
    )) this.inputType = "gamepad";

    if (pad) {
      const rx = gamepadLookX;
      const ry = gamepadLookY;
      if (rx || ry) {
        const sens = (this.camera.fov / 75) * settings.data.sens;
        const turn = 2.15 * sens * dt;
        this.yaw -= rx * turn;
        this.pitch = clamp(this.pitch - ry * turn, -1.35, 1.35);
      }

      const rt = pad.buttons[GAMEPAD_BUTTONS.RT]?.value ?? 0;
      const lt = pad.buttons[GAMEPAD_BUTTONS.LT]?.value ?? 0;
      this.gamepadFiring = rt > 0.18;
      this.gamepadAiming = lt > 0.18;
      if (this.gamepadFiring && this.weapon !== "rifle" && this.gamepad.pressedAnalog(GAMEPAD_BUTTONS.RT)) {
        this.tryShoot();
      }
    } else {
      this.gamepadFiring = false;
      this.gamepadAiming = false;
    }
    this.firing = this.mouseFiring || this.gamepadFiring;
    this.aiming = this.mouseAiming || this.gamepadAiming;

    // Tir automatique du fusil d'assaut (clic maintenu).
    if (this.firing && this.weapon === "rifle") this.tryShoot();

    // Limite les gros déplacements en cas de ralentissement.
    dt = Math.min(dt, 0.05);

    const bind = settings.data.keys;

    this.crouched = !!this.keys[bind.crouch] ||
      !!pad?.buttons[GAMEPAD_BUTTONS.EAST]?.pressed;
    this.sprinting = !!this.keys[bind.sprint] ||
      !!pad?.buttons[GAMEPAD_BUTTONS.L3]?.pressed;

    const speed = (this.crouched
      ? 3
      : this.sprinting
        ? 8
        : 5.2) * this.speedMultiplier;

    /*
     * Commandes : configurables dans Paramètres > Contrôles
     * (par défaut : touches W/A/S/D par position physique, donc ZQSD en AZERTY).
     *
     * La direction est calculée à partir de la caméra.
     * Cela corrige notamment l'inversion avant/arrière.
     */
    const forward =
      (this.keys[bind.forward] ? 1 : 0) -
      (this.keys[bind.back] ? 1 : 0) -
      gamepadForward;

    const side =
      (this.keys[bind.right] ? 1 : 0) -
      (this.keys[bind.left] ? 1 : 0) +
      gamepadSide;

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
    const jumpPressed = !!this.keys[bind.jump] ||
      (!!pad?.buttons[GAMEPAD_BUTTONS.SOUTH]?.pressed && !this.gamepadJumpHeld);
    this.gamepadJumpHeld = !!pad?.buttons[GAMEPAD_BUTTONS.SOUTH]?.pressed;
    if (jumpPressed && this.grounded) {
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
    this.gamepad.update();
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
