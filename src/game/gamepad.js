export const GAMEPAD_BUTTONS = {
  SOUTH: 0,
  EAST: 1,
  WEST: 2,
  NORTH: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
};

export function getGamepad() {
  if (!navigator.getGamepads) return null;
  return [...navigator.getGamepads()].find(pad => pad?.connected) || null;
}

export function deadzone(value, size = 0.18) {
  if (Math.abs(value) <= size) return 0;
  return (value - Math.sign(value) * size) / (1 - size);
}

export class GamepadState {
  constructor() {
    this.prev = null;
  }

  pad() {
    return getGamepad();
  }

  held(index) {
    const pad = this.pad();
    return !!pad?.buttons[index]?.pressed;
  }

  axis(index) {
    return deadzone(this.pad()?.axes[index] ?? 0);
  }

  pressedNow(index) {
    const pad = this.pad();
    if (!pad) return false;
    const now = !!pad.buttons[index]?.pressed;
    const before = this.prev?.index === pad.index && !!this.prev.buttons[index]?.pressed;
    return now && !before;
  }

  pressedAnalog(index, threshold = 0.18) {
    const pad = this.pad();
    if (!pad) return false;
    const now = (pad.buttons[index]?.value ?? 0) > threshold;
    const before = this.prev?.index === pad.index &&
      (this.prev.buttons[index]?.value ?? 0) > threshold;
    return now && !before;
  }

  update() {
    const pad = this.pad();
    this.prev = pad ? {
      index: pad.index,
      buttons: pad.buttons.map(button => ({
        pressed: button.pressed,
        value: button.value
      }))
    } : null;
  }
}

export class GamepadNavigator {
  constructor(isActive = () => true) {
    this.isActive = isActive;
    this.prev = null;
  }

  update() {
    if (!this.isActive()) return;
    const pad = getGamepad();
    if (!pad) {
      this.prev = null;
      return;
    }

    const candidates = [...document.querySelectorAll(
      'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden])'
    )].filter(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    });
    if (!candidates.length) {
      this.prev = pad;
      return;
    }

    const now = index => !!pad.buttons[index]?.pressed;
    const before = index => !!this.prev?.buttons[index]?.pressed;
    const dpadRight = now(GAMEPAD_BUTTONS.DPAD_RIGHT) ||
      (deadzone(pad.axes[0] ?? 0) > 0.75);
    const dpadLeft = now(GAMEPAD_BUTTONS.DPAD_LEFT) ||
      (deadzone(pad.axes[0] ?? 0) < -0.75);
    const dpadDown = now(GAMEPAD_BUTTONS.DPAD_DOWN) ||
      (deadzone(pad.axes[1] ?? 0) > 0.75);
    const dpadUp = now(GAMEPAD_BUTTONS.DPAD_UP) ||
      (deadzone(pad.axes[1] ?? 0) < -0.75);

    const dx = dpadRight ? 1 : dpadLeft ? -1 : 0;
    const dy = dpadDown ? 1 : dpadUp ? -1 : 0;
    const directionChanged = (dx && !this.axisBefore(pad, dx, 0)) ||
      (dy && !this.axisBefore(pad, 0, dy));

    if (directionChanged) {
      const current = document.activeElement;
      let index = candidates.indexOf(current);
      if (index < 0) index = 0;
      if (dy) index = (index + dy + candidates.length) % candidates.length;
      if (dx) index = (index + dx + candidates.length) % candidates.length;
      candidates[index].focus();
    }

    if (now(GAMEPAD_BUTTONS.SOUTH) && !before(GAMEPAD_BUTTONS.SOUTH)) {
      const active = document.activeElement;
      if (active && candidates.includes(active)) active.click();
    }
    if (now(GAMEPAD_BUTTONS.EAST) && !before(GAMEPAD_BUTTONS.EAST)) {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    }

    this.prev = pad;
  }

  axisBefore(pad, dx, dy) {
    if (!this.prev) return false;
    const beforeX = deadzone(this.prev.axes[0] ?? 0);
    const beforeY = deadzone(this.prev.axes[1] ?? 0);
    return dx ? Math.sign(beforeX) === Math.sign(dx) && Math.abs(beforeX) > 0.75 :
      dy ? Math.sign(beforeY) === Math.sign(dy) && Math.abs(beforeY) > 0.75 : false;
  }
}
