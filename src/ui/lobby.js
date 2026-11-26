import { MSG, MAX_PLAYERS } from '../network/protocol.js';
import { APPEARANCE_OPTIONS, getAppearance, normalizeAppearance } from '../game/customization.js';
import { DEFAULT_MAP_ID, getMap, MAPS } from '../game/world.js';
import { BOT_LEVEL_DEFAULT, BOT_LEVEL_MAX, BOT_LEVEL_MIN, BOT_NAMES, clampBotLevel } from '../game/bots.js';

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

/** Apparence aléatoire pour un bot (une option au hasard par catégorie). */
const randomAppearance = () => normalizeAppearance(Object.fromEntries(
  Object.entries(APPEARANCE_OPTIONS)
    .filter(([, options]) => Array.isArray(options) && options.length)
    .map(([category, options]) => [category, options[Math.floor(Math.random() * options.length)].id])
));

/** Salon : 2 à 16 joueurs. L'hôte (id 0) tient la liste et la diffuse. */
export class Lobby {
  constructor(network, game, friends = null) {
    this.network = network;
    this.game = game;
    this.friends = friends;
    this.inRoom = false;
    this.players = [];   // [{ id, name }] — id réseau (0 = hôte)
    this.me = 0;
    this.selectedMap = DEFAULT_MAP_ID;
    this.started = false;
    this.postGame = false;
    this.kickReason = '';
    this.replayVotes = new Set();
    this.game.onFinish = () => this.onGameFinished();
    this.game.onReplayVote = () => this.toggleReplayVote();
    this.game.onReplayConfirm = () => this.confirmReplay();
  }

  syncMap() {
    const map = getMap(this.selectedMap);
    $('#map-description').textContent = map.description;
    window.clashRoster?.setMap(map);
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
    $('#game-mode').onchange = () => this.syncSettings();
    const mapSelect = $('#map-select');
    mapSelect.replaceChildren(...MAPS.map(map => {
      const option = document.createElement('option');
      option.value = map.id;
      option.textContent = map.name;
      return option;
    }));
    mapSelect.value = this.selectedMap;
    mapSelect.onchange = () => {
      if (!this.network.isHost) return;
      this.selectedMap = getMap(mapSelect.value).id;
      this.syncMap();
      this.publish();
    };
    this.mountBotControls();
    $('#start-game').onclick = () => this.startGame();
    this.syncMap();
    this.syncSettings();

    n.on(MSG.HELLO, d => this.onHello(d));
    n.on(MSG.ROSTER, d => this.onRoster(d));
    n.on(MSG.START, d => this.begin(d.config, d.you, d.names, d.appearances));
    n.on(MSG.REPLAY, d => this.onReplay(d));
    n.on(MSG.KICK, () => {
      if (n.isHost || this.started) return;
      this.kickReason = 'Tu as été expulsé du salon.';
      this.leave(this.kickReason);
    });
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
    n.on('disconnected', () => {
      if (this.kickReason) { this.kickReason = ''; return; }
      if (!this.started && !n.isHost) this.leave('Connexion avec l’hôte perdue.');
    });
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
    this.syncBotButton();
  }

  async create() {
    try {
      this.kickReason = '';
      this.status('Création du salon…');
      await this.network.createRoom();
      this.me = 0;
      this.players = [{
        id: 0, name: this.nickname(), appearance: getAppearance(),
        friendCode: this.friends?.code || null
      }];
      $('#display-code').textContent = this.network.roomCode;
      this.show(true);
      this.render();
    } catch (e) { this.status(e.message); }
  }

  async join() {
    try {
      this.kickReason = '';
      this.status('Connexion…');
      await this.network.joinRoom($('#room-code').value);
      this.network.send(MSG.HELLO, {
        name: this.nickname(),
        appearance: getAppearance(),
        friendCode: this.friends?.code || null
      });
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
    this.players = this.players.filter(p => p.id !== d.from).concat({
      id: d.from,
      name,
      appearance: normalizeAppearance(d.appearance),
      friendCode: typeof d.friendCode === 'string' && /^[A-HJ-NP-Z2-9]{8}$/.test(d.friendCode)
        ? d.friendCode
        : null
    });
    this.publish();
  }

  publish() {
    this.players.sort((a, b) => a.id - b.id);
    for (const p of this.players) if (p.id !== 0) {
      this.network.sendTo(p.id, MSG.ROSTER, { players: this.players, you: p.id, map: this.selectedMap });
    }
    this.render();
  }

  onRoster(d) {
    if (this.started || !Array.isArray(d.players)) return;
    this.players = d.players;
    this.me = d.you;
    this.selectedMap = getMap(d.map).id;
    $('#map-select').value = this.selectedMap;
    this.syncMap();
    this.render();
  }

  render() {
    const n = this.players.length;
    this.friends?.push();
    window.clashRoster?.set(
      this.players.map(p => ({
        id: p.id, name: p.name, host: p.id === 0, me: p.id === this.me, bot: !!p.bot,
        level: p.bot ? clampBotLevel(p.level) : null,
        appearance: p.appearance,
        friendCode: p.friendCode,
        friend: !!p.friendCode && !!this.friends?.isFriend(p.friendCode),
        pending: !!p.friendCode && !!this.friends?.pending.includes(p.friendCode)
      })),
      this.network.isHost,
      id => this.kickPlayer(id),
      // Bots : le roster affiche une case « niveau » (min–max) par bot ; l'hôte la modifie via onBotLevel(id, niveau).
      { onBotLevel: (id, level) => this.setBotLevel(id, level), minLevel: BOT_LEVEL_MIN, maxLevel: BOT_LEVEL_MAX }
    );
    const start = $('#start-game');
    start.disabled = n < 2;
    this.syncBotButton();
    this.status(this.network.isHost
      ? (n < 2 ? 'Partage ce code avec tes amis (jusqu’à 16 joueurs).' : `${n} joueurs connectés. Lance la partie quand tout le monde est là.`)
      : `${n} joueur${n > 1 ? 's' : ''} dans le salon. L’hôte va lancer la partie…`);
  }

  // ---------------------------------------------------------------- bots
  // Un bot est un joueur du salon comme les autres (même liste, mêmes expulsions) : `bot: true`, pas de connexion réseau.

  /** Bouton « Ajouter un bot », dans la colonne de gauche juste avant « Paramètres ». */
  mountBotControls() {
    if ($('#add-bot')) return;
    const anchor = $('#open-settings-lobby');
    if (!anchor) return;
    const button = document.createElement('button');
    button.id = 'add-bot';
    button.type = 'button';
    button.className = anchor.className; // même style que le bouton Paramètres
    button.textContent = '+ AJOUTER UN BOT';
    button.onclick = () => this.addBot();
    anchor.before(button);
    this.syncBotButton();
  }

  /** Visible pour l'hôte seulement ; grisé quand le salon est plein. */
  syncBotButton() {
    const button = $('#add-bot');
    if (!button) return;
    button.classList.toggle('hidden', !this.network.isHost);
    button.disabled = this.players.length >= MAX_PLAYERS;
  }

  /** Niveau d'un bot (1 à 10), modifiable par l'hôte avant le lancement. */
  setBotLevel(id, level) {
    const bot = this.players.find(p => p.id === id && p.bot);
    if (!this.network.isHost || this.started || !bot) return;
    bot.level = clampBotLevel(level);
    this.publish();
  }

  addBot() {
    const n = this.network;
    if (!n.isHost || this.started || this.postGame || this.players.length >= MAX_PLAYERS) return;
    // Ids pris par le haut (15, 14…) : les invités reçoivent les plus petits ids libres.
    const taken = new Set([0, ...this.players.map(p => p.id), ...n.conns.keys(), ...n.reserved]);
    let id = MAX_PLAYERS - 1;
    while (id > 0 && taken.has(id)) id--;
    if (id <= 0) return;
    const used = new Set(this.players.map(p => p.name));
    const base = BOT_NAMES.map(name => `${name} (BOT)`).filter(name => !used.has(name));
    const pool = base.length ? base : [`Bot ${id} (BOT)`];
    n.reserved.add(id);
    this.players.push({
      id,
      name: pool[Math.floor(Math.random() * pool.length)],
      appearance: randomAppearance(),
      friendCode: null,
      bot: true,
      level: BOT_LEVEL_DEFAULT
    });
    this.publish();
  }

  removeBot(id) {
    this.network.reserved.delete(id);
    this.players = this.players.filter(p => p.id !== id);
    this.publish();
  }

  kickPlayer(id) {
    if (!this.network.isHost || this.started || id === this.me ||
      !this.players.some(player => player.id === id)) return;
    const player = this.players.find(p => p.id === id);
    if (player.bot) { this.removeBot(id); return; }
    if (confirm(`Expulser ${player.name} du salon ?`)) this.network.kick(id);
  }

  syncSettings() {
    const mode = $('#game-mode').value;
    const classic = mode === 'deathmatch';
    const time = classic && $('#win-mode').value === 'time';
    $('#win-mode-wrap').classList.toggle('hidden', !classic);
    $('#target-wrap').classList.toggle('hidden', !classic || time);
    $('#duration-wrap').classList.toggle('hidden', !classic || !time);
    $('#flag-time-wrap').classList.toggle('hidden', mode !== 'flag');
    $('#flag-size-wrap').classList.toggle('hidden', mode !== 'flag');
    $('#bomb-time-wrap').classList.toggle('hidden', mode !== 'bomb');
    $('#crown-time-wrap').classList.toggle('hidden', mode !== 'crown');
    // Mode bombe : couteau uniquement, le choix d'arsenal n'a pas de sens.
    $('#weapon-rule-wrap').classList.toggle('hidden', mode === 'bomb');
  }

  startGame() {
    if (!this.network.isHost || this.players.length < 2) return;
    const config = {
      gameMode: $('#game-mode').value,
      mode: $('#win-mode').value,
      target: +$('#target-kills').value,
      duration: +$('#duration').value,
      weapon: $('#weapon-rule').value,
      flagSeconds: +$('#flag-time').value,
      flagRadius: +$('#flag-size').value,
      bombSeconds: +$('#bomb-time').value,
      crownSeconds: +$('#crown-time').value,
      map: this.selectedMap
    };
    this.launchGame(config, this.players);
  }

  launchGame(config, players) {
    // Les ids réseau peuvent avoir des trous (joueur parti) : names[id] = null pour les absents.
    const names = [];
    const appearances = [];
    for (const p of players) names[p.id] = p.name;
    for (const p of players) appearances[p.id] = p.appearance || null;
    for (let i = 0; i < names.length; i++) {
      names[i] ??= null;
      appearances[i] ??= null;
    }
    this.network.locked = true;
    config = { ...config, bots: players.filter(p => p.bot).map(p => ({ id: p.id, level: clampBotLevel(p.level) })) };
    for (const p of players) if (p.id !== 0 && !p.bot) {
      this.network.sendTo(p.id, MSG.START, { config, names, appearances, you: p.id });
    }
    this.begin(config, 0, names, appearances);
  }

  begin(config, you, names, appearances) {
    this.postGame = false;
    this.replayVotes.clear();
    this.started = true;
    this.friends?.push();
    this.selectedMap = getMap(config.map).id;
    this.syncMap();
    this.game.start({ ...config, map: this.selectedMap }, you, names, appearances);
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
      p.bot || (this.replayVotes.has(p.id) && (p.id === 0 || this.network.conns.get(p.id)?.open))
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