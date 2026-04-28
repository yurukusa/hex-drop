// stage 4-150 を stageNumber から決定的生成。
//
// 自動崩壊しない構造規則（ぐらす要件: 操作なしで失敗するクリア不能ステージは禁止）:
//   1. 最下段は中央広幅。重心は必ず土台中央 ±50px 以内
//   2. 各段の幅は前段以下、当段の中心は前段の左右範囲内に収める
//      → 当段の下底面は必ず前段の上面に完全に乗る
//   3. 六角形は最上段の真上、隙間あり
// 難易度は段数と段ごとの中心オフセット幅で調整する（橋構造は採用せず、
// 安定保証を最優先）。

import { WORLD_W } from './physics.js';

const CX = WORLD_W / 2;       // 360
const Y_BASE = 1180;          // 最下段の中心Y
const ROW_H = 40;
const ROW_GAP = 2;
const STEP = ROW_H + ROW_GAP;

// mulberry32: ステージ番号から再現可能な擬似乱数
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

export function generateStage(stageNumber) {
  const r = makeRand(stageNumber * 1009 + 17);
  // 段数: 4〜12（stage 4 で 4段、stage 150 で 12段）
  const progress = Math.min(1, (stageNumber - 4) / 146);
  const N = 4 + Math.floor(progress * 8);
  const baseHue = (stageNumber * 47) % 360;

  // 非対称度の進行: 序盤は対称、後半ほど大きくずらす
  const asymStrength = Math.min(1, Math.max(0, (stageNumber - 10) / 60));

  const blocks = [];
  let prevCx = CX;
  let prevW = 220 + Math.floor(r() * 40); // 最下段は 220-260

  blocks.push({ x: prevCx, y: Y_BASE, w: prevW, h: ROW_H, hue: baseHue });

  for (let i = 1; i < N; i++) {
    let w;
    if (i === 1) {
      // 二段目で一気に細くする（テトリス風の「柱が立つ」見た目）
      w = Math.max(80, Math.floor(prevW * (0.35 + r() * 0.2)));
    } else if (i === N - 1) {
      // 最上段は再度幅を広めにして、六角形が乗る台座にする
      w = Math.min(prevW, Math.max(120, Math.floor(prevW + 60 + r() * 40)));
    } else {
      // 中段は前段から緩やかに変動
      const span = Math.min(40, prevW - 60);
      const target = prevW - 10 - Math.floor(r() * span);
      w = Math.max(60, Math.min(prevW, target));
    }

    // 中心の許容オフセット: 前段の上に完全に乗る範囲（4px の安全マージン）
    const maxOffset = Math.max(0, (prevW - w) / 2 - 4);
    const offset = (r() - 0.5) * 2 * maxOffset * asymStrength;
    const cx = prevCx + offset;

    blocks.push({
      x: cx,
      y: Y_BASE - i * STEP,
      w,
      h: ROW_H,
      hue: (baseHue + i * 28) % 360,
    });

    prevCx = cx;
    prevW = w;
  }

  const top = blocks[blocks.length - 1];
  const hex = {
    x: top.x,
    y: top.y - ROW_H / 2 - 36 - 6,
    r: 36,
    hue: (baseHue + 200) % 360,
  };

  return { name: `Stage ${stageNumber}`, blocks, hex };
}
