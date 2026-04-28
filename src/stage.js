import { Composite, Body } from './physics.js';
import { makePiece, makeHexagon, createGround, createOutOfBoundsSensors } from './physics.js';
import { generateStage } from './level-gen.js';

export const TOTAL_STAGES = 150;

export async function loadStageData(stageNumber) {
  return generateStage(stageNumber);
}

export function buildStage(world, data) {
  const pieces = [];
  for (const p of data.pieces) {
    const body = makePiece(p.col, p.row, p.w, p.h, p.hue);
    Composite.add(world, body);
    pieces.push(body);
  }
  const hex = makeHexagon(data.hex.x, data.hex.y, data.hex.r, data.hex.hue);
  Body.setAngle(hex, Math.PI / 6);
  Composite.add(world, hex);

  const ground = createGround();
  Composite.add(world, ground);

  const sensors = createOutOfBoundsSensors();
  for (const s of sensors) Composite.add(world, s);

  return { pieces, hex, ground, sensors };
}

export function teardownStage(world, refs) {
  if (!refs) return;
  for (const p of refs.pieces) Composite.remove(world, p);
  if (refs.hex) Composite.remove(world, refs.hex);
  if (refs.ground) Composite.remove(world, refs.ground);
  if (refs.sensors) for (const s of refs.sensors) Composite.remove(world, s);
}
