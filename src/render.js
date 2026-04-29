import { WORLD_W, WORLD_H, GROUND_X_MIN, GROUND_X_MAX, GROUND_Y, GROUND_HEIGHT, CELL_SIZE } from './physics.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    const sx = this.canvas.width / WORLD_W;
    const sy = this.canvas.height / WORLD_H;
    this.scale = Math.min(sx, sy);
    this.offsetX = (this.canvas.width - WORLD_W * this.scale) / 2;
    this.offsetY = (this.canvas.height - WORLD_H * this.scale) / 2;
  }

  screenToWorld(cssX, cssY) {
    const dpr = this.canvas.width / parseFloat(this.canvas.style.width);
    const px = cssX * dpr;
    const py = cssY * dpr;
    return {
      x: (px - this.offsetX) / this.scale,
      y: (py - this.offsetY) / this.scale,
    };
  }

  clear() {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  fullClear() { this.clear(); }

  beginWorld() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }

  endWorld() {
    this.ctx.restore();
  }

  drawBackground() {
    const ctx = this.ctx;
    const x = GROUND_X_MIN;
    const y = GROUND_Y - GROUND_HEIGHT / 2;
    const w = GROUND_X_MAX - GROUND_X_MIN;
    const h = GROUND_HEIGHT;

    ctx.shadowBlur = 30;
    ctx.shadowColor = '#a98aff';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c8b3ff';
    ctx.strokeRect(x, y, w, h);

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#f4eeff';
    ctx.strokeRect(x, y, w, h);

    ctx.shadowBlur = 0;
  }

  // ピース描画（rect or cells で分岐）
  drawPiece(piece) {
    if (piece.type === 'rect') this.drawRectPiece(piece);
    else this.drawCellsPiece(piece);
  }

  drawRectPiece(piece) {
    const body = piece.body;
    if (this.isOffscreen(body)) return;
    const ctx = this.ctx;
    const { w, h, wCells, hCells } = body.renderInfo;
    const hue = piece.hue;
    const alpha = piece.fadeMs > 0 ? Math.max(0, 1 - piece.fadeMs / 200) : 1;

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.globalAlpha = alpha;

    // 外周ハロー
    ctx.shadowBlur = 26;
    ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `hsl(${hue}, 95%, 72%)`;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 内側白芯
    ctx.shadowBlur = 8;
    ctx.shadowColor = `hsl(${hue}, 90%, 88%)`;
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = `hsl(${hue}, 95%, 95%)`;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 内側セル分割線（複数セルピースなら）
    if (wCells > 1 || hCells > 1) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = `hsla(${hue}, 80%, 75%, 0.35)`;
      ctx.beginPath();
      for (let i = 1; i < wCells; i++) {
        const x = -w / 2 + (i / wCells) * w;
        ctx.moveTo(x, -h / 2 + 5);
        ctx.lineTo(x, h / 2 - 5);
      }
      for (let j = 1; j < hCells; j++) {
        const y = -h / 2 + (j / hCells) * h;
        ctx.moveTo(-w / 2 + 5, y);
        ctx.lineTo(w / 2 - 5, y);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // テトリス形ピース。各セル独立 body、outline は body にローカル線分として保存済み。
  // 複合剛体ピース。piece.body の position/angle と outlineLocal で一括描画。
  drawCellsPiece(piece) {
    if (this.isOffscreen(piece.body)) return;
    const ctx = this.ctx;
    const hue = piece.hue;
    const alpha = piece.fadeMs > 0 ? Math.max(0, 1 - piece.fadeMs / 200) : 1;
    const segs = piece.body.outlineLocal || [];

    ctx.save();
    ctx.translate(piece.body.position.x, piece.body.position.y);
    ctx.rotate(piece.body.angle);
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (const s of segs) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }

    // 外側ハロー
    ctx.shadowBlur = 26;
    ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `hsl(${hue}, 95%, 72%)`;
    ctx.stroke();

    // 内側白芯
    ctx.shadowBlur = 8;
    ctx.shadowColor = `hsl(${hue}, 90%, 88%)`;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `hsl(${hue}, 95%, 95%)`;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawHex(body) {
    const ctx = this.ctx;
    const { hue, r } = body.render;

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.shadowBlur = 32;
    ctx.shadowColor = `hsl(${hue}, 95%, 65%)`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = `hsl(${hue}, 100%, 75%)`;
    ctx.stroke();

    ctx.shadowBlur = 12;
    ctx.shadowColor = `hsl(${hue}, 95%, 90%)`;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  isOffscreen(body) {
    const m = 80;
    return body.position.x < -m || body.position.x > WORLD_W + m
        || body.position.y < -m || body.position.y > WORLD_H + m;
  }

  drawEffects(effects) {
    const ctx = this.ctx;
    for (const p of effects.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.shadowBlur = 20;
      ctx.shadowColor = p.color;
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  drawFlash(strength) {
    if (strength <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.7, strength * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
}
