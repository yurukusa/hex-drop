import { Composite, Body } from './physics.js';
import { makeBlock, makeHexagon, createGround, createOutOfBoundsSensors } from './physics.js';

export const STAGE_IDS = ['stage-01', 'stage-02', 'stage-03'];

export async function loadStageData(id) {
  const res = await fetch(`./stages/${id}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`stage load failed: ${id} (${res.status})`);
  return await res.json();
}

export function buildStage(world, data) {
  const blocks = [];
  for (const b of data.blocks) {
    const body = makeBlock(b.x, b.y, b.w, b.h, b.hue);
    Composite.add(world, body);
    blocks.push(body);
  }
  const hex = makeHexagon(data.hex.x, data.hex.y, data.hex.r, data.hex.hue);
  // Matter.Bodies.polygon の標準向きは頂点が上下に来る（angle=0 で角が下）。
  // 子供向けに「面が下」の安定した見た目にしたいので、30度回して辺が水平になるようにする。
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
