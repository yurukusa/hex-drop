// クリア時のパーティクル＋画面フラッシュ。
// パーティクルはワールド座標、フラッシュは canvas 全体に重ねる。
export class Effects {
  constructor() {
    this.particles = [];
    this.flash = 0; // 0..1
  }

  burst(x, y, baseHue) {
    // 中央で派手に: 60個、放射状＋ランダムずらし、6色
    const count = 60;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const v = 8 + Math.random() * 10;
      const hue = (baseHue + i * 6) % 360;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2,
        life: 1,
        size: 4 + Math.random() * 4,
        color: `hsl(${hue}, 95%, 70%)`,
      });
    }
    this.flash = 1;
  }

  update(dtMs) {
    const k = dtMs / 1000;
    this.flash = Math.max(0, this.flash - k * 1.6);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;            // 重力
      p.vx *= 0.985;           // 空気抵抗
      p.life -= k * 0.55;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  reset() {
    this.particles.length = 0;
    this.flash = 0;
  }
}
