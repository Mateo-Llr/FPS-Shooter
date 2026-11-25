export class Lobby {
  constructor(network, game) { this.network = network; this.game = game; this.$ = s => document.querySelector(s); }
  init() {
    const saved = localStorage.getItem('clash-nickname') || '';
    this.$('#nickname').value = saved;
    this.$('#create-room').onclick = () => this.create();
    this.$('#join-room').onclick = () => this.join();
    this.$('#room-code').addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6));
    this.$('#copy-code').onclick = async () => { try { await navigator.clipboard.writeText(this.network.roomCode); this.$('#copy-code').textContent = 'COPIÉ !'; } catch { this.status('Copie impossible : sélectionne le code manuellement.'); } };
    this.$('#leave-lobby').onclick = () => this.leave();
    this.$('#start-game').onclick = () => this.start();
    this.$('#win-mode').onchange = () => this.toggleRules();
    this.network.on('connected', () => { this.$('#lobby-status').textContent = 'Adversaire connecté. Prêt pour le duel !'; this.$('#start-game').disabled = !this.network.isHost; });
    this.network.on('disconnected', () => this.disconnected());
    this.network.on('error', message => this.status(typeof message === 'string' ? message : 'Erreur réseau.'));
    this.network.on('hello', () => { if (!this.network.isHost) this.network.send('ready', { nickname: this.nickname() }); });
    this.network.on('ready', data => { this.enemyName = data.nickname || 'Adversaire'; this.$('#lobby-status').textContent = `${this.enemyName} est connecté. À toi de lancer !`; this.$('#start-game').disabled = false; });
    this.network.on('start', data => { this.game.start(data.config, false, this.nickname(), this.enemyName || 'Adversaire'); });
    this.toggleRules();
  }
  nickname() {
    const name = this.$('#nickname').value.trim().slice(0,16) || 'Joueur';
    localStorage.setItem('clash-nickname', name); return name;
  }
  status(message) { this.$('#menu-status').textContent = message; }
  async create() {
    try {
      this.nickname(); this.status('Création du salon…');
      await this.network.createRoom();
      this.$('#display-code').textContent = this.network.roomCode;
      this.$('#start-game').disabled = true;
      this.show('lobby');
      this.$('#lobby-status').textContent = 'Partage ce code avec ton ami.';
    } catch (e) { this.status(e.message); }
  }
  async join() {
    try {
      this.nickname(); this.status('Connexion au salon…');
      await this.network.joinRoom(this.$('#room-code').value);
      this.$('#display-code').textContent = this.network.roomCode;
      this.show('lobby'); this.$('#host-settings').classList.add('hidden');
      this.$('#lobby-status').textContent = 'Connecté. En attente du lancement par l’hôte…';
      this.network.send('ready', { nickname: this.nickname() });
    } catch (e) { this.status(e.message); }
  }
  toggleRules() {
    const timed = this.$('#win-mode').value === 'time';
    this.$('#target-wrap').classList.toggle('hidden', timed);
    this.$('#duration-wrap').classList.toggle('hidden', !timed);
  }
  start() {
    if (!this.network.isHost || !this.network.connected) return;
    const config = { mode: this.$('#win-mode').value, target: Number(this.$('#target-kills').value), duration: Number(this.$('#duration').value), weapon: this.$('#weapon-rule').value };
    this.network.send('start', { config });
    this.game.start(config, true, this.nickname(), this.enemyName || 'Adversaire');
  }
  show(screen) {
    ['menu','lobby','game'].forEach(id => this.$('#'+id).classList.toggle('hidden', id !== screen));
  }
  leave() { this.network.destroy(); this.show('menu'); this.$('#host-settings').classList.remove('hidden'); this.status('Tu as quitté le salon.'); }
  disconnected() {
    if (this.$('#game').classList.contains('hidden')) this.$('#lobby-status').textContent = 'Adversaire déconnecté.';
    else this.game.remoteDisconnected();
  }
}