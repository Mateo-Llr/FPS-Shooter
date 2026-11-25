export class HUD {
  constructor() { this.$=s=>document.querySelector(s); }
  show(){this.$('#hud').classList.remove('hidden');}
  update(data) {
    this.$('#health').textContent=Math.max(0,Math.round(data.health));
    this.$('#health-fill').style.width=`${Math.max(0,data.health)}%`;
    this.$('#you-score').textContent=data.youScore;
    this.$('#enemy-score').textContent=data.enemyScore;
    this.$('#timer').textContent=`${Math.floor(data.time/60).toString().padStart(2,'0')}:${Math.floor(data.time%60).toString().padStart(2,'0')}`;
    this.$('#weapon-name').textContent=data.weapon.label;
    this.$('#ammo').textContent=data.ammo;
    this.$('#you-name').textContent=data.youName.toUpperCase();
    this.$('#enemy-name').textContent=data.enemyName.toUpperCase();
  }
  message(text){const el=this.$('#game-message');el.textContent=text;el.classList.remove('hidden');}
  clearMessage(){this.$('#game-message').classList.add('hidden');}
}