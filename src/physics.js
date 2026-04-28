const { Engine, World, Bodies, Body, Composite, Query, Events } = window.Matter;

export const WORLD_W = 720;
export const WORLD_H = 1280;

export const GROUND_Y = 1240;
export const GROUND_HEIGHT = 60;
export const GROUND_HALF_WIDTH = 225;
export const GROUND_X_MIN = WORLD_W / 2 - GROUND_HALF_WIDTH;
export const GROUND_X_MAX = WORLD_W / 2 + GROUND_HALF_WIDTH;

export const CELL_SIZE = 40;
export const GRID_COLS = WORLD_W / CELL_SIZE;
export const GRID_BASE_Y = GROUND_Y - GROUND_HEIGHT / 2;

// 物理サイズ係数。1セルあたり -2px の隙間（cell境界が 2px ずつ離れる）。
const PIECE_INSET = 2;

export function createEngine() {
  const engine = Engine.create({ gravity: { x: 0, y: 1.0, scale: 0.0010 } });
  engine.positionIterations = 10;
  engine.velocityIterations = 10;
  return engine;
}

export function createGround() {
  return Bodies.rectangle(WORLD_W / 2, GROUND_Y, GROUND_HALF_WIDTH * 2, GROUND_HEIGHT, {
    isStatic: true,
    label: 'ground',
    friction: 0.98,
  });
}

export function createOutOfBoundsSensors() {
  const left = Bodies.rectangle(-200, WORLD_H / 2, 400, WORLD_H * 2, {
    isStatic: true, isSensor: true, label: 'oob',
  });
  const right = Bodies.rectangle(WORLD_W + 200, WORLD_H / 2, 400, WORLD_H * 2, {
    isStatic: true, isSensor: true, label: 'oob',
  });
  return [left, right];
}

// 単一矩形ピース。形のバリエーションは (wCells, hCells)。
// (1,1)=単独, (4,1)=横長I, (1,4)=縦長I, (2,2)=O, (3,1)/(1,3)=3連, etc.
export function makePiece(col, row, wCells, hCells, hue) {
  const x = (col + wCells / 2) * CELL_SIZE;
  const y = GRID_BASE_Y - (row + hCells / 2) * CELL_SIZE;
  const w = wCells * CELL_SIZE - PIECE_INSET * 2;
  const h = hCells * CELL_SIZE - PIECE_INSET * 2;
  const body = Bodies.rectangle(x, y, w, h, {
    label: 'block',
    friction: 1.0,
    frictionStatic: 1.5,
    density: 0.0015,
    restitution: 0.0,
    slop: 0.04,
  });
  body.render = { hue, w, h, wCells, hCells, fadeMs: 0 };
  return body;
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
  const dt = Math.max(8, Math.min(33, dtMs));
  Engine.update(engine, dt);
}

export { Engine, World, Bodies, Body, Composite, Query, Events };
