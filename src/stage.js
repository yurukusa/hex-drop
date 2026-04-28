import { Composite, Body } from './physics.js';
import { makeBlock, makeHexagon, createGround, createOutOfBoundsSensors } from './physics.js';
import { generateStage } from './level-gen.js';

export const TOTAL_STAGES = 150;
const HANDWRITTEN = new Set([1, 2, 3]);

export async function loadStageData(stageNumber) {
  if (HANDWRITTEN.has(stageNumber)) {
    const id = `stage-${String(stageNumber).padStart(2, '0')}`;
    const res = await fetch(`./stages/${id}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`stage load failed: ${id} (${res.status})`);
    return await res.json();
  }
  return generateStage(stageNumber);
}

export function buildStage(world, data) {
  const blocks = [];
  for (const b of data.blocks) {
    const body = makeBlock(b.x, b.y, b.w, b.h, b.hue);
    Composite.add(world, body);
    blocks.push(body);
  }
  const hex = makeHexagon(data.hex.x, data.hex.y, data.hex.r, data.hex.hue);
  // Matter の polygon は標準で頂点が上下に来る。30度回して辺を水平に。
  Body.setAngle(hex, Math.PI / 6);
  Composite.add(world, hex);

  const ground = createGround();
  Composite.add(world, ground);

  const sensors = createOutOfBoundsSensors();
  for (const s of sensors) Composite.add(world, s);

  return { blocks, hex, ground, sensors };
}

export function teardownStage(world, refs) {
  if (!refs) return;
  for (const b of refs.blocks) Composite.remove(world, b);
  if (refs.hex) Composite.remove(world, refs.hex);
  if (refs.ground) Composite.remove(world, refs.ground);
  if (refs.sensors) for (const s of refs.sensors) Composite.remove(world, s);
}
