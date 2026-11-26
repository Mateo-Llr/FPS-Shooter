import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createCharacter, disposeCharacter, showGun, poseIdle } from '../game/character.js';
import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE } from '../game/customization.js';
import { editorAssets } from '../game/editor-assets.js';
import { WEAPONS } from '../game/weapons.js';
import { MAPS, World } from '../game/world.js';
import { saveEditorAssets } from './editor-bridge.js';
import './editor.css';

const GEOMETRIES = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 16, 12),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: () => new THREE.ConeGeometry(0.5, 1, 12)
};
const GEOMETRY_LABELS = { box: 'Cube', sphere: 'Sphère', cylinder: 'Cylindre', cone: 'Cône' };

/**
 * Ce que l'on peut éditer. Chaque élément isole ses propres pièces : la liste, la sélection
 * et l'enregistrement ne concernent que lui, le reste du personnage n'est qu'un décor.
 *  - variant : ce que l'on choisit d'abord (quelle coupe, quel accessoire, quelle arme, quelle carte)
 *  - focus   : où se place la caméra
 */
const SUBJECTS = [
  { id: 'hair', kind: 'character', group: 'PERSONNAGE', icon: '✂', label: 'Coupe de cheveux', hint: 'Volumes et couleur d’une coupe', variant: 'hairStyle', variantLabel: 'COUPE', focus: 'head' },
  { id: 'accessory', kind: 'character', group: 'PERSONNAGE', icon: '◒', label: 'Accessoire', hint: 'Casquette, lunettes, masque…', variant: 'accessory', variantLabel: 'ACCESSOIRE', focus: 'head' },
  { id: 'weapon', kind: 'character', group: 'PERSONNAGE', icon: '⌖', label: 'Arme', hint: 'Modèle tenu en main', variant: 'weapon', variantLabel: 'ARME', focus: 'weapon' },
  { id: 'head', kind: 'character', group: 'PERSONNAGE', icon: '☺', label: 'Tête & visage', hint: 'Crâne, yeux, bouche, oreilles', focus: 'head' },
  { id: 'body', kind: 'character', group: 'PERSONNAGE', icon: '▣', label: 'Corps & tenue', hint: 'Torse, bras, jambes', focus: 'body' },
  { id: 'custom', kind: 'character', group: 'PERSONNAGE', icon: '✚', label: 'Blocs ajoutés', hint: 'Pièces supplémentaires', focus: 'body' },
  { id: 'map', kind: 'map', group: 'MONDE', icon: '⌂', label: 'Carte', hint: 'Couvertures, taille, sol', variant: 'map', variantLabel: 'CARTE', focus: 'map' }
];

const NAMES = {
  torso: 'Torse', 'arm-left': 'Bras gauche', 'arm-right': 'Bras droit',
  'leg-left': 'Jambe gauche', 'leg-right': 'Jambe droite',
  head: 'Tête', 'head-model': 'Modèle de la tête', face: 'Visage',
  hair: 'Cheveux', accessory: 'Accessoire', gun: 'Arme',
  'hair-top': 'Dessus', 'hair-side-l': 'Côté gauche', 'hair-side-r': 'Côté droit',
  'hair-back': 'Arrière', 'hair-fringe': 'Frange', 'hair-nape': 'Nuque',
  'hair-temple-l': 'Patte gauche', 'hair-temple-r': 'Patte droite',
  'hair-ridge': 'Crête', 'hair-tuft': 'Mèche', 'hair-sweep': 'Mèche balayée', 'hair-part': 'Côté de la raie',
  'hair-lock': 'Dessus long', 'hair-quiff': 'Toupet',
  'hair-tail-0': 'Queue (haut)', 'hair-tail-1': 'Queue (milieu)', 'hair-tail-2': 'Queue (pointe)'
};
const GENERIC = { mesh: 'Bloc', 'hair-volume': 'Volume', 'hair-spike': 'Pointe' };

const segmentName = segment => {
  const base = segment.replace(/:.*/, '').replace(/^gun-.*/, 'gun');
  return NAMES[base] || base;
};

/** Nom lisible d'une pièce à partir de son identifiant d'éditeur. */
function prettyName(object) {
  const id = object.userData.editorId || object.name;
  if (id.startsWith('custom:')) return object.userData.editorName || object.name || 'Bloc ajouté';
  const parts = id.split('/');
  const last = parts[parts.length - 1];
  const generic = last.match(/^(mesh|hair-volume|hair-spike)-(\d+)$/);
  if (generic) {
    const label = `${GENERIC[generic[1]]} ${Number(generic[2]) + 1}`;
    return parts.length > 1 ? `${segmentName(parts[parts.length - 2])} · ${label}` : label;
  }
  return segmentName(last);
}

const snapshot = object => ({
  p: object.position.clone(),
  r: object.rotation.clone(),
  s: object.scale.clone(),
  c: object.isMesh && object.material?.color ? object.material.color.getHex() : null
});

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export class AssetEditor {
  constructor() {
    this.subject = SUBJECTS[0];
    this.look = { ...DEFAULT_APPEARANCE };
    this.weaponType = 'rifle';
    this.mapId = MAPS[0].id;
    this.selected = null;
    this.currentWorld = null;
    this.character = null;
    this.objects = [];
    this.opened = false;
    this.dirty = false;
    this.snap = false;
    this.showContext = true;
    this.addPartIndex = 0;
    this.pointerStart = null;
    this.ghostMaterial = null;
    this.selBox = null;
    this.hoverBox = null;

    this.launchButton = document.createElement('button');
    this.launchButton.id = 'asset-editor-launch';
    this.launchButton.type = 'button';
    this.launchButton.textContent = 'OUVRIR L’ÉDITEUR 3D';
    document.body.appendChild(this.launchButton);

    this.root = document.createElement('section');
    this.root.id = 'asset-editor';
    this.root.setAttribute('aria-label', 'Éditeur 3D');
    this.root.innerHTML = `
      <header class="ed-top">
        <strong class="ed-brand">CLASH//ROOM <span>ÉDITEUR 3D</span></strong>
        <nav class="ed-crumbs" aria-label="Élément édité"></nav>
        <span class="ed-status" aria-live="polite"></span>
        <button type="button" class="ed-save primary">ENREGISTRER</button>
        <button type="button" class="ed-close quiet">FERMER</button>
      </header>
      <div class="ed-body">
        <aside class="ed-panel ed-left">
          <section class="ed-section">
            <h2><b>1</b> QUE VEUX-TU ÉDITER ?</h2>
            <div class="ed-subjects"></div>
          </section>
          <section class="ed-section ed-variant-sec">
            <h2 class="ed-variant-title"><b>2</b> VARIANTE</h2>
            <div class="ed-variant-row">
              <button type="button" class="ed-prev" aria-label="Précédent">◀</button>
              <select class="ed-variant"></select>
              <button type="button" class="ed-next" aria-label="Suivant">▶</button>
            </div>
          </section>
          <section class="ed-section ed-list-sec">
            <h2><b class="ed-step">3</b> PIÈCES <span class="ed-count"></span></h2>
            <div class="ed-object-list" role="listbox"></div>
            <div class="ed-add-row">
              <select class="ed-geometry" aria-label="Forme du bloc"></select>
              <button type="button" class="ed-add">+ AJOUTER</button>
            </div>
          </section>
        </aside>

        <div class="ed-viewport">
          <canvas aria-label="Vue 3D éditable"></canvas>
          <div class="ed-toolbar">
            <div class="ed-seg">
              <button type="button" data-tool="translate" class="active" title="Déplacer (W)">DÉPLACER</button>
              <button type="button" data-tool="rotate" title="Tourner (E)">TOURNER</button>
              <button type="button" data-tool="scale" title="Échelle (R)">ÉCHELLE</button>
            </div>
            <button type="button" class="ed-toggle ed-snap" aria-pressed="false" title="Pas fixes pour déplacer, tourner et redimensionner">AIMANT</button>
            <button type="button" class="ed-toggle ed-context" aria-pressed="true" title="Afficher le reste du personnage en transparence">CONTEXTE</button>
            <button type="button" class="ed-focus" title="Recentrer la caméra (F)">RECENTRER</button>
          </div>
          <p class="ed-help">Clic : sélectionner · glisser : orbiter · molette : zoom · clic droit : déplacer la vue · W / E / R : outils · F : recentrer</p>
        </div>

        <aside class="ed-panel ed-right">
          <h2 class="ed-inspector-title">INSPECTEUR</h2>
          <section class="ed-section ed-map-settings">
            <label>DEMI-LARGEUR (M)<input type="number" min="12" max="50" step="1" data-map-size="halfWidth"></label>
            <label>DEMI-PROFONDEUR (M)<input type="number" min="12" max="50" step="1" data-map-size="halfDepth"></label>
            <label>COULEUR DU SOL<input type="color" data-map-color="floor"></label>
          </section>
          <p class="ed-hint ed-empty-selection">Choisis une pièce dans la liste ou clique dessus dans la vue 3D.</p>
          <section class="ed-section ed-selection">
            <div class="ed-selected-name"></div>
            <div class="ed-transform-fields"></div>
            <label class="ed-part-color">COULEUR<input type="color" class="ed-color"></label>
            <p class="ed-hint ed-color-note"></p>
            <label class="ed-cover-material">MATÉRIAU
              <select class="ed-material">
                <option value="orange">Conteneur orange</option>
                <option value="blue">Conteneur bleu</option>
                <option value="wall">Mur</option>
                <option value="dark">Structure sombre</option>
              </select>
            </label>
            <div class="ed-actions">
              <button type="button" class="ed-reset">RÉINITIALISER</button>
              <button type="button" class="ed-duplicate">DUPLIQUER</button>
              <button type="button" class="ed-delete quiet">SUPPRIMER</button>
            </div>
          </section>
        </aside>
      </div>`;
    document.body.appendChild(this.root);

    const $ = selector => this.root.querySelector(selector);
    this.$ = $;
    this.canvas = $('canvas');
    this.viewport = $('.ed-viewport');
    this.status = $('.ed-status');
    this.objectList = $('.ed-object-list');
    this.transformFields = $('.ed-transform-fields');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151d22);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 300);
    this.camera.position.set(3.5, 3.2, 6);
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.target.set(0, 1, 0);
    this.gizmo = new TransformControls(this.camera, this.canvas);
    this.gizmo.addEventListener('dragging-changed', event => {
      this.orbit.enabled = !event.value;
      if (event.value && this.pointerStart) this.pointerStart.gizmoDragging = true;
    });
    this.gizmo.addEventListener('objectChange', () => {
      this.fillInspectorFields();
      this.markDirty();
    });
    this.scene.add(this.gizmo.getHelper());
    this.scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x303743, 1.5));
    const key = new THREE.DirectionalLight(0xffe2bd, 2.8);
    key.position.set(-12, 24, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    this.buildSubjectButtons();
    this.buildGeometryPicker();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.rebuildScene({ focus: true });
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(this.frame);
      this.resizeObserver.disconnect();
      this.disposeCurrentAsset();
      this.renderer.dispose();
    }, { once: true });
  }

  // ------------------------------------------------------------------ interface

  buildSubjectButtons() {
    const host = this.$('.ed-subjects');
    host.replaceChildren();
    for (const group of [...new Set(SUBJECTS.map(subject => subject.group))]) {
      host.appendChild(el('div', 'ed-group', group));
      for (const subject of SUBJECTS.filter(item => item.group === group)) {
        const button = el('button', 'ed-subject');
        button.type = 'button';
        button.dataset.subject = subject.id;
        button.append(el('span', 'ed-subject-icon', subject.icon));
        const text = el('span', 'ed-subject-text');
        text.append(el('b', '', subject.label), el('small', '', subject.hint));
        button.appendChild(text);
        host.appendChild(button);
      }
    }
  }

  buildGeometryPicker() {
    this.$('.ed-geometry').replaceChildren(...Object.keys(GEOMETRIES).map(id => {
      const option = el('option', '', GEOMETRY_LABELS[id]);
      option.value = id;
      return option;
    }));
  }

  bind() {
    const $ = this.$;
    this.root.querySelectorAll('[data-tool]').forEach(button => {
      button.onclick = () => this.setTool(button.dataset.tool);
    });
    $('.ed-subjects').onclick = event => {
      const button = event.target.closest('[data-subject]');
      if (button) this.setSubject(button.dataset.subject);
    };
    $('.ed-variant').onchange = event => this.setVariant(event.target.value);
    $('.ed-prev').onclick = () => this.stepVariant(-1);
    $('.ed-next').onclick = () => this.stepVariant(1);
    $('.ed-add').onclick = () => this.addBlock();
    $('.ed-duplicate').onclick = () => this.duplicateBlock();
    $('.ed-delete').onclick = () => this.deleteBlock();
    $('.ed-reset').onclick = () => this.resetSelected();
    $('.ed-material').onchange = event => this.setCoverMaterial(event.target.value);
    $('.ed-color').oninput = event => this.setCharacterColor(event.target.value);
    $('.ed-focus').onclick = () => this.focusSubject();
    $('.ed-snap').onclick = () => {
      this.snap = !this.snap;
      $('.ed-snap').setAttribute('aria-pressed', String(this.snap));
      this.applySnap();
    };
    $('.ed-context').onclick = () => {
      this.showContext = !this.showContext;
      $('.ed-context').setAttribute('aria-pressed', String(this.showContext));
      this.restoreGhost();
      this.applyGhost();
    };
    this.root.querySelectorAll('[data-map-size]').forEach(input => {
      input.onchange = () => this.updateMapDimensions();
    });
    $('[data-map-color="floor"]').onchange = event => {
      this.activeMap().colors.floor = event.target.value;
      this.markDirty();
      this.rebuildMap(this.selected?.userData.mapCoverIndex ?? -1);
    };
    this.transformFields.oninput = () => this.applyInspectorFields();

    this.objectList.onclick = event => {
      const button = event.target.closest('[data-index]');
      if (button) this.selectObject(this.objects[Number(button.dataset.index)]);
    };
    this.objectList.addEventListener('pointerover', event => {
      const button = event.target.closest('[data-index]');
      this.setHighlight('hover', button ? this.objects[Number(button.dataset.index)] : null);
    });
    this.objectList.addEventListener('pointerleave', () => this.setHighlight('hover', null));

    $('.ed-save').onclick = () => this.save();
    $('.ed-close').onclick = () => this.close();
    this.launchButton.onclick = () => this.open();

    this.canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      this.pointerStart = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        moved: false, gizmoDragging: this.gizmo.dragging
      };
    });
    this.canvas.addEventListener('pointermove', event => this.hoverPick(event));
    this.canvas.addEventListener('pointerleave', () => this.setHighlight('hover', null));
    window.addEventListener('pointermove', event => this.trackPointerMovement(event));
    window.addEventListener('pointerup', event => this.finishPointerSelection(event));
    window.addEventListener('pointercancel', event => this.cancelPointerSelection(event));
    window.addEventListener('keydown', event => this.onKey(event));
  }

  onKey(event) {
    if (!this.opened) return;
    const typing = event.target.closest?.('input, select, textarea');
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
      return;
    }
    if (event.key === 'Escape') {
      if (this.selected) this.selectObject(null);
      else this.close();
      return;
    }
    if (typing) return;
    const tools = { w: 'translate', e: 'rotate', r: 'scale' };
    const k = event.key.toLowerCase();
    if (tools[k]) this.setTool(tools[k]);
    else if (k === 'f') this.focusSubject();
    else if (event.key === 'Delete') this.deleteBlock();
  }

  setStatus(text, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }

  markDirty() {
    if (this.dirty) return;
    this.dirty = true;
    this.setStatus('● Modifications non enregistrées');
  }

  /** Met à jour tout ce qui dépend de l'élément édité (boutons, fil d'Ariane, variantes, outils). */
  updateChrome() {
    const subject = this.subject, isMap = subject.kind === 'map';
    this.root.querySelectorAll('[data-subject]').forEach(button =>
      button.classList.toggle('active', button.dataset.subject === subject.id));

    const crumbs = this.$('.ed-crumbs');
    crumbs.replaceChildren(el('span', '', subject.group), el('span', '', subject.label));
    if (subject.variant) crumbs.appendChild(el('strong', '', this.variantLabel()));

    const variants = this.variantOptions();
    this.$('.ed-variant-sec').classList.toggle('hidden', !subject.variant);
    if (subject.variant) {
      this.$('.ed-variant-title').innerHTML = `<b>2</b> ${subject.variantLabel}`;
      const select = this.$('.ed-variant');
      select.replaceChildren(...variants.map(item => {
        const option = el('option', '', item.label);
        option.value = item.id;
        return option;
      }));
      select.value = this.variantValue();
    }
    this.$('.ed-step').textContent = subject.variant ? '3' : '2';

    const canAdd = subject.id === 'custom' || isMap;
    this.$('.ed-add-row').classList.toggle('hidden', !canAdd);
    this.$('.ed-geometry').classList.toggle('hidden', subject.id !== 'custom');
    this.$('.ed-add').textContent = isMap ? '+ AJOUTER UNE COUVERTURE' : '+ AJOUTER UN BLOC';
    this.$('.ed-context').classList.toggle('hidden', isMap);
    this.$('.ed-map-settings').classList.toggle('hidden', !isMap);
    this.$('[data-tool="rotate"]').disabled = isMap;
    if (isMap && this.gizmo.getMode() === 'rotate') this.setTool('translate');
    this.$('.ed-inspector-title').textContent = isMap
      ? `INSPECTEUR · ${this.activeMap().name.toUpperCase()}`
      : `INSPECTEUR · ${subject.label.toUpperCase()}`;
    this.applySnap();
  }

  // ------------------------------------------------------------------ variantes

  variantOptions() {
    switch (this.subject.variant) {
      case 'hairStyle': return APPEARANCE_OPTIONS.hairStyle.map(({ id, label }) => ({ id, label }));
      case 'accessory': return APPEARANCE_OPTIONS.accessory.filter(item => item.id !== 'none').map(({ id, label }) => ({ id, label }));
      case 'weapon': return Object.entries(WEAPONS).map(([id, weapon]) => ({ id, label: weapon.label }));
      case 'map': return MAPS.map(map => ({ id: map.id, label: map.name }));
      default: return [];
    }
  }

  variantValue() {
    switch (this.subject.variant) {
      case 'hairStyle': return this.look.hairStyle;
      case 'accessory': return this.look.accessory;
      case 'weapon': return this.weaponType;
      case 'map': return this.mapId;
      default: return '';
    }
  }

  variantLabel() {
    return this.variantOptions().find(item => item.id === this.variantValue())?.label ?? '';
  }

  setVariant(value) {
    this.serializeActiveAsset();
    switch (this.subject.variant) {
      case 'hairStyle': this.look.hairStyle = value; break;
      case 'accessory': this.look.accessory = value; break;
      case 'weapon': this.weaponType = value; break;
      case 'map': this.mapId = value; break;
      default: return;
    }
    this.rebuildScene({ focus: ['weapon', 'map'].includes(this.subject.variant) });
  }

  stepVariant(direction) {
    const items = this.variantOptions();
    if (!items.length) return;
    const index = items.findIndex(item => item.id === this.variantValue());
    this.setVariant(items[(index + direction + items.length) % items.length].id);
  }

  // ------------------------------------------------------------------ ouverture / modes

  open() {
    this.opened = true;
    this.root.classList.add('open');
    this.resize();
    this.focusSubject();
    this.renderObjectList();
    if (!this.dirty) this.setStatus('Tout est enregistré');
  }

  close() {
    this.opened = false;
    this.root.classList.remove('open');
    this.canvas.style.cursor = '';
  }

  setSubject(id) {
    const next = SUBJECTS.find(subject => subject.id === id);
    if (!next || next === this.subject) return;
    this.serializeActiveAsset();
    this.subject = next;
    if (next.id === 'accessory' && this.look.accessory === 'none') {
      this.look.accessory = this.variantOptions()[0]?.id ?? 'none';
    }
    this.rebuildScene({ focus: true });
  }

  setTool(tool) {
    if (tool === 'rotate' && this.subject.kind === 'map') return;
    this.gizmo.setMode(tool);
    this.root.querySelectorAll('[data-tool]').forEach(button =>
      button.classList.toggle('active', button.dataset.tool === tool));
  }

  applySnap() {
    const map = this.subject.kind === 'map';
    this.gizmo.setTranslationSnap(this.snap ? (map ? 0.5 : 0.05) : null);
    this.gizmo.setRotationSnap(this.snap ? THREE.MathUtils.degToRad(15) : null);
    this.gizmo.setScaleSnap(this.snap ? 0.05 : null);
    this.gizmo.setSpace(map ? 'world' : 'local');
  }

  // ------------------------------------------------------------------ scène

  disposeCurrentAsset() {
    this.gizmo.detach();
    this.setHighlight('sel', null);
    this.setHighlight('hover', null);
    this.restoreGhost();
    if (this.ghostMaterial) {
      this.ghostMaterial.dispose();
      this.ghostMaterial = null;
    }
    if (this.currentWorld) {
      this.currentWorld.dispose();
      this.currentWorld = null;
    }
    if (this.character) {
      disposeCharacter(this.character);
      this.character = null;
    }
    if (this.floor) {
      this.scene.remove(this.floor);
      this.floor.geometry.dispose();
      this.floor.material.dispose();
      this.floor = null;
    }
  }

  /** Reconstruit la scène pour l'élément courant (aucune sérialisation : à faire avant l'appel). */
  rebuildScene({ focus = false } = {}) {
    this.disposeCurrentAsset();
    this.selected = null;
    this.objects = [];
    this.scene.background = new THREE.Color(0x151d22);
    this.scene.fog = null;
    if (this.subject.kind === 'map') this.buildMap();
    else this.buildCharacter();
    this.refreshObjects();
    this.updateChrome();
    this.updateInspector();
    if (focus) this.focusSubject();
  }

  buildCharacter() {
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x202a30, roughness: 0.9 })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.02;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Les accessoires masquent les cheveux : on les retire quand on édite une coupe.
    const appearance = { ...this.look, accessory: this.subject.id === 'hair' ? 'none' : this.look.accessory };
    this.character = createCharacter({ appearance });
    showGun(this.character, this.weaponType);
    if (this.subject.id === 'weapon') poseIdle(this.character, 0, 0); // arme tenue en position de jeu
    this.character.group.rotation.y = Math.PI;
    this.scene.add(this.character.group);
    this.character.group.traverse(object => {
      // Valeurs du code (avant réglages enregistrés) : « Réinitialiser » y revient vraiment.
      if (object.userData.editorId) object.userData.editorInit = object.userData.editorDefault || snapshot(object);
    });
    this.applyGhost();
  }

  buildMap() {
    const map = this.activeMap();
    this.currentWorld = new World(this.scene, map.id);
    const $ = this.$;
    $('[data-map-size="halfWidth"]').value = map.halfWidth;
    $('[data-map-size="halfDepth"]').value = map.halfDepth;
    $('[data-map-color="floor"]').value = map.colors.floor;
    for (const object of this.currentWorld.objects) {
      if (object.userData.editorType === 'cover') object.userData.editorInit = snapshot(object);
    }
  }

  activeMap() {
    return MAPS.find(map => map.id === this.mapId) || MAPS[0];
  }

  rebuildMap(selectedIndex = -1, serialize = true) {
    if (serialize) this.serializeMap();
    this.rebuildScene();
    if (selectedIndex >= 0) {
      this.selectObject(this.objects.find(object => object.userData.mapCoverIndex === selectedIndex));
    }
  }

  updateMapDimensions() {
    const map = this.activeMap();
    const widthInput = this.$('[data-map-size="halfWidth"]');
    const depthInput = this.$('[data-map-size="halfDepth"]');
    const width = Number(widthInput.value), depth = Number(depthInput.value);
    if (!Number.isFinite(width) || !Number.isFinite(depth) ||
        width < 12 || width > 50 || depth < 12 || depth > 50) {
      this.setStatus('Les dimensions doivent être comprises entre 12 et 50 m.', true);
      widthInput.value = map.halfWidth;
      depthInput.value = map.halfDepth;
      return;
    }
    map.halfWidth = width;
    map.halfDepth = depth;
    this.markDirty();
    this.rebuildMap(this.selected?.userData.mapCoverIndex ?? -1);
  }

  /** Cadre la caméra sur l'élément édité. */
  focusSubject() {
    const subject = this.subject;
    if (subject.kind === 'map') {
      const map = this.activeMap();
      this.camera.position.set(map.halfWidth * 0.85, map.halfWidth * 0.95, map.halfDepth * 1.1);
      this.orbit.target.set(0, 0, 0);
      this.orbit.minDistance = 4;
      this.orbit.maxDistance = 160;
      this.orbit.update();
      return;
    }
    if (!this.character) return;
    this.character.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    for (const object of this.objects) box.expandByObject(object);
    if (box.isEmpty()) box.setFromObject(this.character.group);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.3);
    const directions = {
      head: [0.45, 0.25, 1],
      weapon: [-1, 0.3, 0.55], // le personnage est tourné de 180° : sa droite est à -X
      body: [0.5, 0.3, 1]
    };
    const direction = new THREE.Vector3(...directions[subject.focus]).normalize();
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov) / 2) * 1.2;
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.orbit.target.copy(center);
    this.orbit.minDistance = Math.max(0.3, radius * 0.5);
    this.orbit.maxDistance = Math.max(12, distance * 5);
    this.orbit.update();
  }

  // ------------------------------------------------------------------ contexte (reste du personnage)

  inSubject(id) {
    const under = root => id === root || id.startsWith(`${root}/`);
    switch (this.subject.id) {
      case 'hair': return under(`head/head-model/hair:${this.look.hairStyle}`);
      case 'accessory': return under(`head/head-model/accessory:${this.look.accessory}`);
      case 'weapon': return under(`arm-right/gun-${this.weaponType}`);
      case 'head': return (id === 'head' || id.startsWith('head/')) && !/\/(hair|accessory):/.test(id);
      case 'body': return /^(torso|arm-left|arm-right|leg-left|leg-right)(\/|$)/.test(id) && !id.includes('/gun-');
      case 'custom': return id.startsWith('custom:');
      default: return false;
    }
  }

  /** Les pièces hors élément édité sont affichées en transparence (ou masquées). */
  applyGhost() {
    if (!this.character) return;
    if (!this.ghostMaterial) {
      this.ghostMaterial = new THREE.MeshStandardMaterial({
        color: 0x9fb4c0, roughness: 1, transparent: true, opacity: 0.16, depthWrite: false
      });
    }
    this.character.group.traverse(object => {
      if (!object.isMesh || this.inSubject(object.userData.editorId || '')) return;
      if (this.showContext) {
        object.userData.editorMat = object.material;
        object.material = this.ghostMaterial;
      } else {
        object.userData.ghostHidden = true;
        object.visible = false;
      }
    });
  }

  restoreGhost() {
    this.character?.group.traverse(object => {
      if (object.userData.editorMat) {
        object.material = object.userData.editorMat;
        delete object.userData.editorMat;
      }
      if (object.userData.ghostHidden) {
        object.visible = true;
        delete object.userData.ghostHidden;
      }
    });
  }

  materialOf(object) {
    return object.userData.editorMat || object.material;
  }

  // ------------------------------------------------------------------ liste des pièces

  isVisible(object) {
    for (let node = object; node; node = node.parent) if (!node.visible && !node.userData.ghostHidden) return false;
    return true;
  }

  refreshObjects() {
    if (this.subject.kind === 'map') {
      this.objects = this.currentWorld.objects.filter(object => object.userData.editorType === 'cover');
    } else {
      this.objects = [];
      this.character?.group.traverse(object => {
        if (object === this.character.group) return;
        const id = object.userData.editorId;
        if (id && this.inSubject(id) && this.isVisible(object) && (object.isGroup || object.isMesh)) {
          this.objects.push(object);
        }
      });
    }
    this.renderObjectList();
  }

  renderObjectList() {
    this.objectList.replaceChildren();
    this.$('.ed-count').textContent = this.objects.length ? `(${this.objects.length})` : '';
    if (!this.objects.length) {
      this.objectList.appendChild(el('p', 'ed-hint', this.subject.id === 'custom'
        ? 'Aucun bloc ajouté. Utilise « Ajouter un bloc » pour en créer un.'
        : 'Aucune pièce à éditer pour cette variante.'));
      return;
    }
    const baseDepth = this.subject.kind === 'map' ? 0 : this.objects[0].userData.editorId.split('/').length;
    this.objects.forEach((object, index) => {
      const button = el('button', 'ed-object' + (this.selected === object ? ' selected' : ''));
      button.type = 'button';
      button.dataset.index = index;
      const depth = this.subject.kind === 'map' ? 0
        : Math.max(0, Math.min(3, object.userData.editorId.split('/').length - baseDepth));
      button.style.paddingLeft = `${10 + depth * 12}px`;
      const isGroup = !object.isMesh && this.subject.kind !== 'map';
      button.textContent = (isGroup ? '▸ ' : '') + (this.subject.kind === 'map' ? object.name : prettyName(object));
      this.objectList.appendChild(button);
    });
    this.objectList.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  }

  // ------------------------------------------------------------------ sélection

  setHighlight(kind, object) {
    const key = kind === 'sel' ? 'selBox' : 'hoverBox';
    if (this[key]) {
      this.scene.remove(this[key]);
      this[key].geometry.dispose();
      this[key].material.dispose();
      this[key] = null;
    }
    if (!object || (kind === 'hover' && object === this.selected)) return;
    const box = new THREE.BoxHelper(object, kind === 'sel' ? 0xff9a64 : 0x8fd3ff);
    box.material.depthTest = false;
    box.renderOrder = 999;
    this.scene.add(box);
    this[key] = box;
  }

  selectObject(object) {
    this.selected = object || null;
    this.gizmo.detach();
    if (this.selected) this.gizmo.attach(this.selected);
    this.setHighlight('hover', null);
    this.setHighlight('sel', this.selected);
    this.renderObjectList();
    this.updateInspector();
  }

  pickTargets() {
    return this.subject.kind === 'map' ? this.objects : this.objects.filter(object => object.isMesh);
  }

  raycast(event) {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = raycaster.intersectObjects(this.pickTargets(), true)[0]?.object;
    for (let node = hit; node; node = node.parent) if (this.objects.includes(node)) return node;
    return null;
  }

  pickObject(event) {
    if (this.gizmo.dragging) return;
    const object = this.raycast(event);
    if (object) this.selectObject(object);
  }

  hoverPick(event) {
    if (!this.opened || this.gizmo.dragging || event.buttons) return;
    const object = this.raycast(event);
    this.canvas.style.cursor = object ? 'pointer' : '';
    this.setHighlight('hover', object);
  }

  trackPointerMovement(event) {
    if (!this.pointerStart || event.pointerId !== this.pointerStart.pointerId) return;
    const dx = event.clientX - this.pointerStart.x, dy = event.clientY - this.pointerStart.y;
    if (dx * dx + dy * dy > 25) this.pointerStart.moved = true;
  }

  finishPointerSelection(event) {
    const start = this.pointerStart;
    if (!start || event.pointerId !== start.pointerId) return;
    this.pointerStart = null;
    if (start.moved || start.gizmoDragging || this.gizmo.dragging) return;
    this.pickObject({ clientX: start.x, clientY: start.y });
  }

  cancelPointerSelection(event) {
    if (this.pointerStart && event.pointerId === this.pointerStart.pointerId) this.pointerStart = null;
  }

  // ------------------------------------------------------------------ inspecteur

  updateInspector() {
    const isMap = this.subject.kind === 'map';
    const selected = this.selected;
    this.$('.ed-empty-selection').classList.toggle('hidden', !!selected);
    this.$('.ed-selection').classList.toggle('hidden', !selected);
    this.transformFields.replaceChildren();
    if (!selected) return;

    this.$('.ed-selected-name').textContent = isMap ? selected.name : prettyName(selected);
    const rows = isMap
      ? [['POSITION', [['x', 'X'], ['y', 'Y'], ['z', 'Z']]], ['TAILLE (M)', [['width', 'L'], ['height', 'H'], ['depth', 'P']]]]
      : [['POSITION', [['px', 'X'], ['py', 'Y'], ['pz', 'Z']]], ['ROTATION (°)', [['rx', 'X'], ['ry', 'Y'], ['rz', 'Z']]], ['ÉCHELLE', [['sx', 'X'], ['sy', 'Y'], ['sz', 'Z']]]];
    for (const [title, keys] of rows) {
      const row = el('div', 'ed-row');
      row.appendChild(el('div', 'ed-row-title', title));
      const inputs = el('div', 'ed-row-inputs');
      for (const [key, label] of keys) {
        const wrap = el('label');
        wrap.appendChild(el('span', '', label));
        const input = el('input');
        input.type = 'number';
        input.step = '0.05';
        input.dataset.transform = key;
        wrap.appendChild(input);
        inputs.appendChild(wrap);
      }
      row.appendChild(inputs);
      this.transformFields.appendChild(row);
    }
    this.fillInspectorFields();

    const canRemove = isMap || selected.userData.editorCustomId;
    this.$('.ed-delete').classList.toggle('hidden', !canRemove);
    this.$('.ed-duplicate').classList.toggle('hidden', !canRemove);
    this.$('.ed-cover-material').classList.toggle('hidden', !isMap);

    const colorLabel = this.$('.ed-part-color'), note = this.$('.ed-color-note');
    if (isMap) {
      this.$('.ed-material').value = this.activeMap().covers[selected.userData.mapCoverIndex][6];
      colorLabel.classList.add('hidden');
      note.classList.add('hidden');
    } else {
      const material = this.materialOf(selected);
      const editable = selected.isMesh && material?.color && !material.userData.appearanceCategory;
      colorLabel.classList.toggle('hidden', !selected.isMesh);
      this.$('.ed-color').value = `#${material?.color?.getHexString() || 'ffffff'}`;
      this.$('.ed-color').disabled = !editable;
      note.classList.toggle('hidden', !(selected.isMesh && !editable));
      note.textContent = 'Cette couleur vient de la personnalisation du joueur (peau, haut, cheveux…).';
    }
  }

  fillInspectorFields() {
    const object = this.selected;
    if (!object) return;
    const values = {};
    if (this.subject.kind === 'map') {
      const cover = this.activeMap().covers[object.userData.mapCoverIndex];
      Object.assign(values, {
        x: object.position.x, y: object.position.y, z: object.position.z,
        width: cover[3] * object.scale.x, height: cover[4] * object.scale.y, depth: cover[5] * object.scale.z
      });
    } else {
      Object.assign(values, {
        px: object.position.x, py: object.position.y, pz: object.position.z,
        rx: THREE.MathUtils.radToDeg(object.rotation.x),
        ry: THREE.MathUtils.radToDeg(object.rotation.y),
        rz: THREE.MathUtils.radToDeg(object.rotation.z),
        sx: object.scale.x, sy: object.scale.y, sz: object.scale.z
      });
    }
    for (const input of this.transformFields.querySelectorAll('[data-transform]')) {
      if (document.activeElement === input) continue; // ne pas écraser la saisie en cours
      input.value = Number(values[input.dataset.transform].toFixed(3));
    }
  }

  applyInspectorFields() {
    const object = this.selected;
    if (!object) return;
    const value = key => Number(this.transformFields.querySelector(`[data-transform="${key}"]`).value) || 0;
    if (this.subject.kind === 'map') {
      const cover = this.activeMap().covers[object.userData.mapCoverIndex];
      object.position.set(value('x'), value('y'), value('z'));
      object.scale.set(
        Math.max(0.2, value('width')) / cover[3],
        Math.max(0.2, value('height')) / cover[4],
        Math.max(0.2, value('depth')) / cover[5]
      );
    } else {
      object.position.set(value('px'), value('py'), value('pz'));
      object.rotation.set(
        THREE.MathUtils.degToRad(value('rx')),
        THREE.MathUtils.degToRad(value('ry')),
        THREE.MathUtils.degToRad(value('rz'))
      );
      const scale = key => Math.sign(value(key) || 1) * Math.max(0.01, Math.abs(value(key)));
      object.scale.set(scale('sx'), scale('sy'), scale('sz'));
    }
    this.markDirty();
  }

  resetSelected() {
    const object = this.selected, init = object?.userData.editorInit;
    if (!object || !init) return;
    object.position.copy(init.p);
    object.rotation.copy(init.r);
    object.scale.copy(init.s);
    if (init.c != null && object.isMesh && !object.userData.editorMat) object.material.color.setHex(init.c);
    this.fillInspectorFields();
    this.updateInspector();
    this.markDirty();
  }

  setCoverMaterial(material) {
    if (!this.selected || this.subject.kind !== 'map') return;
    this.selected.material = this.currentWorld.materials[material];
    this.selected.userData.editorMaterial = material;
    this.markDirty();
  }

  setCharacterColor(color) {
    const object = this.selected;
    if (!object?.isMesh || !object.material?.color || object.material.userData.appearanceCategory) return;
    object.material.color.set(color);
    this.markDirty();
  }

  // ------------------------------------------------------------------ ajout / copie / suppression

  addBlock() {
    if (this.subject.kind === 'map') {
      this.serializeMap();
      const index = this.activeMap().covers.push([0, 1, 0, 2, 2, 2, 'orange']) - 1;
      this.markDirty();
      this.rebuildMap(index, false);
      return;
    }
    if (this.subject.id !== 'custom') return;
    this.addCustomPart({
      geometry: this.$('.ed-geometry').value || 'box', color: '#f07845',
      position: [0, 1.7, 0], rotation: [0, 0, 0], scale: [0.25, 0.25, 0.25]
    });
  }

  addCustomPart(base) {
    const id = `custom-${Date.now()}-${this.addPartIndex++}`;
    const part = { id, name: `Bloc ${this.addPartIndex}`, ...base };
    const mesh = this.createCharacterPart(part);
    this.character.group.add(mesh);
    this.refreshObjects();
    this.selectObject(mesh);
    this.markDirty();
  }

  createCharacterPart(part) {
    const mesh = new THREE.Mesh(
      GEOMETRIES[part.geometry](),
      new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.8 })
    );
    mesh.name = part.name;
    mesh.userData.editorId = `custom:${part.id}`;
    mesh.userData.editorCustomId = part.id;
    mesh.userData.editorGeometry = part.geometry;
    mesh.userData.editorName = part.name;
    mesh.position.fromArray(part.position);
    mesh.rotation.fromArray([...part.rotation, 'XYZ']);
    mesh.scale.fromArray(part.scale);
    mesh.castShadow = true;
    mesh.userData.editorInit = snapshot(mesh);
    return mesh;
  }

  duplicateBlock() {
    const object = this.selected;
    if (!object) return;
    if (this.subject.kind === 'map') {
      this.serializeMap();
      const copy = this.activeMap().covers[object.userData.mapCoverIndex].slice();
      copy[0] += 1.5;
      copy[2] += 1.5;
      const index = this.activeMap().covers.push(copy) - 1;
      this.markDirty();
      this.rebuildMap(index, false);
    } else if (object.userData.editorCustomId) {
      this.addCustomPart({
        geometry: object.userData.editorGeometry,
        color: `#${object.material.color.getHexString()}`,
        position: [object.position.x + 0.1, object.position.y, object.position.z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray()
      });
    }
  }

  deleteBlock() {
    const object = this.selected;
    if (!object) return;
    if (this.subject.kind === 'map') {
      this.serializeMap();
      this.activeMap().covers.splice(object.userData.mapCoverIndex, 1);
      this.markDirty();
      this.rebuildMap(-1, false);
      return;
    }
    if (!object.userData.editorCustomId) return;
    this.gizmo.detach();
    this.setHighlight('sel', null);
    this.character.group.remove(object);
    object.geometry.dispose();
    object.material.dispose();
    this.selected = null;
    this.refreshObjects();
    this.updateInspector();
    this.markDirty();
  }

  // ------------------------------------------------------------------ sérialisation

  serializeActiveAsset() {
    if (this.subject.kind === 'map' && this.currentWorld) this.serializeMap();
    else if (this.subject.kind === 'character' && this.character) this.serializeCharacter();
  }

  serializeMap() {
    const map = this.activeMap();
    for (const object of this.objects) {
      const index = object.userData.mapCoverIndex;
      const cover = map.covers[index];
      if (!cover) continue;
      map.covers[index] = [
        object.position.x, object.position.y, object.position.z,
        object.geometry.parameters.width * object.scale.x,
        object.geometry.parameters.height * object.scale.y,
        object.geometry.parameters.depth * object.scale.z,
        object.userData.editorMaterial || cover[6]
      ];
    }
  }

  /**
   * N'écrit que ce qui appartient à l'élément édité : les réglages des autres coupes, accessoires
   * et armes (non chargés en ce moment) sont conservés tels quels.
   */
  serializeCharacter() {
    if (this.subject.id === 'custom') {
      const additions = [];
      this.character.group.traverse(object => {
        if (!object.userData.editorCustomId) return;
        additions.push({
          id: object.userData.editorCustomId,
          name: object.userData.editorName || object.name,
          geometry: object.userData.editorGeometry,
          color: `#${object.material.color.getHexString()}`,
          position: object.position.toArray(),
          rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
          scale: object.scale.toArray()
        });
      });
      editorAssets.character.additions = additions;
      return;
    }
    // On n'enregistre que les pièces réellement modifiées par rapport au code : le fichier reste
    // petit et les futures retouches du code (coupes, armes…) ne sont pas écrasées.
    // Les réglages de pièces absentes de la scène (ex. oreilles cachées par une coupe) sont gardés.
    const transforms = { ...(editorAssets.character.transforms || {}) };
    const same = (a, b) => a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) < 1e-4);
    this.character.group.traverse(object => {
      const id = object.userData.editorId;
      if (!id || object.userData.editorCustomId || !this.inSubject(id)) return;
      delete transforms[id];
      const base = object.userData.editorDefault;
      const entry = {};
      const position = object.position.toArray();
      const rotation = [object.rotation.x, object.rotation.y, object.rotation.z];
      const scale = object.scale.toArray();
      const material = this.materialOf(object);
      const color = object.isMesh && material?.color && !material.userData.appearanceCategory
        ? material.color.getHex() : null;
      const moved = !base || !same(position, base.p.toArray()) ||
        !same(rotation, [base.r.x, base.r.y, base.r.z]) || !same(scale, base.s.toArray());
      if (moved) Object.assign(entry, { position, rotation, scale });
      if (color != null && (!base || color !== base.c)) entry.color = `#${color.toString(16).padStart(6, '0')}`;
      if (Object.keys(entry).length) transforms[id] = entry;
    });
    editorAssets.character.transforms = transforms;
  }

  async save() {
    this.serializeActiveAsset();
    this.setStatus('Enregistrement…');
    const button = this.$('.ed-save');
    button.disabled = true;
    try {
      await saveEditorAssets();
      this.dirty = false;
      this.setStatus('✓ Enregistré dans src/game/editor-assets.json');
    } catch (error) {
      this.setStatus(error.message, true);
      console.error(error);
    } finally {
      button.disabled = false;
    }
  }

  // ------------------------------------------------------------------ rendu

  resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.opened) return;
    this.orbit.update();
    this.selBox?.update();
    this.hoverBox?.update();
    this.renderer.render(this.scene, this.camera);
  }
}
