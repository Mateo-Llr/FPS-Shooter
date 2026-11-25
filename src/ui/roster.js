// Liste des joueurs du salon, façon Counter-Strike.
// Fonctionne seul (lecture du DOM du salon) ; pour des données exactes :
//   window.clashRoster.set([{ name: 'Alice', host: true, me: true }, { name: 'Bob' }])

const CSS = `
#roster{margin:6px 0 22px;border:1px solid #39464e;background:#0f161b}
#roster .r-head{display:flex;justify-content:space-between;padding:8px 14px;font:800 11px Inter,Arial,sans-serif;letter-spacing:.2em;color:#8a98a0;border-bottom:1px solid #39464e}
#roster .r-row{display:flex;align-items:center;gap:14px;padding:11px 14px;border-bottom:1px solid #222d34;animation:r-in .25s ease}
#roster .r-row:last-child{border-bottom:0}
#roster .r-row.me{background:rgba(240,120,69,.12)}
#roster .r-row.empty{color:#5d6b72;font:600 13px Inter,Arial,sans-serif;letter-spacing:.1em;border-left:3px dashed #39464e}
#roster .r-av{width:34px;height:34px;display:grid;place-items:center;background:#2b3943;border:1px solid #4a5a64;font:900 18px 'Barlow Condensed',Arial,sans-serif;color:#f4f3ee}
#roster .me .r-av{background:#c8602f;border-color:#f07845}
#roster .r-name{flex:1;font:800 20px 'Barlow Condensed',Arial,sans-serif;letter-spacing:.05em;text-align:left}
#roster .r-tag{font:800 10px Inter,Arial,sans-serif;letter-spacing:.14em;padding:3px 7px;background:#f07845;color:#10151a;margin-left:8px;vertical-align:middle}
#roster .r-tag.you{background:#3a4b55;color:#e6ecef}
#roster .r-state{font:700 11px Inter,Arial,sans-serif;letter-spacing:.14em;color:#7fe08a}
#roster .r-state::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#7fe08a;margin-right:7px;box-shadow:0 0 8px #7fe08a}
@keyframes r-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Roster {
  constructor() {
    const panel = document.querySelector('#lobby .lobby-panel');
    const ref = document.querySelector('#host-settings');
    if (!panel || !ref) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.el = document.createElement('div');
    this.el.id = 'roster';
    panel.insertBefore(this.el, ref);

    this.manual = null;
    this.sig = '';
    window.clashRoster = this;
    setInterval(() => this.render(), 400);
    this.render();
  }

  set(players) {
    this.manual = players;
    this.render();
  }

  /** Déduit les joueurs à partir du DOM du salon. */
  guess() {
    const $ = s => document.querySelector(s);
    const name = ($('#nickname')?.value || '').trim() || 'Joueur';
    const isHost = !$('#host-settings')?.classList.contains('hidden');
    const status = $('#lobby-status')?.textContent || '';
    const joined = !$('#start-game')?.disabled || (/connect|rejoint|prêt/i.test(status) && !/attente|partage/i.test(status));
    const me = { name, host: isHost, me: true };
    return isHost ? [me, joined && { name: 'Adversaire' }] : [{ name: 'Hôte', host: true }, me];
  }

  render() {
    if (!this.el) return;
    const players = (this.manual ?? this.guess()).filter(Boolean).slice(0, 2);
    const sig = JSON.stringify(players);
    if (sig === this.sig) return;
    this.sig = sig;

    const rows = players.map(p => `
      <div class="r-row${p.me ? ' me' : ''}">
        <div class="r-av">${esc((p.name || '?')[0].toUpperCase())}</div>
        <div class="r-name">${esc(p.name)}${p.host ? '<span class="r-tag">HÔTE</span>' : ''}${p.me ? '<span class="r-tag you">TOI</span>' : ''}</div>
        <div class="r-state">PRÊT</div>
      </div>`);
    while (rows.length < 2) rows.push('<div class="r-row empty">EN ATTENTE D’UN JOUEUR…</div>');

    this.el.innerHTML = `<div class="r-head"><span>JOUEURS</span><span>${players.length} / 2</span></div>${rows.join('')}`;
  }
}
