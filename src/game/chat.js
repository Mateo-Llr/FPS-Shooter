// Tchat de partie : Entrée ouvre la saisie, Entrée envoie, Échap annule.
// L'hôte est autoritaire (validation, anti-spam, attribution de l'auteur) ; ce module ne gère que l'interface.

export const CHAT_MAX_LENGTH = 140;
const MAX_LINES = 50;
const VISIBLE_MS = 9000;     // durée d'affichage d'un message quand le tchat est fermé
const LOCAL_COOLDOWN = 600;  // anti-spam côté client (l'hôte applique le sien)

/** Nettoie un message : texte seul, sans caractères de contrôle ni de direction, longueur bornée. */
export function cleanChat(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
}

export class Chat {
  constructor({ canvas, controller, onSend }) {
    this.canvas = canvas;
    this.controller = controller;
    this.onSend = onSend;
    this.active = false;
    this.isOpen = false;
    this.lastSent = 0;

    this.addStyles();
    this.build();
    this.bind();
  }

  addStyles() {
    if (document.querySelector('#clash-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'clash-chat-styles';
    style.textContent = `
      #chat{position:fixed;left:20px;bottom:150px;z-index:60;width:min(88vw,420px);display:none;
        flex-direction:column;gap:6px;pointer-events:none;font:600 14px/1.35 Inter,Arial,sans-serif}
      #chat.active{display:flex}
      #chat-log{display:flex;flex-direction:column;gap:3px;max-height:190px;overflow:hidden;justify-content:flex-end}
      #chat.open #chat-log{overflow-y:auto;pointer-events:auto;background:rgba(10,15,19,.62);padding:8px 10px;
        border-left:3px solid #f07845}
      .chat-line{padding:3px 8px;background:rgba(10,15,19,.55);color:#eef1f2;text-shadow:0 1px 3px #000;
        word-break:break-word;transition:opacity .6s ease;width:fit-content;max-width:100%}
      #chat.open .chat-line{background:none;padding:1px 0}
      .chat-line.old{opacity:0}
      #chat.open .chat-line.old{opacity:1}
      .chat-name{font-weight:800;color:#9fb4bf;margin-right:6px;letter-spacing:.03em}
      .chat-line.mine .chat-name{color:#ffb487}
      #chat-input{display:none;pointer-events:auto;width:100%;box-sizing:border-box;padding:9px 12px;
        background:rgba(10,15,19,.88);color:#fff;border:1px solid #45545d;border-top:2px solid #f07845;
        font:600 14px Inter,Arial,sans-serif;outline:none}
      #chat.open #chat-input{display:block}
      #chat-input::placeholder{color:#6f7d85}
    `;
    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.id = 'chat';
    this.log = document.createElement('div');
    this.log.id = 'chat-log';
    this.log.setAttribute('aria-live', 'polite');
    this.input = document.createElement('input');
    this.input.id = 'chat-input';
    this.input.type = 'text';
    this.input.maxLength = CHAT_MAX_LENGTH;
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.placeholder = 'Message… (Entrée : envoyer · Échap : annuler)';
    this.root.append(this.log, this.input);
    document.body.appendChild(this.root);
  }

  bind() {
    // Entrée (hors saisie) : ouvre le tchat pendant la partie.
    document.addEventListener('keydown', e => {
      if (this.isOpen || !this.active || e.repeat) return;
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
      e.preventDefault();
      this.open();
    });

    // Pendant la saisie, aucune touche ne doit atteindre le jeu (déplacements, armes, Tab…).
    this.input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (!e.isComposing) this.submit();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    // Si la souris est reverrouillée (clic sur le jeu), on referme la saisie.
    document.addEventListener('pointerlockchange', () => {
      if (this.isOpen && document.pointerLockElement === this.canvas) this.close(false);
    });
  }

  setActive(value) {
    this.active = value;
    this.root.classList.toggle('active', value);
    if (!value) this.close(false);
  }

  reset() {
    this.log.replaceChildren();
  }

  open() {
    if (!this.active) return;
    this.isOpen = true;
    this.controller.keys = {};            // évite les touches « collées » au moment d'ouvrir
    this.controller.mouseFiring = false;
    this.controller.mouseAiming = false;
    this.root.classList.add('open');
    document.exitPointerLock?.();
    this.input.value = '';
    this.input.focus();
    this.log.scrollTop = this.log.scrollHeight;
  }

  close(relock = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('open');
    this.input.value = '';
    this.input.blur();
    if (relock && this.active) {
      try { this.canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* sera reverrouillé au clic */ }
    }
  }

  submit() {
    const text = cleanChat(this.input.value);
    if (!text) { this.close(); return; }
    const now = performance.now();
    if (now - this.lastSent < LOCAL_COOLDOWN) return; // trop rapide : on garde la saisie
    this.lastSent = now;
    this.onSend?.(text);
    this.close();
  }

  /** Ajoute un message dans le journal (texte inséré via textContent : pas d'injection HTML). */
  add(name, text, mine = false) {
    const line = document.createElement('div');
    line.className = 'chat-line' + (mine ? ' mine' : '');
    const who = document.createElement('span');
    who.className = 'chat-name';
    who.textContent = name;
    const body = document.createElement('span');
    body.textContent = text;
    line.append(who, body);
    this.log.appendChild(line);
    while (this.log.children.length > MAX_LINES) this.log.firstElementChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
    setTimeout(() => line.classList.add('old'), VISIBLE_MS);
  }
}
