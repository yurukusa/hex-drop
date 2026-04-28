import {
  createEngine, step, pointQuery, removeBody,
  GROUND_Y, GROUND_HEIGHT, GROUND_X_MIN, GROUND_X_MAX, WORLD_H,
} from './physics.js';
import { loadStageData, buildStage, teardownStage, STAGE_IDS } from './stage.js';
import { markCleared } from './storage.js';

const HEX_GROUND_TOL = 8;
const HEX_VEL_THRESHOLD = 0.45;
const HEX_ANG_VEL_THRESHOLD = 0.04;
const STABLE_REQUIRED_MS = 500;

export class Game {
  constructor(renderer, hud, audio, effects) {
    this.renderer = renderer;
    this.hud = hud;
    this.audio = audio;
    this.effects = effects;
    this.engine = createEngine();
    this.world = this.engine.world;

    this.stageIndex = 0;
    this.stageRefs = null;
    this.state = 'loading';
    this.stableMs = 0;
    this.fadingBlocks = new Set();

    this.hud.bindRestart(() => this.restart());
    this.hud.bindMute(() => {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
    });
    this.hud.setMuted(false);
  }

  get currentStageId() {
    return STAGE_IDS[this.stageIndex];
  }

  async loadStage(index) {
    if (this.stageRefs) teardownStage(this.world, this.stageRefs);
    this.stageIndex = Math.max(0, Math.min(STAGE_IDS.length - 1, index));
    this.state = 'loading';
    this.stableMs = 0;
    this.fadingBlocks.clear();
    this.effects.reset();
    this.hud.hideOverlay();

    const data = await loadStageData(this.currentStageId);
    this.stageRefs = buildStage(this.world, data);
    this.hud.setStageLabel(data.name || `Stage ${this.stageIndex + 1}`);
    this.state = 'playing';
    this.audio.start();
  }

  restart() {
    this.loadStage(this.stageIndex);
  }

  next() {
    if (this.stageIndex < STAGE_IDS.length - 1) {
      this.loadStage(this.stageIndex + 1);
    } else {
      this.hud.showOverlay('All Clear!', 'Replay', () => this.loadStage(0));
    }
  }

  handleTap(x, y) {
    // 初回 tap で AudioContext を起こす
    this.audio.ensure();
    if (this.state !== 'playing') return;
    const hits = pointQuery(this.world, x, y);
    const target = hits.find(b => b.label === 'block' && !this.fadingBlocks.has(b));
    if (target) {
      this.fadingBlocks.add(target);
      target.render.fadeMs = 0.001;
      this.audio.pop();
    }
  }

  update(dtMs) {
    if (this.state === 'loading') return;

    for (const b of this.fadingBlocks) {
      b.render.fadeMs += dtMs;
      if (b.render.fadeMs >= 200) {
        removeBody(this.world, b);
        this.fadingBlocks.delete(b);
        if (this.stageRefs) {
          const i = this.stageRefs.blocks.indexOf(b);
          if (i >= 0) this.stageRefs.blocks.splice(i, 1);
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
        markCleared(this.currentStageId);
        // 派手な演出: 六角形の位置からパーティクル放射＋画面フラッシュ
        this.effects.burst(hex.position.x, hex.position.y, hex.render.hue);
        this.audio.clear();
        const last = this.stageIndex >= STAGE_IDS.length - 1;
        // 演出を見せたいので overlay は少し遅らせる
        setTimeout(() => {
          if (this.state === 'clear') {
            this.hud.showOverlay('Clear!', last ? 'Replay' : 'Next', () => last ? this.loadStage(0) : this.next());
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
    for (const b of this.stageRefs.blocks) r.drawBlock(b);
    r.drawHex(this.stageRefs.hex);
    r.drawEffects(this.effects);
    r.endWorld();
    r.drawFlash(this.effects.flash);
  }
}
