export const WEAPONS = {
  shotgun: { label:'FUSIL À POMPE', ammo:6, capacity:6, cooldown:850, damage:60, range:9 },
  rifle: { label:"FUSIL D'ASSAUT", ammo:30, capacity:30, cooldown:150, damage:25, range:32 },
  sniper: { label:'SNIPER', ammo:5, capacity:5, cooldown:1100, damage:80, range:45 }
};
export class WeaponSystem {
  constructor() { this.current='rifle'; this.ammo={shotgun:6,rifle:30,sniper:5}; this.reloading=false; }
  select(name) { if(WEAPONS[name]) this.current=name; }
  reload() {
    if(this.reloading || this.ammo[this.current]===WEAPONS[this.current].capacity) return;
    this.reloading=true; setTimeout(()=>{this.ammo[this.current]=WEAPONS[this.current].capacity;this.reloading=false;}, this.current==='sniper'?1250:950);
  }
  consume() { if(this.reloading || this.ammo[this.current]<=0) return false; this.ammo[this.current]--; return true; }
  stats() { return WEAPONS[this.current]; }
}