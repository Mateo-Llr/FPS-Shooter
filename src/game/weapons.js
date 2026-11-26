
export const WEAPONS = {
  shotgun: {
    label: 'FUSIL À POMPE',
    ammo: 6,
    capacity: 6,
    cooldown: 850,
    reloadTime: 1200,
    damage: 60,
    range: 9
  },

  rifle: {
    label: "FUSIL D'ASSAUT",
    ammo: 30,
    capacity: 30,
    cooldown: 150,
    reloadTime: 1500,
    damage: 25,
    range: 32
  },

  sniper: {
    label: 'SNIPER',
    ammo: 5,
    capacity: 5,
    cooldown: 1100,
    reloadTime: 1800,
    damage: 80,
    range: 45
  },

  knife: {
    label: 'COUTEAU',
    melee: true,
    cooldown: 450,
    damage: 50,
    range: 2.8
  }
};

export class WeaponSystem {
  constructor() {
    this.current = 'rifle';

    this.ammo = {};
    this.reloading = false;
    this.reloadTimers = {};

    this.lastShot = null;

    this.reset();
  }

  reset() {
    for (const [name, weapon] of Object.entries(WEAPONS)) {
      if (!weapon.melee) this.ammo[name] = weapon.capacity;
    }

    this.reloading = false;
    this.lastShot = null;

    for (const timer of Object.values(this.reloadTimers)) {
      clearTimeout(timer);
    }

    this.reloadTimers = {};
  }

  select(name) {
    if (!WEAPONS[name]) return false;

    this.current = name;
    this.reloading = Boolean(this.reloadTimers[name]);

    return true;
  }

  reload() {
    const name = this.current;
    const weapon = WEAPONS[name];

    if (!weapon) return false;
    if (weapon.melee) return false;

    if (this.reloadTimers[name]) return false;

    if (this.ammo[name] >= weapon.capacity) return false;

    this.reloading = true;

    this.reloadTimers[name] = setTimeout(() => {
      this.ammo[name] = weapon.capacity;

      delete this.reloadTimers[name];

      if (this.current === name) {
        this.reloading = false;
      }
    }, weapon.reloadTime);

    return true;
  }

  consume() {
    const name = this.current;
    const weapon = WEAPONS[name];

    if (!weapon) return false;

    if (this.reloadTimers[name]) {
      this.reloading = true;
      return false;
    }

    if (weapon.melee) {
      const now = performance.now();
      if (this.lastShot !== null && now - this.lastShot < weapon.cooldown) return false;
      this.lastShot = now;
      return true;
    }

    if (this.ammo[name] <= 0) {
      this.reload();
      return false;
    }

    const now = performance.now();

    if (this.lastShot !== null && now - this.lastShot < weapon.cooldown) {
      return false;
    }

    this.lastShot = now;
    this.ammo[name]--;

    return true;
  }

  stats() {
    return WEAPONS[this.current];
  }

  getAmmo() {
    if (WEAPONS[this.current]?.melee) return null;
    return this.ammo[this.current] ?? 0;
  }

  isReloading() {
    return Boolean(this.reloadTimers[this.current]);
  }

  dispose() {
    for (const timer of Object.values(this.reloadTimers)) {
      clearTimeout(timer);
    }

    this.reloadTimers = {};
    this.reloading = false;
  }
}
