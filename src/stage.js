import { Composite, Body } from './physics.js';
import { makeRectPiece, makeCellPiece, makeHexagon, createGround, createOutOfBoundsSensors, activatePiece } from './physics.js';
import { generateStage } from './level-gen.js';

export const TOTAL_STAGES = 150;

export async function loadStageData(stageNumber) {
  return generateStage(stageNumber);
}

export function buildStage(world, data) {
  const pieces = [];
  // 全 piece を isStatic で構築（初期接触の爆発を回避）
  for (const p of data.pieces) {
    if (p.kind === 'rect') {
      const piece = makeRectPiece(p.col, p.row, p.w, p.h, p.hue, /*isStatic=*/ true);
      Composite.add(world, piece.body);
      pieces.push(piece);
    } else {
      const piece = makeCellPiece(p.cells, p.hue, /*isStatic=*/ true);
      Composite.add(world, piece.body);
      pieces.push(piece);
    }
  }
  const hex = makeHexagon(data.hex.x, data.hex.y, data.hex.r, data.hex.hue);
  Body.setAngle(hex, Math.PI / 6);
  Body.setStatic(hex, true);
  Composite.add(world, hex);

  const ground = createGround();
  Composite.add(world, ground);

  const sensors = createOutOfBoundsSensors();
  for (const s of sensors) Composite.add(world, s);

  return { pieces, hex, ground, sensors };
}

// プレイ開始: 全 piece + 六角形を動的化
export function activateStage(refs) {
  if (!refs) return;
  for (const p of refs.pieces) activatePiece(p);
  if (refs.hex) Body.setStatic(refs.hex, false);
}

export function removePiece(world, piece) {
  if (piece.type === 'rect') {
    Composite.remove(world, piece.body);
  } else {
    Composite.remove(world, piece.body);
  }
}

export function teardownStage(world, refs) {
  if (!refs) return;
  for (const p of refs.pieces) removePiece(world, p);
  if (refs.hex) Composite.remove(world, refs.hex);
  if (refs.ground) Composite.remove(world, refs.ground);
  if (refs.sensors) for (const s of refs.sensors) Composite.remove(world, s);
}
