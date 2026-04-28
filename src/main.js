import { Renderer } from './render.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import { SoundEngine } from './audio.js';
import { Effects } from './effects.js';

async function boot() {
  if (!window.Matter) {
    document.body.innerHTML = '<div style="padding:24px;color:#eaeaff;font-family:sans-serif">Matter.js の読み込みに失敗しました。ネット接続を確認して再読み込みしてください。</div>';
    return;
  }

  const canvas = document.getElementById('stage');
  const renderer = new Renderer(canvas);
  const hud = new Hud();
  const audio = new SoundEngine();
  const effects = new Effects();
  const game = new Game(renderer, hud, audio, effects);

  new Input(canvas, renderer, (x, y) => game.handleTap(x, y));

  await game.loadStage(0);

  let last = performance.now();
  function loop(now) {
    let dt = now - last;
    last = now;
    if (dt > 33) dt = 33;
    if (dt < 0) dt = 16;
    game.update(dt);
    game.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
