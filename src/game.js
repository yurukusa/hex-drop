import {
  createEngine, step, pointQuery,
  GROUND_Y, GROUND_HEIGHT, GROUND_X_MIN, GROUND_X_MAX, WORLD_H,
  Sleeping, Composite,
} from './physics.js';
import { loadStageData, buildStage, teardownStage, removePiece, activateStage, TOTAL_STAGES } from './stage.js';
import { markCleared, setLastPlayed, loadProgress } from './storage.js';

const HEX_GROUND_TOL = 8;
const HEX_VEL_THRESHOLD = 0.5;
const HEX_ANG_VEL_THRESHOLD = 0.05;
const STABLE_REQUIRED_MS = 500;
const FADE_MS = 200;

export class Game {
  constructor(renderer, hud, audio, effects) {
    this.renderer = renderer;
    this.hud = hud;
    this.audio = audio;
    this.effects = effects;
    this.engine = createEngine();
    this.world = this.engine.world;

    this.stageNumber = 1;
    this.stageRefs = null;
    this.state = 'loading';
    this.stableMs = 0;
    this.fadingPieces = new Set();

    this.hud.bindRestart(() => this.restart());
    this.hud.bindMute(() => {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
    });
    this.hud.setMuted(false);
  }

  async loadStage(stageNumber) {
    if (this.stageRefs) teardownStage(this.world, this.stageRefs);
    this.stageNumber = Math.max(1, Math.min(TOTAL_STAGES, stageNumber));
    this.state = 'loading';
    this.stableMs = 0;
    this.fadingPieces.clear();
    this.effects.reset();
    this.hud.hideOverlay();

    const data = await loadStageData(this.stageNumber);
    this.stageRefs = buildStage(this.world, data);
    this.hud.setStageLabel(`Stage ${this.stageNumber} / ${TOTAL_STAGES}`);
    setLastPlayed(this.stageNumber);
    // 600ms 静止状態で見せた後に動的化（初期爆発を回避）
    this.state = 'preplay';
    this.audio.start();
    setTimeout(() => {
      if (this.stageRefs && this.state === 'preplay') {
        activateStage(this.stageRefs);
        this.state = 'playing';
      }
    }, 600);
  }

  restart() { this.loadStage(this.stageNumber); }

  next() {
    if (this.stageNumber < TOTAL_STAGES) {
      this.loadStage(this.stageNumber + 1);
    } else {
      this.hud.showOverlay('All Clear!', 'Replay', () => this.loadStage(1));
    }
  }

  handleTap(x, y) {
    this.audio.ensure();
    if (this.state !== 'playing') return;
    const hits = pointQuery(this.world, x, y);
    // 矩形ピースは label='block'、テトリスセルは label='cell'
    const hit = hits.find(b => b.label === 'block' || b.label === 'cell');
    if (!hit) return;
    const piece = this.stageRefs?.pieces.find(p => p.pieceId === hit.pieceId);
    if (!piece || this.fadingPieces.has(piece)) return;
    this.fadingPieces.add(piece);
    piece.fadeMs = 0.001;
    this.audio.pop();
    this.wakeAll();
  }

  // sleeping 状態の body を全て起こす（ピース削除で連鎖落下が起きるように）
  wakeAll() {
    if (!this.stageRefs) return;
    for (const p of this.stageRefs.pieces) {
      // 複合剛体も単一矩形も parent body 1つで wake
      Sleeping.set(p.body, false);
    }
    Sleeping.set(this.stageRefs.hex, false);
  }

  update(dtMs) {
    if (this.state === 'loading') return;
    if (this.state === 'preplay') {
      step(this.engine, dtMs);
      this.effects.update(dtMs);
      return;
    }

    for (const piece of this.fadingPieces) {
      piece.fadeMs += dtMs;
      if (piece.fadeMs >= FADE_MS) {
        removePiece(this.world, piece);
        this.fadingPieces.delete(piece);
        if (this.stageRefs) {
          const i = this.stageRefs.pieces.indexOf(piece);
          if (i >= 0) this.stageRefs.pieces.splice(i, 1);
        }
      }
    }

    step(this.engine, dtMs);
    this.effects.update(dtMs);

    if (this.state === 'playing') this.checkOutcome(dtMs);
  }

  checkOutcome(dtMs) {
    const hex = this.stageRefs?.hex;
    if (!hex) return;

    const onGroundY = hex.position.y >= GROUND_Y - GROUND_HEIGHT / 2 - hex.render.r - HEX_GROUND_TOL;
    const insideX = hex.position.x > GROUND_X_MIN && hex.position.x < GROUND_X_MAX;
    const fellBelow = hex.position.y > WORLD_H + 100;
    const fellSide = !insideX && hex.position.y > GROUND_Y;

    if (fellBelow || fellSide) {
      this.state = 'over';
      this.audio.over();
      this.hud.showOverlay('Try Again', 'Restart', () => this.restart());
      return;
    }

    const v = hex.velocity;
    const speed = Math.hypot(v.x, v.y);
    const stable = onGroundY && insideX
                 && speed < HEX_VEL_THRESHOLD
                 && Math.abs(hex.angularVelocity) < HEX_ANG_VEL_THRESHOLD;

    if (stable) {
      this.stableMs += dtMs;
      if (this.stableMs >= STABLE_REQUIRED_MS) {
        this.state = 'clear';
        markCleared(this.stageNumber);
        this.effects.burst(hex.position.x, hex.position.y, hex.render.hue);
        this.audio.clear();
        const last = this.stageNumber >= TOTAL_STAGES;
        setTimeout(() => {
          if (this.state === 'clear') {
            this.hud.showOverlay('Clear!', last ? 'Replay' : 'Next', () => last ? this.loadStage(1) : this.next());
          }
        }, 700);
      }
    } else {
      this.stableMs = 0;
    }
  }

  draw() {
    const r = this.renderer;
    if (this.state === 'loading' || !this.stageRefs) {
      r.fullClear();
      return;
    }
    r.clear();
    r.beginWorld();
    r.drawBackground();
    for (const piece of this.stageRefs.pieces) r.drawPiece(piece);
    r.drawHex(this.stageRefs.hex);
    r.drawEffects(this.effects);
    r.endWorld();
    r.drawFlash(this.effects.flash);
  }

  initialStage() {
    const p = loadProgress();
    return Math.max(1, Math.min(TOTAL_STAGES, p.lastPlayed || 1));
  }
}
