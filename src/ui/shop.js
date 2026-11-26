import * as THREE from 'three';
import { COSMETIC_ITEMS } from '../game/customization.js';
import { accessoryModel } from '../game/character.js';
import { progress } from '../game/progress.js';

const fmt = value => Math.round(value).toLocaleString('fr-FR');

const PREVIEW_SIZE = 320;

export class ShopUI {
  constructor(container) {
    this.container = container;
    this.message = '';
    this.canvases = new Map();
    this.raf = 0;

    this.setupPreviews();
    this.render();
    this.bind();
    progress.onChange(() => this.render());
    this.startLoop();
  }

  /**
   * Un seul moteur WebGL partagé par toutes les cartes : chaque objet est dessiné
   * puis copié dans le canvas 2D de sa carte (évite de multiplier les contextes WebGL).
   */
  setupPreviews() {
    this.previews = new Map();
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
      return;
    }

    for (const item of COSMETIC_ITEMS) {
      const model = accessoryModel(item.id);
      if (!model.children.length) continue; // pas de modèle : l'icône reste affichée

      // Centre l'objet dans un pivot pour qu'il tourne sur lui-même.
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      const pivot = new THREE.Group();
      pivot.add(model);

      const scene = new THREE.Scene();
      scene.add(pivot);
      scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x3a4048, 1.7));
      const key = new THREE.DirectionalLight(0xffe2bd, 2.6);
      key.position.set(-1.5, 2, 2.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x7fb2ff, 1.4);
      rim.position.set(2, 1, -2);
      scene.add(rim);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
      const radius = Math.max(size.x, size.y, size.z);
      const distance = (radius * 1.35) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) + size.z / 2;
      camera.position.set(0, radius * 0.28, distance);
      camera.lookAt(0, 0, 0);

      this.previews.set(item.id, { scene, camera, pivot });
    }
  }

  startLoop() {
    if (!this.renderer || !this.previews.size) return;
    const loop = time => {
      this.raf = requestAnimationFrame(loop);
      // Onglet de la boutique masqué : on ne dessine rien.
      if (!this.container.isConnected || !this.container.getClientRects().length) return;
      for (const [id, preview] of this.previews) {
        const canvas = this.canvases.get(id);
        if (!canvas?.isConnected) continue;
        // Les objets regardent vers -Z : on les présente de face, avec un léger balancement.
        preview.pivot.rotation.y = Math.PI - 0.35 + Math.sin(time / 1100) * 0.85;
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
    for (const { scene } of this.previews.values()) {
      scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    this.renderer?.dispose();
  }

  render() {
    const icon = name => `<svg class="ic"><use href="#i-${name}"/></svg>`;
    this.container.innerHTML = `
      <p class="sh-message" aria-live="polite">${this.message}</p>
      <div class="sh-grid">
        ${COSMETIC_ITEMS.map(item => {
          const owned = progress.ownsCosmetic(item.id);
          const short = !owned && progress.coins < item.price;
          const visual = this.previews.has(item.id)
            ? `<canvas width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}" data-preview="${item.id}"></canvas>`
            : `<span class="sh-glyph" aria-hidden="true">${item.icon}</span>`;
          return `
            <article class="sh-card${owned ? ' owned' : ''}">
              <div class="sh-visual" role="img" aria-label="${item.label}">${visual}</div>
              <div class="sh-info">
                <h2>${item.label}</h2>
                <p>${item.description}</p>
              </div>
              <button class="sh-buy${owned ? ' is-owned' : ''}${short ? ' is-short' : ''}" type="button"
                data-cosmetic="${item.id}" ${owned ? 'disabled' : ''}>
                ${owned ? `${icon('check')}<span>Acheté</span>` : `${icon('coins')}<span>${fmt(item.price)}</span>`}
              </button>
            </article>`;
        }).join('')}
      </div>`;

    // Le HTML a été recréé : on retrouve les nouveaux canvas.
    this.canvases.clear();
    this.container.querySelectorAll('canvas[data-preview]').forEach(canvas => {
      this.canvases.set(canvas.dataset.preview, canvas);
    });
  }

  bind() {
    this.container.addEventListener('click', event => {
      const button = event.target.closest('.sh-buy');
      if (!button || button.disabled) return;
      const result = progress.purchaseCosmetic(button.dataset.cosmetic);
      this.message = result === 'purchased'
        ? 'Objet acheté ! Tu peux maintenant l’équiper dans Customisation.'
        : result === 'insufficient'
          ? 'Tu n’as pas assez de crédits pour cet achat.'
          : 'Cet objet n’est plus disponible à l’achat.';
      this.render();
    });
  }
}
