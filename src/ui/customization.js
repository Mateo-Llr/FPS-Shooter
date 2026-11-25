import * as THREE from 'three';
import { APPEARANCE_OPTIONS, getAppearance, saveAppearance } from '../game/customization.js';
import { createCharacter, disposeCharacter, poseIdle, showGun } from '../game/character.js';

export class CustomizationUI {
  constructor(container) {
    this.container = container;
    this.appearance = getAppearance();
    this.render();
    this.initPreview();
    this.bind();
  }

  render() {
    const labels = {
      skin: 'COULEUR DE PEAU',
      hairColor: 'COULEUR DES CHEVEUX',
      hairStyle: 'COUPE',
      shirt: 'COULEUR DU T-SHIRT',
      shirtStyle: 'STYLE DU HAUT',
      pants: 'PANTALON',
      shoes: 'CHAUSSURES',
      accessory: 'ACCESSOIRE'
    };

    this.container.innerHTML = `
      <div class="custom-layout">
        <section class="custom-preview-panel">
          <div class="custom-preview-head">
            <div><span class="menu-tag">APERÇU</span><small>TON PERSONNAGE</small></div>
            <span class="preview-live"><i></i> EN DIRECT</span>
          </div>
          <div class="avatar-stage">
            <div class="avatar-glow"></div>
            <canvas class="avatar-preview-canvas" aria-label="Aperçu 3D de ton personnage"></canvas>
          </div>
          <div class="preview-caption"><b id="custom-preview-name">TON AGENT</b><span>PRÊT AU COMBAT</span></div>
          <button class="quiet custom-reset" type="button">RÉINITIALISER L’APPARENCE</button>
        </section>
        <section class="custom-options">
          <header class="custom-options-head">
            <div><span class="menu-tag">ARSENAL VISUEL</span><h2>PERSONNALISATION</h2></div>
            <span class="custom-count">08 CATÉGORIES</span>
          </header>
          <div class="custom-category-grid">
            ${Object.entries(APPEARANCE_OPTIONS).map(([category, options]) => `
              <section class="custom-category" data-category="${category}">
                <h3>${labels[category]}</h3>
                <div class="custom-options-list">
                  ${options.map(option => `
                    <button class="custom-choice${this.appearance[category] === option.id ? ' selected' : ''}"
                      type="button" data-category="${category}" data-value="${option.id}"
                      aria-pressed="${this.appearance[category] === option.id}"
                      title="${option.label}">
                      ${option.color ? `<i class="choice-swatch" style="--swatch:${option.color}"></i>` : ''}
                      <span>${option.label}</span>
                    </button>`).join('')}
                </div>
              </section>`).join('')}
          </div>
          <p class="custom-save-note"><i></i> Tes choix sont sauvegardés automatiquement.</p>
        </section>
      </div>`;
  }

  bind() {
    this.container.addEventListener('click', event => {
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
      }
      if (event.target.closest('.custom-reset')) {
        this.appearance = saveAppearance({});
        this.syncChoices();
        this.updatePreview();
      }
    });
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
