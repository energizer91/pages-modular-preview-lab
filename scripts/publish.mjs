import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));
const site=path.resolve(args.site||'site');
const put=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
function safeRemove(p){const resolved=path.resolve(p);if(!resolved.startsWith(site+path.sep))throw new Error('Unsafe deletion');fs.rmSync(resolved,{recursive:true,force:true});}
function walk(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.join(e.parentPath,e.name)):[];}
function validate(dir){for(const name of fs.readdirSync(dir,{recursive:true})){const p=path.join(dir,name);if(fs.lstatSync(p).isSymbolicLink())throw new Error('Links are not accepted');}}
const pr=args.pr||'main';if(!/^(main|[1-9][0-9]*)$/.test(pr))throw new Error('Invalid preview number');
const destination=pr==='main'?site:path.join(site,'pr',pr);
if(args.remove==='true'){if(pr==='main')throw new Error('Cannot remove main');safeRemove(destination);}
else if(args.reconcile!=='true'){
 const pkg=path.resolve(args.package||'dist/package');validate(pkg);
 const m=JSON.parse(fs.readFileSync(path.join(pkg,'build.json'),'utf8'));
 if(!/^[a-f0-9]{16}$/.test(m.coreId))throw new Error('Invalid core ID');
 const coreDir=path.join(site,'cores',m.coreId);
 const hash=createHash('sha256');let coreBytes=0;for(const f of m.core){const p=path.resolve(pkg,'core',f.path);if(!p.startsWith(path.join(pkg,'core')+path.sep))throw new Error('Invalid core file');const data=fs.readFileSync(p);hash.update(f.path);hash.update(data);coreBytes+=data.length;}
 if(hash.digest('hex').slice(0,16)!==m.coreId||coreBytes!==m.coreBytes)throw new Error('Core checksum mismatch');
 if(fs.existsSync(coreDir)){for(const f of m.core){if(!fs.readFileSync(path.join(coreDir,f.path)).equals(fs.readFileSync(path.join(pkg,'core',f.path))))throw new Error('Immutable core collision');}}
 else fs.cpSync(path.join(pkg,'core'),coreDir,{recursive:true});
 const remoteDir=path.join(destination,'remote');if(fs.existsSync(remoteDir))safeRemove(remoteDir);fs.cpSync(path.join(pkg,'remote'),remoteDir,{recursive:true});
 const prefix=pr==='main'?'./cores/':'../../cores/';
 const html=fs.readFileSync(path.join(coreDir,'index.html'),'utf8').replaceAll('src="./','src="'+prefix+m.coreId+'/').replaceAll('href="./','href="'+prefix+m.coreId+'/');
 put(path.join(destination,'index.html'),html);
 put(path.join(destination,'manifest.json'),JSON.stringify({label:pr==='main'?'Main preview':'PR #'+pr,commit:args.sha||'local',coreId:m.coreId,coreBytes:m.coreBytes,remoteBytes:m.remoteBytes,pngBytes:m.pngBytes,entry:'./remote/remoteEntry.js',publishedAt:new Date().toISOString()},null,2));
}
// Reconcile missed close events, and reject stale PR builds before this script is invoked.
if(process.env.GH_TOKEN&&args.repository){
 const r=spawnSync('gh',['api','--paginate','repos/'+args.repository+'/pulls?state=open&per_page=100','--jq','.[].number'],{encoding:'utf8'});if(r.status!==0)throw new Error('Cannot reconcile open PRs: '+r.stderr);
 const open=new Set(r.stdout.trim().split(/\s+/));const parent=path.join(site,'pr');if(fs.existsSync(parent))for(const p of fs.readdirSync(parent))if(/^[0-9]+$/.test(p)&&!open.has(p))safeRemove(path.join(parent,p));
}
const manifests=walk(site).filter(p=>path.basename(p)==='manifest.json'&&!p.includes(path.sep+'cores'+path.sep));
const previews=manifests.map(p=>({path:path.relative(site,path.dirname(p)).replaceAll('\\','/')||'.',...JSON.parse(fs.readFileSync(p,'utf8'))}));
// Persist first-unreferenced timestamps: checkout resets filesystem mtimes.
const used=new Set(previews.map(p=>p.coreId));const cores=path.join(site,'cores');
const gcPath=path.join(site,'core-gc.json');const garbage=fs.existsSync(gcPath)?JSON.parse(fs.readFileSync(gcPath,'utf8')):{};
if(fs.existsSync(cores))for(const id of fs.readdirSync(cores)){
 if(used.has(id)){delete garbage[id];continue;}
 garbage[id]??=new Date().toISOString();
 if(Date.now()-Date.parse(garbage[id])>=86400000){safeRemove(path.join(cores,id));delete garbage[id];}
}
put(gcPath,JSON.stringify(garbage,null,2));
const reportPath=path.join(site,'report.json');
const bytes=walk(site).filter(p=>!p.includes(path.sep+'.git'+path.sep)&&p!==reportPath).reduce((n,p)=>n+fs.statSync(p).size,0);
const report={publishedBytes:bytes,previews:previews.map(({label,path,coreId,remoteBytes})=>({label,path,coreId,remoteBytes})),uniqueCores:fs.existsSync(cores)?fs.readdirSync(cores).length:0,fullCopiesEstimateBytes:previews.reduce((n,p)=>n+p.coreBytes+p.remoteBytes,0)};
for(let i=0;i<5;i++)report.publishedBytes=bytes+Buffer.byteLength(JSON.stringify(report,null,2));
put(reportPath,JSON.stringify(report,null,2));put(path.join(site,'.nojekyll'),'');
if(report.publishedBytes>800*1024*1024)throw new Error('Site exceeded the 800 MiB publication budget');
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Preview storage\n\nPublished tree: '+bytes+' bytes. Full-copy estimate: '+report.fullCopiesEstimateBytes+' bytes. Shared cores: '+report.uniqueCores+'.\n\n'+previews.map(p=>'- '+p.label+': '+p.remoteBytes+' remote bytes; core '+p.coreId).join('\n')+'\n');
