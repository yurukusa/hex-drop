const { Engine, World, Bodies, Body, Composite, Constraint, Query, Events } = window.Matter;

export const WORLD_W = 720;
export const WORLD_H = 1280;

// 土台は壁と同じ幅 (8セル = 320px)。
export const GROUND_Y = 1240;
export const GROUND_HEIGHT = 60;
export const GROUND_HALF_WIDTH = 160;
export const GROUND_X_MIN = WORLD_W / 2 - GROUND_HALF_WIDTH;
export const GROUND_X_MAX = WORLD_W / 2 + GROUND_HALF_WIDTH;

export const CELL_SIZE = 40;
export const CELL_VISUAL = 36;
export const GRID_COLS = WORLD_W / CELL_SIZE;
export const GRID_BASE_Y = GROUND_Y - GROUND_HEIGHT / 2;

// 壁範囲（8列）。中央 col 8.5、半幅 4 → col 5..12
export const WALL_COL_MIN = 5;
export const WALL_COL_MAX = 12;

let nextPieceId = 1;
export function newPieceId() { return nextPieceId++; }

const PIECE_INSET = 2;

export function createEngine() {
  const engine = Engine.create({ gravity: { x: 0, y: 1.0, scale: 0.0010 } });
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
    density: 0.0015,
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
      density: 0.0015,
      restitution: 0.0,
      slop: 0.04,
      isStatic: isStatic,
    });
    b.pieceId = pieceId;
    b.hue = hue;
    b.fadeMs = 0;
    return b;
  });
  // 各セルのローカル outline（隣接セルがピース内にない辺だけ描画用）
  const cellSet = new Set(cells.map(([c, r]) => `${c},${r}`));
  const HV = CELL_VISUAL / 2;
  bodies.forEach((b, idx) => {
    const [c, rr] = cells[idx];
    const segs = [];
    if (!cellSet.has(`${c},${rr + 1}`)) segs.push({ x1: -HV, y1: -HV, x2:  HV, y2: -HV });
    if (!cellSet.has(`${c},${rr - 1}`)) segs.push({ x1: -HV, y1:  HV, x2:  HV, y2:  HV });
    if (!cellSet.has(`${c - 1},${rr}`)) segs.push({ x1: -HV, y1: -HV, x2: -HV, y2:  HV });
    if (!cellSet.has(`${c + 1},${rr}`)) segs.push({ x1:  HV, y1: -HV, x2:  HV, y2:  HV });
    b.outlineLocal = segs;
  });
  // 隣接 cell に Constraint
  // Constraint length は実際の cell 中心間距離に合わせる:
  //   横方向 = CELL_SIZE (40)、縦方向 = CELL_VISUAL (36、密着配置のため)
  const constraints = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const dx = cells[j][0] - cells[i][0];
      const dy = cells[j][1] - cells[i][1];
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      const length = (dx !== 0) ? CELL_SIZE : CELL_VISUAL;
      constraints.push(Constraint.create({
        bodyA: bodies[i],
        bodyB: bodies[j],
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: 0 },
        length: length,
        stiffness: 1.0,
        damping: 0.5,
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
    density: 0.0022,
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

export { Engine, World, Bodies, Body, Composite, Constraint, Query, Events };
