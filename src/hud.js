export class Hud {
  constructor() {
    this.label = document.getElementById('stage-label');
    this.overlay = document.getElementById('hud-overlay');
    this.overlayText = document.getElementById('overlay-text');
    this.overlayAction = document.getElementById('overlay-action');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnMute = document.getElementById('btn-mute');
    this.actionHandler = null;

    this.overlayAction.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.actionHandler) this.actionHandler();
    });
  }

  setStageLabel(name) {
    this.label.textContent = name;
  }

  bindRestart(fn) {
    this.btnRestart.addEventListener('click', (e) => {
      e.preventDefault();
      fn();
    });
  }

  bindMute(fn) {
    this.btnMute.addEventListener('click', (e) => {
      e.preventDefault();
      fn();
    });
  }

  setMuted(muted) {
    this.btnMute.textContent = muted ? '🔇' : '🔊';
  }

  showOverlay(text, actionLabel, onAction) {
    this.overlayText.textContent = text;
    this.overlayAction.textContent = actionLabel;
    this.actionHandler = onAction;
    this.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
    this.actionHandler = null;
  }
}
