// 矩形ピース10種 + テトリス7種のハイブリッド生成。
//
// 段階進行:
//   Stage 1-5: 矩形ピースのみ（現状版そのまま、5歳児でも遊べる）
//   Stage 6+:  テトリス形を順次追加 (I → O → T → L → J → S → Z)
//   Stage 150: 全種類 + 4方向回転で最高難度
//
// 横8列 (WALL_COL_MIN..MAX = 5..12)、土台も8列幅で一体感。
// greedy fill で row 下から走査、完全埋め保証。

import { CELL_SIZE, CELL_VISUAL, GRID_BASE_Y, WALL_COL_MIN, WALL_COL_MAX } from './physics.js';

const TOWER_HEIGHT_BASE = 15;

// 矩形ピース定義（kind = 'rect'、cells の代わりに w/h）
const RECT_PIECES = [
  { kind: 'rect', w: 4, h: 1 },
  { kind: 'rect', w: 1, h: 4 },
  { kind: 'rect', w: 3, h: 2 },
  { kind: 'rect', w: 2, h: 3 },
  { kind: 'rect', w: 2, h: 2 },
  { kind: 'rect', w: 3, h: 1 },
  { kind: 'rect', w: 1, h: 3 },
  { kind: 'rect', w: 2, h: 1 },
  { kind: 'rect', w: 1, h: 2 },
  { kind: 'rect', w: 1, h: 1 },
];

// テトリスピース定義（kind = 'tetris'）
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

// ステージごとの候補ピース集合を構築
function buildCandidates(stageNumber) {
  const candidates = RECT_PIECES.slice();
  if (stageNumber < 6) return candidates;

  // Stage 6 以降: テトリス形を順次追加
  // Stage 6: I のみ
  // Stage 12: I, O
  // Stage 24: I, O, T
  // ...
  // Stage 150: 全7種
  const tetrisProgress = Math.min(1, (stageNumber - 6) / 100);
  const numTetris = Math.min(7, 1 + Math.floor(tetrisProgress * 7));
  const maxRot = Math.min(4, 1 + Math.floor(tetrisProgress * 3));
  const shapes = TETRIS_ORDER.slice(0, numTetris);
  for (const shape of shapes) {
    for (let rot = 0; rot < maxRot; rot++) {
      candidates.push({
        kind: 'tetris',
        cells: rotateCells(TETRIS_BASE[shape], rot),
      });
    }
  }
  return candidates;
}

export function generateStage(stageNumber) {
  const r = makeRand(stageNumber * 1009 + 17);
  const progress = Math.min(1, (stageNumber - 1) / 149);
  const towerHeight = TOWER_HEIGHT_BASE + Math.floor(progress * 7);

  const candidates = buildCandidates(stageNumber);

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
    // anchor をいずれかの cell に合わせて試す
    for (const [adx, ady] of cells) {
      const baseCol = col - adx;
      const baseRow = row - ady;
      const absCells = cells.map(([dx, dy]) => [baseCol + dx, baseRow + dy]);
      if (canPlace(absCells)) {
        // 走査位置 (col, row) を含むこと
        if (absCells.some(([c, rr]) => c === col && rr === row)) {
          return absCells;
        }
      }
    }
    return null;
  }

  // 下から上、左から右走査
  for (let row = 0; row < towerHeight; row++) {
    for (let col = WALL_COL_MIN; col <= WALL_COL_MAX; col++) {
      if (occupied.has(`${col},${row}`)) continue;

      const order = shuffle(candidates, r);
      let placed = null;
      for (const cand of order) {
        let abs = null;
        if (cand.kind === 'rect') {
          abs = tryPlaceRect(col, row, cand.w, cand.h);
        } else {
          abs = tryPlaceTetris(col, row, cand.cells);
        }
        if (abs) {
          placed = { kind: cand.kind, cand, absCells: abs };
          break;
        }
      }

      if (!placed) {
        // 最後の砦: 1x1 矩形
        placed = {
          kind: 'rect',
          cand: { kind: 'rect', w: 1, h: 1 },
          absCells: [[col, row]],
        };
      }

      // 配置を occupied にマーク
      for (const [c, rr] of placed.absCells) occupied.set(`${c},${rr}`, true);
      const hue = (baseHue + pieces.length * 23) % 360;

      if (placed.kind === 'rect') {
        // 矩形ピース: bbox から col, row, w, h を取る（最小座標を起点）
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

  // 六角形は壁中央の最上段の上（縦は CELL_VISUAL 単位で密着）
  const centerCol = (WALL_COL_MIN + WALL_COL_MAX + 1) / 2;
  const towerTopY = GRID_BASE_Y - towerHeight * CELL_VISUAL;
  const hex = {
    x: centerCol * CELL_SIZE,
    y: towerTopY - 36 - 4,
    r: 36,
    hue: (baseHue + 200) % 360,
  };

  return { name: `Stage ${stageNumber}`, pieces, hex };
}
