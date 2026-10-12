import { readdir,readFile,writeFile,mkdir,rm,cp } from 'node:fs/promises';
import { resolve,relative,extname } from 'node:path';
import './prepare-archive.mjs';

const root=resolve(import.meta.dirname,'..'),web=resolve(root,'web'),dist=resolve(root,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const assets={};
async function collect(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())await collect(path);
    else {
      const extension=extname(path);if(!types[extension])throw new Error(`Unsupported asset ${path}`);
      assets['/'+relative(web,path).replaceAll('\\','/')]={type:types[extension],data:(await readFile(path)).toString('base64')};
    }
  }
}
await collect(web);
const source=await readFile(resolve(root,'worker/index.js'),'utf8');
if(!source.includes('"__EMBEDDED_WEB_ASSETS__"'))throw new Error('Worker asset marker missing');
const worker=source.replace('"__EMBEDDED_WEB_ASSETS__"',JSON.stringify(assets));
await rm(dist,{recursive:true,force:true});
await mkdir(resolve(dist,'server'),{recursive:true});await mkdir(resolve(dist,'.openai'),{recursive:true});
await writeFile(resolve(dist,'server/index.js'),worker);
await cp(resolve(root,'.openai/hosting.json'),resolve(dist,'.openai/hosting.json'));
await cp(resolve(root,'drizzle'),resolve(dist,'.openai/drizzle'),{recursive:true});
const module=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
if(typeof module.default?.fetch!=='function')throw new Error('Worker must export default.fetch');
console.log(`Built Worker with ${Object.keys(assets).length} embedded assets and schema migrations.`);
