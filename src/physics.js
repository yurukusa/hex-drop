// Matter.js は index.html の <script> でグローバル `Matter` に展開済み。
// ESMラッパを噛ませない方が CDN 互換性が高い。
const { Engine, World, Bodies, Body, Composite, Query, Events } = window.Matter;

export const WORLD_W = 720;
export const WORLD_H = 1280;
export const GROUND_Y = 1240;
export const GROUND_HEIGHT = 60;
// 子供向けでクリア可能性を担保するため、土台は広めに維持する。
// 一度150まで絞ったが、操作してもクリアできないケースが増えたためぐらす指示で300に戻す。
export const GROUND_HALF_WIDTH = 300;
export const GROUND_X_MIN = WORLD_W / 2 - GROUND_HALF_WIDTH;
export const GROUND_X_MAX = WORLD_W / 2 + GROUND_HALF_WIDTH;

export function createEngine() {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.0, scale: 0.0012 },
  });
  // 反発を控えめにして自然な崩れに
  engine.positionIterations = 8;
  engine.velocityIterations = 8;
  return engine;
}

export function createGround() {
  return Bodies.rectangle(WORLD_W / 2, GROUND_Y, GROUND_HALF_WIDTH * 2, GROUND_HEIGHT, {
    isStatic: true,
    label: 'ground',
    friction: 0.9,
    render: { hue: 280 },
  });
}

// 画面外への落下キャッチャー（不可視、削除判定用）
export function createOutOfBoundsSensors() {
  const left = Bodies.rectangle(-200, WORLD_H / 2, 400, WORLD_H * 2, {
    isStatic: true,
    isSensor: true,
    label: 'oob',
  });
  const right = Bodies.rectangle(WORLD_W + 200, WORLD_H / 2, 400, WORLD_H * 2, {
    isStatic: true,
    isSensor: true,
    label: 'oob',
  });
  return [left, right];
}

export function makeBlock(x, y, w, h, hue) {
  return Bodies.rectangle(x, y, w, h, {
    label: 'block',
    friction: 0.7,
    frictionStatic: 0.9,
    density: 0.0015,
    restitution: 0.02,
    render: { hue, w, h, fadeMs: 0 },
  });
}

export function makeHexagon(x, y, r, hue) {
  return Bodies.polygon(x, y, 6, r, {
    label: 'hex',
    friction: 0.55,
    frictionStatic: 0.85,
    density: 0.0022,
    restitution: 0.05,
    render: { hue, r },
  });
}

export function pointQuery(world, x, y) {
  return Query.point(Composite.allBodies(world), { x, y });
}

export function removeBody(world, body) {
  Composite.remove(world, body);
}

export function step(engine, dtMs) {
  // dt は Matter 内部で 1000/60 を想定。実 dt を渡すと安定するが上限をクランプ
  const dt = Math.max(8, Math.min(33, dtMs));
  Engine.update(engine, dt);
}

export { Engine, World, Bodies, Body, Composite, Query, Events };
