import * as THREE from 'three';
import { APPEARANCE_OPTIONS, getAppearance, saveAppearance } from '../game/customization.js';
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

export class CustomizationUI {
  constructor(container) {
    this.container = container;
    this.appearance = getAppearance();
    this.tileVersion = 0;
    this.setupTilePreviews();
    this.render();
    this.updateValues();
    this.initPreview();
    this.bind();
    progress.onChange(() => { this.renderAccessoryChoices(); this.renderTilePreviews(); });
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
                <div class="custom-options-list${options.some(option => option.color) ? ' ribbon' : ''}">
                  ${(category === 'accessory'
                    ? options.filter(option => option.id === 'none' || progress.ownsCosmetic(option.id))
                    : options).map(option => this.choiceHTML(category, option)).join('')}
                </div>
              </section>`).join('')}
          </div>
        </section>
      </div>`;
  }

  choiceHTML(category, option) {
    const selected = this.appearance[category] === option.id;
    const model = this.tileRenderer && MODEL_FOCUS[category];
    return `
      <button class="custom-choice${option.color ? ' swatch' : ''}${model ? ' model' : ''}${selected ? ' selected' : ''}"
        type="button" data-category="${category}" data-value="${option.id}"
        aria-pressed="${selected}" title="${option.label}" ${option.color ? `aria-label="${option.label}"` : ''}
        ${option.color ? `style="--swatch:${option.color}"` : ''}>
        ${option.color ? icon('check') : ''}
        ${model ? `<canvas width="${TILE_SIZE}" height="${TILE_SIZE}" data-preview-category="${category}" data-preview-value="${option.id}" aria-hidden="true"></canvas>` : ''}
        ${option.color ? '' : `<span>${option.label}</span>`}
      </button>`;
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

  /** Dessine les vignettes visibles qui ne reflètent pas encore l'apparence actuelle. */
  renderTilePreviews() {
    if (!this.tileRenderer) return;
    for (const canvas of this.container.querySelectorAll('canvas[data-preview-value]')) {
      if (!canvas.offsetParent) continue;
      if (canvas.dataset.version === String(this.tileVersion)) continue;
      this.drawTile(canvas);
      canvas.dataset.version = String(this.tileVersion);
    }
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
      section.querySelector('.cz-value').textContent = selected?.title ?? '';
    });
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
      const choice = event.target.closest('.custom-choice');
      if (choice) {
        this.appearance[choice.dataset.category] = choice.dataset.value;
        this.appearance = saveAppearance(this.appearance);
        const category = choice.dataset.category;
        this.container.querySelectorAll(`.custom-choice[data-category="${category}"]`).forEach(button => {
          const selected = button === choice;
          button.classList.toggle('selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
        this.updatePreview();
        this.updateValues();
        this.tileVersion++;
        this.renderTilePreviews();
      }
      if (event.target.closest('.custom-reset')) {
        this.appearance = saveAppearance({});
        this.syncChoices();
        this.updateValues();
        this.updatePreview();
        this.tileVersion++;
        this.renderTilePreviews();
      }
    });
  }

  renderAccessoryChoices() {
    const list = this.container.querySelector('.custom-category[data-category="accessory"] .custom-options-list');
    if (!list) return;
    const options = APPEARANCE_OPTIONS.accessory.filter(option =>
      option.id === 'none' || progress.ownsCosmetic(option.id)
    );
    list.innerHTML = options.map(option => this.choiceHTML('accessory', option)).join('');
    this.updateValues();
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
    this.character = createCharacter({ appearance: this.appearance });
    showGun(this.character, 'rifle');
    this.character.group.rotation.y = Math.PI;
    this.character.group.traverse(object => {
      if (object.isMesh) object.castShadow = true;
    });
    this.scene.add(this.character.group);
  }

  syncChoices() {
    this.container.querySelectorAll('.custom-choice').forEach(button => {
      const selected = this.appearance[button.dataset.category] === button.dataset.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
}
