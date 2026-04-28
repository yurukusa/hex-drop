import { WORLD_W, WORLD_H, GROUND_X_MIN, GROUND_X_MAX, GROUND_Y, GROUND_HEIGHT } from './physics.js';

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

  // フレーム冒頭: 純黒で完全クリア（蛍光管風には残像より黒の透明感が映える）
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
    // 着地有効ゾーン（土台）も枠線だけのネオン管に統一
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

  // 蛍光ネオン管風: 中身は描かず、外側ハロー + 内側白芯の二重ストロークだけ
  drawBlock(body) {
    const ctx = this.ctx;
    const { hue, w, h, fadeMs } = body.render;
    if (this.isOffscreen(body)) return;

    const alpha = fadeMs > 0 ? Math.max(0, 1 - fadeMs / 200) : 1;

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.globalAlpha = alpha;

    // 外側のハロー（強グロー）
    ctx.shadowBlur = 24;
    ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `hsl(${hue}, 95%, 72%)`;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 内側の白い芯（蛍光管のガス光ってる芯）
    ctx.shadowBlur = 8;
    ctx.shadowColor = `hsl(${hue}, 90%, 85%)`;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `hsl(${hue}, 95%, 95%)`;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawHex(body) {
    const ctx = this.ctx;
    const { hue, r } = body.render;

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    // 物理エンジン側の頂点配置に合わせるため offset = PI/6（i=0 が右下、面が水平に来る向き）。
    // body.angle に PI/6 を初期適用しているので、ここはオフセットなしでよい。
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // 外ハロー
    ctx.shadowBlur = 32;
    ctx.shadowColor = `hsl(${hue}, 95%, 65%)`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = `hsl(${hue}, 100%, 75%)`;
    ctx.stroke();

    // 内側白芯
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

  // クリア演出: パーティクル＋画面フラッシュをワールド座標で描画
  drawEffects(effects) {
    const ctx = this.ctx;
    // パーティクル
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

  // フラッシュは canvas 全体に重ねるので world 座標変換の外側で呼ぶ
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
