// Protocole versionné : ne jamais faire confiance aux messages du pair.
export const PROTOCOL_VERSION = 2;
export const MAX_PLAYERS = 16;
export const MSG = Object.freeze({
  HELLO: 'hello', READY: 'ready', START: 'start', INPUT: 'input',
  STATE: 'state', EVENT: 'event', PING: 'ping', PONG: 'pong',
  GAMEOVER: 'gameover', RECONNECT: 'reconnect', ROSTER: 'roster', REPLAY: 'replay',
  KICK: 'kick'
});

export function validMessage(message) {
  return !!message && typeof message === 'object' &&
    message.v === PROTOCOL_VERSION && Object.values(MSG).includes(message.type);
}
export function packet(type, payload = {}) {
  return { v: PROTOCOL_VERSION, type, ...payload };
}
