import { MSG, MAX_PLAYERS } from '../network/protocol.js';

const $ = s => document.querySelector(s);
const NICKNAME_KEY = 'clash.nickname';

const getStoredNickname = () => {
  try {
    return (localStorage.getItem(NICKNAME_KEY) || '').trim().slice(0, 16);
  } catch {
    return '';
  }
};

const storeNickname = nickname => {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // Le pseudo reste utilisable même si le stockage est indisponible.
  }
};

/** Salon : 2 à 16 joueurs. L'hôte (id 0) tient la liste et la diffuse. */
export class Lobby {
  constructor(network, game, friends = null) {
    this.network = network;
    this.game = game;
    this.friends = friends;
    this.inRoom = false;
    this.players = [];   // [{ id, name }] — id réseau (0 = hôte)
    this.me = 0;
    this.started = false;
    this.postGame = false;
    this.replayVotes = new Set();
    this.game.onFinish = () => this.onGameFinished();
    this.game.onReplayVote = () => this.toggleReplayVote();
    this.game.onReplayConfirm = () => this.confirmReplay();
  }

  init() {
    const n = this.network;
    const nicknameInput = $('#nickname');
    const savedNickname = getStoredNickname();
    if (savedNickname) nicknameInput.value = savedNickname;
    nicknameInput.addEventListener('input', () => {
      const nickname = nicknameInput.value.trim().slice(0, 16);
      if (nickname) storeNickname(nickname);
    });
    nicknameInput.addEventListener('change', () => this.nickname());
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
    n.on(MSG.REPLAY, d => this.onReplay(d));
    n.on('peer-left', d => {
      if (!n.isHost) return;
      if (this.postGame) {
        this.players = this.players.filter(p => p.id !== d.id);
        this.replayVotes.delete(d.id);
        this.broadcastReplayState();
      } else if (!this.started) {
        this.players = this.players.filter(p => p.id !== d.id);
        this.publish();
      }
    });
    n.on('disconnected', () => { if (!this.started && !n.isHost) this.leave('Connexion avec l’hôte perdue.'); });
    n.on('error', m => this.status(m));
  }

  /** État envoyé aux amis : salon ouvert / en partie. */
  presence() {
    const n = this.network;
    return {
      room: this.inRoom ? n.roomCode : null,
      count: this.players.length,
      open: this.inRoom && !this.started && !n.locked && this.players.length < MAX_PLAYERS,
      ingame: this.started
    };
  }

  /** Rejoint un salon à partir d'un code (invitation d'un ami). */
  joinCode(code) {
    if (this.inRoom || this.started) return;
    $('#room-code').value = String(code || '').toUpperCase();
    this.join();
  }

  nickname() {
    const nickname = ($('#nickname').value || '').trim().slice(0, 16);
    if (nickname) storeNickname(nickname);
    return nickname || 'Joueur';
  }

  status(text, el = '#lobby-status') {
    const e = $(el); if (e) e.textContent = text;
    if ($('#menu') && !$('#menu').classList.contains('hidden')) $('#menu-status').textContent = text;
  }

  show(lobby) {
    $('#menu').classList.toggle('hidden', lobby);
    $('#lobby').classList.toggle('hidden', !lobby);
    this.inRoom = lobby;
    this.friends?.push();
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
    this.friends?.push();
    window.clashRoster?.set(
      this.players.map(p => ({ id: p.id, name: p.name, host: p.id === 0, me: p.id === this.me })),
      this.network.isHost
    );
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
    this.launchGame(config, this.players);
  }

  launchGame(config, players) {
    // Les ids réseau peuvent avoir des trous (joueur parti) : names[id] = null pour les absents.
    const names = [];
    for (const p of players) names[p.id] = p.name;
    for (let i = 0; i < names.length; i++) names[i] ??= null;
    this.network.locked = true;
    for (const p of players) if (p.id !== 0) this.network.sendTo(p.id, MSG.START, { config, names, you: p.id });
    this.begin(config, 0, names);
  }

  begin(config, you, names) {
    this.postGame = false;
    this.replayVotes.clear();
    this.started = true;
    this.friends?.push();
    this.game.start(config, you, names);
  }

  onGameFinished() {
    if (!this.inRoom || !this.started || !this.network.connected) return false;
    this.started = false;
    this.postGame = true;
    this.players = this.players.filter(p => this.game.ids.includes(p.id));
    this.replayVotes.clear();
    this.broadcastReplayState();
    this.friends?.push();
    return true;
  }

  toggleReplayVote() {
    if (!this.postGame) return;
    if (this.network.isHost) {
      if (this.replayVotes.has(0)) this.replayVotes.delete(0);
      else this.replayVotes.add(0);
      this.broadcastReplayState();
      return;
    }

    const voted = !this.replayVotes.has(this.me);
    if (voted) this.replayVotes.add(this.me);
    else this.replayVotes.delete(this.me);
    this.game.updateReplayState([...this.replayVotes]);
    this.network.send(MSG.REPLAY, { action: 'vote', voted });
  }

  onReplay(d) {
    if (!this.postGame) return;
    if (this.network.isHost) {
      if (d.action !== 'vote' || !this.players.some(p => p.id === d.from)) return;
      if (d.voted) this.replayVotes.add(d.from);
      else this.replayVotes.delete(d.from);
      this.broadcastReplayState();
      return;
    }
    if (d.action !== 'state' || !Array.isArray(d.votes)) return;
    const eligible = new Set(this.players.map(p => p.id));
    this.replayVotes = new Set(d.votes.filter(id => Number.isInteger(id) && eligible.has(id)));
    this.game.updateReplayState([...this.replayVotes]);
  }

  broadcastReplayState() {
    const votes = [...this.replayVotes];
    this.game.updateReplayState(votes);
    if (this.network.isHost) this.network.send(MSG.REPLAY, { action: 'state', votes });
  }

  confirmReplay() {
    if (!this.network.isHost || !this.postGame || !this.replayVotes.has(0)) return;
    const players = this.players.filter(p =>
      this.replayVotes.has(p.id) && (p.id === 0 || this.network.conns.get(p.id)?.open)
    );
    if (players.length < 2) return;
    this.players = players;
    this.launchGame(this.game.config, players);
  }

  leave(message) {
    this.network.destroy();
    this.players = [];
    this.started = false;
    this.postGame = false;
    this.replayVotes.clear();
    window.clashRoster?.set(null);
    this.show(false);
    this.status(message || 'Prêt à jouer ? Invite des amis.', '#menu-status');
  }
}