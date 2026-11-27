import * as THREE from 'three';
import { SHIRT_COLORS } from './character.js';
import { MAX_PLAYERS } from '../network/protocol.js';

/**
 * Équipes : fonctions partagées par le salon, la scène 3D du salon et la partie.
 * Une équipe = un index (0..count-1). Il y en a au plus autant que de joueurs possibles.
 */
export const MIN_TEAMS = 2;
export const MAX_TEAMS = MAX_PLAYERS;

const make = (name, hex) => {
  const lum = (0.299 * (hex >> 16 & 255) + 0.587 * (hex >> 8 & 255) + 0.114 * (hex & 255)) / 255;
  return Object.freeze({
    name, hex,
    css: '#' + hex.toString(16).padStart(6, '0'),
    ink: lum > 0.6 ? '#10151a' : '#ffffff' // texte lisible posé sur la couleur
  });
};

export const TEAMS = Object.freeze([
  make('Rouge', 0xe5484d), make('Bleu', 0x3e7bfa), make('Vert', 0x3fb950), make('Jaune', 0xf5c542),
  make('Orange', 0xf58a3d), make('Violet', 0x9b6bff), make('Cyan', 0x2fc7d8), make('Rose', 0xf26fb0),
  make('Citron', 0xb6e03b), make('Marron', 0xa0673a), make('Gris', 0x8a98a0), make('Indigo', 0x4b4fd6),
  make('Bordeaux', 0x9c2a4a), make('Menthe', 0x6fe0a8), make('Sable', 0xd8c3a5), make('Blanc', 0xeef1f2)
]);

export const clampTeamCount = n => Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(+n) || MIN_TEAMS));
export const teamInfo = t => TEAMS[t] ?? TEAMS[0];
export const validTeam = (t, count) => Number.isInteger(t) && t >= 0 && t < count;

/** Valeur de t-shirt dans le même format que SHIRT_COLORS (nombre, chaîne CSS ou THREE.Color). */
export function shirtFor(team) {
  const hex = teamInfo(team).hex, sample = SHIRT_COLORS[0];
  if (typeof sample === 'number') return hex;
  if (typeof sample === 'string') return teamInfo(team).css;
  return new THREE.Color(hex);
}

/** Nombre de joueurs par équipe. */
export function teamSizes(players, count) {
  const sizes = Array.from({ length: count }, () => 0);
  for (const p of players) if (validTeam(p.team, count)) sizes[p.team]++;
  return sizes;
}

/** Équipe la moins peuplée (la plus petite en cas d'égalité) : celle où arrive un nouveau joueur. */
export function leastPopulatedTeam(players, count) {
  const sizes = teamSizes(players, count);
  return sizes.indexOf(Math.min(...sizes));
}

/** Replace dans une équipe valide tout joueur dont l'équipe n'existe plus (nombre d'équipes réduit). */
export function fixTeams(players, count) {
  for (const p of players) {
    if (validTeam(p.team, count)) continue;
    p.team = leastPopulatedTeam(players.filter(q => q !== p), count);
  }
}

/** Répartition équitable : les joueurs sont distribués à tour de rôle. */
export function balanceTeams(players, count) {
  [...players].sort((a, b) => a.id - b.id).forEach((p, i) => { p.team = i % count; });
}

/** Nombre d'équipes qui ont au moins un joueur. */
export const activeTeamCount = players => new Set(players.map(p => p.team)).size;
