// Execute the real page module against an event harness, without a browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Matter from './matter.mjs';

const width=375, height=500;
class Element {
  constructor() { this.style={};this.events=new Map();this.captures=new Set();this.children=[];this.disabled=false;this.hidden=false;const set=new Set();this.classList={add:(...x)=>x.forEach(v=>set.add(v)),remove:(...x)=>x.forEach(v=>set.delete(v)),contains:x=>set.has(x)}; }
  addEventListener(type,fn) { if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn); }
  dispatch(type,properties={}) { const event={type,preventDefault(){},...properties};for(const fn of this.events.get(type)||[])fn(event); }
  getBoundingClientRect() { return {left:0,top:0,width,height,right:width,bottom:height}; }
  append(item) { this.children.push(item); }
  decode() { return Promise.resolve(); }
  focus() { document.activeElement=this; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id);this.dispatch('lostpointercapture',{pointerId:id}); }
  showModal() { this.open=true; }
  close() { this.open=false; }
}
const elements=new Map();
const get=selector=>{if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);};
const documentEvents=new Map();
globalThis.document={querySelector:get,createElement:()=>new Element(),hidden:false,addEventListener:(type,fn)=>documentEvents.set(type,fn)};
const reduced={matches:false,addEventListener(){}};
globalThis.window={Matter,matchMedia:()=>reduced};
const map=JSON.parse(await readFile(new URL('../web/assets/logo-map.json',import.meta.url)));
globalThis.fetch=async()=>({ok:true,json:async()=>map});
globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn();}};
let rafId=0, clock=0;
const callbacks=new Map();
globalThis.requestAnimationFrame=fn=>{const id=++rafId;callbacks.set(id,fn);return id;};
globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
function frames(count){for(let i=0;i<count;i++){clock+=1000/60;const batch=[...callbacks.values()];callbacks.clear();for(const fn of batch)fn(clock);}}
await import('../web/app.mjs');
const stage=get('#stage'),ring=get('#ring-target'),reset=get('#reset-button'),pieces=get('#pieces');
assert(stage.classList.contains('ready'),'Assets should enable interaction');
assert.equal(ring.disabled,false);
assert.equal(pieces.children.length,11);
const parsePosition=element=>[...element.style.transform.matchAll(/translate3d\(([-.\d]+)px,([-.\d]+)px/g)][0].slice(1).map(Number);
const center=()=>{const [x,y]=parsePosition(ring);return {clientX:x+parseFloat(ring.style.width)/2,clientY:y+parseFloat(ring.style.height)/2};};
let p=center();
ring.dispatch('pointerdown',{...p,button:0,pointerId:1,timeStamp:0});
ring.dispatch('pointermove',{clientX:p.clientX+4,clientY:p.clientY+4,pointerId:1,timeStamp:16});
assert(!stage.classList.contains('loose'),'The PNG must stay visible during a pull below the release threshold');
ring.dispatch('pointerup',{pointerId:1,timeStamp:32});
assert(!stage.classList.contains('loose'),'A small pull should reconnect');
const initial=pieces.children.map(parsePosition);
const initialAngles=pieces.children.map(e=>Number(e.style.transform.match(/rotate\(([-.\d]+)rad/)[1]));
p=center();
ring.dispatch('pointerdown',{...p,button:0,pointerId:2,timeStamp:100});
ring.dispatch('pointermove',{clientX:p.clientX+55,clientY:p.clientY-25,pointerId:2,timeStamp:200});
assert(stage.classList.contains('released'),'Drag past the threshold should release letters');
ring.dispatch('pointerup',{pointerId:2,timeStamp:220});
const rotation=pieces.children.map(()=>0);
for(let i=0;i<600;i++) {
  frames(1);
  pieces.children.forEach((e,j)=>rotation[j]=Math.max(rotation[j],Math.abs(Number(e.style.transform.match(/rotate\(([-.\d]+)rad/)[1])-initialAngles[j])));
}
assert(pieces.children.every((e,i)=>parsePosition(e)[1]>initial[i][1]+50),'Released letter sprites should fall');
assert(rotation.filter(x=>x>.1).length>=7,'The letters should rotate in flight; they may rest flat on the floor');
reset.dispatch('click');
assert(!stage.classList.contains('loose'));
assert(!stage.classList.contains('released'));
assert.deepEqual(pieces.children.map(parsePosition),initial,'Reconnect restores original positions');
ring.dispatch('keydown',{key:'Enter',repeat:false});
assert(stage.classList.contains('released'),'Keyboard release should work');
reset.dispatch('click');
reduced.matches=true;
reset.dispatch('click');
ring.dispatch('keydown',{key:' ',repeat:false});
assert(stage.classList.contains('released'));
assert.equal(callbacks.size,0,'Reduced motion must avoid animated physics');
assert(get('#live-status').textContent.includes('motion reduced'));
for(const [name,close] of [['about','dialog-close']]) {
  get(`#${name}-button`).dispatch('click');
  assert(get(`#${name}-dialog`).open,`${name} navigation should open its panel`);
  get(`#${close}`).dispatch('click');
  assert(!get(`#${name}-dialog`).open);
}
const homeHTML=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
assert(homeHTML.includes('id="collect-button" href="/collect"'),'Collect must navigate to the separate page');
assert(homeHTML.includes('id="archive-button" href="/archive"'),'Archive must navigate to the separate page');
console.log('PASS homepage events: PNG until release, SVG fall, reset, keyboard, About and page links');
