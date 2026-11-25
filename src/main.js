import './style.css';
import { Lobby } from './ui/lobby.js';
import { Network } from './network/peer.js';
import { Game } from './game/game.js';
import { Roster } from './ui/roster.js';
import { Friends } from './ui/friends.js';
import { SettingsUI } from './ui/settings.js';
import { CustomizationUI } from './ui/customization.js';
import { GamepadNavigator } from './game/gamepad.js';

const network = new Network();
const settingsUI = new SettingsUI();
const game = new Game(document.querySelector('#game-canvas'), network);
const friends = new Friends();
const lobby = new Lobby(network, game, friends);
new CustomizationUI(document.querySelector('#customization-panel'));

new Roster(friends);
lobby.init();

const gamepadNavigator = new GamepadNavigator(() =>
  !document.querySelector('#game')?.classList.contains('hidden') ||
  !!document.querySelector('#settings.show') ||
  !!document.querySelector('#lobby:not(.hidden)') ||
  !!document.querySelector('#menu:not(.hidden)')
);
const navigateMenus = () => {
  gamepadNavigator.update();
  requestAnimationFrame(navigateMenus);
};
navigateMenus();

const menuTabs = [...document.querySelectorAll('.menu-tab')];
const menuViews = [...document.querySelectorAll('.menu-view')];
menuTabs.forEach(tab => {
  tab.onclick = () => {
    menuTabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    menuViews.forEach(view => {
      const active = view.dataset.view === tab.dataset.tab;
      view.classList.toggle('hidden', !active);
      view.classList.toggle('active', active);
    });
  };
});

const previewName = document.querySelector('#custom-preview-name');
const nickname = document.querySelector('#nickname');
const updatePreviewName = () => { previewName.textContent = (nickname.value.trim() || 'TON AGENT').toUpperCase(); };
nickname.addEventListener('input', updatePreviewName);
updatePreviewName();

friends.attach({
  getName: () => lobby.nickname(),
  getPresence: () => lobby.presence(),
  onJoin: code => lobby.joinCode(code)
});
friends.mount(document.querySelector('#friends-menu'));
const lobbyFriends = document.querySelector('#friends-lobby');
if (lobbyFriends) friends.mount(lobbyFriends, { lobby: true });

settingsUI.mountInline(document.querySelector('#menu-settings-panel'));
document.querySelector('#open-settings-lobby').onclick = () => settingsUI.open();
game.onOpenSettings = () => settingsUI.open();

window.addEventListener('beforeunload', () => network.destroy());
