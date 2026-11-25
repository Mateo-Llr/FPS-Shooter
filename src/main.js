import './style.css';
import { Lobby } from './ui/lobby.js';
import { Network } from './network/peer.js';
import { Game } from './game/game.js';
import { Roster } from './ui/roster.js';
import { Friends } from './ui/friends.js';
import { SettingsUI } from './ui/settings.js';

const network = new Network();
const settingsUI = new SettingsUI();
const game = new Game(document.querySelector('#game-canvas'), network);
const friends = new Friends();
const lobby = new Lobby(network, game, friends);

new Roster();
lobby.init();

friends.attach({
  getName: () => lobby.nickname(),
  getPresence: () => lobby.presence(),
  onJoin: code => lobby.joinCode(code)
});
friends.mount(document.querySelector('#friends-menu'));
friends.mount(document.querySelector('#friends-lobby'), { lobby: true });

document.querySelector('#open-settings').onclick = () => settingsUI.open();
document.querySelector('#open-settings-lobby').onclick = () => settingsUI.open();
game.onOpenSettings = () => settingsUI.open();

window.addEventListener('beforeunload', () => network.destroy());
