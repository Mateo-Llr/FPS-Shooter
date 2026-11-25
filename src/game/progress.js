// Progression : crédits, statistiques, succès et quêtes quotidiennes (sauvegardés dans localStorage).
import { COSMETIC_ITEMS } from './customization.js';

const STORE_KEY = 'clash.progress.v1';

export const KILL_REWARD = 2;
export const HEAD_BONUS = 1;
export const MATCH_REWARD = 10;
export const WIN_REWARD = 25;
export const DAILY_BONUS = 75;
export const MIN_MATCH_SECONDS = 20;

export const WEAPON_IDS = ['shotgun', 'rifle', 'sniper', 'knife'];

const num = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);

// ---------- Formatage ----------

export function fmtDuration(sec) {
  sec = Math.floor(sec);
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  if (sec < 3600) return `${m} min`;
  const h = Math.floor(sec / 3600), r = Math.floor((sec % 3600) / 60);
  return r ? `${h} h ${r} min` : `${h} h`;
}

// ---------- Quêtes quotidiennes ----------

const kill = (weapon, head) => e =>
  e.type === 'kill' && (!weapon || e.weapon === weapon) && (!head || e.head) ? 1 : 0;
const time = e => (e.type === 'time' ? e.sec : 0);
const played = e => (e.type === 'matchEnd' && e.counted ? 1 : 0);
const won = e => (e.type === 'matchEnd' && e.counted && e.won ? 1 : 0);
const streak = (e, c) => (e.type === 'kill' ? c.streak : 0);
const matchKills = (e, c) => (e.type === 'kill' ? c.matchKills : 0);

const TIER_REWARD = { easy: 25, medium: 50, hard: 100 };
export const TIER_LABEL = { easy: 'FACILE', medium: 'MOYEN', hard: 'DIFFICILE' };

const q = (id, tier, text, goal, track, extra = {}) =>
  ({ id, tier, text, goal, reward: TIER_REWARD[tier], track, ...extra });

export const QUEST_POOL = [
  q('k5', 'easy', 'Élimine 5 joueurs', 5, kill()),
  q('rifle5', 'easy', 'Élimine 5 joueurs au fusil d’assaut', 5, kill('rifle')),
  q('shotgun2', 'easy', 'Élimine 2 joueurs au fusil à pompe', 2, kill('shotgun')),
  q('time5', 'easy', 'Joue 5 minutes', 300, time, { unit: 'time' }),
  q('play1', 'easy', 'Termine 1 partie', 1, played),

  q('head3', 'medium', 'Réussis 3 tirs à la tête', 3, kill(null, true)),
  q('k12', 'medium', 'Élimine 12 joueurs', 12, kill()),
  q('shotgun5', 'medium', 'Élimine 5 joueurs au fusil à pompe', 5, kill('shotgun')),
  q('knife2', 'medium', 'Élimine 2 joueurs au couteau', 2, kill('knife')),
  q('sniper3', 'medium', 'Élimine 3 joueurs au sniper', 3, kill('sniper')),
  q('rifle15', 'medium', 'Élimine 15 joueurs au fusil d’assaut', 15, kill('rifle')),
  q('time12', 'medium', 'Joue 12 minutes', 720, time, { unit: 'time' }),
  q('win1', 'medium', 'Gagne 1 partie', 1, won),

  q('sniper6', 'hard', 'Élimine 6 joueurs au sniper', 6, kill('sniper')),
  q('head8', 'hard', 'Réussis 8 tirs à la tête', 8, kill(null, true)),
  q('streak5', 'hard', 'Enchaîne 5 éliminations sans mourir', 5, streak, { max: true }),
  q('k25', 'hard', 'Élimine 25 joueurs', 25, kill()),
  q('win2', 'hard', 'Gagne 2 parties', 2, won),
  q('match12', 'hard', 'Fais 12 éliminations dans une seule partie', 12, matchKills, { max: true }),
  q('knife4', 'hard', 'Élimine 4 joueurs au couteau', 4, kill('knife')),
  q('time25', 'hard', 'Joue 25 minutes', 1500, time, { unit: 'time' }),
  q('play4', 'hard', 'Termine 4 parties', 4, played)
];
const QUEST_BY_ID = Object.fromEntries(QUEST_POOL.map(t => [t.id, t]));

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function seededRandom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une quête facile, une moyenne, une difficile : tirées au hasard à partir de la date. */
function pickDailyQuests(day) {
  const rnd = seededRandom(day);
  return ['easy', 'medium', 'hard'].map(tier => {
    const pool = QUEST_POOL.filter(t => t.tier === tier);
    return { id: pool[Math.floor(rnd() * pool.length)].id, progress: 0, done: false };
  });
}

// ---------- Succès ----------

export const ACHIEVEMENT_CATEGORIES = [
  ['combat', 'COMBAT'],
  ['weapons', 'ARMES'],
  ['matches', 'PARTIES'],
  ['dedication', 'ENDURANCE']
];

const a = (id, cat, icon, name, desc, goal, reward, get, unit) =>
  ({ id, cat, icon, name, desc, goal, reward, get, unit });
const kw = w => s => s.killsW[w];

export const ACHIEVEMENTS = [
  // COMBAT
  a('first_blood', 'combat', '✦', 'Premier sang', 'Élimine ton premier joueur.', 1, 20, s => s.kills),
  a('kills_10', 'combat', '☠', 'Recrue', 'Cumule 10 éliminations.', 10, 25, s => s.kills),
  a('kills_50', 'combat', '☠', 'Soldat', 'Cumule 50 éliminations.', 50, 50, s => s.kills),
  a('kills_250', 'combat', '☠', 'Vétéran', 'Cumule 250 éliminations.', 250, 120, s => s.kills),
  a('kills_1000', 'combat', '♛', 'Légende de l’arène', 'Cumule 1 000 éliminations.', 1000, 400, s => s.kills),
  a('heads_1', 'combat', '⌖', 'Œil de lynx', 'Réussis ton premier tir à la tête.', 1, 20, s => s.heads),
  a('heads_25', 'combat', '⌖', 'Tireur d’élite', 'Réussis 25 tirs à la tête.', 25, 60, s => s.heads),
  a('heads_150', 'combat', '⌖', 'Chirurgien', 'Réussis 150 tirs à la tête.', 150, 200, s => s.heads),
  a('streak_3', 'combat', '⚡', 'Triplé', 'Enchaîne 3 éliminations sans mourir.', 3, 30, s => s.bestStreak),
  a('streak_5', 'combat', '⚡', 'Inarrêtable', 'Enchaîne 5 éliminations sans mourir.', 5, 60, s => s.bestStreak),
  a('streak_10', 'combat', '⚡', 'Dieu de l’arène', 'Enchaîne 10 éliminations sans mourir.', 10, 200, s => s.bestStreak),
  a('match_10', 'combat', '✹', 'Massacre', 'Fais 10 éliminations dans une seule partie.', 10, 50, s => s.bestMatch),
  a('match_20', 'combat', '✹', 'Apocalypse', 'Fais 20 éliminations dans une seule partie.', 20, 100, s => s.bestMatch),

  // ARMES
  a('shotgun_25', 'weapons', '▰', 'Fracasseur', '25 éliminations au fusil à pompe.', 25, 50, kw('shotgun')),
  a('shotgun_100', 'weapons', '▰', 'Dévastateur', '100 éliminations au fusil à pompe.', 100, 150, kw('shotgun')),
  a('rifle_100', 'weapons', '▤', 'Rafale', '100 éliminations au fusil d’assaut.', 100, 60, kw('rifle')),
  a('rifle_500', 'weapons', '▤', 'Maître du fusil', '500 éliminations au fusil d’assaut.', 500, 200, kw('rifle')),
  a('sniper_20', 'weapons', '◎', 'Longue portée', '20 éliminations au sniper.', 20, 60, kw('sniper')),
  a('sniper_100', 'weapons', '◎', 'Fantôme', '100 éliminations au sniper.', 100, 200, kw('sniper')),
  a('sniper_heads', 'weapons', '◎', 'Une balle, un mort', '10 tirs à la tête au sniper.', 10, 80, s => s.sniperHeads),
  a('knife_1', 'weapons', '†', 'Au contact', 'Élimine un joueur au couteau.', 1, 40, kw('knife')),
  a('knife_10', 'weapons', '†', 'Lame silencieuse', '10 éliminations au couteau.', 10, 120, kw('knife')),
  a('knife_50', 'weapons', '†', 'Boucher', '50 éliminations au couteau.', 50, 250, kw('knife')),
  a('arsenal', 'weapons', '✪', 'Arsenal complet', 'Fais au moins 10 éliminations avec chaque arme.', 10, 150,
    s => Math.min(...WEAPON_IDS.map(w => s.killsW[w]))),

  // PARTIES
  a('play_1', 'matches', '▶', 'Baptême du feu', 'Termine ta première partie.', 1, 20, s => s.matches),
  a('play_10', 'matches', '▶', 'Habitué', 'Termine 10 parties.', 10, 50, s => s.matches),
  a('play_50', 'matches', '▶', 'Pilier de l’arène', 'Termine 50 parties.', 50, 150, s => s.matches),
  a('play_200', 'matches', '▶', 'Accro', 'Termine 200 parties.', 200, 400, s => s.matches),
  a('win_1', 'matches', '★', 'Première victoire', 'Gagne une partie.', 1, 40, s => s.wins),
  a('win_10', 'matches', '★', 'Gagnant', 'Gagne 10 parties.', 10, 100, s => s.wins),
  a('win_50', 'matches', '★', 'Champion', 'Gagne 50 parties.', 50, 300, s => s.wins),
  a('flawless_1', 'matches', '✚', 'Intouchable', 'Gagne une partie sans mourir.', 1, 100, s => s.flawless),
  a('flawless_5', 'matches', '✚', 'Invulnérable', 'Gagne 5 parties sans mourir.', 5, 250, s => s.flawless),
  a('big_win', 'matches', '♜', 'Roi de la mêlée', 'Gagne une partie à 4 joueurs ou plus.', 1, 100, s => s.bigWins),
  a('big_match', 'matches', '♜', 'Salon plein', 'Termine une partie à 8 joueurs ou plus.', 1, 60, s => s.bigMatches),
  a('time_win', 'matches', '⏱', 'Maître du chrono', 'Gagne 3 parties « meilleur score au temps ».', 3, 80, s => s.timeWins),

  // ENDURANCE
  a('time_30', 'dedication', '⏱', 'Échauffement', 'Joue 30 minutes au total.', 1800, 30, s => s.playtime, 'time'),
  a('time_5h', 'dedication', '⏱', 'Marathon', 'Joue 5 heures au total.', 18000, 150, s => s.playtime, 'time'),
  a('time_20h', 'dedication', '⏱', 'Vie d’arène', 'Joue 20 heures au total.', 72000, 400, s => s.playtime, 'time'),
  a('deaths_50', 'dedication', '☁', 'On apprend en tombant', 'Meurs 50 fois. Ça arrive aux meilleurs.', 50, 30, s => s.deaths),
  a('quests_10', 'dedication', '◆', 'Chasseur de primes', 'Termine 10 quêtes quotidiennes.', 10, 60, s => s.questsDone),
  a('quests_50', 'dedication', '◆', 'Mercenaire', 'Termine 50 quêtes quotidiennes.', 50, 200, s => s.questsDone),
  a('bonus_7', 'dedication', '◆', 'Semaine parfaite', 'Termine toutes les quêtes du jour 7 fois.', 7, 250, s => s.bonusDays),
  a('earn_1000', 'dedication', '◈', 'Économe', 'Gagne 1 000 crédits au total.', 1000, 80, s => s.earned),
  a('earn_10000', 'dedication', '◈', 'Magnat', 'Gagne 10 000 crédits au total.', 10000, 300, s => s.earned)
];

// ---------- Données ----------

const blankStats = () => ({
  kills: 0, deaths: 0, heads: 0, sniperHeads: 0,
  killsW: Object.fromEntries(WEAPON_IDS.map(w => [w, 0])),
  bestStreak: 0, bestMatch: 0, matches: 0, wins: 0, flawless: 0,
  bigWins: 0, bigMatches: 0, timeWins: 0, playtime: 0,
  earned: 0, questsDone: 0, bonusDays: 0
});
const blank = () => ({
  v: 1, coins: 0, stats: blankStats(), unlocked: {}, cosmetics: [],
  daily: { day: '', quests: [], bonus: false }
});

class Progress {
  constructor() {
    this.changeListeners = [];
    this.toastListeners = [];
    this.streak = 0; this.matchKills = 0; this.matchDeaths = 0; this.matchSeconds = 0;
    this.inMatch = false;
    this.playAcc = 0;
    this.lastSave = 0; this.lastEmit = 0;
    this.data = this.load();
    this.ensureDay();
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  load() {
    const d = blank();
    try {
      const j = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!j || typeof j !== 'object') return d;
      d.coins = num(j.coins);
      for (const k of Object.keys(d.stats)) {
        if (k === 'killsW') for (const w of WEAPON_IDS) d.stats.killsW[w] = num(j.stats?.killsW?.[w]);
        else d.stats[k] = num(j.stats?.[k]);
      }
      for (const [id, at] of Object.entries(j.unlocked || {})) {
        if (ACHIEVEMENTS.some(x => x.id === id)) d.unlocked[id] = num(at) || Date.now();
      }
      if (Array.isArray(j.cosmetics)) {
        d.cosmetics = [...new Set(j.cosmetics.filter(id => COSMETIC_ITEMS.some(item => item.id === id)))];
      }
      if (typeof j.daily?.day === 'string' && Array.isArray(j.daily.quests)) {
        d.daily.day = j.daily.day;
        d.daily.bonus = !!j.daily.bonus;
        d.daily.quests = j.daily.quests
          .filter(x => QUEST_BY_ID[x?.id])
          .map(x => ({ id: x.id, progress: num(x.progress), done: !!x.done }));
      }
    } catch { /* données illisibles : on repart de zéro */ }
    return d;
  }

  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch { /* stockage indisponible */ }
    this.lastSave = performance.now();
  }

  onChange(f) { this.changeListeners.push(f); }
  onToast(f) { this.toastListeners.push(f); }
  notify() { this.changeListeners.forEach(f => f()); this.lastEmit = performance.now(); }
  toast(t) { this.toastListeners.forEach(f => f(t)); }

  get coins() { return this.data.coins; }
  get stats() { return this.data.stats; }
  ownsCosmetic(id) { return this.data.cosmetics.includes(id); }

  purchaseCosmetic(id) {
    const item = COSMETIC_ITEMS.find(cosmetic => cosmetic.id === id);
    if (!item || this.ownsCosmetic(id)) return 'unavailable';
    if (this.data.coins < item.price) return 'insufficient';
    this.data.coins -= item.price;
    this.data.cosmetics.push(id);
    this.save();
    this.notify();
    return 'purchased';
  }

  grant(amount) {
    this.data.coins += amount;
    this.data.stats.earned += amount;
  }

  // ----- Quêtes -----

  /** Génère les quêtes du jour si la date a changé. Retourne true si elles ont été renouvelées. */
  ensureDay() {
    const day = todayKey();
    if (this.data.daily.day === day && this.data.daily.quests.length === 3) return false;
    this.data.daily = { day, quests: pickDailyQuests(day), bonus: false };
    this.save();
    return true;
  }

  msUntilReset() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime();
  }

  /** Quêtes du jour avec leur définition. */
  dailyQuests() {
    return this.data.daily.quests.map(x => ({ ...QUEST_BY_ID[x.id], progress: Math.min(x.progress, QUEST_BY_ID[x.id].goal), done: x.done }));
  }

  get dailyBonusDone() { return this.data.daily.bonus; }

  // ----- Parties -----

  startMatch() {
    this.streak = 0; this.matchKills = 0; this.matchDeaths = 0; this.matchSeconds = 0;
    this.playAcc = 0;
    this.inMatch = true;
  }

  /** À appeler à chaque image pendant la partie. */
  tickPlay(dt) {
    if (!this.inMatch) return;
    this.matchSeconds += dt;
    this.playAcc += dt;
    if (this.playAcc >= 1) {
      const sec = this.playAcc;
      this.playAcc = 0;
      this.record({ type: 'time', sec });
    }
  }

  endMatch({ won = false, players = 0, mode = 'kills', aborted = false } = {}) {
    if (!this.inMatch) return;
    this.inMatch = false;
    if (this.playAcc > 0) { this.record({ type: 'time', sec: this.playAcc }); this.playAcc = 0; }
    const counted = !aborted && players >= 2 && this.matchSeconds >= MIN_MATCH_SECONDS;
    this.record({ type: 'matchEnd', counted, won, players, mode });
  }

  // ----- Événements -----

  record(ev) {
    this.ensureDay();
    const s = this.data.stats;

    if (ev.type === 'kill') {
      s.kills++;
      if (s.killsW[ev.weapon] !== undefined) s.killsW[ev.weapon]++;
      let gain = KILL_REWARD;
      if (ev.head) {
        s.heads++;
        if (ev.weapon === 'sniper') s.sniperHeads++;
        gain += HEAD_BONUS;
      }
      this.streak++; this.matchKills++;
      s.bestStreak = Math.max(s.bestStreak, this.streak);
      s.bestMatch = Math.max(s.bestMatch, this.matchKills);
      this.grant(gain);
    } else if (ev.type === 'death') {
      s.deaths++;
      this.streak = 0; this.matchDeaths++;
    } else if (ev.type === 'time') {
      s.playtime += ev.sec;
    } else if (ev.type === 'matchEnd' && ev.counted) {
      s.matches++;
      let payout = MATCH_REWARD;
      if (ev.won) {
        s.wins++;
        payout += WIN_REWARD;
        if (this.matchDeaths === 0) s.flawless++;
        if (ev.players >= 4) s.bigWins++;
        if (ev.mode === 'time') s.timeWins++;
      }
      if (ev.players >= 8) s.bigMatches++;
      this.grant(payout);
      this.toast({ kind: 'coin', title: ev.won ? 'VICTOIRE' : 'PARTIE TERMINÉE', text: 'Récompense de fin de partie', reward: payout });
    }

    this.updateQuests(ev);
    this.checkAchievements();

    // Le temps de jeu arrive chaque seconde : on limite les écritures et les rafraîchissements.
    const now = performance.now();
    if (ev.type !== 'time' || now - this.lastSave > 5000) this.save();
    if (ev.type !== 'time' || now - this.lastEmit > 2000) this.notify();
  }

  updateQuests(ev) {
    const ctx = { streak: this.streak, matchKills: this.matchKills };
    const d = this.data.daily;
    for (const entry of d.quests) {
      if (entry.done) continue;
      const tpl = QUEST_BY_ID[entry.id];
      const v = tpl.track(ev, ctx);
      if (!v) continue;
      entry.progress = tpl.max ? Math.max(entry.progress, v) : entry.progress + v;
      if (entry.progress >= tpl.goal) {
        entry.done = true;
        this.data.stats.questsDone++;
        this.grant(tpl.reward);
        this.toast({ kind: 'quest', title: 'QUÊTE TERMINÉE', text: tpl.text, reward: tpl.reward });
      }
    }
    if (!d.bonus && d.quests.length && d.quests.every(x => x.done)) {
      d.bonus = true;
      this.data.stats.bonusDays++;
      this.grant(DAILY_BONUS);
      this.toast({ kind: 'quest', title: 'BONUS QUOTIDIEN', text: 'Toutes les quêtes du jour sont terminées', reward: DAILY_BONUS });
    }
  }

  // ----- Succès -----

  checkAchievements() {
    // Une récompense peut en débloquer une autre (crédits cumulés) : on boucle jusqu'à stabilité.
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const ach of ACHIEVEMENTS) {
        if (this.data.unlocked[ach.id] || ach.get(this.data.stats) < ach.goal) continue;
        this.data.unlocked[ach.id] = Date.now();
        this.grant(ach.reward);
        this.toast({ kind: 'ach', title: 'SUCCÈS DÉBLOQUÉ', text: ach.name, icon: ach.icon, reward: ach.reward });
        changed = true;
      }
      if (!changed) break;
    }
  }

  achievementValue(ach) {
    return Math.min(ach.get(this.data.stats), ach.goal);
  }

  isUnlocked(id) { return this.data.unlocked[id] || 0; }
}

export const progress = new Progress();
