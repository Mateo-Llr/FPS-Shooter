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
  ['weapon4', 'Couteau', 'Digit4'],
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

const settingsSections = () => `
  <div class="settings-controls">
    <section>
      <h3>SOURIS</h3>
      <div class="set-row">
        <span>Sensibilité</span>
        <input type="range" class="set-sens" min="0.1" max="3" step="0.05" />
        <output class="set-sens-out"></output>
      </div>
    </section>

    <section>
      <h3>AUDIO</h3>
      <div class="set-row">
        <span>Volume général</span>
        <input type="range" class="set-vol" min="0" max="100" step="1" />
        <output class="set-vol-out"></output>
      </div>
    </section>

    <section>
      <h3>MANETTE</h3>
      <div class="controller-map">
        <span><b>Stick gauche</b> Se déplacer</span>
        <span><b>Stick droit</b> Regarder</span>
        <span><b>A / Croix bas</b> Sauter</span>
        <span><b>B / Croix droite</b> S’accroupir</span>
        <span><b>LT</b> Visée</span>
        <span><b>RT</b> Tirer</span>
        <span><b>X / Croix gauche</b> Recharger / DPad armes</span>
        <span><b>Y / Croix haut</b> Arme suivante</span>
        <span><b>LB / RB</b> LB précédente · RB suivante</span>
        <span><b>View / DOS</b> Tableau des scores</span>
      </div>
    </section>

    <section>
      <h3>CONTRÔLES <small>Clique sur une touche puis appuie sur la nouvelle (Échap pour annuler)</small></h3>
      <div class="set-keys keys-grid"></div>
      <div class="set-foot"><button class="quiet set-reset">RÉINITIALISER LES TOUCHES</button></div>
    </section>
  </div>`;

// ---------- Interface ----------

export class SettingsUI {
  constructor() {
    this.listening = null;
    this.listeningRoot = null;
    this.roots = [];

    this.el = document.createElement('div');
    this.el.id = 'settings';
    this.el.className = 'modal-back';
    this.el.innerHTML = `
      <div class="modal" role="dialog" aria-label="Paramètres">
        <div class="modal-head"><h2>PARAMÈTRES</h2><button class="quiet" data-close>FERMER ✕</button></div>
        ${settingsSections()}
      </div>`;
    document.body.appendChild(this.el);

    this.modalControls = this.el.querySelector('.settings-controls');
    this.roots.push(this.modalControls);
    settings.onChange(() => this.roots.forEach(root => this.refresh(root)));
    this.bindControls(this.modalControls);
    this.render(this.modalControls);
    this.el.querySelector('[data-close]').onclick = () => this.close();
    this.el.addEventListener('mousedown', e => { if (e.target === this.el) this.close(); });

    // Capture de la touche à réassigner (phase de capture : le jeu ne la voit pas).
    document.addEventListener('keydown', e => {
      if (this.listening) {
        e.preventDefault(); e.stopPropagation();
        const action = this.listening;
        const root = this.listeningRoot;
        this.listening = null;
        this.listeningRoot = null;
        if (e.code !== 'Escape') settings.rebind(action, e.code);
        this.refresh(root);
      } else if (e.code === 'Escape' && this.el.classList.contains('show')) {
        e.preventDefault(); e.stopPropagation();
        this.close();
      }
    }, true);
  }

  mountInline(target) {
    target.innerHTML = settingsSections();
    const root = target.querySelector('.settings-controls');
    this.roots.push(root);
    this.bindControls(root);
    this.render(root);
  }

  bindControls(root) {
    root.querySelector('.set-sens').oninput = e => {
      settings.data.sens = +e.currentTarget.value;
      settings.save();
    };
    root.querySelector('.set-vol').oninput = e => {
      settings.data.volume = +e.currentTarget.value / 100;
      settings.save();
      this.blip();
    };
    root.querySelector('.set-reset').onclick = () => settings.resetKeys();
    root.addEventListener('click', e => {
      const btn = e.target.closest('.key-btn');
      if (!btn) return;
      this.listening = btn.dataset.action;
      this.listeningRoot = root;
      this.render(root);
    });
  }

  refresh(root) {
    if (!root?.isConnected) return;
    root.querySelector('.set-sens').value = settings.data.sens;
    root.querySelector('.set-sens-out').textContent = `${(+settings.data.sens).toFixed(2)}×`;
    root.querySelector('.set-vol').value = Math.round(settings.data.volume * 100);
    root.querySelector('.set-vol-out').textContent = `${Math.round(settings.data.volume * 100)}%`;
    for (const btn of root.querySelectorAll('.key-btn')) {
      const action = btn.dataset.action;
      btn.textContent = this.listeningRoot === root && this.listening === action
        ? 'APPUIE SUR UNE TOUCHE…'
        : keyLabel(settings.data.keys[action]);
      btn.classList.toggle('listening', this.listeningRoot === root && this.listening === action);
    }
  }

  render(root) {
    root.querySelector('.set-sens').value = settings.data.sens;
    root.querySelector('.set-sens-out').textContent = `${(+settings.data.sens).toFixed(2)}×`;
    root.querySelector('.set-vol').value = Math.round(settings.data.volume * 100);
    root.querySelector('.set-vol-out').textContent = `${Math.round(settings.data.volume * 100)}%`;
    const keysEl = root.querySelector('.set-keys');
    keysEl.replaceChildren();
    for (const [id, label] of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'key-row';
      const name = document.createElement('span');
      name.textContent = label;
      const btn = document.createElement('button');
      btn.className = 'key-btn' + (this.listeningRoot === root && this.listening === id ? ' listening' : '');
      btn.dataset.action = id;
      btn.textContent = this.listeningRoot === root && this.listening === id ? 'APPUIE SUR UNE TOUCHE…' : keyLabel(settings.data.keys[id]);
      row.append(name, btn);
      keysEl.appendChild(row);
    }
  }

  open() { this.render(this.modalControls); this.el.classList.add('show'); }
  close() {
    if (this.listeningRoot === this.modalControls) {
      this.listening = null;
      this.listeningRoot = null;
    }
    this.el.classList.remove('show');
    this.onClose?.();
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
