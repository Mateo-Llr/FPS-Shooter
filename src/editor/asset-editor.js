import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createCharacter, disposeCharacter, showGun } from '../game/character.js';
import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE } from '../game/customization.js';
import { editorAssets } from '../game/editor-assets.js';
import { MAPS, World } from '../game/world.js';
import { saveEditorAssets } from './editor-bridge.js';
import './editor.css';

const GEOMETRIES = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 16, 12),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: () => new THREE.ConeGeometry(0.5, 1, 12)
};
export class AssetEditor {
  constructor() {
    this.mode = 'character';
    this.mapId = MAPS[0].id;
    this.selected = null;
    this.currentWorld = null;
    this.character = null;
    this.objects = [];
    this.opened = false;
    this.addPartIndex = 0;
    this.pointerStart = null;
    this.previewAppearance = { ...DEFAULT_APPEARANCE };

    this.launchButton = document.createElement('button');
    this.launchButton.id = 'asset-editor-launch';
    this.launchButton.type = 'button';
    this.launchButton.textContent = 'OUVRIR L’ÉDITEUR 3D';
    document.body.appendChild(this.launchButton);

    this.root = document.createElement('section');
    this.root.id = 'asset-editor';
    this.root.setAttribute('aria-label', 'Éditeur 3D');
    this.root.innerHTML = `
      <header class="editor-topbar">
        <strong class="editor-brand">CLASH//ROOM · ÉDITEUR</strong>
        <span class="editor-status" aria-live="polite">Modifications en mémoire</span>
        <button type="button" class="editor-save primary">ENREGISTRER DANS LE PROJET</button>
        <button type="button" class="editor-close quiet">FERMER</button>
      </header>
      <div class="editor-workspace"><canvas aria-label="Vue 3D éditable"></canvas></div>
      <aside class="editor-panel left">
        <h2>ESPACE DE TRAVAIL</h2>
        <div class="editor-tabs">
          <button type="button" data-mode="character" class="active">PERSONNAGE</button>
          <button type="button" data-mode="map">CARTE</button>
        </div>
        <label class="editor-map-picker hidden">CARTE À ÉDITER
          <select class="editor-map-select"></select>
        </label>
        <label class="editor-look-picker">COUPE
          <select data-appearance="hairStyle"></select>
        </label>
        <label class="editor-look-picker">ACCESSOIRE
          <select data-appearance="accessory"></select>
        </label>
        <label class="editor-look-picker">STYLE DU HAUT
          <select data-appearance="shirtStyle"></select>
        </label>
        <div class="editor-tools">
          <button type="button" data-tool="translate" class="active">DÉPLACER</button>
          <button type="button" data-tool="rotate">TOURNER</button>
          <button type="button" data-tool="scale">ÉCHELLE</button>
        </div>
        <div class="editor-object-list"></div>
        <button type="button" class="editor-add">+ AJOUTER UN BLOC</button>
        <button type="button" class="editor-delete quiet">SUPPRIMER LE BLOC</button>
        <p class="editor-hint">Souris gauche : orbiter · molette : zoom · clic droit : déplacer la vue. Sélectionne une pièce puis utilise le gizmo ou les valeurs.</p>
      </aside>
      <aside class="editor-panel right">
        <h2 class="editor-inspector-title">INSPECTEUR</h2>
        <label class="editor-map-width">DEMI-LARGEUR (M)
          <input type="number" min="12" max="50" step="1" data-map-size="halfWidth">
        </label>
        <label class="editor-map-depth">DEMI-PROFONDEUR (M)
          <input type="number" min="12" max="50" step="1" data-map-size="halfDepth">
        </label>
        <label class="editor-floor-color">COULEUR DU SOL
          <input type="color" data-map-color="floor">
        </label>
        <div class="editor-transform-fields"></div>
        <label class="editor-part-color hidden">COULEUR DE LA PIÈCE
          <input type="color" class="editor-color">
        </label>
        <label class="editor-cover-material hidden">MATÉRIAU DU BLOC
          <select class="editor-material">
            <option value="orange">Conteneur orange</option>
            <option value="blue">Conteneur bleu</option>
            <option value="wall">Mur</option>
            <option value="dark">Structure sombre</option>
          </select>
        </label>
        <p class="editor-hint editor-selection-hint">Choisis un objet dans la liste ou clique dessus dans la vue 3D.</p>
      </aside>`;
    document.body.appendChild(this.root);

    this.canvas = this.root.querySelector('canvas');
    this.status = this.root.querySelector('.editor-status');
    this.objectList = this.root.querySelector('.editor-object-list');
    this.transformFields = this.root.querySelector('.editor-transform-fields');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151d22);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 250);
    this.camera.position.set(6, 5, 8);
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.target.set(0, 1, 0);
    this.gizmo = new TransformControls(this.camera, this.canvas);
    this.gizmo.addEventListener('dragging-changed', event => {
      this.orbit.enabled = !event.value;
      if (event.value && this.pointerStart) this.pointerStart.gizmoDragging = true;
    });
    this.gizmo.addEventListener('objectChange', () => this.fillInspectorFields());
    this.scene.add(this.gizmo.getHelper());
    this.scene.add(new THREE.HemisphereLight(0xdbe8f5, 0x303743, 1.5));
    const key = new THREE.DirectionalLight(0xffe2bd, 2.8);
    key.position.set(-12, 24, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    this.bind();
    this.populateMapPicker();
    this.populateAppearancePickers();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root.querySelector('.editor-workspace'));
    this.launchButton.onclick = () => this.open();
    this.root.querySelector('.editor-close').onclick = () => this.close();
    this.root.querySelector('.editor-save').onclick = () => this.save();
    this.setMode('character');
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(this.frame);
      this.resizeObserver.disconnect();
      this.disposeCurrentAsset();
      this.renderer.dispose();
    }, { once: true });
  }

  bind() {
    this.root.querySelectorAll('[data-mode]').forEach(button => {
      button.onclick = () => this.setMode(button.dataset.mode);
    });
    this.root.querySelectorAll('[data-tool]').forEach(button => {
      button.onclick = () => this.setTool(button.dataset.tool);
    });
    this.root.querySelector('.editor-map-select').onchange = event => {
      this.serializeActiveAsset();
      this.mapId = event.target.value;
      this.showMap();
    };
    this.root.querySelector('.editor-add').onclick = () => this.addBlock();
    this.root.querySelector('.editor-delete').onclick = () => this.deleteBlock();
    this.root.querySelector('.editor-material').onchange = event => this.setCoverMaterial(event.target.value);
    this.root.querySelector('.editor-color').oninput = event => this.setCharacterColor(event.target.value);
    this.root.querySelectorAll('[data-map-size]').forEach(input => {
      input.onchange = () => this.updateMapDimensions();
    });
    this.root.querySelector('[data-map-color="floor"]').onchange = event => {
      const map = this.activeMap();
      map.colors.floor = event.target.value;
      this.rebuildMap();
    };
    this.objectList.onclick = event => {
      const button = event.target.closest('[data-editor-object]');
      if (button) this.selectObject(this.objects.find(object => object.userData.editorId === button.dataset.editorObject));
    };
    this.canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      this.pointerStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        gizmoDragging: this.gizmo.dragging
      };
    });
    window.addEventListener('pointermove', event => this.trackPointerMovement(event));
    window.addEventListener('pointerup', event => this.finishPointerSelection(event));
    window.addEventListener('pointercancel', event => this.cancelPointerSelection(event));
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.opened) this.close();
    });
  }

  populateMapPicker() {
    const select = this.root.querySelector('.editor-map-select');
    select.replaceChildren(...MAPS.map(map => {
      const option = document.createElement('option');
      option.value = map.id;
      option.textContent = map.name;
      return option;
    }));
    select.value = this.mapId;
  }

  populateAppearancePickers() {
    for (const select of this.root.querySelectorAll('[data-appearance]')) {
      const category = select.dataset.appearance;
      select.replaceChildren(...APPEARANCE_OPTIONS[category].map(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        return option;
      }));
      select.value = this.previewAppearance[category];
      select.onchange = () => {
        this.serializeActiveAsset();
        this.previewAppearance[category] = select.value;
        this.showCharacter();
      };
    }
  }

  open() {
    this.opened = true;
    this.root.classList.add('open');
    this.resize();
    this.orbit.update();
    this.renderObjectList();
  }

  close() {
    this.opened = false;
    this.root.classList.remove('open');
    this.canvas.style.cursor = '';
  }

  setMode(mode) {
    this.serializeActiveAsset();
    this.mode = mode;
    this.root.querySelectorAll('[data-mode]').forEach(button =>
      button.classList.toggle('active', button.dataset.mode === mode)
    );
    this.root.querySelector('.editor-map-picker').classList.toggle('hidden', mode !== 'map');
    this.root.querySelectorAll('.editor-look-picker').forEach(element =>
      element.classList.toggle('hidden', mode !== 'character')
    );
    this.root.querySelector('.editor-add').textContent =
      mode === 'map' ? '+ AJOUTER UNE COUVERTURE' : '+ AJOUTER UNE PIÈCE';
    this.root.querySelector('.editor-delete').textContent =
      mode === 'map' ? 'SUPPRIMER LA COUVERTURE' : 'SUPPRIMER LA PIÈCE AJOUTÉE';
    if (mode === 'map' && this.gizmo.getMode() === 'rotate') this.setTool('translate');
    this.showEmptyScene();
    if (mode === 'map') this.showMap();
    else this.showCharacter();
  }

  setTool(tool) {
    if (tool === 'rotate' && this.mode === 'map') return;
    this.gizmo.setMode(tool);
    this.root.querySelectorAll('[data-tool]').forEach(button =>
      button.classList.toggle('active', button.dataset.tool === tool)
    );
  }

  disposeCurrentAsset() {
    this.gizmo.detach();
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

  showEmptyScene() {
    this.disposeCurrentAsset();
    this.selected = null;
    this.objects = [];
    this.scene.background = new THREE.Color(0x151d22);
    this.scene.fog = null;
  }

  showCharacter() {
    this.showEmptyScene();
    this.mode = 'character';
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x202a30, roughness: 0.9 })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.02;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.character = createCharacter({ appearance: this.previewAppearance });
    showGun(this.character, 'rifle');
    this.character.group.rotation.y = Math.PI;
    this.scene.add(this.character.group);
    this.camera.position.set(3.5, 3.2, 6);
    this.orbit.target.set(0, 1.05, 0);
    this.orbit.minDistance = 2.5;
    this.orbit.maxDistance = 12;
    this.orbit.update();
    this.refreshObjects();
    this.updateInspector();
  }

  showMap() {
    this.showEmptyScene();
    this.mode = 'map';
    const map = this.activeMap();
    this.currentWorld = new World(this.scene, map.id);
    this.camera.position.set(map.halfWidth * 0.85, map.halfWidth * 0.95, map.halfDepth * 1.1);
    this.orbit.target.set(0, 0, 0);
    this.orbit.minDistance = 8;
    this.orbit.maxDistance = 150;
    this.orbit.update();
    this.root.querySelector('[data-map-size="halfWidth"]').value = map.halfWidth;
    this.root.querySelector('[data-map-size="halfDepth"]').value = map.halfDepth;
    this.root.querySelector('[data-map-color="floor"]').value = map.colors.floor;
    this.refreshObjects();
    this.updateInspector();
  }

  activeMap() {
    return MAPS.find(map => map.id === this.mapId) || MAPS[0];
  }

  rebuildMap(selectedIndex = -1) {
    this.showEmptyScene();
    this.showMap();
    if (selectedIndex >= 0) {
      this.selectObject(this.objects.find(object => object.userData.mapCoverIndex === selectedIndex));
    }
  }

  updateMapDimensions() {
    const map = this.activeMap();
    const width = Number(this.root.querySelector('[data-map-size="halfWidth"]').value);
    const depth = Number(this.root.querySelector('[data-map-size="halfDepth"]').value);
    if (!Number.isFinite(width) || !Number.isFinite(depth) ||
        width < 12 || width > 50 || depth < 12 || depth > 50) {
      this.status.classList.add('editor-error');
      this.status.textContent = 'Les dimensions doivent être comprises entre 12 et 50 m.';
      this.root.querySelector('[data-map-size="halfWidth"]').value = map.halfWidth;
      this.root.querySelector('[data-map-size="halfDepth"]').value = map.halfDepth;
      return;
    }
    this.status.classList.remove('editor-error');
    this.status.textContent = 'Modifications en mémoire';
    map.halfWidth = width;
    map.halfDepth = depth;
    this.rebuildMap();
  }

  refreshObjects() {
    if (this.mode === 'map') {
      this.objects = this.currentWorld.objects.filter(object => object.userData.editorType === 'cover');
    } else {
      this.objects = [];
      this.character?.group.traverse(object => {
        if (object !== this.character.group && object.userData.editorId &&
            this.isVisible(object) && (object.isGroup || object.isMesh)) this.objects.push(object);
      });
    }
    this.renderObjectList();
  }

  isVisible(object) {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  }

  renderObjectList() {
    this.objectList.replaceChildren();
    for (const object of this.objects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'editor-object' +
        (this.selected === object ? ' selected' : '');
      button.dataset.editorObject = object.userData.editorId;
      button.textContent = this.mode === 'map'
        ? object.name
        : object.userData.editorId.replaceAll('/', '  ›  ');
      this.objectList.appendChild(button);
    }
  }

  selectObject(object) {
    this.selected = object || null;
    this.gizmo.detach();
    if (this.selected) this.gizmo.attach(this.selected);
    this.renderObjectList();
    this.updateInspector();
  }

  pickObject(event) {
    if (this.gizmo.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const targets = this.mode === 'map'
      ? this.objects
      : this.objects.filter(object => object.isMesh);
    const hit = raycaster.intersectObjects(targets, true)[0]?.object;
    if (!hit) return;
    let selected = hit;
    while (selected && !selected.userData.editorId) selected = selected.parent;
    if (selected) this.selectObject(selected);
  }

  trackPointerMovement(event) {
    if (!this.pointerStart || event.pointerId !== this.pointerStart.pointerId) return;
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
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
    if (this.pointerStart && event.pointerId === this.pointerStart.pointerId) {
      this.pointerStart = null;
    }
  }

  updateInspector() {
    const map = this.activeMap();
    const isMap = this.mode === 'map';
    this.root.querySelectorAll('[data-map-size], [data-map-color]').forEach(element =>
      element.closest('label').classList.toggle('hidden', !isMap)
    );
    this.root.querySelector('.editor-part-color').classList.toggle('hidden', isMap || !this.selected);
    this.root.querySelector('.editor-cover-material').classList.toggle('hidden', !isMap || !this.selected);
    this.root.querySelector('[data-tool="rotate"]').disabled = isMap;
    this.root.querySelector('.editor-transform-fields').replaceChildren();
    this.root.querySelector('.editor-selection-hint').textContent = this.selected
      ? this.selected.userData.editorId.replaceAll('/', ' › ')
      : 'Choisis un objet dans la liste ou clique dessus dans la vue 3D.';
    this.root.querySelector('.editor-delete').disabled = !this.selected ||
      (this.mode === 'character' && !this.selected.userData.editorCustomId);
    this.root.querySelector('.editor-inspector-title').textContent =
      isMap ? `INSPECTEUR · ${map.name.toUpperCase()}` : 'INSPECTEUR · PERSONNAGE';

    if (!this.selected) return;
    const fields = this.root.querySelector('.editor-transform-fields');
    const labels = isMap
      ? [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['width', 'L'], ['height', 'H'], ['depth', 'P']]
      : [['px', 'X'], ['py', 'Y'], ['pz', 'Z'], ['rx', 'RX°'], ['ry', 'RY°'], ['rz', 'RZ°'], ['sx', 'SX'], ['sy', 'SY'], ['sz', 'SZ']];
    for (const [key, label] of labels) {
      const control = document.createElement('label');
      control.textContent = label;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.05';
      input.dataset.transform = key;
      control.appendChild(input);
      fields.appendChild(control);
    }
    fields.oninput = () => this.applyInspectorFields();
    this.fillInspectorFields();
    if (isMap) {
      const material = this.root.querySelector('.editor-material');
      material.value = map.covers[this.selected.userData.mapCoverIndex][6];
    } else {
      const color = this.root.querySelector('.editor-color');
      color.value = `#${this.selected.material?.color?.getHexString() || 'ffffff'}`;
      color.disabled = !this.selected.isMesh || !this.selected.material?.color ||
        Boolean(this.selected.material.userData.appearanceCategory);
    }
  }

  fillInspectorFields() {
    if (!this.selected) return;
    const values = {};
    if (this.mode === 'map') {
      const map = this.activeMap();
      const index = this.selected.userData.mapCoverIndex;
      const cover = map.covers[index];
      Object.assign(values, {
        x: this.selected.position.x,
        y: this.selected.position.y,
        z: this.selected.position.z,
        width: cover[3] * this.selected.scale.x,
        height: cover[4] * this.selected.scale.y,
        depth: cover[5] * this.selected.scale.z
      });
    } else {
      Object.assign(values, {
        px: this.selected.position.x, py: this.selected.position.y, pz: this.selected.position.z,
        rx: THREE.MathUtils.radToDeg(this.selected.rotation.x),
        ry: THREE.MathUtils.radToDeg(this.selected.rotation.y),
        rz: THREE.MathUtils.radToDeg(this.selected.rotation.z),
        sx: this.selected.scale.x, sy: this.selected.scale.y, sz: this.selected.scale.z
      });
    }
    for (const input of this.transformFields.querySelectorAll('[data-transform]')) {
      input.value = Number(values[input.dataset.transform].toFixed(3));
    }
  }

  applyInspectorFields() {
    if (!this.selected) return;
    const value = key => Number(this.transformFields.querySelector(`[data-transform="${key}"]`).value) || 0;
    if (this.mode === 'map') {
      const cover = this.activeMap().covers[this.selected.userData.mapCoverIndex];
      this.selected.position.set(value('x'), value('y'), value('z'));
      this.selected.scale.set(
        Math.max(0.2, value('width')) / cover[3],
        Math.max(0.2, value('height')) / cover[4],
        Math.max(0.2, value('depth')) / cover[5]
      );
    } else {
      this.selected.position.set(value('px'), value('py'), value('pz'));
      this.selected.rotation.set(
        THREE.MathUtils.degToRad(value('rx')),
        THREE.MathUtils.degToRad(value('ry')),
        THREE.MathUtils.degToRad(value('rz'))
      );
      this.selected.scale.set(
        Math.sign(value('sx') || 1) * Math.max(0.01, Math.abs(value('sx'))),
        Math.sign(value('sy') || 1) * Math.max(0.01, Math.abs(value('sy'))),
        Math.sign(value('sz') || 1) * Math.max(0.01, Math.abs(value('sz')))
      );
    }
  }

  setCoverMaterial(material) {
    if (!this.selected || this.mode !== 'map') return;
    this.selected.material = this.currentWorld.materials[material];
    this.selected.userData.editorMaterial = material;
  }

  setCharacterColor(color) {
    if (!this.selected?.isMesh || !this.selected.material?.color ||
        this.selected.material.userData.appearanceCategory) return;
    this.selected.material.color.set(color);
  }

  addBlock() {
    if (this.mode === 'map') {
      const map = this.activeMap();
      const index = map.covers.push([0, 1, 0, 2, 2, 2, 'orange']) - 1;
      this.rebuildMap(index);
      return;
    }
    const id = `custom-${Date.now()}-${this.addPartIndex++}`;
    const part = {
      id, name: `Nouvelle pièce ${this.addPartIndex}`, geometry: 'box', color: '#f07845',
      position: [0, 1.7, 0], rotation: [0, 0, 0], scale: [0.25, 0.25, 0.25]
    };
    const mesh = this.createCharacterPart(part);
    this.character.group.add(mesh);
    this.refreshObjects();
    this.selectObject(mesh);
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
    return mesh;
  }

  deleteBlock() {
    if (!this.selected) return;
    if (this.mode === 'map') {
      const index = this.selected.userData.mapCoverIndex;
      this.activeMap().covers.splice(index, 1);
      this.rebuildMap();
      return;
    }
    if (!this.selected.userData.editorCustomId) return;
    this.gizmo.detach();
    this.character.group.remove(this.selected);
    this.selected.geometry.dispose();
    this.selected.material.dispose();
    this.selected = null;
    this.refreshObjects();
    this.updateInspector();
  }

  serializeActiveAsset() {
    if (this.mode === 'map' && this.currentWorld) this.serializeMap();
    if (this.mode === 'character' && this.character) this.serializeCharacter();
  }

  serializeMap() {
    const map = this.activeMap();
    for (const object of this.objects) {
      const index = object.userData.mapCoverIndex;
      const cover = map.covers[index];
      if (!cover) continue;
      const material = object.userData.editorMaterial || cover[6];
      map.covers[index] = [
        object.position.x, object.position.y, object.position.z,
        object.geometry.parameters.width * object.scale.x,
        object.geometry.parameters.height * object.scale.y,
        object.geometry.parameters.depth * object.scale.z,
        material
      ];
    }
  }

  serializeCharacter() {
    const transforms = {};
    const additions = [];
    this.character.group.traverse(object => {
      if (object.userData.editorCustomId) {
        additions.push({
          id: object.userData.editorCustomId,
          name: object.userData.editorName || object.name,
          geometry: object.userData.editorGeometry,
          color: `#${object.material.color.getHexString()}`,
          position: object.position.toArray(),
          rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
          scale: object.scale.toArray()
        });
        return;
      }
      const id = object.userData.editorId;
      if (!id) return;
      const entry = {
        position: object.position.toArray(),
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray()
      };
      if (object.isMesh && object.material?.color && !object.material.userData.appearanceCategory) {
        entry.color = `#${object.material.color.getHexString()}`;
      }
      transforms[id] = entry;
    });
    editorAssets.character.transforms = transforms;
    editorAssets.character.additions = additions;
  }

  async save() {
    this.serializeActiveAsset();
    this.status.classList.remove('editor-error');
    this.status.textContent = 'Enregistrement des ressources…';
    this.root.querySelector('.editor-save').disabled = true;
    try {
      await saveEditorAssets();
      this.status.textContent = 'Enregistré dans src/game/editor-assets.json';
    } catch (error) {
      this.status.classList.add('editor-error');
      this.status.textContent = error.message;
      console.error(error);
    } finally {
      this.root.querySelector('.editor-save').disabled = false;
    }
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.opened) return;
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  }
}
