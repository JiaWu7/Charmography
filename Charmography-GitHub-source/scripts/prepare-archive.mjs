import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const records=JSON.parse(await readFile(resolve(root,'source/archive-records.json'),'utf8'));
const order=['tt','jj','xy','bb','cc','ss'];
if(records.length!==6||records.some((r,i)=>r.id!==order[i]))throw new Error('Archive must preserve TT, JJ, XY, BB, CC, SS order');
const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const objects=records.map((r,i)=>{
  const [x,y,w,h]=r.crop;
  if(x<0||y<0||w<=0||h<=0||x+w>1170||y+h>356)throw new Error('Photo window outside the source image');
  for(const key of ['owner','title','quote','origin','accumulation','outcome','photoCaption'])if(!r[key]?.trim())throw new Error(`Missing ${key} in ${r.id}`);
  const p=r.placement,number=String(i+1).padStart(3,'0');
  return `<button type="button" class="charm-object" id="charm-${r.id}" data-record-id="${r.id}" aria-label="Open ${r.owner}’s story: ${escape(r.title)}" aria-haspopup="dialog" aria-controls="record-dialog" style="--x:${p.x}%;--y:${p.y}%;--size:${p.size}%;--tilt:${p.tilt}deg">
        <svg class="object-portrait" viewBox="${r.crop.join(' ')}" aria-hidden="true"><image href="/assets/charm-portraits.png" width="1170" height="356"/></svg>
        <span class="object-label"><span>${number}</span><span class="label-slash">/</span><span>${r.owner}</span><span class="object-open" aria-hidden="true">↗</span></span>
      </button>`;
}).join('\n      ');
const fallback=records.map(r=>`<details><summary>${r.owner} / ${escape(r.title)}</summary>${['origin','accumulation','outcome'].map(key=>`<p><strong>${key[0].toUpperCase()+key.slice(1)}</strong> ${escape(r[key])}</p>`).join('')}</details>`).join('\n');
const home=await readFile(resolve(root,'web/index.html'),'utf8');
let header=home.match(/<header class="header">[\s\S]*?<\/header>/)?.[0];
const about=home.match(/<dialog id="about-dialog"[\s\S]*?<\/dialog>/)?.[0];
if(!header||!about)throw new Error('Shared homepage header or About content missing');
header=header.replace('href="./"','href="/"').replace('class="nav-button" id="archive-button"','class="nav-button is-active" id="archive-button" aria-current="page"');
const values={HEADER:header,ABOUT:about,OBJECTS:objects,FALLBACK:fallback,DATA:JSON.stringify(records).replaceAll('<','\\u003c')};
let page=await readFile(resolve(root,'source/archive-template.html'),'utf8');
page=page.replace(/\{\{([A-Z]+)\}\}/g,(_,key)=>values[key]??(()=>{throw new Error('Unknown template placeholder '+key);})());
await writeFile(resolve(root,'web/archive.html'),page);
