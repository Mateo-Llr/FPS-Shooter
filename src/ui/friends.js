import Peer from 'peerjs';

/**
 * Amis sans serveur dédié : chaque navigateur garde un « code ami » permanent (8 caractères) et
 * enregistre un pair PeerJS discret avec cet identifiant. Les amis (acceptés des deux côtés) se
 * connectent entre eux, s'échangent leur état (en ligne / salon ouvert / en partie) et peuvent
 * s'inviter. Un ami hors ligne ne reçoit pas les demandes : elles sont renvoyées dès qu'il revient.
 */

const PREFIX = 'clashroom-f-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY = { code: 'clash.friendCode', friends: 'clash.friends', pending: 'clash.pendingOut', incoming: 'clash.incoming' };
const STALE_MS = 20000;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};
const makeCode = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const validCode = c => /^[A-HJ-NP-Z2-9]{8}$/.test(c);
const clean = s => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Joueur';

export class Friends {
  constructor() {
    let code = store.get(KEY.code, '');
    if (!validCode(code)) { code = makeCode(); store.set(KEY.code, code); }
    this.code = code;
    this.friends = store.get(KEY.friends, []);    // [{ code, name }]
    this.pending = store.get(KEY.pending, []);    // codes auxquels j'ai envoyé une demande
    this.incoming = store.get(KEY.incoming, []);  // [{ code, name }] demandes reçues
    this.live = new Map();                        // code -> { conn, connecting, status, seen }
    this.mounts = [];
    this.peerState = 'init';
    this.cb = { getName: () => 'Joueur', getPresence: () => ({ room: null }), onJoin: () => {} };

    this.toasts = document.createElement('div');
    this.toasts.id = 'toasts';
    document.body.appendChild(this.toasts);

    this.connect();
    setInterval(() => { this.tick(); this.render(); }, 6000);
    addEventListener('beforeunload', () => { try { this.peer?.destroy(); } catch { /* ignoré */ } });
  }

  attach(cb) { Object.assign(this.cb, cb); }

  // ---------- Connexion au serveur de signalisation ----------

  connect() {
    clearTimeout(this.retry);
    try { this.peer?.destroy(); } catch { /* ignoré */ }
    const peer = this.peer = new Peer(PREFIX + this.code, { debug: 0 });
    peer.on('open', () => { this.peerState = 'ok'; this.render(); this.tick(); });
    peer.on('connection', c => this.bind(c));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ignoré */ } });
    peer.on('error', err => {
      if (err.type === 'peer-unavailable') return; // un ami est simplement hors ligne
      this.peerState = err.type === 'unavailable-id' ? 'busy' : 'error';
      this.render();
      clearTimeout(this.retry);
      this.retry = setTimeout(() => { if (this.peerState !== 'ok') this.connect(); }, 15000);
    });
  }

  codeOf(conn) { return conn.peer?.startsWith(PREFIX) ? conn.peer.slice(PREFIX.length) : null; }
  slot(code) {
    if (!this.live.has(code)) this.live.set(code, { conn: null, connecting: 0, status: null, seen: 0 });
    return this.live.get(code);
  }
  isFriend(code) { return this.friends.some(f => f.code === code); }
  save() {
    store.set(KEY.friends, this.friends);
    store.set(KEY.pending, this.pending);
    store.set(KEY.incoming, this.incoming);
  }

  bind(conn) {
    const code = this.codeOf(conn);
    if (!code || code === this.code) return;
    conn.on('open', () => {
      const st = this.slot(code);
      if (!st.conn?.open) st.conn = conn;
      st.connecting = 0;
      conn.send({ t: 'hello', name: this.cb.getName() });
      if (this.pending.includes(code)) conn.send({ t: 'req', name: this.cb.getName() });
      if (this.isFriend(code)) this.sendStatus(conn);
    });
    conn.on('data', d => this.onData(code, conn, d));
    conn.on('close', () => {
      const st = this.live.get(code);
      if (st && st.conn === conn) { st.conn = null; st.status = null; this.render(); }
    });
    conn.on('error', () => {});
  }

  /** Reconnecte les amis (et demandes en attente) hors ligne, et rafraîchit l'état envoyé. */
  tick() {
    if (this.peerState !== 'ok') return;
    const codes = new Set([...this.friends.map(f => f.code), ...this.pending]);
    for (const code of codes) {
      const st = this.slot(code);
      if (st.conn?.open) { if (this.isFriend(code)) this.sendStatus(st.conn); continue; }
      if (Date.now() - st.connecting < 9000) continue;
      st.connecting = Date.now();
      const c = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      this.bind(c);
      setTimeout(() => { if (!c.open) c.close(); }, 8000);
    }
  }

  presence() {
    const p = this.cb.getPresence() || {};
    return { room: p.room || null, count: p.count || 0, open: !!p.open, ingame: !!p.ingame };
  }

  sendStatus(conn) {
    try { conn.send({ t: 'status', name: this.cb.getName(), ...this.presence() }); } catch { /* ignoré */ }
  }

  /** À appeler quand mon salon / ma partie change : prévient les amis immédiatement. */
  push() {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      for (const [code, st] of this.live) if (st.conn?.open && this.isFriend(code)) this.sendStatus(st.conn);
    }, 250);
  }

  // ---------- Messages ----------

  onData(code, conn, d) {
    if (!d || typeof d !== 'object') return;
    const st = this.slot(code);
    const friend = this.friends.find(f => f.code === code);
    switch (d.t) {
      case 'req': {
        const name = clean(d.name);
        if (friend || this.pending.includes(code)) {
          this.addFriend(code, name);
          conn.send({ t: 'acc', name: this.cb.getName() });
        } else if (!this.incoming.some(r => r.code === code)) {
          this.incoming.push({ code, name });
          this.save();
          this.toast(`${name} veut t’ajouter en ami.`, [
            { label: 'ACCEPTER', fn: () => this.accept(code) },
            { label: 'REFUSER', fn: () => this.decline(code) }
          ]);
        }
        this.render();
        break;
      }
      case 'acc':
        if (this.pending.includes(code)) this.addFriend(code, clean(d.name));
        break;
      case 'dec':
        if (this.pending.includes(code)) {
          this.pending = this.pending.filter(c => c !== code);
          this.save(); this.render();
          this.toast('Une demande d’ami a été refusée.');
        }
        break;
      case 'rm':
        if (friend) { this.friends = this.friends.filter(f => f.code !== code); this.save(); this.render(); }
        break;
      case 'hello':
        if (friend) { friend.name = clean(d.name); this.save(); this.sendStatus(conn); this.render(); }
        break;
      case 'status': {
        if (!friend) break;
        const was = st.status;
        friend.name = clean(d.name);
        st.status = { room: d.room || null, count: +d.count || 0, open: !!d.open, ingame: !!d.ingame };
        st.seen = Date.now();
        this.save();
        this.render();
        const mine = this.presence();
        if (st.status.open && st.status.room && !mine.room && (!was || was.room !== st.status.room)) {
          this.toast(`${friend.name} a ouvert un salon.`, [{ label: 'REJOINDRE', fn: () => this.cb.onJoin(st.status.room) }]);
        }
        break;
      }
      case 'invite':
        if (friend && /^[A-Z0-9]{6}$/.test(d.room || '')) {
          const actions = this.presence().room ? [] : [{ label: 'REJOINDRE', fn: () => this.cb.onJoin(d.room) }];
          this.toast(`${friend.name} t’invite dans son salon.`, actions, 15000);
        }
        break;
    }
  }

  // ---------- Actions ----------

  /** Envoie une demande d'ami à un code. Retourne un message d'erreur ou ''. */
  request(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!validCode(code)) return 'Code invalide : 8 caractères attendus.';
    if (code === this.code) return 'C’est ton propre code !';
    if (this.isFriend(code)) return 'Déjà dans ta liste d’amis.';
    if (!this.pending.includes(code)) this.pending.push(code);
    // Si l'autre m'avait déjà demandé : on accepte directement.
    if (this.incoming.some(r => r.code === code)) { this.accept(code); return ''; }
    this.save();
    this.slot(code).connecting = 0;
    this.tick();
    this.render();
    this.toast('Demande envoyée. Elle sera reçue quand ton ami sera en ligne.');
    return '';
  }

  addFriend(code, name) {
    if (!this.isFriend(code)) {
      this.friends.push({ code, name });
      this.toast(`${name} est maintenant ton ami.`);
    }
    this.pending = this.pending.filter(c => c !== code);
    this.incoming = this.incoming.filter(r => r.code !== code);
    this.save();
    const st = this.slot(code);
    if (st.conn?.open) this.sendStatus(st.conn);
    else this.tick();
    this.render();
  }

  accept(code) {
    const req = this.incoming.find(r => r.code === code);
    this.addFriend(code, req?.name || 'Joueur');
    const st = this.live.get(code);
    if (st?.conn?.open) st.conn.send({ t: 'acc', name: this.cb.getName() });
  }

  decline(code) {
    this.incoming = this.incoming.filter(r => r.code !== code);
    this.save();
    const st = this.live.get(code);
    if (st?.conn?.open) st.conn.send({ t: 'dec' });
    this.render();
  }

  cancelPending(code) {
    this.pending = this.pending.filter(c => c !== code);
    this.save(); this.render();
  }

  remove(code) {
    const st = this.live.get(code);
    if (st?.conn?.open) st.conn.send({ t: 'rm' });
    this.friends = this.friends.filter(f => f.code !== code);
    this.save(); this.render();
  }

  invite(code) {
    const st = this.live.get(code), room = this.presence().room;
    if (!st?.conn?.open || !room) return;
    st.conn.send({ t: 'invite', name: this.cb.getName(), room });
    this.toast('Invitation envoyée.');
  }

  statusOf(code) {
    const st = this.live.get(code);
    if (!st?.conn?.open || !st.status || Date.now() - st.seen > STALE_MS) return null;
    return st.status;
  }

  // ---------- Interface ----------

  toast(text, actions = [], ttl = 9000) {
    const el = document.createElement('div');
    el.className = 'toast';
    const p = document.createElement('span');
    p.textContent = text;
    el.appendChild(p);
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => { el.remove(); a.fn(); };
      el.appendChild(b);
    }
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => el.remove(), ttl);
  }

  /** Affiche le panneau d'amis dans `container`. `lobby: true` → boutons INVITER au lieu de REJOINDRE. */
  mount(container, { lobby = false } = {}) {
    const ic = name => `<svg class="ic"><use href="#i-${name}"/></svg>`;
    container.innerHTML = `
      <div class="fr-me">
        <span class="fr-me-label">${ic('user-round')}<small>TON CODE</small></span>
        <b>${this.code}</b>
        <button class="fr-icon" type="button" data-copy title="Copier mon code" aria-label="Copier mon code">${ic('copy')}</button>
        <span class="fr-info" tabindex="0" role="img" title="Ton code et ta liste d’amis sont enregistrés sur cet appareil. Sur un nouvel ordinateur, partage ton nouveau code et ajoute tes amis à nouveau. Les codes de salon sont temporaires : l’hôte doit être en ligne." aria-label="Ton code et ta liste d’amis sont enregistrés sur cet appareil. Sur un nouvel ordinateur, partage ton nouveau code et ajoute tes amis à nouveau. Les codes de salon sont temporaires : l’hôte doit être en ligne.">${ic('info')}</span>
      </div>
      <div class="fr-add">
        <input maxlength="8" placeholder="CODE D’UN AMI" aria-label="Code d’un ami" autocomplete="off" spellcheck="false" />
        <button type="button" data-add title="Ajouter" aria-label="Ajouter un ami">${ic('user-plus')}</button>
      </div>
      <p class="fr-note" role="status"></p>
      <div class="fr-head"><span class="fr-count"></span></div>
      <div class="fr-list"></div>`;
    const input = container.querySelector('input');
    const note = container.querySelector('.fr-note');
    const add = () => {
      note.textContent = this.request(input.value);
      if (!note.textContent) input.value = '';
    };
    container.querySelector('[data-add]').onclick = add;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
    container.querySelector('[data-copy]').onclick = () =>
      navigator.clipboard?.writeText(this.code).then(() => this.toast('Code ami copié.'));
    this.mounts.push({ container, lobby });
    this.render();
  }

  render() {
    for (const { container, lobby } of this.mounts) {
      const list = container.querySelector('.fr-list');
      const note = container.querySelector('.fr-note');
      const countEl = container.querySelector('.fr-count');
      if (!list) continue;

      if (this.peerState === 'busy' && !note.textContent) note.textContent = 'Ton code ami est déjà utilisé dans un autre onglet.';
      else if (this.peerState === 'error' && !note.textContent) note.textContent = 'Service d’amis indisponible. Nouvelle tentative…';
      else if (this.peerState === 'ok' && /indisponible|autre onglet/.test(note.textContent)) note.textContent = '';

      const rows = [];
      const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      };
      const button = (icon, title, fn, cls = '', text = '') => {
        const b = el('button', cls);
        b.type = 'button';
        b.title = title;
        b.setAttribute('aria-label', title);
        b.innerHTML = `<svg class="ic"><use href="#i-${icon}"/></svg>${text ? `<span>${text}</span>` : ''}`;
        b.onclick = fn;
        return b;
      };

      // Demandes reçues
      for (const r of this.incoming) {
        const row = el('div', 'fr-row req');
        row.append(el('span', 'fr-dot'), this.nameCell(r.name, 'DEMANDE D’AMI'));
        const acts = el('div', 'fr-acts');
        acts.append(button('check', 'Accepter', () => this.accept(r.code), 'ok'), button('x', 'Refuser', () => this.decline(r.code), 'no'));
        row.appendChild(acts);
        rows.push(row);
      }

      // Amis, triés : salon ouvert > en ligne > hors ligne
      let online = 0;
      const list2 = this.friends.map(f => ({ f, s: this.statusOf(f.code) }));
      const rank = x => (x.s?.open ? 0 : x.s ? 1 : 2);
      list2.sort((a, b) => rank(a) - rank(b) || a.f.name.localeCompare(b.f.name));
      for (const { f, s } of list2) {
        if (s) online++;
        const row = el('div', 'fr-row' + (s ? ' on' : ''));
        let label = 'HORS LIGNE';
        if (s) label = s.ingame ? 'EN PARTIE' : s.room ? `DANS UN SALON · ${s.count}` : 'EN LIGNE';
        row.append(el('span', 'fr-dot' + (s?.ingame ? ' busy' : s ? ' on' : '')), this.nameCell(f.name, label));
        const acts = el('div', 'fr-acts');
        if (!lobby && s?.open && s.room) acts.append(button('log-in', 'Rejoindre le salon', () => this.cb.onJoin(s.room), 'join', 'REJOINDRE'));
        if (lobby && s && !s.ingame) acts.append(button('send', 'Inviter', () => this.invite(f.code), 'join', 'INVITER'));
        acts.append(button('x', 'Retirer de mes amis', () => { if (confirm(`Retirer ${f.name} de tes amis ?`)) this.remove(f.code); }, 'no'));
        row.appendChild(acts);
        rows.push(row);
      }

      // Demandes envoyées
      for (const code of this.pending) {
        const row = el('div', 'fr-row pend');
        row.append(el('span', 'fr-dot'), this.nameCell(code, 'DEMANDE EN ATTENTE'));
        const acts = el('div', 'fr-acts');
        acts.append(button('x', 'Annuler la demande', () => this.cancelPending(code), 'no'));
        row.appendChild(acts);
        rows.push(row);
      }

      if (!rows.length) rows.push(el('p', 'fr-empty', 'Aucun ami pour l’instant. Échange ton code avec tes amis !'));
      list.replaceChildren(...rows);
      countEl.textContent = `${online} EN LIGNE`;
    }
  }

  nameCell(name, sub) {
    const d = document.createElement('div');
    d.className = 'fr-name';
    const a = document.createElement('b'); a.textContent = name;
    const b = document.createElement('small'); b.textContent = sub;
    d.append(a, b);
    return d;
  }
}
