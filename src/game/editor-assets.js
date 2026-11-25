import initialAssets from './editor-assets.json';

export const editorAssets = JSON.parse(JSON.stringify(initialAssets));

export function replaceEditorAssets(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.maps) ||
      !value.character || typeof value.character !== 'object') {
    throw new Error('Fichier de ressources invalide.');
  }
  editorAssets.maps.splice(0, editorAssets.maps.length, ...value.maps);
  editorAssets.character = value.character;
}
