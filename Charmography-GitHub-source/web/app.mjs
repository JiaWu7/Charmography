import { createScene } from './physics.mjs?v=soft-3';

const stage = document.querySelector('#stage');
const original = document.querySelector('#original-logo');
const ringTarget = document.querySelector('#ring-target');
const ringImage = document.querySelector('#ring-image');
const pieces = document.querySelector('#pieces');
const reset = document.querySelector('#reset-button');
const hint = document.querySelector('#drag-hint');
const status = document.querySelector('#live-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
for (const [name, closeId] of [['about','dialog-close']]) {
  const dialog = document.querySelector(`#${name}-dialog`);
  document.querySelector(`#${name}-button`).addEventListener('click', () => dialog.showModal());
  document.querySelector(`#${closeId}`).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if(event.target===dialog) { const b=dialog.getBoundingClientRect(); if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom) dialog.close(); } });
}

let scene, map, nodes, drag = null, frame = null, lastTime = 0, accumulator = 0;
let mode = 'connected', measured = null;

function draw() {
  scene.letters.forEach((item,i) => {
    const p = item.body.position;
    nodes[i].style.transform = `translate3d(${p.x-item.width/2}px,${p.y-item.height/2}px,0) rotate(${item.body.angle}rad)`;
  });
  const p = scene.ring.position;
  const hit = Math.max(56, scene.ringSize);
  ringTarget.style.width = `${hit}px`;
  ringTarget.style.height = `${hit}px`;
  ringTarget.style.transform = `translate3d(${p.x-hit/2}px,${p.y-hit/2}px,0) rotate(${scene.ring.angle}rad)`;
}

function revealPieces() {
  stage.classList.add('loose');
}

function release() {
  if (scene.released) return;
  revealPieces();
  scene.release();
  mode = 'released';
  stage.classList.add('released');
  status.textContent = reducedMotion.matches
    ? 'The o has disconnected. The letters have been placed at the bottom with motion reduced. Select Reconnect to restore the logo.'
    : 'The o has disconnected. The letters are falling. Select Reconnect to restore the logo.';
  draw();
  startLoop();
}

function loop(time) {
  frame = null;
  if (!scene.released || document.hidden) { lastTime = 0; return; }
  const elapsed = lastTime ? Math.min(time-lastTime, 50) : 1000/60;
  lastTime = time;
  accumulator += elapsed;
  while (accumulator >= 1000/120) { scene.step(); accumulator -= 1000/120; }
  draw();
  if (!scene.settled || drag) frame = requestAnimationFrame(loop);
  else lastTime = 0;
}
function startLoop() {
  if (!frame && scene.released && !reducedMotion.matches) frame = requestAnimationFrame(loop);
}

function reconnect(announce = true) {
  if (frame) cancelAnimationFrame(frame);
  frame = null; lastTime = 0; accumulator = 0;
  const wasDragging = drag;
  drag = null;
  if (wasDragging && ringTarget.hasPointerCapture(wasDragging.id)) ringTarget.releasePointerCapture(wasDragging.id);
  scene?.destroy();
  const box = stage.getBoundingClientRect();
  measured = {width:box.width, height:box.height};
  scene = createScene(window.Matter, map, box.width, box.height, {reducedMotion:reducedMotion.matches});
  mode = 'connected';
  stage.classList.remove('loose', 'released');
  ringTarget.classList.remove('dragging');
  const logoWidth = map.bounds.width*scene.scale;
  original.style.width = `${logoWidth}px`;
  original.style.height = `${map.bounds.height*scene.scale}px`;
  original.style.left = `${scene.left}px`;
  original.style.top = `${scene.top}px`;
  original.style.transform = 'none';
  scene.letters.forEach((item,i) => { nodes[i].style.width = `${item.width}px`; nodes[i].style.height = `${item.height}px`; });
  ringImage.style.width = `${scene.ringWidth}px`;
  ringImage.style.height = `${scene.ringHeight}px`;
  const narrow = box.width <= 640;
  hint.style.left = narrow ? `${Math.max(75,scene.ringOrigin.x-20)}px` : `${scene.ringOrigin.x+61}px`;
  hint.style.top = `${narrow ? scene.top+map.bounds.height*scene.scale+74 : scene.ringOrigin.y+88}px`;
  draw();
  if (announce) status.textContent = 'Reconnected. Drag the grey o, or press Enter on it, to release the letters again.';
}

function localPoint(event) {
  const box = stage.getBoundingClientRect();
  return {x:event.clientX-box.left, y:event.clientY-box.top};
}
ringTarget.addEventListener('pointerdown', event => {
  if (!scene || drag || event.button !== 0) return;
  event.preventDefault();
  ringTarget.focus({preventScroll:true});
  const p = localPoint(event);
  drag = {id:event.pointerId, origin:{...scene.ring.position}, offset:{x:p.x-scene.ring.position.x,y:p.y-scene.ring.position.y}, previous:p, time:event.timeStamp, velocity:{x:0,y:0}};
  scene.holdRing();
  ringTarget.setPointerCapture(event.pointerId);
  ringTarget.classList.add('dragging');
  startLoop();
});
ringTarget.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  event.preventDefault();
  const p = localPoint(event);
  const dt = Math.max(8, event.timeStamp-drag.time);
  drag.velocity = {x:(p.x-drag.previous.x)*16.67/dt, y:(p.y-drag.previous.y)*16.67/dt};
  drag.previous = p; drag.time = event.timeStamp;
  const destination = {x:p.x-drag.offset.x, y:p.y-drag.offset.y};
  scene.moveRing(destination);
  const distance = Math.hypot(scene.ring.position.x-drag.origin.x, scene.ring.position.y-drag.origin.y);
  // The original PNG remains visible until the ring actually disconnects.
  if (distance > Math.max(12, Math.min(26,scene.ringSize*.2))) release();
  draw();
  startLoop();
});

function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const finished = drag;
  drag = null;
  ringTarget.classList.remove('dragging');
  if (ringTarget.hasPointerCapture(finished.id)) ringTarget.releasePointerCapture(finished.id);
  if (mode === 'connected') reconnect(false);
  else { scene.letGoRing(event.type === 'pointercancel' ? {x:0,y:0} : finished.velocity); draw(); startLoop(); }
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) ringTarget.addEventListener(type, endDrag);
ringTarget.addEventListener('keydown', event => {
  if ((event.key==='Enter' || event.key===' ') && !event.repeat) {
    event.preventDefault();
    if (!scene.released) { release(); scene.letGoRing({x:0,y:0}); draw(); startLoop(); }
  }
});
reset.addEventListener('click', () => reconnect());
reducedMotion.addEventListener('change', () => { if(scene) reconnect(); });
document.addEventListener('visibilitychange', () => {
  if(document.hidden && frame) { cancelAnimationFrame(frame); frame=null; lastTime=0; }
  else if(scene) startLoop();
});

try {
  if (!window.Matter) throw new Error('Physics library unavailable');
  const response = await fetch('assets/logo-map.json?v=soft-3');
  if (!response.ok) throw new Error('Logo map unavailable');
  map = await response.json();
  nodes = map.glyphs.map(glyph => {
    const img = document.createElement('img');
    img.src = glyph.src.startsWith('data:') ? glyph.src : `${glyph.src}?v=soft-3`;
    img.alt = ''; img.className = 'letter'; img.draggable = false;
    pieces.append(img);
    return img;
  });
  await Promise.all([document.querySelector('#logo-image'),ringImage,...nodes].map(img=>img.decode()));
  reconnect(false);
  ringTarget.disabled = false; reset.disabled = false;
  stage.classList.add('ready');
  new ResizeObserver(() => {
    const box = stage.getBoundingClientRect();
    if(Math.abs(box.width-measured.width)>1 || Math.abs(box.height-measured.height)>35) reconnect(false);
  }).observe(stage);
} catch (error) {
  document.querySelector('#error-message').hidden = false;
  status.textContent = 'The interactive logo could not load. Refresh the page to try again.';
  console.error('Charmography interaction:', error);
}
