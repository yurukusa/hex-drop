export class Input {
  constructor(canvas, renderer, onTap) {
    this.lastTapMs = 0;
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastTapMs < 100) return; // 連打抑止
      this.lastTapMs = now;
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const w = renderer.screenToWorld(cssX, cssY);
      onTap(w.x, w.y);
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
