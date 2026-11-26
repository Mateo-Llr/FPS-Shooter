import Peer from 'peerjs';
import { MSG, MAX_PLAYERS, packet, validMessage } from './protocol.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/**
 * Topologie en étoile : l'hôte (joueur 0) est relié à chaque invité (ids 1..15).
 * - hôte : send() diffuse à tous, sendTo(id) cible un invité ; les messages reçus portent `from` (id de l'invité).
 * - invité : send() envoie à l'hôte.
 * Événements locaux : 'peer-joined' / 'peer-left' ({ id }, hôte), 'disconnected' (invité), 'error', 'status'.
 * Plusieurs écouteurs par événement sont possibles (lobby + jeu).
 */
export class Network {
  constructor() {
    this.peer = null; this.conn = null; this.conns = new Map();
    this.isHost = false; this.roomCode = ''; this.connected = false;
    this.locked = false; this.handlers = {};
    this.reserved = new Set(); // ids réservés par l'hôte pour des bots (jamais attribués à un invité)
  }
  on(event, callback) { (this.handlers[event] ||= []).push(callback); }
  emit(event, data) {
    for (const cb of this.handlers[event] || []) {
      try { cb(data); } catch (e) { console.error(e); }
    }
  }

  async createRoom() {
    this.destroyPeer();
    this.isHost = true; this.locked = false;
    this.roomCode = makeCode();
    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.roomCode, { debug: 1 });
      const timeout = setTimeout(() => reject(new Error('Délai dépassé lors de la création du salon.')), 12000);
      this.peer.on('open', id => { clearTimeout(timeout); resolve(id); });
      this.peer.on('connection', conn => this.acceptGuest(conn));
      this.peer.on('error', err => { clearTimeout(timeout); this.emit('error', this.errorText(err)); reject(new Error(this.errorText(err))); });
      this.peer.on('disconnected', () => this.emit('status', 'Signalisation interrompue. Tentative de reconnexion…'));
    });
  }

  acceptGuest(conn) {
    if (this.locked || this.conns.size + this.reserved.size >= MAX_PLAYERS - 1) {
      conn.on('open', () => { conn.send(packet(MSG.HELLO, { refused: true })); setTimeout(() => conn.close(), 300); });
      return;
    }
    let id = 1;
    while (this.conns.has(id) || this.reserved.has(id)) id++;
    this.conns.set(id, conn);
    conn.on('open', () => { this.connected = true; this.emit('peer-joined', { id }); });
    conn.on('data', data => { if (validMessage(data)) this.emit(data.type, { ...data, from: id }); });
    const gone = () => {
      if (this.conns.get(id) !== conn) return;
      this.conns.delete(id);
      this.emit('peer-left', { id });
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  async joinRoom(code) {
    this.destroyPeer();
    this.isHost = false;
    this.roomCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (this.roomCode.length !== 6) throw new Error('Le code doit contenir 6 caractères.');
    return new Promise((resolve, reject) => {
      this.peer = new Peer(undefined, { debug: 1 });
      const timeout = setTimeout(() => reject(new Error('Hôte introuvable ou délai dépassé. Vérifie le code.')), 15000);
      this.peer.on('open', () => {
        const conn = this.peer.connect(this.roomCode, { reliable: true, serialization: 'json' });
        this.conn = conn;
        conn.on('open', () => { clearTimeout(timeout); this.connected = true; this.emit('connected', { peer: conn.peer }); resolve(); });
        conn.on('data', data => { if (validMessage(data)) this.emit(data.type, { ...data, from: 0 }); });
        conn.on('close', () => { this.connected = false; this.emit('disconnected'); });
        conn.on('error', err => { clearTimeout(timeout); reject(new Error('Connexion impossible : ' + err.message)); });
      });
      this.peer.on('error', err => { clearTimeout(timeout); reject(new Error(this.errorText(err))); });
    });
  }

  send(type, payload = {}) {
    const p = packet(type, payload);
    if (this.isHost) { for (const c of this.conns.values()) if (c.open) c.send(p); }
    else if (this.conn?.open) this.conn.send(p);
  }
  sendTo(id, type, payload = {}) {
    const c = this.conns.get(id);
    if (c?.open) c.send(packet(type, payload));
  }
  kick(id) {
    if (!this.isHost || this.locked) return false;
    const conn = this.conns.get(id);
    if (!conn) return false;
    this.sendTo(id, MSG.KICK);
    setTimeout(() => {
      if (this.conns.get(id) === conn) conn.close();
    }, 150);
    return true;
  }

  errorText(err) {
    const map = { 'peer-unavailable': 'Salon introuvable. Vérifie le code et réessaie.', 'unavailable-id': 'Ce code est déjà utilisé. Réessaie.', 'network': 'Erreur réseau : PeerJS Cloud est peut-être indisponible.', 'browser-incompatible': 'Ce navigateur ne prend pas en charge WebRTC.' };
    return map[err?.type] || err?.message || 'Erreur de connexion inconnue.';
  }
  destroyPeer() {
    try { this.conn?.close(); this.conns.forEach(c => c.close()); this.peer?.destroy(); } catch {}
    this.conn = null; this.peer = null; this.conns.clear(); this.reserved.clear(); this.connected = false;
  }
  destroy() { this.destroyPeer(); }
}
