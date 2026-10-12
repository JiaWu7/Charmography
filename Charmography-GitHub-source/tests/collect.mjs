import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { initCollect } from '../web/collect.mjs';

function harness(options={}) {
  const elements=new Map(),revoked=[],calls=[];
  class Element {
    constructor(id){this.id=id;this.name=id;this.events=new Map();this.hidden=false;this.disabled=false;this.value='';this.src='';this.textContent='';this.style={};this.attrs={};this.classes=new Set();this.classList={add:(...names)=>names.forEach(x=>this.classes.add(x)),remove:(...names)=>names.forEach(x=>this.classes.delete(x)),contains:name=>this.classes.has(name)};}
    addEventListener(type,fn){const list=this.events.get(type)??[];list.push(fn);this.events.set(type,list);}
    dispatch(type,props={}){return Promise.all((this.events.get(type)??[]).map(fn=>fn({preventDefault(){},target:this,...props})));}
    focus(){doc.activeElement=this;}
    click(){this.clicks=(this.clicks??0)+1;}
    setAttribute(key,value){this.attrs[key]=value;}
    removeAttribute(key){delete this.attrs[key];}
    reportValidity(){return ['origin','accumulation','outcome'].every(id=>get(id).value.length<=2000);}
    reset(){for(const id of ['origin','accumulation','outcome','photo-input'])get(id).value='';}
    showModal(){this.open=true;}
    close(){this.open=false;}
    getBoundingClientRect(){return {left:0,top:0,right:100,bottom:100};}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const doc={getElementById:get};
  let reply={ok:true,json:async()=>({id:'saved-story'})};
  const urls={createObjectURL:file=>'blob:'+file.name,revokeObjectURL:url=>revoked.push(url)};
  const fetch=async(url,settings)=>{calls.push({url,...settings});return typeof reply==='function'?reply():reply;};
  const config={location:{protocol:'https:'},URL:urls,fetch,...options};
  const controller=initCollect(doc,config);
  return {get,doc,controller,calls,revoked,config,setReply:value=>reply=value};
}
const photo=new File(['photo'],'charm.png',{type:'image/png'}),replacement=new File(['another'],'second.jpg',{type:'image/jpeg'});
const h=harness(),{get,controller}=h;
await get('about-button').dispatch('click');assert(get('about-dialog').open);
await get('dialog-close').dispatch('click');assert(!get('about-dialog').open);
await get('upload-area').dispatch('keydown',{key:'Enter'});assert.equal(get('photo-input').clicks,1);
controller.selectPhoto(photo);assert.equal(get('photo-preview').src,'blob:charm.png');assert.equal(get('photo-preview').hidden,false);
controller.selectPhoto(new File(['bad'],'bad.gif',{type:'image/gif'}));assert.equal(controller.photo,photo,'Invalid replacement preserves the existing photo');
await get('upload-area').dispatch('drop',{dataTransfer:{files:[replacement]}});assert.equal(controller.photo,replacement);assert(h.revoked.includes('blob:charm.png'));
await get('remove-photo').dispatch('click');assert.equal(controller.photo,null);assert(get('photo-preview').hidden);
await get('story-form').dispatch('submit');assert.equal(h.calls.length,0);assert.equal(h.doc.activeElement,get('origin'));
for(const id of ['origin','accumulation','outcome'])get(id).value='  '+id+' — 我的故事  ';
await get('story-form').dispatch('submit');assert.equal(h.calls.length,0);assert(get('form-status').textContent.includes('photo'));
controller.selectPhoto(photo);
h.setReply({ok:false,json:async()=>({error:'Saving is temporarily unavailable.'})});
await get('story-form').dispatch('submit');assert(!controller.saved);assert.equal(controller.photo,photo);assert.equal(get('origin').value,'  origin — 我的故事  ');
assert(!get('submit-story').disabled);assert(!get('origin').readOnly);assert(!get('photo-input').disabled);
const retryToken=h.calls[0].body.get('submissionToken');
let finish;h.setReply(()=>new Promise(resolve=>finish=resolve));
const submitting=get('story-form').dispatch('submit');
assert(get('submit-story').disabled);assert(get('origin').readOnly);assert(get('photo-input').disabled);
await get('story-form').dispatch('submit');assert.equal(h.calls.length,2,'A pending save must not send another request');
controller.selectPhoto(replacement);assert.equal(controller.photo,photo,'Photo is frozen during save');
finish({ok:true,json:async()=>({id:'saved-story'})});await submitting;
assert(controller.saved);assert(get('origin').disabled);assert(get('form-status').classList.contains('is-success'));assert(!get('another-story').hidden);
assert.equal(h.calls[1].body.get('origin'),'origin — 我的故事');assert.equal(h.calls[1].body.get('submissionToken'),retryToken);
assert.equal(h.calls[1].body.get('photo').name,'charm.png');assert.equal(h.calls[1].url,'/api/stories');
await get('story-form').dispatch('submit');assert.equal(h.calls.length,2);
await get('another-story').dispatch('click');assert(!controller.saved);assert.equal(controller.photo,null);assert(!get('origin').disabled);assert.equal(get('origin').value,'');
const offline=harness({preview:true});assert(offline.get('submit-story').disabled);assert(!offline.get('offline-note').hidden);
await offline.get('story-form').dispatch('submit');assert.equal(offline.calls.length,0,'Offline previews never claim a server save');

if(process.env.CHARMOGRAPHY_COLLECT_PREVIEW) {
// Run the exact exported HTML script in a DOM event harness, with a web protocol.
const html=await readFile(process.env.CHARMOGRAPHY_COLLECT_PREVIEW,'utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const p=harness();
for(const element of ['story-form','about-button','dialog-close','about-dialog','upload-area','photo-input','replace-photo','remove-photo','photo-preview','another-story'])p.get(element).events.clear();
vm.runInNewContext(script,{document:p.doc,location:{protocol:'https:'},URL:p.config.URL,fetch:p.config.fetch,crypto,FormData,File,AbortController,setTimeout,clearTimeout});
assert(p.get('submit-story').disabled,'Exported preview remains offline even in a web-hosted viewer');
await p.get('upload-area').dispatch('drop',{dataTransfer:{files:[photo]}});assert.equal(p.get('photo-preview').src,'blob:charm.png');
await p.get('story-form').dispatch('submit');assert.equal(p.calls.length,0);
console.log('PASS exported Collect HTML: upload preview and online-only submission');
}
console.log('PASS Collect events: photo preview/replace/remove, required answers, failure recovery, duplicate prevention and success');
