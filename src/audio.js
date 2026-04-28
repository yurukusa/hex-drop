// アセット不要のため WebAudio で音を合成。
// AudioContext はユーザー操作があるまで起動できないので、
// 最初の tap で ensure() を呼ぶ流れに乗せる。
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* 黙って続行 */ });
    }
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freqStart, freqEnd, durMs, type = 'square', vol = 0.16, delayMs = 0) {
    if (!this.ensure() || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delayMs / 1000;
    const t1 = t0 + durMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.05);
  }

  pop()    { this._tone(560, 320, 70, 'triangle', 0.18); }
  thump()  { this._tone(120,  60, 140, 'sawtooth', 0.12); }   // ブロック落下時の重め
  clear() {
    [659, 784, 988, 1319].forEach((f, i) => {
      this._tone(f, f, 150, 'triangle', 0.18, i * 110);
    });
    // ファンファーレ末尾の高い余韻
    this._tone(1760, 1318, 320, 'sine', 0.10, 480);
  }
  over() {
    this._tone(220, 110, 320, 'sawtooth', 0.20);
    this._tone(165,  82, 380, 'sawtooth', 0.18, 140);
  }
  start() { this._tone(440, 660, 120, 'sine', 0.12); }
}
