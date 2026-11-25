
export const APPEARANCE_KEY = 'clash.appearance.v1';

/**
 * Catalogue des cosmétiques.
 * Les IDs correspondent exactement à accessoryModel() dans character.js.
 */
export const COSMETIC_ITEMS = [
  // CHAPEAUX
  {
    id: 'cap',
    label: 'Casquette',
    price: 100,
    icon: '🧢',
    description: 'Une casquette sportive et intemporelle.',
    category: 'Chapeaux'
  },
  {
    id: 'red_cap',
    label: 'Casquette rouge',
    price: 120,
    icon: '🧢',
    description: 'Une casquette rouge pour se faire remarquer.',
    category: 'Chapeaux'
  },
  {
    id: 'bucket_hat',
    label: 'Bob',
    price: 150,
    icon: '👒',
    description: 'Un bob décontracté.',
    category: 'Chapeaux'
  },
  {
    id: 'top_hat',
    label: 'Haut-de-forme',
    price: 250,
    icon: '🎩',
    description: 'Un style élégant sur le champ de bataille.',
    category: 'Chapeaux'
  },
  {
    id: 'crown',
    label: 'Couronne royale',
    price: 500,
    icon: '👑',
    description: 'Montre qui commande.',
    category: 'Chapeaux'
  },
  {
    id: 'beanie',
    label: 'Bonnet',
    price: 120,
    icon: '🧶',
    description: 'Un bonnet confortable.',
    category: 'Chapeaux'
  },
  {
    id: 'wizard_hat',
    label: 'Chapeau de sorcier',
    price: 300,
    icon: '🪄',
    description: 'Un peu de magie dans ton équipement.',
    category: 'Chapeaux'
  },

  // BANDEAUX
  {
    id: 'headband',
    label: 'Bandeau',
    price: 80,
    icon: '🔴',
    description: 'Un bandeau sportif.',
    category: 'Bandeaux'
  },
  {
    id: 'bandana',
    label: 'Bandana',
    price: 130,
    icon: '🏴',
    description: 'Un look de combattant.',
    category: 'Bandeaux'
  },

  // LUNETTES
  {
    id: 'glasses',
    label: 'Lunettes',
    price: 60,
    icon: '👓',
    description: 'Une monture sobre pour garder l’œil sur la cible.',
    category: 'Lunettes'
  },
  {
    id: 'sunglasses',
    label: 'Lunettes de soleil',
    price: 120,
    icon: '🕶️',
    description: 'Le style avant tout.',
    category: 'Lunettes'
  },
  {
    id: 'neon_glasses',
    label: 'Lunettes néon',
    price: 180,
    icon: '🟢',
    description: 'Des lunettes lumineuses au look futuriste.',
    category: 'Lunettes'
  },
  {
    id: 'monocle',
    label: 'Monocle',
    price: 200,
    icon: '🧐',
    description: 'Une touche de sophistication.',
    category: 'Lunettes'
  },

  // MASQUES
  {
    id: 'mask',
    label: 'Masque tactique',
    price: 80,
    icon: '▰',
    description: 'Un masque simple pour compléter ta tenue.',
    category: 'Masques'
  },
  {
    id: 'ninja_mask',
    label: 'Masque ninja',
    price: 180,
    icon: '🥷',
    description: 'Un équipement digne d\'un ninja.',
    category: 'Masques'
  },
  {
    id: 'medical_mask',
    label: 'Masque médical',
    price: 100,
    icon: '😷',
    description: 'Un masque léger et pratique.',
    category: 'Masques'
  },
  {
    id: 'skull_mask',
    label: 'Masque crâne',
    price: 350,
    icon: '💀',
    description: 'Fais trembler tes adversaires.',
    category: 'Masques'
  },

  // ÉQUIPEMENTS
  {
    id: 'headphones',
    label: 'Casque audio',
    price: 200,
    icon: '🎧',
    description: 'Toujours connecté à la bataille.',
    category: 'Équipements'
  },
  {
    id: 'military_helmet',
    label: 'Casque militaire',
    price: 250,
    icon: '🪖',
    description: 'Un casque robuste pour les combats.',
    category: 'Équipements'
  },
  {
    id: 'space_helmet',
    label: 'Casque spatial',
    price: 450,
    icon: '🚀',
    description: 'Prêt pour une mission intergalactique.',
    category: 'Équipements'
  },

  // FANTAISIE
  {
    id: 'devil_horns',
    label: 'Cornes du démon',
    price: 300,
    icon: '😈',
    description: 'Un look terrifiant.',
    category: 'Fantaisie'
  },
  {
    id: 'angel_halo',
    label: 'Halo céleste',
    price: 400,
    icon: '😇',
    description: 'Un halo doré au-dessus de ta tête.',
    category: 'Fantaisie'
  },
  {
    id: 'cat_ears',
    label: 'Oreilles de chat',
    price: 180,
    icon: '🐱',
    description: 'Des oreilles adorables.',
    category: 'Fantaisie'
  },
  {
    id: 'bunny_ears',
    label: 'Oreilles de lapin',
    price: 200,
    icon: '🐰',
    description: 'Des oreilles longues et amusantes.',
    category: 'Fantaisie'
  },
  {
    id: 'robot_antenna',
    label: 'Antenne robot',
    price: 250,
    icon: '🤖',
    description: 'Une antenne futuriste.',
    category: 'Fantaisie'
  },
  {
    id: 'flower',
    label: 'Fleur',
    price: 100,
    icon: '🌺',
    description: 'Une petite fleur décorative.',
    category: 'Fantaisie'
  },
  {
    id: 'star',
    label: 'Étoile',
    price: 220,
    icon: '⭐',
    description: 'Une étoile au sommet de la tête.',
    category: 'Fantaisie'
  },
  {
    id: 'earrings',
    label: 'Boucles d’oreilles',
    price: 150,
    icon: '💎',
    description: 'Des bijoux dorés.',
    category: 'Bijoux'
  },
  {
    id: 'piercing',
    label: 'Piercing',
    price: 100,
    icon: '✨',
    description: 'Un petit détail métallique.',
    category: 'Bijoux'
  }
];

/**
 * OPTIONS DE PERSONNALISATION
 */
export const APPEARANCE_OPTIONS = {

  // PEAU
  skin: [
    { id: 'light', label: 'Clair', color: '#f0c7a5' },
    { id: 'peach', label: 'Pêche', color: '#d99d79' },
    { id: 'warm', label: 'Doré', color: '#bb805b' },
    { id: 'brown', label: 'Brun', color: '#8b563c' },
    { id: 'deep', label: 'Foncé', color: '#633c30' },
    { id: 'porcelain', label: 'Porcelaine', color: '#f5dfd0' },
    { id: 'tan', label: 'Bronzé', color: '#bd875f' },
    { id: 'dark', label: 'Ébène', color: '#422a25' }
  ],

  // COULEURS DE CHEVEUX
  hairColor: [
    { id: 'brown', label: 'Brun', color: '#493326' },
    { id: 'black', label: 'Noir', color: '#19191d' },
    { id: 'blond', label: 'Blond', color: '#c9a357' },
    { id: 'red', label: 'Roux', color: '#a64c2e' },
    { id: 'blue', label: 'Bleu', color: '#426c9a' },
    { id: 'white', label: 'Blanc', color: '#e5e3dc' },
    { id: 'pink', label: 'Rose', color: '#d875a8' },
    { id: 'purple', label: 'Violet', color: '#8055b8' },
    { id: 'green', label: 'Vert', color: '#4b9961' },
    { id: 'silver', label: 'Argent', color: '#aeb8c4' },
    { id: 'orange', label: 'Orange', color: '#e17a35' }
  ],

  // COUPES DE CHEVEUX
  hairStyle: [
    { id: 'classic', label: 'Classique' },
    { id: 'spiky', label: 'Ébouriffé' },
    { id: 'buzz', label: 'Très court' },
    { id: 'fade', label: 'Dégradé' },
    { id: 'sidepart', label: 'Raie côté' },
    { id: 'curly', label: 'Bouclé' },
    { id: 'afro', label: 'Afro' },
    { id: 'mohawk', label: 'Crête iroquoise' },
    { id: 'long', label: 'Long' },
    { id: 'bob', label: 'Carré' },
    { id: 'bun', label: 'Chignon' },
    { id: 'undercut', label: 'Undercut' },
    { id: 'ponytail', label: 'Queue-de-cheval' }
  ],

  // T-SHIRTS
  shirt: [
    { id: 'orange', label: 'Orange', color: '#c94f36' },
    { id: 'blue', label: 'Bleu', color: '#2f7fc1' },
    { id: 'green', label: 'Vert', color: '#3fa65a' },
    { id: 'yellow', label: 'Jaune', color: '#d6a529' },
    { id: 'purple', label: 'Violet', color: '#8b4fc9' },
    { id: 'teal', label: 'Turquoise', color: '#1fa6a0' },
    { id: 'pink', label: 'Rose', color: '#d9568f' },
    { id: 'gray', label: 'Gris', color: '#7d8a96' },
    { id: 'white', label: 'Blanc', color: '#e9e5db' },
    { id: 'black', label: 'Noir', color: '#24272d' },
    { id: 'red', label: 'Rouge', color: '#bd3737' }
  ],

  // STYLES DE T-SHIRT
  shirtStyle: [
    { id: 'plain', label: 'T-shirt' },
    { id: 'stripes', label: 'Rayures' },
    { id: 'jacket', label: 'Veste' }
  ],

  // PANTALONS
  pants: [
    { id: 'navy', label: 'Marine', color: '#26374e' },
    { id: 'black', label: 'Noir', color: '#22252a' },
    { id: 'olive', label: 'Olive', color: '#4b5032' },
    { id: 'sand', label: 'Sable', color: '#8e7855' },
    { id: 'gray', label: 'Gris', color: '#777d86' },
    { id: 'white', label: 'Blanc', color: '#deded8' },
    { id: 'red', label: 'Rouge', color: '#873b3b' }
  ],

  // CHAUSSURES
  shoes: [
    { id: 'black', label: 'Noir', color: '#171b22' },
    { id: 'white', label: 'Blanc', color: '#e5e3dc' },
    { id: 'red', label: 'Rouge', color: '#a83d35' },
    { id: 'blue', label: 'Bleu', color: '#315d91' },
    { id: 'gold', label: 'Doré', color: '#b99a48' }
  ],

  // ACCESSOIRES
  accessory: [
    { id: 'none', label: 'Aucun' },
    ...COSMETIC_ITEMS.map(({ id, label }) => ({ id, label }))
  ]
};

/**
 * APPARENCE PAR DÉFAUT
 */
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

/**
 * Normalise une apparence.
 * Évite les IDs invalides et conserve les anciennes sauvegardes.
 */
export function normalizeAppearance(value = {}) {
  const appearance = {};

  for (const [category, options] of Object.entries(APPEARANCE_OPTIONS)) {
    const selected = options.some(option => option.id === value?.[category])
      ? value[category]
      : DEFAULT_APPEARANCE[category];

    appearance[category] = selected;
  }

  return appearance;
}

/**
 * Récupération de l'apparence sauvegardée.
 */
export function getAppearance() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(APPEARANCE_KEY) || '{}'
    );

    return normalizeAppearance(saved);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/**
 * Sauvegarde de l'apparence.
 */
export function saveAppearance(appearance) {
  const normalized = normalizeAppearance(appearance);

  try {
    localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // Apparence conservée pendant la session.
  }

  return normalized;
}

/**
 * Recherche d'un cosmétique par son ID.
 */
export function getCosmetic(id) {
  return COSMETIC_ITEMS.find(item => item.id === id) || null;
}

/**
 * Liste des cosmétiques par catégorie.
 */
export function getCosmeticsByCategory(category) {
  return COSMETIC_ITEMS.filter(item => item.category === category);
}

/**
 * Liste des catégories disponibles.
 */
export function getCosmeticCategories() {
  return [...new Set(COSMETIC_ITEMS.map(item => item.category))];
}
