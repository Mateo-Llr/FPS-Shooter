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
  r.append(el('i', '', '◈'), document.createTextNode(`+${fmt(amount)}`));
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
    const doneCount = quests.filter(x => x.done).length;
    const root = el('div', 'quests-layout');

    const side = el('aside', 'quests-side');
    side.append(
      el('p', 'eyebrow', 'MISSIONS · RENOUVELÉES CHAQUE JOUR'),
      (() => { const h = el('h1'); h.append('QUÊTES', el('br'), el('span', '', 'DU JOUR.')); return h; })()
    );
    const cd = el('div', 'quests-countdown');
    cd.append(el('small', '', 'NOUVELLES QUÊTES DANS'), el('strong', '', '--:--:--'));
    cd.lastChild.dataset.countdown = '';
    side.appendChild(cd);

    const s = progress.stats;
    const grid = el('div', 'quests-stats');
    const stat = (label, value) => {
      const c = el('div');
      c.append(el('strong', '', value), el('small', '', label));
      grid.appendChild(c);
    };
    stat('ÉLIMINATIONS', fmt(s.kills));
    stat('MORTS', fmt(s.deaths));
    stat('RATIO', (s.deaths ? s.kills / s.deaths : s.kills).toFixed(2));
    stat('TIRS À LA TÊTE', fmt(s.heads));
    stat('PARTIES', fmt(s.matches));
    stat('VICTOIRES', fmt(s.wins));
    stat('TEMPS DE JEU', fmtDuration(s.playtime));
    stat('MEILLEURE SÉRIE', fmt(s.bestStreak));
    side.appendChild(grid);

    const list = el('section', 'quests-list');
    const head = el('div', 'quests-head');
    head.append(el('h2', '', 'MISSIONS ACTIVES'), el('span', '', `${doneCount} / ${quests.length} TERMINÉES`));
    list.appendChild(head);

    for (const quest of quests) {
      const card = el('article', `quest-card tier-${quest.tier}${quest.done ? ' done' : ''}`);
      const top = el('div', 'quest-top');
      top.append(el('span', 'quest-tier', TIER_LABEL[quest.tier]), reward(quest.reward, quest.done ? 'claimed' : ''));
      const label = quest.unit === 'time'
        ? `${Math.floor(quest.progress / 60)} / ${quest.goal / 60} min`
        : `${fmt(quest.progress)} / ${fmt(quest.goal)}`;
      const foot = el('div', 'quest-foot');
      foot.append(el('span', '', quest.done ? '✓ TERMINÉE' : 'EN COURS'), el('b', '', label));
      card.append(top, el('h3', '', quest.text), bar(quest.progress, quest.goal, 'teal'), foot);
      list.appendChild(card);
    }

    const bonus = el('article', `quest-bonus${progress.dailyBonusDone ? ' done' : ''}`);
    const bt = el('div');
    bt.append(
      el('h3', '', 'BONUS QUOTIDIEN'),
      el('p', '', progress.dailyBonusDone ? 'Bonus récupéré. Reviens demain !' : 'Termine les 3 quêtes pour le débloquer.')
    );
    bonus.append(bt, reward(DAILY_BONUS, progress.dailyBonusDone ? 'claimed' : ''));
    list.appendChild(bonus);

    root.append(side, list);
    this.questsEl.replaceChildren(root);
    this.tick();
  }

  // ---------- Succès ----------

  renderAchievements() {
    const unlocked = ACHIEVEMENTS.filter(x => progress.isUnlocked(x.id)).length;
    const root = el('div', 'ach-layout');

    const head = el('header', 'ach-head');
    const title = el('div');
    title.append(
      el('p', 'eyebrow', 'TROPHÉES · RÉCOMPENSES EN CRÉDITS'),
      (() => { const h = el('h1'); h.append('SUCCÈS ', el('span', '', 'DÉBLOQUÉS.')); return h; })()
    );
    const total = el('div', 'ach-total');
    total.append(el('strong', '', `${unlocked}`), el('span', '', `/ ${ACHIEVEMENTS.length}`));
    const meter = el('div', 'ach-meter');
    meter.append(total, bar(unlocked, ACHIEVEMENTS.length, 'gold'));
    head.append(title, meter);
    root.appendChild(head);

    for (const [catId, catLabel] of ACHIEVEMENT_CATEGORIES) {
      const items = ACHIEVEMENTS.filter(x => x.cat === catId);
      const done = items.filter(x => progress.isUnlocked(x.id)).length;
      const section = el('section', 'ach-section');
      const h = el('div', 'ach-section-head');
      h.append(el('h2', '', catLabel), el('span', '', `${done} / ${items.length}`));
      const grid = el('div', 'ach-grid');

      for (const ach of items) {
        const at = progress.isUnlocked(ach.id);
        const value = progress.achievementValue(ach);
        const card = el('article', `ach-card${at ? ' unlocked' : ''}`);
        const icon = el('div', 'ach-icon', ach.icon);
        const body = el('div', 'ach-body');
        const label = ach.unit === 'time'
          ? `${fmtDuration(value)} / ${fmtDuration(ach.goal)}`
          : `${fmt(value)} / ${fmt(ach.goal)}`;
        const foot = el('div', 'ach-foot');
        foot.append(
          el('span', '', at ? `✓ ${new Date(at).toLocaleDateString('fr-FR')}` : label),
          reward(ach.reward, at ? 'claimed' : '')
        );
        body.append(el('h3', '', ach.name), el('p', '', ach.desc), bar(value, ach.goal, 'gold'), foot);
        card.append(icon, body);
        grid.appendChild(card);
      }
      section.append(h, grid);
      root.appendChild(section);
    }
    this.achEl.replaceChildren(root);
  }

  // ---------- Notifications ----------

  toast({ kind, title, text, icon, reward: amount }) {
    const t = el('div', `p-toast ${kind}`);
    const body = el('div');
    body.append(el('small', '', title), el('strong', '', text));
    t.append(el('div', 'p-toast-icon', icon || (kind === 'quest' ? '◆' : '◈')), body);
    if (amount) t.appendChild(reward(amount));
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 350);
    }, 4200);
  }
}
