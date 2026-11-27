import * as THREE from 'three';
import {
  APPEARANCE_EVENT, APPEARANCE_OPTIONS, COSMETIC_CATEGORIES, COSMETIC_ITEMS, OPEN_SHOP_EVENT, RARITIES,
  getAppearance, getCosmetic, getCosmeticCategories, getRarity, saveAppearance
} from '../game/customization.js';
import { createCharacter, disposeCharacter, poseIdle, showGun } from '../game/character.js';
import { progress } from '../game/progress.js';

const icon = name => `<svg class="ic"><use href="#i-${name}"/></svg>`;

/** Catégorie → [icône, libellé] */
const CATEGORIES = {
  skin: ['user-round', 'Couleur de peau'],
  hairColor: ['droplet', 'Couleur des cheveux'],
  hairStyle: ['scissors', 'Coupe'],
  shirt: ['palette', 'Couleur du haut'],
  shirtStyle: ['shirt', 'Style du haut'],
  pants: ['columns-2', 'Pantalon'],
  shoes: ['footprints', 'Chaussures'],
  accessory: ['glasses', 'Accessoire']
};

/** Catégories affichées en vignettes 3D → partie du personnage à cadrer (comme dans l'éditeur 3D). */
const MODEL_FOCUS = { hairStyle: 'head', accessory: 'head', shirtStyle: 'torso' };
const FOCUS_DIRECTION = { head: [0.45, 0.25, 1], torso: [0.4, 0.2, 1] };
const TILE_SIZE = 192;
/** Nombre de vignettes 3D dessinées par image (évite de figer l'interface à l'ouverture de l'onglet). */
const TILES_PER_FRAME = 3;
const CATEGORY_ICONS = Object.fromEntries(COSMETIC_CATEGORIES.map(category => [category.id, category.icon]));

const STYLE = `
.cz-acc-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:2px 0 10px}
.cz-acc-count{font-size:.8rem;opacity:.85}
.cz-acc-count b{font-size:.95rem}
.cz-shop-link{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:inherit;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer}
.cz-shop-link:hover{background:rgba(255,255,255,.14)}
.cz-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;flex:1 1 100%;scrollbar-width:thin}
.cz-chip{flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer}
.cz-chip small{opacity:.65;font-weight:600}
.cz-chip:hover{background:rgba(255,255,255,.1)}
.cz-chip.active{background:#f07845;border-color:#f07845;color:#1a1008}
.cz-group h4{display:flex;align-items:center;gap:6px;margin:14px 0 6px;font-size:.74rem;letter-spacing:.07em;text-transform:uppercase;opacity:.7}
.cz-group h4 small{opacity:.6;font-weight:600}
.cz-acc .custom-choice{--rc:#9aa7b4;position:relative}
.cz-acc .custom-choice.r-rare{--rc:#4aa3ff}
.cz-acc .custom-choice.r-epic{--rc:#b46bff}
.cz-acc .custom-choice.r-legendary{--rc:#ffb02e}
.cz-acc .custom-choice[data-rarity]::after{content:'';position:absolute;left:10px;right:10px;bottom:0;height:3px;border-radius:3px;background:var(--rc);opacity:.85;pointer-events:none}
.cz-acc .custom-choice.locked canvas{filter:grayscale(.9) brightness(.65)}
.cz-acc .custom-choice.locked>span{opacity:.65}
.cz-acc .custom-choice.trying{outline:2px dashed #ffd84a;outline-offset:-2px}
.cz-price{position:absolute;top:5px;right:5px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:99px;background:rgba(10,14,18,.82);color:#ffd84a;font-size:.68rem;font-weight:800;font-style:normal;pointer-events:none}
.cz-price .ic{width:.95em;height:.95em}
.cz-tryon{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 10px;margin-top:8px;padding:8px 10px;border-radius:12px;background:rgba(255,216,74,.12);border:1px solid rgba(255,216,74,.35);font-size:.8rem;text-align:center}
.cz-tryon.hidden{display:none}
.cz-tryon button{padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:inherit;font:inherit;font-weight:700;font-size:.78rem;cursor:pointer}
.cz-tryon button.primary{background:#ffd84a;border-color:#ffd84a;color:#1a1204}
`;

function ensureStyle() {
  if (document.getElementById('customization-extra-style')) return;
  const style = document.createElement('style');
  style.id = 'customization-extra-style';
  style.textContent = STYLE;
  document.head.append(style);
}

export class CustomizationUI {
  constructor(container) {
    this.container = container;
    this.appearance = getAppearance();
    this.tileVersion = 0;
    this.tileQueue = new Set();
    this.tilePump = 0;
    this.accessoryFilter = 'all';
    this.tryOn = null;
    ensureStyle();
    this.setupTilePreviews();
    this.render();
    this.updateValues();
    this.applyAccessoryFilter();
    this.initPreview();
    this.bind();
    progress.onChange(() => { this.renderAccessoryChoices(); this.renderTilePreviews(); });
    // L'apparence peut changer ailleurs (équipement depuis la boutique) : on se resynchronise.
    window.addEventListener(APPEARANCE_EVENT, event => this.onAppearanceChanged(event.detail));
    // Les vignettes d'un onglet masqué sont dessinées au moment où il devient visible.
    new ResizeObserver(() => this.renderTilePreviews()).observe(this.container);
    this.renderTilePreviews();
  }

  render() {
    this.container.innerHTML = `
      <div class="cz">
        <section class="cz-stage">
          <div class="avatar-stage">
            <canvas class="avatar-preview-canvas" aria-label="Aperçu 3D de ton personnage"></canvas>
          </div>
          <b id="custom-preview-name" class="cz-name">TON AGENT</b>
          <div class="cz-tryon hidden" role="status"></div>
          <button class="cz-reset custom-reset" type="button" title="Réinitialiser l’apparence" aria-label="Réinitialiser l’apparence">${icon('rotate-ccw')}</button>
        </section>

        <section class="cz-editor">
          <nav class="cz-tabs" aria-label="Catégories">
            ${Object.keys(APPEARANCE_OPTIONS).map((category, index) => `
              <button class="cz-tab${index === 0 ? ' active' : ''}" type="button" data-tab="${category}"
                aria-pressed="${index === 0}" title="${CATEGORIES[category][1]}" aria-label="${CATEGORIES[category][1]}">
                ${icon(CATEGORIES[category][0])}<span class="cz-tab-label">${CATEGORIES[category][1]}</span>
              </button>`).join('')}
          </nav>
          <div class="cz-panels">
            ${Object.entries(APPEARANCE_OPTIONS).map(([category, options], index) => `
              <section class="custom-category${index === 0 ? '' : ' hidden'}" data-category="${category}">
                <h3>${CATEGORIES[category][1]}<small class="cz-value"></small></h3>
                ${category === 'accessory'
                  ? `<div class="cz-acc" data-role="acc-body">${this.accessoryBodyHTML()}</div>`
                  : `<div class="custom-options-list${options.some(option => option.color) ? ' ribbon' : ''}">
                      ${options.map(option => this.choiceHTML(category, option)).join('')}
                    </div>`}
              </section>`).join('')}
          </div>
        </section>
      </div>`;
  }

  choiceHTML(category, option) {
    const selected = this.appearance[category] === option.id;
    const model = this.tileRenderer && MODEL_FOCUS[category];
    const cosmetic = category === 'accessory' ? getCosmetic(option.id) : null;
    const locked = !!cosmetic && !progress.ownsCosmetic(option.id);
    const rarity = cosmetic ? getRarity(cosmetic) : null;
    const title = locked
      ? `${option.label} — ${cosmetic.price} crédits (boutique)`
      : cosmetic ? `${option.label} · ${RARITIES[rarity].label}` : option.label;
    return `
      <button class="custom-choice${option.color ? ' swatch' : ''}${model ? ' model' : ''}${selected ? ' selected' : ''}${rarity ? ` r-${rarity}` : ''}${locked ? ' locked' : ''}"
        type="button" data-category="${category}" data-value="${option.id}"
        ${locked ? 'data-locked="1"' : `aria-pressed="${selected}"`} ${rarity ? `data-rarity="${rarity}"` : ''}
        title="${title}" ${option.color ? `aria-label="${option.label}"` : ''}
        ${option.color ? `style="--swatch:${option.color}"` : ''}>
        ${option.color ? icon('check') : ''}
        ${model ? `<canvas width="${TILE_SIZE}" height="${TILE_SIZE}" data-preview-category="${category}" data-preview-value="${option.id}" aria-hidden="true"></canvas>` : ''}
        ${option.color ? '' : `<span>${option.label}</span>`}
        ${locked ? `<em class="cz-price">${icon('coins')}${cosmetic.price}</em>` : ''}
      </button>`;
  }

  /** Onglet « Accessoire » : filtres, compteur, objets groupés par catégorie, objets verrouillés en aperçu. */
  accessoryBodyHTML() {
    const owned = COSMETIC_ITEMS.filter(item => progress.ownsCosmetic(item.id));
    const categories = getCosmeticCategories();
    const chips = [
      ['all', 'Tout', '', COSMETIC_ITEMS.length],
      ['owned', 'Possédés', '', owned.length],
      ...categories.map(category => [
        category, category, CATEGORY_ICONS[category] || '', COSMETIC_ITEMS.filter(item => item.category === category).length
      ])
    ];
    const none = APPEARANCE_OPTIONS.accessory.find(option => option.id === 'none');

    const groups = categories.map(category => {
      const items = COSMETIC_ITEMS
        .filter(item => item.category === category)
        .sort((a, b) => Number(progress.ownsCosmetic(b.id)) - Number(progress.ownsCosmetic(a.id)) || a.price - b.price);
      const ownedHere = items.filter(item => progress.ownsCosmetic(item.id)).length;
      return `
        <div class="cz-group" data-group="${category}">
          <h4><span aria-hidden="true">${CATEGORY_ICONS[category] || ''}</span>${category}<small>${ownedHere}/${items.length}</small></h4>
          <div class="custom-options-list">
            ${items.map(item => this.choiceHTML('accessory', { id: item.id, label: item.label })).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="cz-acc-bar">
        <span class="cz-acc-count"><b>${owned.length}</b> / ${COSMETIC_ITEMS.length} possédés</span>
        <button class="cz-shop-link" type="button" data-role="open-shop">${icon('coins')}<span>Boutique</span></button>
        <div class="cz-chips" role="tablist" aria-label="Filtrer les accessoires">
          ${chips.map(([key, label, glyph, total]) => `
            <button class="cz-chip${this.accessoryFilter === key ? ' active' : ''}" type="button" role="tab"
              aria-selected="${this.accessoryFilter === key}" data-acc-filter="${key}">
              ${glyph ? `<span aria-hidden="true">${glyph}</span>` : ''}${label}<small>${total}</small>
            </button>`).join('')}
        </div>
      </div>
      <div class="cz-group" data-group="none">
        <div class="custom-options-list">${this.choiceHTML('accessory', none)}</div>
      </div>
      ${groups}`;
  }

  /** Applique le filtre actif (sans tout redessiner) : masque tuiles et groupes qui ne correspondent pas. */
  applyAccessoryFilter() {
    const body = this.container.querySelector('[data-role="acc-body"]');
    if (!body) return;
    const filter = this.accessoryFilter;
    body.querySelectorAll('.cz-group').forEach(group => {
      const name = group.dataset.group;
      let any = false;
      group.querySelectorAll('.custom-choice').forEach(tile => {
        const show = name === 'none' || filter === 'all' || (filter === 'owned' ? !tile.dataset.locked : name === filter);
        tile.classList.toggle('hidden', !show);
        any = any || show;
      });
      group.classList.toggle('hidden', !any || (name === 'none' && filter !== 'all' && filter !== 'owned'));
    });
    body.querySelectorAll('.cz-chip').forEach(chip => {
      const active = chip.dataset.accFilter === filter;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', String(active));
    });
  }

  // ------------------------------------------------------------------ vignettes 3D

  /**
   * Un seul moteur WebGL pour toutes les vignettes : chaque variante est dessinée sur le personnage
   * actuel, cadrée sur la tête (ou le torse) comme dans l'éditeur 3D, puis copiée dans son canvas 2D.
   */
  setupTilePreviews() {
    try {
      this.tileRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.tileRenderer.setPixelRatio(1);
      this.tileRenderer.setSize(TILE_SIZE, TILE_SIZE, false);
      this.tileRenderer.setClearColor(0x000000, 0);
      this.tileRenderer.outputColorSpace = THREE.SRGBColorSpace;
      this.tileRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.tileRenderer.toneMappingExposure = 1.1;
    } catch (error) {
      console.warn('Vignettes 3D indisponibles :', error);
      this.tileRenderer = null;
      return;
    }
    this.tileScene = new THREE.Scene();
    this.tileScene.add(new THREE.HemisphereLight(0xe4efff, 0x20262b, 1.7));
    const key = new THREE.DirectionalLight(0xffe2bd, 2.8);
    key.position.set(-2, 3, 4);
    this.tileScene.add(key);
    const rim = new THREE.DirectionalLight(0xf07845, 1.6);
    rim.position.set(3, 2, -3);
    this.tileScene.add(rim);
    this.tileCamera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
    window.addEventListener('beforeunload', () => this.tileRenderer.dispose(), { once: true });
  }

  /** Met en file les vignettes visibles qui ne reflètent pas encore l'apparence actuelle. */
  renderTilePreviews() {
    if (!this.tileRenderer) return;
    for (const canvas of this.container.querySelectorAll('canvas[data-preview-value]')) {
      if (!canvas.offsetParent) continue;
      if (canvas.dataset.version === String(this.tileVersion)) continue;
      this.tileQueue.add(canvas);
    }
    this.pumpTiles();
  }

  /** Dessine quelques vignettes par image pour garder l'interface fluide. */
  pumpTiles() {
    if (this.tilePump || !this.tileQueue.size) return;
    this.tilePump = requestAnimationFrame(() => {
      this.tilePump = 0;
      let drawn = 0;
      for (const canvas of this.tileQueue) {
        this.tileQueue.delete(canvas);
        if (!canvas.isConnected || !canvas.offsetParent) continue;
        if (canvas.dataset.version === String(this.tileVersion)) continue;
        this.drawTile(canvas);
        canvas.dataset.version = String(this.tileVersion);
        if (++drawn >= TILES_PER_FRAME) break;
      }
      this.pumpTiles();
    });
  }

  drawTile(canvas) {
    const category = canvas.dataset.previewCategory;
    const appearance = { ...this.appearance, [category]: canvas.dataset.previewValue };
    // Un accessoire masque les cheveux : on le retire pour montrer la coupe (comme l'éditeur).
    if (category === 'hairStyle') appearance.accessory = 'none';

    let character;
    try {
      character = createCharacter({ appearance });
      character.group.rotation.y = Math.PI;
      this.tileScene.add(character.group);
      this.frameTile(character, MODEL_FOCUS[category]);
      this.tileRenderer.render(this.tileScene, this.tileCamera);
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(this.tileRenderer.domElement, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.warn('Vignette 3D impossible :', error);
    } finally {
      if (character) {
        this.tileScene.remove(character.group);
        disposeCharacter(character);
      }
    }
  }

  /** Même cadrage que l'éditeur : boîte englobante de la partie, caméra en biais à distance ajustée. */
  frameTile(character, focus) {
    const rootId = focus === 'head' ? 'head' : 'torso';
    character.group.updateWorldMatrix(true, true);
    let part = null;
    character.group.traverse(object => { if (!part && object.userData?.editorId === rootId) part = object; });

    const box = new THREE.Box3();
    if (part) {
      box.setFromObject(part);
    } else {
      // Repli : tranche du personnage à la hauteur de la tête ou du torse.
      box.setFromObject(character.group);
      const height = box.max.y - box.min.y;
      if (focus === 'head') box.min.y = box.max.y - height * 0.22;
      else { box.max.y -= height * 0.18; box.min.y = box.max.y - height * 0.38; }
    }
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.2);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.tileCamera.fov) / 2) * 1.15;
    const direction = new THREE.Vector3(...FOCUS_DIRECTION[focus]).normalize();
    this.tileCamera.position.copy(center).addScaledVector(direction, distance);
    this.tileCamera.lookAt(center);
  }

  /** Affiche, à côté du titre de chaque catégorie, le nom de l'option choisie. */
  updateValues() {
    this.container.querySelectorAll('.custom-category').forEach(section => {
      const selected = section.querySelector('.custom-choice.selected');
      section.querySelector('.cz-value').textContent = selected?.dataset.value && selected.querySelector('span')
        ? selected.querySelector('span').textContent
        : selected?.title ?? '';
    });
  }

  // ------------------------------------------------------------------ essayage d'objets non possédés

  setTryOn(id) {
    this.tryOn = id;
    const banner = this.container.querySelector('.cz-tryon');
    const item = id ? getCosmetic(id) : null;
    banner.classList.toggle('hidden', !item);
    banner.innerHTML = item ? `
      <span>Essai : <b>${item.label}</b> · ${icon('coins')} ${item.price}</span>
      <button class="primary" type="button" data-role="tryon-shop">Voir en boutique</button>
      <button type="button" data-role="tryon-cancel">Annuler</button>` : '';
    this.container.querySelectorAll('.custom-choice.trying').forEach(tile => tile.classList.remove('trying'));
    if (item) this.container.querySelector(`.custom-choice[data-category="accessory"][data-value="${id}"]`)?.classList.add('trying');
    this.updatePreview();
  }

  openShop(id) {
    window.dispatchEvent(new CustomEvent(OPEN_SHOP_EVENT, { detail: { id } }));
  }

  /** L'apparence a été modifiée en dehors de ce menu (ex. équipement depuis la boutique). */
  onAppearanceChanged(next) {
    if (!next || Object.keys(next).every(key => next[key] === this.appearance[key])) return;
    this.appearance = { ...next };
    this.syncChoices();
    this.updateValues();
    this.tryOn = null;
    this.setTryOn(null);
    this.tileVersion++;
    this.renderTilePreviews();
  }

  bind() {
    this.container.addEventListener('click', event => {
      const tab = event.target.closest('.cz-tab');
      if (tab) {
        this.container.querySelectorAll('.cz-tab').forEach(item => {
          item.classList.toggle('active', item === tab);
          item.setAttribute('aria-pressed', String(item === tab));
        });
        this.container.querySelectorAll('.custom-category').forEach(section => {
          section.classList.toggle('hidden', section.dataset.category !== tab.dataset.tab);
        });
        this.renderTilePreviews();
        return;
      }

      const chip = event.target.closest('.cz-chip');
      if (chip) {
        this.accessoryFilter = chip.dataset.accFilter;
        this.applyAccessoryFilter();
        this.renderTilePreviews();
        return;
      }
      if (event.target.closest('[data-role="open-shop"]')) { this.openShop(null); return; }
      if (event.target.closest('[data-role="tryon-shop"]')) { this.openShop(this.tryOn); return; }
      if (event.target.closest('[data-role="tryon-cancel"]')) { this.setTryOn(null); return; }

      const choice = event.target.closest('.custom-choice');
      if (choice) {
        // Objet non possédé : simple essayage sur l'aperçu, rien n'est sauvegardé.
        if (choice.dataset.locked) { this.setTryOn(choice.dataset.value); return; }

        this.appearance[choice.dataset.category] = choice.dataset.value;
        this.appearance = saveAppearance(this.appearance);
        const category = choice.dataset.category;
        this.container.querySelectorAll(`.custom-choice[data-category="${category}"]`).forEach(button => {
          const selected = button === choice;
          button.classList.toggle('selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
        this.setTryOn(null);
        this.updateValues();
        this.tileVersion++;
        this.renderTilePreviews();
      }
      if (event.target.closest('.custom-reset')) {
        this.appearance = saveAppearance({});
        this.syncChoices();
        this.updateValues();
        this.setTryOn(null);
        this.tileVersion++;
        this.renderTilePreviews();
      }
    });
  }

  renderAccessoryChoices() {
    const body = this.container.querySelector('[data-role="acc-body"]');
    if (!body) return;
    body.innerHTML = this.accessoryBodyHTML();
    this.applyAccessoryFilter();
    this.updateValues();
    // Si l'objet à l'essai vient d'être acheté, l'essai prend fin.
    if (this.tryOn && progress.ownsCosmetic(this.tryOn)) this.setTryOn(null);
    else if (this.tryOn) this.container.querySelector(`.custom-choice[data-category="accessory"][data-value="${this.tryOn}"]`)?.classList.add('trying');
  }

  initPreview() {
    this.canvas = this.container.querySelector('.avatar-preview-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    this.camera.position.set(0, 2.15, 5.2);
    this.camera.lookAt(0, 1.05, 0);
    this.scene.add(new THREE.HemisphereLight(0xe4efff, 0x20262b, 1.7));

    const key = new THREE.DirectionalLight(0xffe2bd, 3);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xf07845, 2.1);
    rim.position.set(3, 3, -4);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 48),
      new THREE.MeshStandardMaterial({ color: 0x11191f, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.85, 48),
      new THREE.MeshBasicMaterial({ color: 0xf07845, transparent: true, opacity: 0.75 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.01;
    this.scene.add(this.ring);

    this.previewTime = 0;
    this.resizeObserver = new ResizeObserver(() => this.resizePreview());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resizePreview();
    this.updatePreview();
    this.lastFrame = performance.now();
    this.animatePreview = this.animatePreview.bind(this);
    this.frame = requestAnimationFrame(this.animatePreview);
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(this.frame);
      this.resizeObserver.disconnect();
      disposeCharacter(this.character);
      this.renderer.dispose();
    }, { once: true });
  }

  resizePreview() {
    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animatePreview(now) {
    this.frame = requestAnimationFrame(this.animatePreview);
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    if (!this.canvas.offsetParent) return;

    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;
    if (width && height && this.canvas.width !== Math.round(width * this.renderer.getPixelRatio())) {
      this.resizePreview();
    }

    this.previewTime += dt;
    const breath = poseIdle(this.character, this.previewTime);
    this.character.group.scale.y = breath;
    this.character.group.rotation.y = Math.PI + Math.sin(this.previewTime * 0.35) * 0.28;
    this.renderer.render(this.scene, this.camera);
  }

  updatePreview() {
    if (this.character) disposeCharacter(this.character);
    // Un objet « à l'essai » est affiché sans être sauvegardé.
    const appearance = this.tryOn ? { ...this.appearance, accessory: this.tryOn } : this.appearance;
    this.character = createCharacter({ appearance });
    showGun(this.character, 'rifle');
    this.character.group.rotation.y = Math.PI;
    this.character.group.traverse(object => {
      if (object.isMesh) object.castShadow = !object.material.transparent;
    });
    this.scene.add(this.character.group);
  }

  syncChoices() {
    this.container.querySelectorAll('.custom-choice').forEach(button => {
      if (button.dataset.locked) return;
      const selected = this.appearance[button.dataset.category] === button.dataset.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
}
