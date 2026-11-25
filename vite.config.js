import { defineConfig } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const editorEndpoint = '/__clashroom_editor/assets';
const editorAssetsPath = path.resolve('src/game/editor-assets.json');
const mapIds = new Set(['foundry', 'dockyard', 'ruins']);
const materials = new Set(['wall', 'dark', 'orange', 'blue']);
const geometries = new Set(['box', 'sphere', 'cylinder', 'cone']);
const hexColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const vector = value => Array.isArray(value) && value.length === 3 &&
  value.every(component => Number.isFinite(component) && Math.abs(component) <= 100);
const validTransform = value => value && typeof value === 'object' &&
  (!value.position || vector(value.position)) &&
  (!value.rotation || vector(value.rotation)) &&
  (!value.scale || (vector(value.scale) && value.scale.every(component => Math.abs(component) > 0.001))) &&
  (!value.color || hexColor(value.color));

function validEditorAssets(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.maps) || data.maps.length !== 3 ||
      !data.character || typeof data.character !== 'object') return false;
  const ids = new Set();
  for (const map of data.maps) {
    if (!mapIds.has(map.id) || ids.has(map.id) ||
        !Number.isFinite(map.halfWidth) || !Number.isFinite(map.halfDepth) ||
        map.halfWidth < 12 || map.halfWidth > 50 || map.halfDepth < 12 || map.halfDepth > 50 ||
        !map.colors || !['floor', 'wall', 'dark', 'orange', 'blue'].every(key => hexColor(map.colors[key])) ||
        !Number.isInteger(map.colors.barrel) || !Array.isArray(map.covers) || map.covers.length > 200 ||
        !map.covers.every(cover => Array.isArray(cover) && cover.length === 7 &&
          cover.slice(0, 6).every(Number.isFinite) && cover.slice(3, 6).every(size => size > 0.1 && size <= 60) &&
          materials.has(cover[6])) ||
        !Array.isArray(map.barrels) || map.barrels.length > 100 ||
        !map.barrels.every(barrel => Array.isArray(barrel) && barrel.length === 2 && barrel.every(Number.isFinite))) return false;
    ids.add(map.id);
  }
  const transforms = data.character.transforms;
  const additions = data.character.additions;
  if (!transforms || typeof transforms !== 'object' || Array.isArray(transforms) ||
      Object.keys(transforms).length > 1000 ||
      !Object.values(transforms).every(validTransform) ||
      !Array.isArray(additions) || additions.length > 200 ||
      !additions.every(part => part && /^[\w-]{1,80}$/.test(part.id) &&
        typeof part.name === 'string' && part.name.length <= 80 && geometries.has(part.geometry) &&
        hexColor(part.color) && vector(part.position) && vector(part.rotation) && vector(part.scale) &&
        part.scale.every(component => Math.abs(component) > 0.001))) return false;
  return true;
}

function editorSaveMiddleware(req, res, next) {
  if (new URL(req.url, 'http://localhost').pathname !== editorEndpoint) return next();
  const remoteAddress = req.socket.remoteAddress || '';
  if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' &&
      !remoteAddress.startsWith('::ffff:127.')) {
    res.statusCode = 403;
    res.end('L’éditeur est réservé à la machine locale.');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }
  if (req.method === 'GET') {
    readFile(editorAssetsPath, 'utf8').then(contents => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(contents);
    }).catch(error => {
      console.error('Échec de lecture des ressources de l’éditeur :', error);
      res.statusCode = 500;
      res.end('Impossible de lire les ressources du projet.');
    });
    return;
  }
  void (async () => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          res.statusCode = 413;
          res.end('Fichier trop volumineux.');
          return;
        }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!validEditorAssets(data)) {
        res.statusCode = 400;
        res.end('Format de ressources invalide.');
        return;
      }
      await writeFile(editorAssetsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ saved: true }));
    } catch (error) {
      console.error('Échec de sauvegarde des ressources de l’éditeur :', error);
      res.statusCode = 500;
      res.end('Impossible d’écrire dans les fichiers du projet.');
    }
  })();
}

const editorPlugin = {
  name: 'clash-room-local-editor-save',
  configureServer(server) {
    server.middlewares.use(editorSaveMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(editorSaveMiddleware);
  }
};

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/FPS-Shooter/' : '/',
  server: { host: true },
  build: { outDir: 'dist', sourcemap: true },
  plugins: process.env.VITE_EDITOR === '1' ? [editorPlugin] : []
});