
export class HUD {
  constructor() {
    this.$ = selector => document.querySelector(selector);

    this.messageTimeout = null;
    this.damageTimeout = null;
    this.previousHealth = 100;

    this.createDamageIndicator();
    this.addStyles();
  }

  addStyles() {
    if (document.querySelector('#clash-hud-styles')) return;

    const style = document.createElement('style');
    style.id = 'clash-hud-styles';

    style.textContent = `
      #health-fill {
        transition: width .25s ease, background-color .25s ease;
      }

      #health-fill.low-health {
        background: #ff3939 !important;
        box-shadow: 0 0 12px #ff3939;
      }

      #health.damage {
        animation: health-shake .22s ease;
      }

      @keyframes health-shake {
        0%,100% { transform: translateX(0); }
        25% { transform: translateX(-4px); }
        75% { transform: translateX(4px); }
      }

      #game-message {
        animation: message-in .25s ease;
      }

      @keyframes message-in {
        from { opacity: 0; transform: translate(-50%, 12px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }

      #damage-indicator {
        position: fixed;
        top: 34%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #ff5947;
        font: 900 38px Arial, sans-serif;
        text-shadow: 0 3px 8px #000, 0 0 15px #ff392b;
        pointer-events: none;
        opacity: 0;
        z-index: 100;
        white-space: nowrap;
      }

      #damage-indicator.show {
        animation: damage-pop .8s ease forwards;
      }

      @keyframes damage-pop {
        0% { opacity: 0; transform: translate(-50%, 12px) scale(.65); }
        15% { opacity: 1; transform: translate(-50%, 0) scale(1.15); }
        30% { transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -35px) scale(.95); }
      }
    `;

    document.head.appendChild(style);
  }

  createDamageIndicator() {
    let indicator = this.$('#damage-indicator');

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'damage-indicator';
      document.body.appendChild(indicator);
    }

    this.damageIndicator = indicator;
  }

  show() {
    this.$('#hud')?.classList.remove('hidden');
  }

  update(data) {
    const health = Math.max(0, Math.min(100, data.health));

    const healthElement = this.$('#health');
    const healthFill = this.$('#health-fill');

    if (healthElement) {
      healthElement.textContent = Math.round(health);

      if (health < this.previousHealth) {
        healthElement.classList.remove('damage');
        void healthElement.offsetWidth;
        healthElement.classList.add('damage');
      }
    }

    if (healthFill) {
      healthFill.style.width = `${health}%`;
      healthFill.classList.toggle('low-health', health <= 30);
    }

    this.previousHealth = health;

    if (this.$('#you-score')) {
      this.$('#you-score').textContent = data.youScore;
    }

    if (this.$('#enemy-score')) {
      this.$('#enemy-score').textContent = data.enemyScore;
    }

    if (this.$('#timer')) {
      const seconds = Math.max(0, Math.floor(data.time));

      this.$('#timer').textContent =
        `${Math.floor(seconds / 60).toString().padStart(2, '0')}:` +
        `${(seconds % 60).toString().padStart(2, '0')}`;
    }

    if (this.$('#weapon-name')) {
      this.$('#weapon-name').textContent =
        data.weapon?.label ?? 'ARME';
    }

    if (this.$('#ammo')) {
      this.$('#ammo').textContent = data.ammo ?? '--';
    }

    if (this.$('#you-name')) {
      this.$('#you-name').textContent =
        (data.youName || 'JOUEUR').toUpperCase();
    }

    if (this.$('#enemy-name')) {
      this.$('#enemy-name').textContent =
        (data.enemyName || 'ADVERSAIRE').toUpperCase();
    }
  }

  showDamage(amount) {
    if (!this.damageIndicator) return;

    this.damageIndicator.textContent = `-${amount} PV`;

    this.damageIndicator.classList.remove('show');
    void this.damageIndicator.offsetWidth;
    this.damageIndicator.classList.add('show');

    clearTimeout(this.damageTimeout);

    this.damageTimeout = setTimeout(() => {
      this.damageIndicator.classList.remove('show');
    }, 850);
  }

  message(text) {
    const element = this.$('#game-message');

    if (!element) return;

    element.textContent = text;
    element.classList.remove('hidden');

    clearTimeout(this.messageTimeout);

    this.messageTimeout = setTimeout(() => {
      if (this.$('#game-message')) {
        this.$('#game-message').classList.add('hidden');
      }
    }, 5000);
  }

  clearMessage() {
    clearTimeout(this.messageTimeout);

    this.$('#game-message')?.classList.add('hidden');
    this.damageIndicator?.classList.remove('show');
  }
}
