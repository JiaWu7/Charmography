import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Matter from './matter.mjs';
import { createScene } from '../web/physics.mjs';

const map = JSON.parse(await readFile(new URL('../web/assets/logo-map.json',import.meta.url)));
assert.equal(map.glyphs.map(x=>x.char).join(''), 'Charmgraphy');
for (const [width,height] of [[320,430],[375,500],[768,600],[1440,660],[2560,850]]) {
  const scene = createScene(Matter,map,width,height);
  assert.equal(scene.letters.length,11);
  for(let i=0;i<60;i++) scene.step();
  for(const item of scene.letters) {
    assert.equal(item.body.isStatic,true);
    assert.deepEqual(item.body.position,item.origin);
  }
  scene.holdRing();
  scene.moveRing({x:scene.ringOrigin.x+50,y:scene.ringOrigin.y-50});
  for(const item of scene.letters) assert.deepEqual(item.body.position,item.origin);
  scene.release();
  scene.letGoRing({x:1,y:-1});
  const rotation = scene.letters.map(()=>0);
  for(let i=0;i<240;i++) {
    scene.step();
    scene.letters.forEach((x,j)=>rotation[j]=Math.max(rotation[j],Math.abs(x.body.angle-(x.glyph.rotation??0)*Math.PI/180)));
  }
  assert(scene.letters.every(x=>x.body.position.y>x.origin.y+50),`${width}: every letter should fall`);
  assert(rotation.filter(x=>x>.12).length>=7,`${width}: letters should rotate during their fall`);
  for(let i=0;i<1200;i++) scene.step();
  for (const body of [...scene.letters.map(x=>x.body),scene.ring]) {
    assert(Number.isFinite(body.position.x)&&Number.isFinite(body.position.y),`${width}: stable coordinates`);
    assert(body.bounds.max.y<=scene.floor+4,`${width}: floor contact ${body.label}`);
    const border=width<=640?18:28;
    assert(body.bounds.min.x>=border-4,`${width}: left boundary ${body.label}`);
    assert(body.bounds.max.x<=width-border+4,`${width}: right boundary ${body.label}`);
  }
  scene.destroy();
  const reduced = createScene(Matter,map,width,height,{reducedMotion:true});
  reduced.release();
  assert(reduced.settled);
  for(const item of reduced.letters) {
    assert(item.body.isStatic);
    assert(Math.abs(item.body.position.y+item.height/2-reduced.floor)<.001);
  }
  reduced.destroy();
  console.log(`PASS ${width}px: held logo, release, rotation, floor, walls, reduced motion`);
}
const slower=createScene(Matter,map,1440,660), previous=createScene(Matter,map,1440,660);
previous.engine.gravity.y=1.1;
for(const scene of [slower,previous]) {scene.release();scene.letGoRing();}
for(let i=0;i<60;i++) {slower.step();previous.step();}
const meanFall=scene=>scene.letters.reduce((sum,x)=>sum+x.body.position.y-x.origin.y,0)/scene.letters.length;
assert(meanFall(slower)<meanFall(previous)*.9,'The updated fall should be slightly slower than the previous gravity');
slower.destroy();previous.destroy();
console.log('PASS slower fall relative to the previous version');
