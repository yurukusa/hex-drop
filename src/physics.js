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
    frictionAir: 0.005,
    sleepThreshold: 30,        // 空気抵抗で微振動を減衰
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

// テトリス形ピース（Stage 6以降の追加要素）
// 各セルを独立 body にして、隣接セル間を Constraint で剛結合。
// L/T/S/Z 形が物理的に他のピースと噛み合う。
// 戻り値: { type: 'cells', bodies, constraints, pieceId, hue, fadeMs }
export function makeCellPiece(cells, hue, isStatic = false) {
  const pieceId = newPieceId();
  const bodies = cells.map(([col, row]) => {
    const x = (col + 0.5) * CELL_SIZE;
    // 縦は CELL_VISUAL 単位で密着配置（重力下で動かない）
    const y = GRID_BASE_Y - (row + 0.5) * CELL_VISUAL;
    const b = Bodies.rectangle(x, y, CELL_VISUAL, CELL_VISUAL, {
      label: 'cell',
      friction: 1.0,
      frictionStatic: 1.5,
      frictionAir: 0.005,
    sleepThreshold: 30,
      density: 0.003,
      restitution: 0.0,
      slop: 0.04,
      isStatic: isStatic,
    });
    b.pieceId = pieceId;
    b.hue = hue;
    b.fadeMs = 0;
    return b;
  });
  // 各セルのローカル outline（隣接セルがピース内にない辺だけ）
  // 描画範囲は CELL_SIZE/2 (= 20) を使う。物理サイズは CELL_VISUAL (= 36) で
  // 隙間 4px あるが、描画上は 40 で「隣接 cell の辺が連続」して見える
  // → ピース全体が一体化したアウトラインとして光る。
  const cellSet = new Set(cells.map(([c, r]) => `${c},${r}`));
  const H = CELL_SIZE / 2;       // 横方向の描画半幅 (隣接 cell が見た目連続)
  const V = CELL_VISUAL / 2;     // 縦方向の描画半幅 (実 cell サイズ、密着なので連続)
  bodies.forEach((b, idx) => {
    const [c, rr] = cells[idx];
    const segs = [];
    // 上辺（Y方向は密着なので V）: x は隣接 cell との連続のため H
    if (!cellSet.has(`${c},${rr + 1}`)) segs.push({ x1: -H, y1: -V, x2:  H, y2: -V });
    if (!cellSet.has(`${c},${rr - 1}`)) segs.push({ x1: -H, y1:  V, x2:  H, y2:  V });
    if (!cellSet.has(`${c - 1},${rr}`)) segs.push({ x1: -H, y1: -V, x2: -H, y2:  V });
    if (!cellSet.has(`${c + 1},${rr}`)) segs.push({ x1:  H, y1: -V, x2:  H, y2:  V });
    b.outlineLocal = segs;
  });
  // 全ペア cell を Constraint で剛結合。隣接ペアだけだと激しい衝突で
  // ピースが折れ曲がる（ぐらす指摘）ため、対角ペアも含めて全結合する。
  // length は実距離 (横=CELL_SIZE, 縦=CELL_VISUAL) のユークリッド距離。
  const constraints = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const dx = cells[j][0] - cells[i][0];
      const dy = cells[j][1] - cells[i][1];
      const lenX = dx * CELL_SIZE;
      const lenY = dy * CELL_VISUAL;
      const length = Math.sqrt(lenX * lenX + lenY * lenY);
      constraints.push(Constraint.create({
        bodyA: bodies[i],
        bodyB: bodies[j],
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: 0 },
        length: length,
        stiffness: 1.0,
        damping: 1.0,        // 振動を完全に減衰
        render: { visible: false },
      }));
    }
  }
  return { type: 'cells', bodies, constraints, pieceId, hue, fadeMs: 0 };
}

// 全 piece を動的化（プレイ開始時に呼ぶ）
export function activatePiece(piece) {
  if (piece.type === 'rect') {
    Body.setStatic(piece.body, false);
  } else {
    for (const b of piece.bodies) Body.setStatic(b, false);
  }
}

export function makeHexagon(x, y, r, hue) {
  return Bodies.polygon(x, y, 6, r, {
    label: 'hex',
    friction: 0.55,
    frictionStatic: 0.85,
    frictionAir: 0.005,
    sleepThreshold: 30,
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
