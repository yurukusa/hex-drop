// 単一矩形ピースで 10列×15段以上のグリッドを完全に埋める壁ぎっしり生成。
//
// 設計:
//   - col GROUND_COL_MIN..MAX (=10セル幅) × row 0..towerHeight-1 を完全埋め
//   - greedy fill: 大きい矩形から先に試行 → ダメなら小さく → 最後 1x1
//   - 全セル占有保証、隙間ゼロ
//   - 段数 15 → 22、ピース種類は段階的に解放
//
// 物理は単純矩形なので安定、複合剛体不要。
import { CELL_SIZE, GRID_BASE_Y } from './physics.js';

const GROUND_COL_MIN = 4;
const GROUND_COL_MAX = 13;
const TOWER_HEIGHT_BASE = 15;

// 大きい順に試す（greedy fill が大きいピースを優先するため）
const ALL_PIECE_TYPES = [
  { w: 4, h: 1 },  // 横I
  { w: 1, h: 4 },  // 縦I
  { w: 3, h: 2 },  // 横長
  { w: 2, h: 3 },  // 縦長
  { w: 2, h: 2 },  // O
  { w: 3, h: 1 },  // 3連横
  { w: 1, h: 3 },  // 3連縦
  { w: 2, h: 1 },  // 2連横
  { w: 1, h: 2 },  // 2連縦
  { w: 1, h: 1 },  // 単独（隙間埋め）
];

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

function shuffle(arr, r) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateStage(stageNumber) {
  const r = makeRand(stageNumber * 1009 + 17);
  const progress = Math.min(1, (stageNumber - 1) / 149);

  const towerHeight = TOWER_HEIGHT_BASE + Math.floor(progress * 7);

  // 利用するピース種類数（大→小の順、最後の 1x1 は常に利用可能）
  // Stage 1: 4種類 (4x1, 1x4, 3x2, 2x3) + 1x1 → 5種
  // Stage 150: 全 10 種
  const numPieceTypes = Math.min(ALL_PIECE_TYPES.length, 5 + Math.floor(progress * 5));
  const typeBag = ALL_PIECE_TYPES.slice(0, numPieceTypes - 1);
  // ALL_PIECE_TYPES の最後は (1,1)、これは常に隙間埋め用に保持
  const fillerType = { w: 1, h: 1 };

  const baseHue = (stageNumber * 47) % 360;
  const occupied = new Map();
  const pieces = [];

  function canPlace(col, row, w, h) {
    if (col < GROUND_COL_MIN || col + w - 1 > GROUND_COL_MAX) return false;
    if (row < 0 || row + h - 1 >= towerHeight) return false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (occupied.has(`${col + dx},${row + dy}`)) return false;
      }
    }
    return true;
  }

  function place(col, row, w, h, hue) {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.set(`${col + dx},${row + dy}`, true);
      }
    }
    pieces.push({ col, row, w, h, hue });
  }

  // 下から上へ、左から右へ走査
  for (let row = 0; row < towerHeight; row++) {
    for (let col = GROUND_COL_MIN; col <= GROUND_COL_MAX; col++) {
      if (occupied.has(`${col},${row}`)) continue;

      // ランダムな順序でピース種類を試す
      const tries = shuffle(typeBag, r);
      let placed = false;
      for (const t of tries) {
        if (canPlace(col, row, t.w, t.h)) {
          place(col, row, t.w, t.h, (baseHue + pieces.length * 17) % 360);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // 1x1 で埋める
        place(col, row, fillerType.w, fillerType.h, (baseHue + pieces.length * 17) % 360);
      }
    }
  }

  // 六角形は土台中央の真上、最上段の上に隙間あり
  const centerCol = (GROUND_COL_MIN + GROUND_COL_MAX + 1) / 2; // 9
  const towerTopY = GRID_BASE_Y - towerHeight * CELL_SIZE;
  const hex = {
    x: centerCol * CELL_SIZE,
    y: towerTopY - 36 - 8,
    r: 36,
    hue: (baseHue + 200) % 360,
  };

  return { name: `Stage ${stageNumber}`, pieces, hex };
}
