const { Engine, World, Bodies, Body, Composite, Constraint, Query, Events, Sleeping } = window.Matter;

// CELL_SIZE=64、WORLD_W=11*64=704 で割り切れて中央ズレなし
export const WORLD_W = 704;
export const WORLD_H = 1280;

export const CELL_SIZE = 64;
export const CELL_VISUAL = 60;
export const GRID_COLS = WORLD_W / CELL_SIZE;          // 11

// 土台は壁と同じ幅 (5セル = 320px)。
export const GROUND_Y = 1240;
export const GROUND_HEIGHT = 60;
export const GROUND_HALF_WIDTH = 160;
export const GROUND_X_MIN = WORLD_W / 2 - GROUND_HALF_WIDTH;
export const GROUND_X_MAX = WORLD_W / 2 + GROUND_HALF_WIDTH;

export const GRID_BASE_Y = GROUND_Y - GROUND_HEIGHT / 2;

// 壁範囲（5列）。中央 col 5、左 col 3、右 col 7
export const WALL_COL_MIN = 3;
export const WALL_COL_MAX = 7;

let nextPieceId = 1;
export function newPieceId() { return nextPieceId++; }

const PIECE_INSET = 2;

export function createEngine() {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.0, scale: 0.0007 },
    enableSleeping: true,        // 低速 body を sleep 状態にして完全停止
  });
  engine.positionIterations = 12;
  engine.velocityIterations = 12;
  engine.constraintIterations = 4;
  return engine;
}

export function createGround() {
  return Bodies.rectangle(WORLD_W / 2, GROUND_Y, GROUND_HALF_WIDTH * 2, GROUND_HEIGHT, {
    isStatic: true, label: 'ground', friction: 0.98,
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

// 単一矩形ピース（Stage 1-5の主役、Stage 6+でも併用）
// 縦は CELL_VISUAL 単位で密着配置（重力下で動かないように）
// 横は CELL_SIZE 単位で隙間あり（物理安定性確保）
// 戻り値: { type: 'rect', body, pieceId, hue, fadeMs }
export function makeRectPiece(col, row, wCells, hCells, hue, isStatic = false) {
  const x = (col + wCells / 2) * CELL_SIZE;
  const y = GRID_BASE_Y - row * CELL_VISUAL - (hCells * CELL_VISUAL) / 2;
  const w = wCells * CELL_SIZE - PIECE_INSET * 2;
  const h = hCells * CELL_VISUAL;
  const pieceId = newPieceId();
  const body = Bodies.rectangle(x, y, w, h, {
    label: 'block',
    friction: 1.0,
    frictionStatic: 1.5,
    frictionAir: 0.02,
    sleepThreshold: 20,        // 空気抵抗で微振動を減衰
    density: 0.003,
    restitution: 0.0,
    slop: 0.04,
    isStatic: isStatic,
  });
  body.pieceId = pieceId;
  body.hue = hue;
  body.fadeMs = 0;
  body.renderInfo = { kind: 'rect', w, h, wCells, hCells };
  return { type: 'rect', body, pieceId, hue, fadeMs: 0 };
}

// テトリス形ピース。Matter.Body.create({ parts }) で複数 cell を1つの剛体に統合。
// 真の複合剛体 - cell 同士は物理的に「同じ1つの body」として動く。
// Constraint 不要、cell 間の押し合いゼロ、完全剛体。
// 戻り値: { type: 'cells', body, pieceId, hue, fadeMs }
export function makeCellPiece(cells, hue, isStatic = false) {
  const pieceId = newPieceId();
  // 各 cell の body を作る（parts 用、物理プロパティは parent から継承）
  const parts = cells.map(([col, row]) => {
    const x = (col + 0.5) * CELL_SIZE;
    const y = GRID_BASE_Y - (row + 0.5) * CELL_VISUAL;
    return Bodies.rectangle(x, y, CELL_VISUAL, CELL_VISUAL, { label: 'cell' });
  });
  // 複合剛体生成
  const piece = Body.create({
    parts,
    label: 'piece',
    friction: 1.0,
    frictionStatic: 1.5,
    frictionAir: 0.02,         // 振動減衰を強化 (複合剛体間の衝突連鎖を抑える)
    sleepThreshold: 20,        // 早期 sleep で塔全体の微振動を停止
    density: 0.003,
    restitution: 0.0,
    slop: 0.04,
    isStatic: isStatic,
  });
  piece.pieceId = pieceId;
  piece.hue = hue;
  piece.fadeMs = 0;
  // 子 part にも pieceId/hue を伝播 (タップ判定で part にヒットするため)
  for (let i = 1; i < piece.parts.length; i++) {
    piece.parts[i].pieceId = pieceId;
    piece.parts[i].hue = hue;
  }

  // outline: 各 cell のローカル offset (parent.position 基準) で線分を作る。
  // 隣接 cell が同 piece 内になければ外周辺。
  const cellSet = new Set(cells.map(([c, r]) => `${c},${r}`));
  const H = CELL_SIZE / 2;
  const V = CELL_VISUAL / 2;
  const segs = [];
  for (let i = 0; i < cells.length; i++) {
    const [c, rr] = cells[i];
    const part = piece.parts[i + 1];   // parts[0] は parent 自身
    const ox = part.position.x - piece.position.x;
    const oy = part.position.y - piece.position.y;
    if (!cellSet.has(`${c},${rr + 1}`)) segs.push({ x1: ox - H, y1: oy - V, x2: ox + H, y2: oy - V });
    if (!cellSet.has(`${c},${rr - 1}`)) segs.push({ x1: ox - H, y1: oy + V, x2: ox + H, y2: oy + V });
    if (!cellSet.has(`${c - 1},${rr}`)) segs.push({ x1: ox - H, y1: oy - V, x2: ox - H, y2: oy + V });
    if (!cellSet.has(`${c + 1},${rr}`)) segs.push({ x1: ox + H, y1: oy - V, x2: ox + H, y2: oy + V });
  }
  piece.outlineLocal = segs;

  return { type: 'cells', body: piece, pieceId, hue, fadeMs: 0 };
}

// 全 piece を動的化（プレイ開始時に呼ぶ）
export function activatePiece(piece) {
  // 複合剛体も単一矩形も、parent body 1つを setStatic(false)
  Body.setStatic(piece.body, false);
}

export function makeHexagon(x, y, r, hue) {
  return Bodies.polygon(x, y, 6, r, {
    label: 'hex',
    friction: 0.55,
    frictionStatic: 0.85,
    frictionAir: 0.02,
    sleepThreshold: 20,
    density: 0.004,             // 重め: 落下ピースに弾かれにくい
    restitution: 0.05,
    render: { hue, r },
  });
}

export function pointQuery(world, x, y) {
  return Query.point(Composite.allBodies(world), { x, y });
}

export function step(engine, dtMs) {
  const dt = Math.max(8, Math.min(33, dtMs));
  Engine.update(engine, dt);
}

export { Engine, World, Bodies, Body, Composite, Constraint, Query, Events, Sleeping };
