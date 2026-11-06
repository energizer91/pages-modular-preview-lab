import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const repo=process.env.GITHUB_REPOSITORY,pr=process.env.PR,sha=process.env.SHA;
const base='https://'+repo.split('/')[0]+'.github.io/'+repo.split('/')[1]+'/';
function target(number,commit){if(!/^(main|[1-9][0-9]*)$/.test(number))throw new Error('Invalid PR');return {pr:number,sha:commit,env:number==='main'?'preview-main':'preview-pr-'+number,url:base+(number==='main'?'':'pr/'+number+'/')};}
const t=target(pr,sha);
const api=(endpoint,method='GET',body)=>{const r=spawnSync('gh',['api',endpoint,'--method',method,...(body?['--input','-']:[])],{encoding:'utf8',input:body?JSON.stringify(body):undefined});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim()?JSON.parse(r.stdout):null;};
const endpoint='repos/'+repo;
const logUrl='https://github.com/'+repo+'/actions/runs/'+process.env.GITHUB_RUN_ID;
const status=(id,state,t,extra={})=>api(endpoint+'/deployments/'+id+'/statuses','POST',{state,log_url:logUrl,environment:t.env,auto_inactive:false,...extra});
const create=t=>api(endpoint+'/deployments','POST',{ref:t.sha,environment:t.env,auto_merge:false,required_contexts:[],transient_environment:true,production_environment:false,description:'Modular Pages preview '+(t.pr==='main'?'main':'PR #'+t.pr)});
const marker='<!-- modular-pages-preview -->';
function comment(t,body){if(t.pr==='main')return;const comments=api(endpoint+'/issues/'+t.pr+'/comments?per_page=100');const existing=comments.find(c=>c.user.login==='github-actions[bot]'&&c.body.includes(marker));return api(endpoint+(existing?'/issues/comments/'+existing.id:'/issues/'+t.pr+'/comments'),existing?'PATCH':'POST',{body:marker+'\n'+body});}
function ready(t,m,id){
 if(!id){const deployments=api(endpoint+'/deployments?environment='+t.env+'&per_page=100');id=deployments.find(d=>d.sha===t.sha)?.id||create(t).id;}
 status(id,'success',t,{description:'Preview ready and served snapshot verified',environment_url:t.url});
 comment(t,'### Preview ready\n\n**[Open this PR preview ↗]('+t.url+')**\n\nCommit: `'+t.sha.slice(0,7)+'` · Shared core: `'+m.coreId+'`\n\nRemote: **'+(m.remoteBytes/1024).toFixed(1)+' KiB** · Shared PNG stored once: **'+(m.pngBytes/1048576).toFixed(2)+' MiB**.\n\nDesktop / tablet / mobile switcher is available above the iframe. This URL shows this PR snapshot; browser edits stay local.\n\n[Deployment details]('+logUrl+') · [Storage report]('+base+'report.json)');
}
switch(process.argv[2]){
 case 'start':{const d=create(t);status(d.id,'in_progress',t,{description:'Publishing shared core and PR module'});fs.appendFileSync(process.env.GITHUB_OUTPUT,'id='+d.id+'\n');break;}
 case 'finish':{
  const success=process.env.PUBLISHED==='true';
  if(success){
   const site=process.env.SITE;
   const m=JSON.parse(fs.readFileSync(path.join(site,t.pr==='main'?'':('pr/'+t.pr),'manifest.json'),'utf8'));ready(t,m,process.env.DEPLOYMENT_ID);
   // A single Pages deployment publishes the entire site, including earlier failed previews.
   const parent=path.join(site,'pr');if(fs.existsSync(parent))for(const number of fs.readdirSync(parent)){
    if(!/^[1-9][0-9]*$/.test(number)||number===t.pr)continue;
    const m=JSON.parse(fs.readFileSync(path.join(parent,number,'manifest.json'),'utf8'));
    const current=api(endpoint+'/pulls/'+number);if(current.state==='open'&&current.head.sha===m.commit)ready(target(number,m.commit),m);
   }
  }else{status(process.env.DEPLOYMENT_ID,'failure',t,{description:'Pages publication or served-snapshot verification failed'});comment(t,'### Preview publication failed\n\n[Inspect the workflow]('+logUrl+'). A previous preview, if any, may still show an older commit.');}
  break;}
 case 'retire':{for(const d of api(endpoint+'/deployments?environment='+t.env+'&per_page=100'))status(d.id,'inactive',t,{description:'PR closed; preview removed'});comment(t,'### Preview removed\n\nThis PR is closed. Its preview files were removed from GitHub Pages.');break;}
 default:throw new Error('Unknown deployment operation');
}
