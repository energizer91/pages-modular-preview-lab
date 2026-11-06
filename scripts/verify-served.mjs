import fs from 'node:fs';import path from 'node:path';
const site=process.env.SITE;const report=JSON.parse(fs.readFileSync(path.join(site,'report.json'),'utf8'));let last;
for(let attempt=0;attempt<24;attempt++){
 try{
  for(const p of report.previews){
   const expected=JSON.parse(fs.readFileSync(path.join(site,p.path,'manifest.json'),'utf8'));
   const url=new URL((p.path==='.'?'':p.path+'/')+'manifest.json',process.env.PAGE_URL);url.searchParams.set('verify',process.env.GITHUB_RUN_ID+'-'+attempt);
   const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status+' at '+url.pathname);
   const actual=await response.json();if(actual.commit!==expected.commit||actual.coreId!==expected.coreId)throw new Error('Stale snapshot at '+url.pathname);
  }
  console.log('Verified '+report.previews.length+' served preview manifests');process.exit(0);
 }catch(error){last=error;console.log('Waiting for Pages edge propagation:',String(error));await new Promise(r=>setTimeout(r,5000));}
}
throw last;
