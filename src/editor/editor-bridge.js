import { editorAssets, replaceEditorAssets } from '../game/editor-assets.js';

export const editorEnabled = import.meta.env.VITE_EDITOR === '1';
const ASSET_URL = '/__clashroom_editor/assets';

export async function initializeEditorAssets() {
  if (!editorEnabled) return;
  const response = await fetch(ASSET_URL);
  if (!response.ok) throw new Error(`Impossible de charger les ressources (${response.status}).`);
  replaceEditorAssets(await response.json());
}

export async function saveEditorAssets() {
  const response = await fetch(ASSET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editorAssets)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Impossible d'enregistrer les ressources (${response.status}).`);
  }
  return response.json();
}
