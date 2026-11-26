import {
  progress, ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, TIER_LABEL, DAILY_BONUS, fmtDuration
} from '../game/progress.js';

const el = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== '') n.textContent = text;
  return n;
};
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const icon = name => {
  const span = el('span', 'ic-wrap');
  span.innerHTML = `<svg class="ic"><use href="#i-${name}"/></svg>`;
  return span;
};

/** Couleur de chaque palier de quête (du plus simple au plus difficile). */
const TIER_COLORS = ['#5fd0c4', '#f0b44d', '#f07845'];
const visible = node => !!node && node.offsetParent !== null;

function bar(value, goal, cls = '') {
  const wrap = el('div', `p-bar ${cls}`);
  const fill = el('span');
  fill.style.width = `${Math.min(100, (value / goal) * 100)}%`;
  wrap.appendChild(fill);
  return wrap;
}

function reward(amount, cls = '') {
  const r = el('span', `p-reward ${cls}`);
  r.append(icon('coins'), document.createTextNode(`+${fmt(amount)}`));
  return r;
}

/** Portefeuille (en haut à droite), onglets Quêtes et Succès, notifications. */
export class ProgressUI {
  constructor({ wallet, quests, achievements }) {
    this.walletAmount = wallet?.querySelector('#wallet-amount');
    this.wallet = wallet;
    this.questsEl = quests;
    this.achEl = achievements;
    this.lastCoins = progress.coins;
    this.achFilter = 'all';

    this.toasts = el('div', 'p-toasts');
    this.toasts.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.toasts);

    progress.onChange(() => this.refresh());
    progress.onToast(t => this.toast(t));

    // Rendu quand l'onglet devient visible.
    for (const panel of [quests, achievements]) {
      if (!panel?.parentElement) continue;
      new MutationObserver(() => this.refresh()).observe(panel.parentElement, { attributes: true, attributeFilter: ['class'] });
    }

    setInterval(() => this.tick(), 1000);
    this.refresh(true);
  }

  refresh() {
    this.renderWallet();
    if (visible(this.questsEl)) this.renderQuests();
    if (visible(this.achEl)) this.renderAchievements();
  }

  renderWallet() {
    if (!this.walletAmount) return;
    this.walletAmount.textContent = fmt(progress.coins);
    if (progress.coins > this.lastCoins) {
      this.wallet.classList.remove('bump');
      void this.wallet.offsetWidth;
      this.wallet.classList.add('bump');
    }
    this.lastCoins = progress.coins;
  }

  tick() {
    if (progress.ensureDay()) this.refresh();
    const out = this.questsEl?.querySelector('[data-countdown]');
    if (out) {
      const s = Math.floor(progress.msUntilReset() / 1000);
      const p = n => String(n).padStart(2, '0');
      out.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
    }
  }

  // ---------- Quêtes ----------

  renderQuests() {
    const quests = progress.dailyQuests();
    const root = el('div', 'quests-layout');

    // Compte à rebours avant le renouvellement des quêtes
    const head = el('div', 'quests-head');
    const cd = el('div', 'quests-countdown');
    cd.title = 'Nouvelles quêtes dans';
    cd.append(icon('timer'), el('strong', '', '--:--:--'));
    cd.lastChild.dataset.countdown = '';
    head.appendChild(cd);

    const grid = el('section', 'quests-grid');
    quests.forEach((quest, index) => {
      const card = el('article', `quest-card${quest.done ? ' done' : ''}`);
      card.style.setProperty('--tier', TIER_COLORS[Math.min(index, TIER_COLORS.length - 1)]);
      const top = el('div', 'quest-top');
      const tier = el('span', 'quest-tier');
      tier.append(quest.done ? icon('check') : icon('target'), document.createTextNode(TIER_LABEL[quest.tier]));
      top.append(tier, reward(quest.reward, quest.done ? 'claimed' : ''));
      const label = quest.unit === 'time'
        ? `${Math.floor(quest.progress / 60)} / ${quest.goal / 60} min`
        : `${fmt(quest.progress)} / ${fmt(quest.goal)}`;
      const meter = el('div', 'quest-meter');
      meter.append(bar(quest.progress, quest.goal), el('b', '', label));
      card.append(top, el('h3', '', quest.text), meter);
      grid.appendChild(card);
    });

    // Bonus : un cran par quête terminée
    const bonus = el('article', `quest-bonus${progress.dailyBonusDone ? ' done' : ''}`);
    bonus.title = progress.dailyBonusDone ? 'Bonus récupéré' : 'Termine toutes les quêtes pour le débloquer';
    const pips = el('div', 'bonus-pips');
    quests.forEach(quest => pips.appendChild(el('span', quest.done ? 'on' : '')));
    bonus.append(icon(progress.dailyBonusDone ? 'check' : 'gift'), el('h3', '', 'Bonus quotidien'), pips,
      reward(DAILY_BONUS, progress.dailyBonusDone ? 'claimed' : ''));

    // Statistiques : une seule bande
    const s = progress.stats;
    const stats = el('section', 'quests-stats');
    const stat = (name, label, value) => {
      const c = el('div', 'stat');
      const text = el('div');
      text.append(el('strong', '', value), el('small', '', label));
      c.append(icon(name), text);
      stats.appendChild(c);
    };
    stat('crosshair', 'ÉLIMINATIONS', fmt(s.kills));
    stat('skull', 'MORTS', fmt(s.deaths));
    stat('scale', 'RATIO', (s.deaths ? s.kills / s.deaths : s.kills).toFixed(2));
    stat('target', 'TIRS À LA TÊTE', fmt(s.heads));
    stat('gamepad-2', 'PARTIES', fmt(s.matches));
    stat('trophy', 'VICTOIRES', fmt(s.wins));
    stat('timer', 'TEMPS DE JEU', fmtDuration(s.playtime));
    stat('flame', 'MEILLEURE SÉRIE', fmt(s.bestStreak));

    root.append(head, grid, bonus, stats);
    this.questsEl.replaceChildren(root);
    this.tick();
  }

  // ---------- Succès ----------

  renderAchievements() {
    const unlocked = ACHIEVEMENTS.filter(x => progress.isUnlocked(x.id)).length;
    const root = el('div', 'ach-layout');

    // Progression globale
    const total = el('header', 'ach-total');
    const count = el('div', 'ach-count');
    count.append(icon('trophy'), el('strong', '', `${unlocked}`), el('span', '', `/ ${ACHIEVEMENTS.length}`));
    total.append(count, bar(unlocked, ACHIEVEMENTS.length, 'gold'));
    root.appendChild(total);

    // Filtre par catégorie : une barre d'onglets
    const tabs = el('nav', 'ach-tabs');
    tabs.setAttribute('aria-label', 'Catégories de succès');
    const entries = [['all', 'TOUT', unlocked, ACHIEVEMENTS.length]].concat(ACHIEVEMENT_CATEGORIES.map(([id, label]) => {
      const items = ACHIEVEMENTS.filter(x => x.cat === id);
      return [id, label, items.filter(x => progress.isUnlocked(x.id)).length, items.length];
    }));
    for (const [id, label, done, size] of entries) {
      const tab = el('button', `ach-tab${this.achFilter === id ? ' active' : ''}`);
      tab.type = 'button';
      tab.setAttribute('aria-pressed', String(this.achFilter === id));
      tab.append(el('span', '', label), el('small', '', `${done}/${size}`));
      tab.onclick = () => { this.achFilter = id; this.renderAchievements(); };
      tabs.appendChild(tab);
    }
    root.appendChild(tabs);

    const card = ach => {
      const at = progress.isUnlocked(ach.id);
      const value = progress.achievementValue(ach);
      const node = el('article', `ach-card${at ? ' unlocked' : ''}`);
      const body = el('div', 'ach-body');
      const label = ach.unit === 'time'
        ? `${fmtDuration(value)} / ${fmtDuration(ach.goal)}`
        : `${fmt(value)} / ${fmt(ach.goal)}`;
      const foot = el('div', 'ach-foot');
      const state = el('span');
      if (at) state.append(icon('check'), document.createTextNode(new Date(at).toLocaleDateString('fr-FR')));
      else state.textContent = label;
      foot.append(state, reward(ach.reward, at ? 'claimed' : ''));
      body.append(el('h3', '', ach.name), el('p', '', ach.desc), bar(value, ach.goal, 'gold'), foot);
      node.append(el('div', 'ach-icon', ach.icon), body);
      return node;
    };

    for (const [catId, catLabel] of ACHIEVEMENT_CATEGORIES) {
      if (this.achFilter !== 'all' && this.achFilter !== catId) continue;
      const section = el('section', 'ach-section');
      if (this.achFilter === 'all') section.appendChild(el('h2', '', catLabel));
      const grid = el('div', 'ach-grid');
      ACHIEVEMENTS.filter(x => x.cat === catId).forEach(ach => grid.appendChild(card(ach)));
      section.appendChild(grid);
      root.appendChild(section);
    }
    this.achEl.replaceChildren(root);
  }

  // ---------- Notifications ----------

  toast({ kind, title, text, icon: glyphText, reward: amount }) {
    const t = el('div', `p-toast ${kind}`);
    const body = el('div');
    body.append(el('small', '', title), el('strong', '', text));
    const glyph = el('div', 'p-toast-icon');
    if (glyphText) glyph.textContent = glyphText;
    else glyph.appendChild(icon(kind === 'quest' ? 'target' : 'trophy'));
    t.append(glyph, body);
    if (amount) t.appendChild(reward(amount));
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 350);
    }, 4200);
  }
}
