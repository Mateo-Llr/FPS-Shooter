import './style.css';
import './progress.css';
import { Lobby } from './ui/lobby.js';
import { Network } from './network/peer.js';
import { Game } from './game/game.js';
import { Roster } from './ui/roster.js';
import { Friends } from './ui/friends.js';
import { SettingsUI } from './ui/settings.js';
import { CustomizationUI } from './ui/customization.js';
import { GamepadNavigator } from './game/gamepad.js';
import { ProgressUI } from './ui/progress.js';
import { ShopUI } from './ui/shop.js';
import { editorEnabled, initializeEditorAssets } from './editor/editor-bridge.js';

function bootstrap() {
  const network = new Network();
  const settingsUI = new SettingsUI();
  const game = new Game(document.querySelector('#game-canvas'), network);
  const friends = new Friends();
  const lobby = new Lobby(network, game, friends);
  new CustomizationUI(document.querySelector('#customization-panel'));
  new ProgressUI({
    wallet: document.querySelector('#wallet'),
    quests: document.querySelector('#quests-panel'),
    achievements: document.querySelector('#achievements-panel')
  });
  new ShopUI(document.querySelector('#shop-panel'));

  new Roster(friends);
  lobby.init();
  if (editorEnabled) {
    import('./editor/asset-editor.js')
      .then(({ AssetEditor }) => new AssetEditor())
      .catch(error => {
        console.error('Échec du chargement de l’éditeur 3D :', error);
        document.querySelector('#menu-status').textContent = `Éditeur 3D indisponible : ${error.message}`;
      });
  }

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

  // Menu Jouer : amis connectés + salons à rejoindre en un clic.
  const playFriends = document.querySelector('#friends-play');
  const playPanel = document.querySelector('#play-friends');
  if (playFriends && playPanel) {
    friends.mount(playFriends, { compact: true });
    const count = document.querySelector('#pf-count');
    const refreshPlayFriends = () => {
      const online = [...playFriends.querySelectorAll('.fr-row')]
        .filter(row => row.querySelector('.fr-dot.on, .fr-dot.busy'));
      const joinable = online.filter(row => row.querySelector('.join:not(:disabled)')).length;
      count.textContent = joinable
        ? `${joinable} SALON${joinable > 1 ? 'S' : ''} OUVERT${joinable > 1 ? 'S' : ''} · ${online.length} EN LIGNE`
        : `${online.length} EN LIGNE`;
      playPanel.classList.toggle('empty', online.length === 0);
      playPanel.classList.toggle('live', joinable > 0);
    };
    new MutationObserver(refreshPlayFriends).observe(playFriends, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled']
    });
    refreshPlayFriends();
  }
  document.querySelectorAll('[data-goto]').forEach(button => {
    button.onclick = () => menuTabs.find(tab => tab.dataset.tab === button.dataset.goto)?.click();
  });

  settingsUI.mountInline(document.querySelector('#menu-settings-panel'));
  document.querySelector('#open-settings-lobby').onclick = () => settingsUI.open();
  game.onOpenSettings = () => settingsUI.open();

  window.addEventListener('beforeunload', () => network.destroy());
}

initializeEditorAssets().then(bootstrap).catch(error => {
  console.error('Échec du chargement des ressources du projet :', error);
  document.querySelector('#menu-status').textContent = `Impossible de charger les ressources : ${error.message}`;
});
