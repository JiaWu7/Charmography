import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import worker from '../dist/server/index.js';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(await readFile(new URL('../drizzle/0000_charm_stories.sql',import.meta.url),'utf8'));
let failInsert=false,failPhoto=false;
const objects=new Map();
const env={
  DB:{prepare(sql){
    let args=[];
    return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){if(failInsert&&sql.startsWith('INSERT'))throw new Error('Simulated database failure');return sqlite.prepare(sql).run(...args);}};
  }},
  BUCKET:{async put(key,bytes,metadata){if(failPhoto)throw new Error('Simulated photo storage failure');objects.set(key,{bytes:Uint8Array.from(bytes),metadata});},async delete(key){objects.delete(key);}}
};
const root='https://charmography.example';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOJ0AAAAASUVORK5CYII=','base64');
const count=()=>sqlite.prepare('SELECT COUNT(*) AS n FROM charm_stories').get().n;
function payload(overrides={}){
  const data=new FormData();
  const values={origin:"  A friend's gift — 她送给我的包挂  ",accumulation:'Train rides and rainy walks.',outcome:'It reminds me of home.',submissionToken:crypto.randomUUID(),photo:new File([png],'charm.png',{type:'image/png'}),...overrides};
  for(const [name,value] of Object.entries(values))if(value!==null)data.set(name,value);
  return data;
}
const post=(body,headers={},bindings=env)=>worker.fetch(new Request(root+'/api/stories',{method:'POST',body,headers:{Origin:root,'oai-authenticated-user-id':'viewer-one',...headers}}),bindings);
const original=payload(),token=original.get('submissionToken');
let response=await post(original);assert.equal(response.status,201);
const saved=await response.json();assert(saved.id);assert.equal(count(),1);assert.equal(objects.size,1);
const row=sqlite.prepare('SELECT * FROM charm_stories WHERE id = ?').get(saved.id);
assert.equal(row.origin,"A friend's gift — 她送给我的包挂");assert.equal(row.contributor_id,'viewer-one');
assert.equal(row.photo_type,'image/png');assert.equal(row.photo_size,png.length);
assert.deepEqual(objects.get(row.photo_key).bytes,Uint8Array.from(png));
assert.equal(objects.get(row.photo_key).metadata.httpMetadata.contentType,'image/png');
response=await post(payload({submissionToken:token}));assert.equal(response.status,200);assert.equal((await response.json()).id,saved.id);
assert.equal(count(),1);assert.equal(objects.size,1);
for(const [overrides,expected] of [
  [{origin:'   '},422],[{outcome:'x'.repeat(2001)},422],[{photo:null},422],
  [{photo:new File(['not an image'],'pretend.png',{type:'image/png'})},422],
  [{photo:new File([new Uint8Array(10*1024*1024+1)],'large.png',{type:'image/png'})},413],
  [{submissionToken:'invalid'},422]
]) {assert.equal((await post(payload(overrides))).status,expected);assert.equal(count(),1);assert.equal(objects.size,1);}
assert.equal((await post(payload(),{Origin:'https://other.example'})).status,403);
assert.equal((await post(payload(),{},{})).status,503);
assert.equal((await post('{}',{'Content-Type':'application/json'})).status,400);
const log=console.error;console.error=()=>{};
try {
  failInsert=true;assert.equal((await post(payload())).status,503);failInsert=false;
  assert.equal(objects.size,1,'Database failure must remove the newly uploaded photo');
  failPhoto=true;assert.equal((await post(payload())).status,503);failPhoto=false;
  assert.equal(count(),1,'Photo failure must not create a partial story');
} finally {console.error=log;}
const remove=(viewer,origin=root)=>worker.fetch(new Request(root+'/api/stories/'+saved.id,{method:'DELETE',headers:{Origin:origin,'oai-authenticated-user-id':viewer}}),env);
assert.equal((await remove('viewer-two')).status,204);assert.equal(count(),1);
assert.equal((await remove('viewer-one','https://other.example')).status,403);assert.equal(count(),1);
assert.equal((await remove('viewer-one')).status,204);assert.equal(count(),0);assert.equal(objects.size,0);
assert.equal((await worker.fetch(new Request(root+'/api/health'),env)).status,200);
for(const [route,source,type] of [
  ['/','index.html','text/html'],['/collect','collect.html','text/html'],['/archive','archive.html','text/html'],
  ['/collect.mjs?v=collect-4','collect.mjs','text/javascript'],['/collect.css','collect.css','text/css'],
  ['/assets/logo.png','assets/logo.png','image/png'],['/assets/letter-00.svg','assets/letter-00.svg','image/svg+xml']
]) {
  response=await worker.fetch(new Request(root+route),env);assert.equal(response.status,200,route);
  assert(response.headers.get('Content-Type').startsWith(type));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL('../web/'+source,import.meta.url)),route+' must preserve source bytes');
}
assert.equal((await worker.fetch(new Request(root+'/collect/'),env)).status,308);
assert.equal((await worker.fetch(new Request(root+'/archive/'),env)).status,308);
assert.equal((await worker.fetch(new Request(root+'/unknown'),env)).status,404);
sqlite.close();
console.log('PASS submission API: durable schema, photo bytes, Unicode, retries, validation, rollback, ownership and page routing');
