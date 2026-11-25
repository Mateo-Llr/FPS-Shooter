export const APPEARANCE_KEY = 'clash.appearance.v1';

export const APPEARANCE_OPTIONS = {
  skin: [
    { id: 'light', label: 'Clair', color: '#f0c7a5' },
    { id: 'peach', label: 'Pêche', color: '#d99d79' },
    { id: 'warm', label: 'Doré', color: '#bb805b' },
    { id: 'brown', label: 'Brun', color: '#8b563c' },
    { id: 'deep', label: 'Foncé', color: '#633c30' }
  ],
  hairColor: [
    { id: 'brown', label: 'Brun', color: '#493326' },
    { id: 'black', label: 'Noir', color: '#19191d' },
    { id: 'blond', label: 'Blond', color: '#c9a357' },
    { id: 'red', label: 'Roux', color: '#a64c2e' },
    { id: 'blue', label: 'Bleu', color: '#426c9a' }
  ],
  hairStyle: [
    { id: 'classic', label: 'Classique' },
    { id: 'spiky', label: 'Ébouriffé' },
    { id: 'buzz', label: 'Très court' },
    { id: 'fade', label: 'Dégradé' },
    { id: 'sidepart', label: 'Raie côté' },
    { id: 'curly', label: 'Bouclé' },
    { id: 'afro', label: 'Afro' },
    { id: 'mohawk', label: 'Crête' },
    { id: 'long', label: 'Long' },
    { id: 'bob', label: 'Carré' },
    { id: 'bun', label: 'Chignon' },
    { id: 'undercut', label: 'Undercut' },
    { id: 'ponytail', label: 'Queue-de-cheval' }
  ],
  shirt: [
    { id: 'orange', label: 'Orange', color: '#c94f36' },
    { id: 'blue', label: 'Bleu', color: '#2f7fc1' },
    { id: 'green', label: 'Vert', color: '#3fa65a' },
    { id: 'yellow', label: 'Jaune', color: '#d6a529' },
    { id: 'purple', label: 'Violet', color: '#8b4fc9' },
    { id: 'teal', label: 'Turquoise', color: '#1fa6a0' },
    { id: 'pink', label: 'Rose', color: '#d9568f' },
    { id: 'gray', label: 'Gris', color: '#7d8a96' }
  ],
  shirtStyle: [
    { id: 'plain', label: 'T-shirt' },
    { id: 'stripes', label: 'Rayures' },
    { id: 'jacket', label: 'Veste' }
  ],
  pants: [
    { id: 'navy', label: 'Marine', color: '#26374e' },
    { id: 'black', label: 'Noir', color: '#22252a' },
    { id: 'olive', label: 'Olive', color: '#4b5032' },
    { id: 'sand', label: 'Sable', color: '#8e7855' }
  ],
  shoes: [
    { id: 'black', label: 'Noir', color: '#171b22' },
    { id: 'white', label: 'Blanc', color: '#e5e3dc' },
    { id: 'red', label: 'Rouge', color: '#a83d35' }
  ],
  accessory: [
    { id: 'none', label: 'Aucun' },
    { id: 'cap', label: 'Casquette' },
    { id: 'headband', label: 'Bandeau' },
    { id: 'glasses', label: 'Lunettes' }
  ]
};

export const DEFAULT_APPEARANCE = {
  skin: 'peach',
  hairColor: 'brown',
  hairStyle: 'classic',
  shirt: 'orange',
  shirtStyle: 'plain',
  pants: 'navy',
  shoes: 'black',
  accessory: 'none'
};

export function normalizeAppearance(value) {
  const appearance = {};
  for (const [category, options] of Object.entries(APPEARANCE_OPTIONS)) {
    const selected = options.some(option => option.id === value?.[category])
      ? value[category]
      : DEFAULT_APPEARANCE[category];
    appearance[category] = selected;
  }
  return appearance;
}

export function getAppearance() {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(appearance) {
  const normalized = normalizeAppearance(appearance);
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(normalized));
  } catch {
    // L'apparence reste active pour cette session si le stockage est indisponible.
  }
  return normalized;
}
