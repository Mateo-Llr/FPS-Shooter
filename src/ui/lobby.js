import { MSG, MAX_PLAYERS } from '../network/protocol.js';

const $ = s => document.querySelector(s);

/** Salon : 2 à 16 joueurs. L'hôte (id 0) tient la liste et la diffuse. */
export class Lobby {
  constructor(network, game) {
    this.network = network;
    this.game = game;
    this.players = [];   // [{ id, name }] — id réseau (0 = hôte)
    this.me = 0;
    this.started = false;
  }

  init() {
    const n = this.network;
    $('#create-room').onclick = () => this.create();
    $('#join-room').onclick = () => this.join();
    $('#room-code').addEventListener('keydown', e => { if (e.key === 'Enter') this.join(); });
    $('#copy-code').onclick = () => navigator.clipboard?.writeText(n.roomCode).then(() => this.status('Code copié.'));
    $('#leave-lobby').onclick = () => this.leave();
    $('#win-mode').onchange = () => this.syncSettings();
    $('#start-game').onclick = () => this.startGame();
    this.syncSettings();

    n.on(MSG.HELLO, d => this.onHello(d));
    n.on(MSG.ROSTER, d => this.onRoster(d));
    n.on(MSG.START, d => this.begin(d.config, d.you, d.names));
    n.on('peer-left', d => { if (!this.started && n.isHost) { this.players = this.players.filter(p => p.id !== d.id); this.publish(); } });
    n.on('disconnected', () => { if (!this.started && !n.isHost) this.leave('Connexion avec l’hôte perdue.'); });
    n.on('error', m => this.status(m));
  }

  nickname() { return ($('#nickname').value || '').trim().slice(0, 16) || 'Joueur'; }

  status(text, el = '#lobby-status') {
    const e = $(el); if (e) e.textContent = text;
    if ($('#menu') && !$('#menu').classList.contains('hidden')) $('#menu-status').textContent = text;
  }

  show(lobby) {
    $('#menu').classList.toggle('hidden', lobby);
    $('#lobby').classList.toggle('hidden', !lobby);
    $('#host-settings').classList.toggle('hidden', !this.network.isHost);
  }

  async create() {
    try {
      this.status('Création du salon…');
      await this.network.createRoom();
      this.me = 0;
      this.players = [{ id: 0, name: this.nickname() }];
      $('#display-code').textContent = this.network.roomCode;
      this.show(true);
      this.render();
    } catch (e) { this.status(e.message); }
  }

  async join() {
    try {
      this.status('Connexion…');
      await this.network.joinRoom($('#room-code').value);
      this.network.send(MSG.HELLO, { name: this.nickname() });
      $('#display-code').textContent = this.network.roomCode;
      this.players = [];
      this.show(true);
      this.status('Connecté. En attente de l’hôte…');
    } catch (e) { this.status(e.message); }
  }

  onHello(d) {
    if (!this.network.isHost) {
      if (d.refused) this.leave('Salon complet ou partie en cours.');
      return;
    }
    if (this.started || this.players.length >= MAX_PLAYERS) return;
    let name = String(d.name || 'Joueur').slice(0, 16), k = 2;
    const base = name;
    while (this.players.some(p => p.name === name)) name = `${base} ${k++}`;
    this.players = this.players.filter(p => p.id !== d.from).concat({ id: d.from, name });
    this.publish();
  }

  publish() {
    this.players.sort((a, b) => a.id - b.id);
    for (const p of this.players) if (p.id !== 0) this.network.sendTo(p.id, MSG.ROSTER, { players: this.players, you: p.id });
    this.render();
  }

  onRoster(d) {
    if (this.started || !Array.isArray(d.players)) return;
    this.players = d.players;
    this.me = d.you;
    this.render();
  }

  render() {
    const n = this.players.length;
    window.clashRoster?.set(this.players.map(p => ({ name: p.name, host: p.id === 0, me: p.id === this.me })));
    const start = $('#start-game');
    start.disabled = n < 2;
    this.status(this.network.isHost
      ? (n < 2 ? 'Partage ce code avec tes amis (jusqu’à 16 joueurs).' : `${n} joueurs connectés. Lance la partie quand tout le monde est là.`)
      : `${n} joueur${n > 1 ? 's' : ''} dans le salon. L’hôte va lancer la partie…`);
  }

  syncSettings() {
    const time = $('#win-mode').value === 'time';
    $('#target-wrap').classList.toggle('hidden', time);
    $('#duration-wrap').classList.toggle('hidden', !time);
  }

  startGame() {
    if (!this.network.isHost || this.players.length < 2) return;
    const config = {
      mode: $('#win-mode').value,
      target: +$('#target-kills').value,
      duration: +$('#duration').value,
      weapon: $('#weapon-rule').value
    };
    // Les ids réseau peuvent avoir des trous (joueur parti) : names[id] = null pour les absents.
    const names = [];
    for (const p of this.players) names[p.id] = p.name;
    for (let i = 0; i < names.length; i++) names[i] ??= null;
    this.network.locked = true;
    for (const p of this.players) if (p.id !== 0) this.network.sendTo(p.id, MSG.START, { config, names, you: p.id });
    this.begin(config, 0, names);
  }

  begin(config, you, names) {
    this.started = true;
    this.game.start(config, you, names);
  }

  leave(message) {
    this.network.destroy();
    this.players = [];
    this.started = false;
    window.clashRoster?.set(null);
    this.show(false);
    this.status(message || 'Prêt à jouer ? Invite des amis.', '#menu-status');
  }
}
