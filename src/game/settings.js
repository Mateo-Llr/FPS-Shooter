// Paramètres : sensibilité, volume, contrôles. Sauvegardés dans localStorage.

const STORE = 'clash.settings.v1';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** [id, libellé, touche par défaut]. Les touches sont des KeyboardEvent.code (position physique). */
export const ACTIONS = [
  ['forward', 'Avancer', 'KeyW'],
  ['back', 'Reculer', 'KeyS'],
  ['left', 'Aller à gauche', 'KeyA'],
  ['right', 'Aller à droite', 'KeyD'],
  ['jump', 'Sauter', 'Space'],
  ['crouch', 'S’accroupir', 'ControlLeft'],
  ['sprint', 'Sprinter', 'ShiftLeft'],
  ['reload', 'Recharger', 'KeyR'],
  ['weapon1', 'Fusil à pompe', 'Digit1'],
  ['weapon2', 'Fusil d’assaut', 'Digit2'],
  ['weapon3', 'Sniper', 'Digit3'],
  ['scoreboard', 'Tableau des scores', 'Tab']
];
const defaultKeys = () => Object.fromEntries(ACTIONS.map(([id, , key]) => [id, key]));

class Settings {
  constructor() {
    this.listeners = [];
    this.data = this.load();
  }

  load() {
    try {
      const j = JSON.parse(localStorage.getItem(STORE) || '{}');
      return {
        sens: clamp(+j.sens || 1, 0.1, 4),
        volume: j.volume == null ? 0.7 : clamp(+j.volume, 0, 1),
        keys: { ...defaultKeys(), ...(j.keys || {}) }
      };
    } catch {
      return { sens: 1, volume: 0.7, keys: defaultKeys() };
    }
  }

  save() {
    try { localStorage.setItem(STORE, JSON.stringify(this.data)); } catch { /* stockage indisponible */ }
    this.listeners.forEach(f => f(this.data));
  }

  onChange(f) { this.listeners.push(f); }

  /** Réassigne une action ; si la touche servait déjà, les deux actions échangent leurs touches. */
  rebind(action, code) {
    const keys = this.data.keys, prev = keys[action];
    for (const a in keys) if (a !== action && keys[a] === code) keys[a] = prev;
    keys[action] = code;
    this.save();
  }

  resetKeys() {
    this.data.keys = defaultKeys();
    this.save();
  }
}

export const settings = new Settings();

// ---------- Affichage des touches (suit la disposition réelle du clavier : AZERTY, QWERTY…) ----------

let layout = null;
navigator.keyboard?.getLayoutMap?.().then(m => { layout = m; }).catch(() => {});

const SPECIAL = {
  Space: 'ESPACE', Tab: 'TAB', Enter: 'ENTRÉE', Backspace: 'RETOUR', CapsLock: 'VERR. MAJ',
  ControlLeft: 'CTRL GAUCHE', ControlRight: 'CTRL DROIT', ShiftLeft: 'MAJ GAUCHE', ShiftRight: 'MAJ DROIT',
  AltLeft: 'ALT GAUCHE', AltRight: 'ALT DROIT', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'
};

export function keyLabel(code) {
  if (SPECIAL[code]) return SPECIAL[code];
  const mapped = layout?.get(code);
  if (mapped) return mapped.toUpperCase();
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'PAVÉ ').toUpperCase();
}

// ---------- Interface ----------

export class SettingsUI {
  constructor() {
    this.listening = null;

    this.el = document.createElement('div');
    this.el.id = 'settings';
    this.el.className = 'modal-back';
    this.el.innerHTML = `
      <div class="modal" role="dialog" aria-label="Paramètres">
        <div class="modal-head"><h2>PARAMÈTRES</h2><button class="quiet" data-close>FERMER ✕</button></div>

        <section>
          <h3>SOURIS</h3>
          <div class="set-row">
            <span>Sensibilité</span>
            <input type="range" id="set-sens" min="0.1" max="3" step="0.05" />
            <output id="set-sens-out"></output>
          </div>
        </section>

        <section>
          <h3>AUDIO</h3>
          <div class="set-row">
            <span>Volume général</span>
            <input type="range" id="set-vol" min="0" max="100" step="1" />
            <output id="set-vol-out"></output>
          </div>
        </section>

        <section>
          <h3>CONTRÔLES <small>Clique sur une touche puis appuie sur la nouvelle (Échap pour annuler)</small></h3>
          <div id="set-keys" class="keys-grid"></div>
          <div class="set-foot"><button class="quiet" id="set-reset">RÉINITIALISER LES TOUCHES</button></div>
        </section>
      </div>`;
    document.body.appendChild(this.el);

    this.sens = this.el.querySelector('#set-sens');
    this.sensOut = this.el.querySelector('#set-sens-out');
    this.vol = this.el.querySelector('#set-vol');
    this.volOut = this.el.querySelector('#set-vol-out');
    this.keysEl = this.el.querySelector('#set-keys');

    this.sens.oninput = () => {
      settings.data.sens = +this.sens.value;
      settings.save();
      this.refreshOutputs();
    };
    this.vol.oninput = () => {
      settings.data.volume = +this.vol.value / 100;
      settings.save();
      this.refreshOutputs();
      this.blip();
    };
    this.el.querySelector('#set-reset').onclick = () => { settings.resetKeys(); this.render(); };
    this.el.querySelector('[data-close]').onclick = () => this.close();
    this.el.addEventListener('mousedown', e => { if (e.target === this.el) this.close(); });

    // Capture de la touche à réassigner (phase de capture : le jeu ne la voit pas).
    document.addEventListener('keydown', e => {
      if (!this.el.classList.contains('show')) return;
      if (this.listening) {
        e.preventDefault(); e.stopPropagation();
        const action = this.listening;
        this.listening = null;
        if (e.code !== 'Escape') settings.rebind(action, e.code);
        this.render();
      } else if (e.code === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        this.close();
      }
    }, true);
  }

  open() { this.render(); this.el.classList.add('show'); }
  close() { this.listening = null; this.el.classList.remove('show'); this.onClose?.(); }

  refreshOutputs() {
    this.sensOut.textContent = `${(+this.sens.value).toFixed(2)}×`;
    this.volOut.textContent = `${this.vol.value}%`;
  }

  render() {
    this.sens.value = settings.data.sens;
    this.vol.value = Math.round(settings.data.volume * 100);
    this.refreshOutputs();

    this.keysEl.replaceChildren();
    for (const [id, label] of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'key-row';
      const name = document.createElement('span');
      name.textContent = label;
      const btn = document.createElement('button');
      btn.className = 'key-btn' + (this.listening === id ? ' listening' : '');
      btn.textContent = this.listening === id ? 'APPUIE SUR UNE TOUCHE…' : keyLabel(settings.data.keys[id]);
      btn.onclick = () => { this.listening = id; this.render(); };
      row.append(name, btn);
      this.keysEl.appendChild(row);
    }
  }

  /** Petit bip pour entendre le volume choisi. */
  blip() {
    clearTimeout(this.blipTimer);
    this.blipTimer = setTimeout(() => {
      try {
        const c = (this.ac ??= new (window.AudioContext || window.webkitAudioContext)());
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = 660;
        g.gain.setValueAtTime(0.2 * settings.data.volume + 0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.16);
      } catch { /* audio indisponible */ }
    }, 80);
  }
}
