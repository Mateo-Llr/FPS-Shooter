import './style.css';
import { Lobby } from './ui/lobby.js';
import { Network } from './network/peer.js';
import { Game } from './game/game.js';
import { Roster } from './ui/roster.js';

const network = new Network();
const game = new Game(document.querySelector('#game-canvas'), network);
const lobby = new Lobby(network, game);

lobby.init();
new Roster();
window.addEventListener('beforeunload', () => network.destroy());