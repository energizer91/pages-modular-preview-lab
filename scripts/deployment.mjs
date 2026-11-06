import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const repo=process.env.GITHUB_REPOSITORY,pr=process.env.PR,sha=process.env.SHA;
if(!/^(main|[1-9][0-9]*)$/.test(pr))throw new Error('Invalid PR');
const env=pr==='main'?'preview-main':'preview-pr-'+pr;
const base='https://'+repo.split('/')[0]+'.github.io/'+repo.split('/')[1]+'/';
const url=base+(pr==='main'?'':'pr/'+pr+'/');
const api=(endpoint,method='GET',body)=>{const r=spawnSync('gh',['api',endpoint,'--method',method,...(body?['--input','-']:[])],{encoding:'utf8',input:body?JSON.stringify(body):undefined});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim()?JSON.parse(r.stdout):null;};
const endpoint='repos/'+repo;
const logUrl='https://github.com/'+repo+'/actions/runs/'+process.env.GITHUB_RUN_ID;
const status=(id,state,extra={})=>api(endpoint+'/deployments/'+id+'/statuses','POST',{state,log_url:logUrl,environment:env,auto_inactive:false,...extra});
const marker='<!-- modular-pages-preview -->';
function comment(body){if(pr==='main')return;const comments=api(endpoint+'/issues/'+pr+'/comments?per_page=100');const existing=comments.find(c=>c.user.login==='github-actions[bot]'&&c.body.includes(marker));return api(endpoint+(existing?'/issues/comments/'+existing.id:'/issues/'+pr+'/comments'),existing?'PATCH':'POST',{body:marker+'\n'+body});}
switch(process.argv[2]){
 case 'start':{const d=api(endpoint+'/deployments','POST',{ref:sha,environment:env,auto_merge:false,required_contexts:[],transient_environment:true,production_environment:false,description:'Modular Pages preview '+(pr==='main'?'main':'PR #'+pr)});status(d.id,'in_progress',{description:'Publishing shared core and PR module'});fs.appendFileSync(process.env.GITHUB_OUTPUT,'id='+d.id+'\n');break;}
 case 'finish':{
  const success=process.env.PUBLISHED==='true';status(process.env.DEPLOYMENT_ID,success?'success':'failure',{description:success?'Preview ready':'Pages publication failed',...(success?{environment_url:url}:{})});
  if(success){const m=JSON.parse(fs.readFileSync(path.join(process.env.SITE,pr==='main'?'':('pr/'+pr),'manifest.json'),'utf8'));comment('### Preview ready\n\n**[Open this PR preview ↗]('+url+')**\n\nCommit: `'+sha.slice(0,7)+'` · Shared core: `'+m.coreId+'`\n\nRemote: **'+(m.remoteBytes/1024).toFixed(1)+' KiB** · Shared PNG stored once: **'+(m.pngBytes/1048576).toFixed(2)+' MiB**.\n\nDesktop / tablet / mobile switcher is available above the iframe. This URL shows this PR snapshot; browser edits stay local.\n\n[Deployment details]('+logUrl+') · [Storage report]('+base+'report.json)');}
  else comment('### Preview publication failed\n\n[Inspect the workflow]('+logUrl+'). A previous preview, if any, may still show an older commit.');
  break;}
 case 'retire':{for(const d of api(endpoint+'/deployments?environment='+env+'&per_page=100'))status(d.id,'inactive',{description:'PR closed; preview removed'});comment('### Preview removed\n\nThis PR is closed. Its preview files were removed from GitHub Pages.');break;}
 default:throw new Error('Unknown deployment operation');
}
