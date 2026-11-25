import Peer from 'peerjs';
import { MSG, packet, validMessage } from './protocol.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export class Network {
  constructor() {
    this.peer = null; this.conn = null; this.isHost = false;
    this.roomCode = ''; this.connected = false; this.handlers = {};
    this.reconnectTimer = null;
  }
  on(event, callback) { this.handlers[event] = callback; }
  emit(event, data) { this.handlers[event]?.(data); }
  async createRoom() {
    this.destroyPeer();
    this.isHost = true;
    this.roomCode = makeCode();
    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.roomCode, { debug: 1 });
      const timeout = setTimeout(() => reject(new Error('Délai dépassé lors de la création du salon.')), 12000);
      this.peer.on('open', id => { clearTimeout(timeout); resolve(id); });
      this.peer.on('connection', conn => {
        if (this.conn) { conn.close(); return; }
        this.attachConnection(conn);
      });
      this.peer.on('error', err => { clearTimeout(timeout); this.emit('error', this.errorText(err)); reject(new Error(this.errorText(err))); });
      this.peer.on('disconnected', () => this.emit('status', 'Signalisation interrompue. Tentative de reconnexion…'));
    });
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
        this.attachConnection(conn);
        conn.on('open', () => { clearTimeout(timeout); resolve(); });
        conn.on('error', err => { clearTimeout(timeout); reject(new Error('Connexion impossible : ' + err.message)); });
      });
      this.peer.on('error', err => { clearTimeout(timeout); reject(new Error(this.errorText(err))); });
    });
  }
  attachConnection(conn) {
    this.conn = conn;
    conn.on('open', () => {
      this.connected = true;
      this.emit('connected', { peer: conn.peer });
      if (this.isHost) this.send(MSG.HELLO, { role: 'host' });
    });
    conn.on('data', data => {
      if (!validMessage(data)) return;
      this.emit(data.type, data);
    });
    conn.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
    });
    conn.on('error', err => this.emit('error', err.message));
  }
  send(type, payload = {}) {
    if (this.conn?.open) this.conn.send(packet(type, payload));
  }
  errorText(err) {
    const map = { 'peer-unavailable': 'Salon introuvable. Vérifie le code et réessaie.', 'unavailable-id': 'Ce code est déjà utilisé. Réessaie.', 'network': 'Erreur réseau : PeerJS Cloud est peut-être indisponible.', 'browser-incompatible': 'Ce navigateur ne prend pas en charge WebRTC.' };
    return map[err?.type] || err?.message || 'Erreur de connexion inconnue.';
  }
  destroyPeer() {
    clearTimeout(this.reconnectTimer);
    try { this.conn?.close(); this.peer?.destroy(); } catch {}
    this.conn = null; this.peer = null; this.connected = false;
  }
  destroy() { this.destroyPeer(); }
}