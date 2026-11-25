export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.75;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class PlayerController {
  constructor(camera, canvas, world) {
    this.camera = camera; this.canvas = canvas; this.world = world;
    this.position = { x: 0, y: 0, z: 7 }; this.yaw = Math.PI; this.pitch = 0;
    this.velocityY = 0; this.grounded = true; this.keys = {};
    this.crouched = false; this.sprinting = false; this.enabled = false;
    this.onShoot = null; this.lastShot = 0; this.weapon = 'rifle';
    this.bind();
  }
  bind() {
    document.addEventListener('keydown', e => { this.keys[e.code] = true; if (['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault(); });
    document.addEventListener('keyup', e => this.keys[e.code] = false);
    this.canvas.addEventListener('click', () => { if (this.enabled && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.(); });
    document.addEventListener('mousemove', e => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      this.yaw -= e.movementX * 0.0022; this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.35, 1.35);
    });
    document.addEventListener('mousedown', e => { if (e.button === 0 && this.enabled && document.pointerLockElement === this.canvas) this.tryShoot(); });
  }
  tryShoot() {
    const stats = { shotgun: [850, 60], rifle: [150, 25], sniper: [1100, 80] }[this.weapon];
    if (performance.now() - this.lastShot < stats[0]) return;
    this.lastShot = performance.now();
    this.onShoot?.({ weapon: this.weapon, yaw: this.yaw, pitch: this.pitch, damage: stats[1] });
  }
  update(dt) {
    if (!this.enabled) return;
    this.crouched = !!this.keys.ControlLeft || !!this.keys.ControlRight;
    this.sprinting = !!this.keys.ShiftLeft || !!this.keys.ShiftRight;
    const speed = this.crouched ? 3 : this.sprinting ? 8 : 5.2;
    const forward = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const side = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const length = Math.hypot(forward, side) || 1;
    const dx = (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) / length;
    const dz = (Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) / length;
    this.position.x += dx * speed * dt; this.position.z += dz * speed * dt;
    this.world.resolve(this.position);
    if (this.keys.Space && this.grounded) { this.velocityY = 6.4; this.grounded = false; }
    this.velocityY -= 18 * dt; this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) { this.position.y = 0; this.velocityY = 0; this.grounded = true; }
    this.camera.position.set(this.position.x, this.position.y + (this.crouched ? 1.05 : 1.55), this.position.z);
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  snapshot() { return { x:this.position.x, y:this.position.y, z:this.position.z, yaw:this.yaw, pitch:this.pitch }; }
  setPosition(p) { if (!p) return; this.position.x=p.x; this.position.y=p.y||0; this.position.z=p.z; }
}