const STATIC_ASSETS = "__EMBEDDED_WEB_ASSETS__";
const MAX_PHOTO_BYTES=10*1024*1024;
const TEXT_LIMIT=2000;
const decodedAssets=new Map();

function json(value,status=200) {
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function photoType(bytes) {
  if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return {mime:'image/png',ext:'png'};
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {mime:'image/webp',ext:'webp'};
  return null;
}
async function saveStory(request,env) {
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'Submit your story from the Charmography website.'},403);
  if(!env.DB||!env.BUCKET)return json({error:'Saving is temporarily unavailable. Please try again shortly.'},503);
  if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))return json({error:'Please include your answers and a photo.'},400);
  const length=Number(request.headers.get('Content-Length'));
  if(length>MAX_PHOTO_BYTES+65536)return json({error:'Choose a photo smaller than 10 MB.'},413);
  let data;
  try{data=await request.formData();}catch{return json({error:'The submission could not be read. Please try again.'},400);}
  const answers={};
  for(const name of ['origin','accumulation','outcome']) {
    const value=data.get(name);
    if(typeof value!=='string'||!value.trim())return json({error:'Please answer all three questions.'},422);
    if(value.trim().length>TEXT_LIMIT)return json({error:'Keep each answer within 2,000 characters.'},422);
    answers[name]=value.trim();
  }
  const token=data.get('submissionToken');
  if(typeof token!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))return json({error:'Please refresh the page and try again.'},422);
  const photo=data.get('photo');
  if(!photo||typeof photo==='string'||typeof photo.arrayBuffer!=='function'||!photo.size)return json({error:'Add a photo of your charm before saving.'},422);
  if(photo.size>MAX_PHOTO_BYTES)return json({error:'Choose a photo smaller than 10 MB.'},413);
  const bytes=new Uint8Array(await photo.arrayBuffer());
  const type=photoType(bytes);
  if(!type)return json({error:'Choose a JPG, PNG or WebP photo.'},422);
  let key=null;
  try {
    const previous=await env.DB.prepare('SELECT id, created_at FROM charm_stories WHERE submission_token = ?').bind(token).first();
    if(previous)return json({id:previous.id,createdAt:previous.created_at},200);
    const id=crypto.randomUUID(),createdAt=new Date().toISOString();
    key=`stories/${id}/photo.${type.ext}`;
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type.mime}});
    await env.DB.prepare('INSERT INTO charm_stories (id, submission_token, origin, accumulation, outcome, photo_key, photo_type, photo_size, contributor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id,token,answers.origin,answers.accumulation,answers.outcome,key,type.mime,bytes.length,request.headers.get('oai-authenticated-user-id'),createdAt
    ).run();
    return json({id,createdAt},201);
  } catch(error) {
    if(key){try{await env.BUCKET.delete(key);}catch{}}
    try {
      const previous=await env.DB.prepare('SELECT id, created_at FROM charm_stories WHERE submission_token = ?').bind(token).first();
      if(previous)return json({id:previous.id,createdAt:previous.created_at},200);
    } catch{}
    console.error('Story storage failed:',error.message);
    return json({error:'Your story could not be saved. Your answers are still here. Please try again.'},503);
  }
}
async function deleteOwnStory(request,env,id) {
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'Use the Charmography website for this action.'},403);
  const contributor=request.headers.get('oai-authenticated-user-id');
  if(!contributor||!env.DB||!env.BUCKET)return json({error:'This action is unavailable.'},403);
  const row=await env.DB.prepare('SELECT photo_key FROM charm_stories WHERE id = ? AND contributor_id = ?').bind(id,contributor).first();
  if(!row)return new Response(null,{status:204});
  await env.BUCKET.delete(row.photo_key);
  await env.DB.prepare('DELETE FROM charm_stories WHERE id = ? AND contributor_id = ?').bind(id,contributor).run();
  return new Response(null,{status:204});
}

export default {
  async fetch(request,env={}) {
    const url=new URL(request.url);
    try {
      if(url.pathname==='/api/stories') {
        if(request.method==='POST')return await saveStory(request,env);
        return json({error:'Use the submission form to save your story.'},405);
      }
      if(url.pathname==='/api/health') {
        if(!env.DB||!env.BUCKET)return json({ready:false},503);
        await env.DB.prepare('SELECT id FROM charm_stories LIMIT 1').first();
        return json({ready:true});
      }
      const deletion=url.pathname.match(/^\/api\/stories\/([0-9a-f-]{36})$/i);
      if(deletion&&request.method==='DELETE')return await deleteOwnStory(request,env,deletion[1]);
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
      if(url.pathname==='/collect/')return Response.redirect(new URL('/collect',url),308);
      if(url.pathname==='/archive/')return Response.redirect(new URL('/archive',url),308);
      let path=url.pathname;
      if(path==='/')path='/index.html';
      if(path==='/collect')path='/collect.html';
      if(path==='/archive')path='/archive.html';
      const asset=STATIC_ASSETS[path];
      if(!asset)return new Response('Page not found',{status:404});
      if(!decodedAssets.has(path))decodedAssets.set(path,Uint8Array.from(atob(asset.data),char=>char.charCodeAt(0)));
      const headers={'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':path.endsWith('.html')?'no-cache':'public, max-age=300'};
      return new Response(request.method==='HEAD'?null:decodedAssets.get(path),{headers});
    } catch(error) {
      console.error('Request failed:',error.message);
      return json({error:'Something went wrong. Please try again.'},503);
    }
  }
};
