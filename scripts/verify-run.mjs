import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const output=o=>{for(const [k,v]of Object.entries(o))fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+v+'\n');};
if(process.env.GITHUB_EVENT_NAME!=='workflow_run'){output({maintenance:true,pr:'main',skip:false});process.exit(0);}
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));const run=event.workflow_run;
const meta=JSON.parse(fs.readFileSync('context/event.json','utf8'));const repo=process.env.GITHUB_REPOSITORY;
if(meta.repository!==repo||run.head_repository.full_name!==repo||meta.sha!==run.head_sha||!(/^[a-f0-9]{40}$/.test(meta.sha)))throw new Error('Build provenance mismatch');
if(run.path!=='.github/workflows/build.yml')throw new Error('Unexpected workflow path');
if(meta.pr==='main'){
 if(run.head_branch!=='main'||!['push','workflow_dispatch'].includes(run.event))throw new Error('Invalid main build');
 output({pr:'main',sha:meta.sha,skip:false,remove:false});
}else{
 if(!/^[1-9][0-9]*$/.test(meta.pr)||run.event!=='pull_request')throw new Error('Invalid PR build');
 const r=spawnSync('gh',['api','repos/'+repo+'/pulls/'+meta.pr],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);const pr=JSON.parse(r.stdout);
 if(pr.head.repo?.full_name!==repo||pr.base.repo.full_name!==repo||pr.head.ref!==run.head_branch)throw new Error('PR origin mismatch');
 output({pr:meta.pr,sha:meta.sha,remove:pr.state==='closed',skip:pr.state==='open'&&pr.head.sha!==meta.sha});
}
