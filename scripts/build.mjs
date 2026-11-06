import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export function inventory(dir){return fs.readdirSync(dir,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const absolute=path.join(e.parentPath,e.name);return {path:path.relative(dir,absolute).replaceAll('\\','/'),bytes:fs.statSync(absolute).size};}).sort((a,b)=>a.path.localeCompare(b.path,'en'));}
function run(target){const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit',env:{...process.env,BUILD_TARGET:target}});if(r.status!==0)process.exit(r.status||1);}
run('core');run('remote');
const core=inventory('dist/core');const remote=inventory('dist/remote');
const hash=createHash('sha256');for(const f of core){hash.update(f.path);hash.update(fs.readFileSync(path.join('dist/core',f.path)));}
const coreId=hash.digest('hex').slice(0,16);
const stats={coreId,coreBytes:core.reduce((n,f)=>n+f.bytes,0),remoteBytes:remote.reduce((n,f)=>n+f.bytes,0),pngBytes:core.filter(f=>f.path.endsWith('.png')).reduce((n,f)=>n+f.bytes,0),core,remote};
const packagePath=path.resolve('dist/package');if(packagePath!==path.join(process.cwd(),'dist','package'))throw new Error('Unexpected package path');fs.rmSync(packagePath,{recursive:true,force:true});fs.mkdirSync(packagePath,{recursive:true});fs.cpSync('dist/core','dist/package/core',{recursive:true});fs.cpSync('dist/remote','dist/package/remote',{recursive:true});fs.writeFileSync('dist/package/build.json',JSON.stringify(stats,null,2));
console.log('\nBUILD ACCOUNTING',JSON.stringify({coreId,coreBytes:stats.coreBytes,remoteBytes:stats.remoteBytes,pngBytes:stats.pngBytes},null,2));
if(remote.some(f=>f.path.endsWith('.png')))throw new Error('Shared PNG leaked into remote');
if(stats.remoteBytes>250*1024)throw new Error('Remote exceeded 250 KiB: check shared dependency fallbacks');
