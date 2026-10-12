import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { initArchive } from '../web/archive.mjs';

const records=JSON.parse(await readFile(new URL('../source/archive-records.json',import.meta.url),'utf8'));
assert.deepEqual(records.map(r=>r.id),['tt','jj','xy','bb','cc','ss']);
const html=await readFile(new URL('../web/archive.html',import.meta.url),'utf8');
assert.deepEqual([...html.matchAll(/data-record-id="([a-z]+)"/g)].map(x=>x[1]),records.map(r=>r.id));
assert(html.includes('aria-current="page" href="/archive"'));
const embedded=JSON.parse(html.match(/<script id="archive-records" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded,records);

function harness(hash='') {
  const elements=new Map();
  class Element {
    constructor(id){this.id=id;this.events=new Map();this.textContent='';this.dataset={};this.style={};this.attrs={};this.open=false;this.disabled=false;}
    addEventListener(type,fn){const list=this.events.get(type)??[];list.push(fn);this.events.set(type,list);}
    dispatch(type,properties={}){for(const fn of this.events.get(type)??[])fn({target:this,preventDefault(){},...properties});}
    showModal(){this.open=true;}
    close(){this.open=false;this.dispatch('close');}
    focus(){doc.activeElement=this;}
    setAttribute(key,value){this.attrs[key]=value;}
    getBoundingClientRect(){return {left:20,top:20,right:600,bottom:600};}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const buttons=records.map(r=>{const button=get('charm-'+r.id);button.dataset.recordId=r.id;return button;});
  const doc={getElementById:get,querySelectorAll:()=>buttons,body:{style:{overflow:''}},activeElement:buttons[0]};
  get('archive-records').textContent=JSON.stringify(records);
  const location={href:'https://charmography.example/archive'+hash,hash};
  const history={replaceState(state,title,url){location.href=url.href;location.hash=url.hash;},state:null};
  const events=new Map();
  const window={addEventListener:(type,fn)=>events.set(type,fn)};
  return {doc,get,buttons,location,history,window,events};
}
const h=harness(),{get}=h;
const app=initArchive(h.doc,h);
for(let i=0;i<records.length;i++) {
  h.buttons[i].dispatch('click');
  assert(get('record-dialog').open);assert.equal(app.current,i);
  assert.equal(get('record-title').textContent,records[i].title);
  assert.equal(get('record-owner').textContent,records[i].owner);
  assert.equal(get('record-photo').attrs.viewBox,records[i].crop.join(' '));
  for(const field of ['origin','accumulation','outcome'])assert.equal(get('record-'+field).textContent,records[i][field]);
  assert.equal(h.location.hash,'#'+records[i].id);assert.equal(h.doc.body.style.overflow,'hidden');
  get('record-close').dispatch('click');assert(!get('record-dialog').open);
  assert.equal(h.doc.activeElement,h.buttons[i]);assert.equal(h.doc.body.style.overflow,'');assert.equal(h.location.hash,'');
}
h.buttons[0].dispatch('click');assert(get('record-previous').disabled);
get('record-previous').dispatch('click');assert.equal(app.current,0);
get('record-next').dispatch('click');assert.equal(app.current,1);
get('record-dialog').dispatch('keydown',{key:'ArrowRight'});assert.equal(app.current,2);
get('record-dialog').dispatch('keydown',{key:'ArrowLeft'});assert.equal(app.current,1);
for(let i=0;i<10;i++)get('record-next').dispatch('click');assert.equal(app.current,5);assert(get('record-next').disabled);
get('record-dialog').dispatch('click',{clientX:100,clientY:100});assert(get('record-dialog').open);
get('record-dialog').dispatch('click',{clientX:0,clientY:0});assert(!get('record-dialog').open);
get('about-button').dispatch('click');assert(get('about-dialog').open);
get('dialog-close').dispatch('click');assert(!get('about-dialog').open);
const linked=harness('#ss'),linkApp=initArchive(linked.doc,linked);assert.equal(linkApp.current,5);assert(linked.get('record-dialog').open);
linked.location.hash='';linked.events.get('hashchange')();assert(!linked.get('record-dialog').open);
// A hosted file preview can block history changes; opening a story still works.
const restricted=harness();restricted.history.replaceState=()=>{throw new Error('Blocked history');};
initArchive(restricted.doc,restricted);restricted.buttons[0].dispatch('click');assert(restricted.get('record-dialog').open);

if(process.env.CHARMOGRAPHY_ARCHIVE_PREVIEW) {
  const preview=await readFile(process.env.CHARMOGRAPHY_ARCHIVE_PREVIEW,'utf8');
  assert(!/<(?:script|link)[^>]+(?:src|href)="\//.test(preview));
  const script=[...preview.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const p=harness();
  vm.runInNewContext(script,{document:p.doc,location:p.location,history:p.history,window:p.window,URL});
  p.buttons[3].dispatch('click');assert(p.get('record-dialog').open);
  assert.equal(p.get('record-title').textContent,records[3].title);
  p.get('record-next').dispatch('click');assert.equal(p.get('record-title').textContent,records[4].title);
  p.get('record-close').dispatch('click');assert(!p.get('record-dialog').open);
  console.log('PASS offline archive HTML: embedded photographs, opening, next and close');
}
console.log('PASS archive: all six image/story mappings, deep links, keyboard browsing, bounds, close, focus restoration and About');
