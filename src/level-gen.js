// 矩形ピース10種 + テトリス7種のハイブリッド生成（改善版）。
//
// ぐらすフィードバック反映:
//   - 最下段 (row=0) は 1x1 / 2x1 / 1x2 のみ → 「下2個タップで突破」を封じる
//   - 大きい横長/縦長ピースは row >= 1 のみで使用
//   - Stage 6 以降は確実にテトリス3個以上、Stage 150 で40個以上
//   - greedy fill が縦長偏りしないよう、横長と縦長を毎走査でランダム順
//
// 段階進行:
//   Stage 1-5:  矩形のみ
//   Stage 6+:   テトリスを上層に強制配置 (上段から順にテトリス候補を優先)
//   Stage 150:  全7種＋4回転、テトリス比率最大

import { CELL_SIZE, CELL_VISUAL, GRID_BASE_Y, WALL_COL_MIN, WALL_COL_MAX } from './physics.js';

// 塔高さ: Stage 1-24: 11段、Stage 25 から10ステージごとに+1段、Stage 75 で17段到達、以降17段固定。
// スマホ画面 (1280px) で最上段が見切れない最大値が17段 (CELL_VISUAL=60、六角形含む)。
function towerHeightFor(stageNumber) {
  if (stageNumber < 25) return 11;
  return Math.min(17, 11 + Math.floor((stageNumber - 15) / 10));
}

// 最下段専用（row=0）: 横方向に2列以上またがるピース or 1x1 単発のみ。
// 縦長 (1x2 等) は外側列が独立してしまうので不採用。
const FOUNDATION_PIECES = [
  { kind: 'rect', w: 2, h: 1 },
  { kind: 'rect', w: 1, h: 1 },
];

// 上層（row>=1）の矩形ピース。
// すべて w >= 2 を保証（外側列が独立しないように）。1x1 は最後のフィラーのみ。
const RECT_LARGE = [
  { kind: 'rect', w: 4, h: 1 },   // 横I
  { kind: 'rect', w: 3, h: 2 },   // 横長
  { kind: 'rect', w: 2, h: 2 },   // O
  { kind: 'rect', w: 3, h: 1 },
  { kind: 'rect', w: 2, h: 1 },
];

const TETRIS_BASE = {
  I: [[0,0],[1,0],[2,0],[3,0]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[0,0],[1,0],[2,0],[1,1]],
  L: [[0,0],[1,0],[2,0],[2,1]],
  J: [[0,0],[1,0],[2,0],[0,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
};
const TETRIS_ORDER = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];

function makeRand(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotateCells(cells, times) {
  let out = cells.map(c => [c[0], c[1]]);
  for (let k = 0; k < (((times % 4) + 4) % 4); k++) {
    out = out.map(([x, y]) => [-y, x]);
    const minX = Math.min(...out.map(c => c[0]));
    const minY = Math.min(...out.map(c => c[1]));
    out = out.map(([x, y]) => [x - minX, y - minY]);
  }
  return out;
}

function shuffle(arr, r) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildTetrisCandidates(stageNumber) {
  if (stageNumber < 6) return [];
  // T/S/Z を最優先 (難度高、噛み合いが面白い)。O は最低 (簡単、面白みが薄い)。
  // 候補配列に同形を重み回数追加し、shuffle で T/S/Z が選ばれやすくする。
  const weights = {
    T: 5, S: 5, Z: 5,    // 最優先 (凹凸でロック)
    L: 3, J: 3,          // 中
    I: 2,                // 細長
    O: 1,                // 最低 (正方形は簡単)
  };
  const maxRot = Math.min(4, 1 + Math.floor((stageNumber - 6) / 48));
  const out = [];
  for (const shape of TETRIS_ORDER) {
    for (let rot = 0; rot < maxRot; rot++) {
      const cells = rotateCells(TETRIS_BASE[shape], rot);
      // 縦1列だけのピース (I_v 等) は除外: 外側列が独立してしまう
      const xs = cells.map(c => c[0]);
      const width = Math.max(...xs) - Math.min(...xs) + 1;
      if (width < 2) continue;
      for (let w = 0; w < weights[shape]; w++) {
        out.push({ kind: 'tetris', cells });
      }
    }
  }
  return out;
}

// テトリス出現比率: Stage 6 で 70%、Stage 150 で 100%
function tetrisProbability(stageNumber) {
  if (stageNumber < 6) return 0;
  const t = Math.min(1, (stageNumber - 6) / 144);
  return 0.7 + t * 0.3;
}

export function generateStage(stageNumber) {
  const r = makeRand(stageNumber * 1009 + 17);
  const progress = Math.min(1, (stageNumber - 1) / 149);
  const towerHeight = towerHeightFor(stageNumber);

  const tetrisCandidates = buildTetrisCandidates(stageNumber);
  const tetrisProb = tetrisProbability(stageNumber);

  const baseHue = (stageNumber * 47) % 360;
  const occupied = new Map();
  const pieces = [];

  function canPlace(absCells) {
    for (const [c, rr] of absCells) {
      if (c < WALL_COL_MIN || c > WALL_COL_MAX) return false;
      if (rr < 0 || rr >= towerHeight) return false;
      if (occupied.has(`${c},${rr}`)) return false;
    }
    return true;
  }

  function tryPlaceRect(col, row, w, h) {
    const absCells = [];
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        absCells.push([col + dx, row + dy]);
      }
    }
    return canPlace(absCells) ? absCells : null;
  }

  function tryPlaceTetris(col, row, cells) {
    for (const [adx, ady] of cells) {
      const baseCol = col - adx;
      const baseRow = row - ady;
      const absCells = cells.map(([dx, dy]) => [baseCol + dx, baseRow + dy]);
      if (canPlace(absCells) && absCells.some(([c, rr]) => c === col && rr === row)) {
        return absCells;
      }
    }
    return null;
  }

  function tryAll(col, row, candidates) {
    for (const cand of candidates) {
      const abs = (cand.kind === 'rect')
        ? tryPlaceRect(col, row, cand.w, cand.h)
        : tryPlaceTetris(col, row, cand.cells);
      if (abs) return { cand, absCells: abs };
    }
    return null;
  }

  // 下から上、左から右走査
  for (let row = 0; row < towerHeight; row++) {
    for (let col = WALL_COL_MIN; col <= WALL_COL_MAX; col++) {
      if (occupied.has(`${col},${row}`)) continue;

      let placed = null;

      if (row === 0) {
        // 最下段: 小ピース矩形のみ
        placed = tryAll(col, row, shuffle(FOUNDATION_PIECES, r));
      } else if (tetrisCandidates.length > 0) {
        // 上層: テトリスを最優先で全候補試行
        placed = tryAll(col, row, shuffle(tetrisCandidates, r));
        // テトリスがどれも置けない時のみ矩形にフォールバック
        if (!placed) {
          placed = tryAll(col, row, shuffle(RECT_LARGE, r));
        }
      } else {
        // Stage 1-5: 矩形のみ
        placed = tryAll(col, row, shuffle(RECT_LARGE, r));
      }

      if (!placed) {
        // 1x1 単発を避けるため、右隣が空きなら 2x1 で埋める（横方向に連結）
        if (col + 1 <= WALL_COL_MAX && !occupied.has(`${col + 1},${row}`)) {
          placed = { cand: { kind: 'rect', w: 2, h: 1 }, absCells: [[col, row], [col + 1, row]] };
        } else {
          // どうしても 1x1 が必要な場合のみ
          placed = { cand: { kind: 'rect', w: 1, h: 1 }, absCells: [[col, row]] };
        }
      }

      for (const [c, rr] of placed.absCells) occupied.set(`${c},${rr}`, true);
      const hue = (baseHue + pieces.length * 23) % 360;

      if (placed.cand.kind === 'rect') {
        const xs = placed.absCells.map(c => c[0]);
        const ys = placed.absCells.map(c => c[1]);
        const minC = Math.min(...xs);
        const minR = Math.min(...ys);
        const maxC = Math.max(...xs);
        const maxR = Math.max(...ys);
        pieces.push({
          kind: 'rect',
          col: minC, row: minR,
          w: maxC - minC + 1,
          h: maxR - minR + 1,
          hue,
        });
      } else {
        pieces.push({
          kind: 'tetris',
          cells: placed.absCells,
          hue,
        });
      }
    }
  }

  const centerCol = (WALL_COL_MIN + WALL_COL_MAX + 1) / 2;
  const towerTopY = GRID_BASE_Y - towerHeight * CELL_VISUAL;
  const hex = {
    x: centerCol * CELL_SIZE,
    y: towerTopY - 70 - 4,
    r: 70,
    hue: (baseHue + 200) % 360,
  };

  return { name: `Stage ${stageNumber}`, pieces, hex };
}
