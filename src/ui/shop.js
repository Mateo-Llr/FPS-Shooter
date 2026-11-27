import * as THREE from 'three';
import {
  APPEARANCE_EVENT, COSMETIC_CATEGORIES, COSMETIC_ITEMS, RARITIES,
  getAppearance, getCosmeticCategories, getRarity, saveAppearance
} from '../game/customization.js';
import { accessoryModel, createCharacter, disposeCharacter } from '../game/character.js';
import { progress } from '../game/progress.js';

const fmt = value => Math.round(value).toLocaleString('fr-FR');

const PREVIEW_SIZE = 256;
/** Au-delà de ce prix, l'achat demande une confirmation (second clic). */
const CONFIRM_FROM = 300;
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const CATEGORY_ICONS = Object.fromEntries(COSMETIC_CATEGORIES.map(category => [category.id, category.icon]));

const SORTS = {
  default: ['Ordre du catalogue', null],
  'price-asc': ['Prix croissant', (a, b) => a.price - b.price],
  'price-desc': ['Prix décroissant', (a, b) => b.price - a.price],
  rarity: ['Rareté', (a, b) => RARITY_ORDER.indexOf(getRarity(b)) - RARITY_ORDER.indexOf(getRarity(a)) || b.price - a.price],
  name: ['Nom (A → Z)', (a, b) => a.label.localeCompare(b.label, 'fr')]
};

const STYLE = `
.sh2-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;margin-bottom:12px}
.sh2-balance{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.07);font-weight:800;font-size:1.05rem}
.sh2-balance .ic{width:1.1em;height:1.1em}
.sh2-collection{flex:1;min-width:180px;display:grid;gap:5px;font-size:.8rem;opacity:.9}
.sh2-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}
.sh2-bar>span{display:block;height:100%;background:linear-gradient(90deg,#f07845,#ffb02e);border-radius:inherit;transition:width .4s}
.sh2-toolbar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-bottom:12px}
.sh2-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;flex:1 1 320px;scrollbar-width:thin}
.sh2-chip{flex:none;display:inline-flex;gap:6px;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;font-weight:700;font-size:.85rem;cursor:pointer}
.sh2-chip small{opacity:.65;font-weight:600}
.sh2-chip:hover{background:rgba(255,255,255,.1)}
.sh2-chip.active{background:#f07845;border-color:#f07845;color:#1a1008}
.sh2-chip.active small{opacity:.8}
.sh2-controls{display:flex;gap:8px;flex:0 1 auto}
.sh2-controls input,.sh2-controls select{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:10px;padding:7px 10px;font:inherit;font-size:.85rem;min-width:0}
.sh2-controls input{width:150px}
.sh2-controls select option{color:#111}
.sh-card{--rc:#9aa7b4;position:relative;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rc) 30%,transparent);transition:transform .15s,box-shadow .15s}
.sh-card:hover{transform:translateY(-2px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rc) 75%,transparent),0 8px 22px color-mix(in srgb,var(--rc) 22%,transparent)}
.sh-card.r-rare{--rc:#4aa3ff}.sh-card.r-epic{--rc:#b46bff}.sh-card.r-legendary{--rc:#ffb02e}
.sh-card .sh-visual{position:relative;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--rc) 26%,transparent),transparent 72%)}
.sh-rarity,.sh-tag{position:absolute;top:8px;font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:99px;pointer-events:none}
.sh-rarity{left:8px;background:color-mix(in srgb,var(--rc) 22%,rgba(10,14,18,.78));color:var(--rc)}
.sh-tag{right:8px;background:#3fa65a;color:#fff}
.sh-cat{display:block;margin-top:4px;opacity:.55;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
.sh-buy.sh-equip{background:#2f7fc1;color:#fff}
.sh-buy.sh-equip.is-on{background:rgba(255,255,255,.12);color:inherit}
.sh-buy.is-confirm{background:#d6a529;color:#1a1204}
.sh2-empty{grid-column:1/-1;text-align:center;opacity:.7;padding:36px 0}
@media (prefers-reduced-motion:reduce){.sh-card,.sh2-bar>span{transition:none}}
`;

function ensureStyle() {
  if (document.getElementById('shop-extra-style')) return;
  const style = document.createElement('style');
  style.id = 'shop-extra-style';
  style.textContent = STYLE;
  document.head.append(style);
}

export class ShopUI {
  constructor(container) {
    this.container = container;
    this.message = '';
    this.filter = 'all';
    this.sort = 'default';
    this.query = '';
    this.pending = null;
    this.canvases = new Map();
    this.previews = new Map();
    this.visible = new Set();
    this.appearanceKey = '';
    this.lastKeyCheck = 0;
    this.lastDraw = 0;
    this.raf = 0;

    ensureStyle();
    this.setupRenderer();
    this.buildShell();
    this.render();
    this.bind();
    const unsubscribe = progress.onChange(() => this.render());
    this.unsubscribe = typeof unsubscribe === 'function' ? unsubscribe : null;
    this.onAppearance = () => this.render();
    window.addEventListener(APPEARANCE_EVENT, this.onAppearance);
    this.startLoop();
  }

  // ------------------------------------------------------------------ aperçus 3D

  /**
   * Un seul moteur WebGL partagé par toutes les cartes : chaque objet est dessiné
   * puis copié dans le canvas 2D de sa carte (évite de multiplier les contextes WebGL).
   * Les aperçus sont créés à la demande et dessinés uniquement quand la carte est visible.
   */
  setupRenderer() {
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE, false);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
    } catch (error) {
      console.warn('Aperçu 3D de la boutique indisponible :', error);
      this.renderer = null;
    }
    this.observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          const id = entry.target.dataset.preview;
          if (entry.isIntersecting) this.visible.add(id); else this.visible.delete(id);
        }
      }, { rootMargin: '80px' })
      : null;
  }

  addLights(scene, warm = 0xffe2bd, cool = 0x7fb2ff) {
    scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x3a4048, 1.7));
    const key = new THREE.DirectionalLight(warm, 2.6);
    key.position.set(-1.5, 2, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(cool, 1.4);
    rim.position.set(2, 1, -2);
    scene.add(rim);
  }

  /** Aperçu : l'objet porté par TON personnage (apparence actuelle), cadré sur la tête. */
  buildPreview(id) {
    const scene = new THREE.Scene();
    this.addLights(scene);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    const pivot = new THREE.Group();
    scene.add(pivot);
    const preview = { scene, camera, pivot, character: null };

    try {
      const character = createCharacter({ appearance: { ...getAppearance(), accessory: id } });
      character.group.rotation.y = Math.PI;
      pivot.add(character.group);
      scene.updateMatrixWorld(true);

      let head = null;
      character.group.traverse(object => { if (!head && object.userData?.editorId === 'head') head = object; });
      const box = new THREE.Box3().setFromObject(head || character.group);
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.25);
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.08;
      camera.position.set(center.x, center.y + radius * 0.12, center.z + distance);
      camera.lookAt(center);
      preview.character = character;
      preview.sway = 0.55;
      preview.base = 0;
      return preview;
    } catch (error) {
      console.warn('Aperçu sur personnage impossible, repli sur l’objet seul :', error);
    }

    // Repli : l'objet seul, centré dans un pivot.
    pivot.clear();
    const model = accessoryModel(id);
    if (!model.children.length) return null;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    pivot.add(model);
    const radius = Math.max(size.x, size.y, size.z);
    const distance = (radius * 1.35) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) + size.z / 2;
    camera.position.set(0, radius * 0.28, distance);
    camera.lookAt(0, 0, 0);
    preview.sway = 0.85;
    preview.base = Math.PI - 0.35;
    return preview;
  }

  disposePreview(preview) {
    if (!preview) return;
    if (preview.character) disposeCharacter(preview.character);
    preview.scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }

  /** L'apparence a changé (menu de customisation) : les aperçus sont reconstruits à la demande. */
  checkAppearance(time) {
    if (time - this.lastKeyCheck < 600) return;
    this.lastKeyCheck = time;
    const key = JSON.stringify(getAppearance());
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;
    for (const preview of this.previews.values()) this.disposePreview(preview);
    this.previews.clear();
  }

  startLoop() {
    if (!this.renderer) return;
    const loop = time => {
      this.raf = requestAnimationFrame(loop);
      // Onglet de la boutique masqué : on ne dessine rien.
      if (!this.container.isConnected || !this.container.getClientRects().length) return;
      if (time - this.lastDraw < 32) return; // ~30 images/s suffisent pour des vignettes
      this.lastDraw = time;
      this.checkAppearance(time);

      for (const id of this.visible) {
        const canvas = this.canvases.get(id);
        if (!canvas?.isConnected) continue;
        let preview = this.previews.get(id);
        if (preview === undefined) {
          preview = this.buildPreview(id);
          this.previews.set(id, preview);
        }
        if (!preview) continue;
        // Les personnages regardent vers -Z (ils sont déjà retournés) : léger balancement autour de la face.
        preview.pivot.rotation.y = preview.base + Math.sin(time / 1100 + id.length) * preview.sway;
        this.renderer.render(preview.scene, preview.camera);
        const g = canvas.getContext('2d');
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.unsubscribe?.();
    window.removeEventListener(APPEARANCE_EVENT, this.onAppearance);
    for (const preview of this.previews.values()) this.disposePreview(preview);
    this.previews.clear();
    this.renderer?.dispose();
  }

  // ------------------------------------------------------------------ interface

  buildShell() {
    this.container.innerHTML = `
      <div class="sh2-head">
        <span class="sh2-balance" data-role="balance"></span>
        <div class="sh2-collection" data-role="collection"></div>
      </div>
      <div class="sh2-toolbar">
        <div class="sh2-chips" data-role="chips" role="tablist" aria-label="Catégories"></div>
        <div class="sh2-controls">
          <input type="search" data-role="search" placeholder="Rechercher…" aria-label="Rechercher un objet" autocomplete="off">
          <select data-role="sort" aria-label="Trier">
            ${Object.entries(SORTS).map(([key, [label]]) => `<option value="${key}">${label}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="sh-message" aria-live="polite"></p>
      <div class="sh-grid" data-role="grid"></div>`;
    this.el = {
      balance: this.container.querySelector('[data-role="balance"]'),
      collection: this.container.querySelector('[data-role="collection"]'),
      chips: this.container.querySelector('[data-role="chips"]'),
      message: this.container.querySelector('.sh-message'),
      grid: this.container.querySelector('[data-role="grid"]')
    };
  }

  setMessage(text) {
    this.message = text;
    this.el.message.textContent = text;
  }

  matches(item) {
    if (this.filter === 'owned' && !progress.ownsCosmetic(item.id)) return false;
    if (this.filter !== 'all' && this.filter !== 'owned' && item.category !== this.filter) return false;
    const q = this.query.trim().toLocaleLowerCase('fr');
    return !q || `${item.label} ${item.description} ${item.category}`.toLocaleLowerCase('fr').includes(q);
  }

  render() {
    const icon = name => `<svg class="ic"><use href="#i-${name}"/></svg>`;
    const owned = COSMETIC_ITEMS.filter(item => progress.ownsCosmetic(item.id)).length;
    const equippedId = getAppearance().accessory;

    this.el.balance.innerHTML = `${icon('coins')}<span>${fmt(progress.coins)}</span>`;
    this.el.collection.innerHTML = `
      <span><b>${owned}</b> / ${COSMETIC_ITEMS.length} objets collectionnés</span>
      <div class="sh2-bar"><span style="width:${(owned / COSMETIC_ITEMS.length) * 100}%"></span></div>`;

    const count = predicate => COSMETIC_ITEMS.filter(predicate).length;
    const chips = [
      ['all', 'Tout', '', COSMETIC_ITEMS.length],
      ['owned', 'Possédés', '', owned],
      ...getCosmeticCategories().map(category => [
        category, category, CATEGORY_ICONS[category] || '', count(item => item.category === category)
      ])
    ];
    this.el.chips.innerHTML = chips.map(([key, label, glyph, total]) => `
      <button class="sh2-chip${this.filter === key ? ' active' : ''}" type="button" role="tab"
        aria-selected="${this.filter === key}" data-filter="${key}">
        ${glyph ? `<span aria-hidden="true">${glyph}</span>` : ''}${label}<small>${total}</small>
      </button>`).join('');

    const compare = SORTS[this.sort][1];
    const items = COSMETIC_ITEMS.filter(item => this.matches(item));
    if (compare) items.sort(compare);

    this.el.grid.innerHTML = items.length ? items.map(item => {
      const isOwned = progress.ownsCosmetic(item.id);
      const isEquipped = isOwned && equippedId === item.id;
      const short = !isOwned && progress.coins < item.price;
      const rarity = getRarity(item);
      const confirming = this.pending === item.id;
      const hasPreview = !!this.renderer;
      const visual = hasPreview
        ? `<canvas width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}" data-preview="${item.id}"></canvas>`
        : `<span class="sh-glyph" aria-hidden="true">${item.icon}</span>`;
      let button;
      if (isOwned) {
        button = `<button class="sh-buy sh-equip${isEquipped ? ' is-on' : ''}" type="button" data-cosmetic="${item.id}"
          data-action="${isEquipped ? 'unequip' : 'equip'}">${icon('check')}<span>${isEquipped ? 'Retirer' : 'Équiper'}</span></button>`;
      } else {
        button = `<button class="sh-buy${short ? ' is-short' : ''}${confirming ? ' is-confirm' : ''}" type="button"
          data-cosmetic="${item.id}" data-action="buy"
          ${short ? `title="Il te manque ${fmt(item.price - progress.coins)} crédits"` : ''}>
          ${icon('coins')}<span>${confirming ? `Confirmer · ${fmt(item.price)}` : fmt(item.price)}</span></button>`;
      }
      return `
        <article class="sh-card r-${rarity}${isOwned ? ' owned' : ''}">
          <div class="sh-visual" role="img" aria-label="${item.label}">
            ${visual}
            <span class="sh-rarity">${RARITIES[rarity].label}</span>
            ${isEquipped ? '<span class="sh-tag">Équipé</span>' : ''}
          </div>
          <div class="sh-info">
            <h2>${item.label}</h2>
            <p>${item.description}</p>
            <span class="sh-cat">${item.category}</span>
          </div>
          ${button}
        </article>`;
    }).join('') : '<p class="sh2-empty">Aucun objet ne correspond à ta recherche.</p>';

    // Le HTML a été recréé : on retrouve (et on observe) les nouveaux canvas.
    this.observer?.disconnect();
    this.visible.clear();
    this.canvases.clear();
    this.el.grid.querySelectorAll('canvas[data-preview]').forEach(canvas => {
      this.canvases.set(canvas.dataset.preview, canvas);
      if (this.observer) this.observer.observe(canvas); else this.visible.add(canvas.dataset.preview);
    });
    this.el.message.textContent = this.message;
  }

  bind() {
    this.container.addEventListener('click', event => {
      const chip = event.target.closest('.sh2-chip');
      if (chip) {
        this.filter = chip.dataset.filter;
        this.pending = null;
        this.render();
        return;
      }

      const button = event.target.closest('.sh-buy');
      if (!button || button.disabled) return;
      const id = button.dataset.cosmetic;
      const item = COSMETIC_ITEMS.find(entry => entry.id === id);
      if (!item) return;
      const action = button.dataset.action;

      if (action === 'equip' || action === 'unequip') {
        this.pending = null;
        saveAppearance({ ...getAppearance(), accessory: action === 'equip' ? id : 'none' });
        this.setMessage(action === 'equip' ? `${item.label} équipé.` : `${item.label} retiré.`);
        this.render();
        return;
      }

      // Achat : les objets chers demandent une confirmation.
      if (item.price >= CONFIRM_FROM && this.pending !== id && progress.coins >= item.price) {
        this.pending = id;
        this.setMessage(`Clique encore une fois pour acheter « ${item.label} » (${fmt(item.price)} crédits).`);
        this.render();
        clearTimeout(this.pendingTimer);
        this.pendingTimer = setTimeout(() => {
          if (this.pending !== id) return;
          this.pending = null;
          this.setMessage('');
          this.render();
        }, 4000);
        return;
      }
      this.pending = null;
      clearTimeout(this.pendingTimer);
      const result = progress.purchaseCosmetic(id);
      this.setMessage(result === 'purchased'
        ? `${item.label} acheté ! Tu peux l’équiper ici ou dans Customisation.`
        : result === 'insufficient'
          ? 'Tu n’as pas assez de crédits pour cet achat.'
          : 'Cet objet n’est plus disponible à l’achat.');
      this.render();
    });

    this.container.querySelector('[data-role="search"]').addEventListener('input', event => {
      this.query = event.target.value;
      this.render();
    });
    this.container.querySelector('[data-role="sort"]').addEventListener('change', event => {
      this.sort = event.target.value;
      this.render();
    });
  }
}
