import { chromium } from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{}),headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.waitForTimeout(1200);

fs.mkdirSync('.local',{recursive:true});await page.screenshot({path:'.local/desktop.png',fullPage:true});
const frame=page.frameLocator('iframe');
await frame.getByRole('heading',{name:'Studio workspace'}).waitFor({timeout:15000});
for(const [mode,width,label] of [['Tablet',768,'tablet'],['Mobile',390,'mobile'],['Desktop',1280,'desktop']]){
 await page.getByRole('button',{name:mode,exact:false}).click();
 await page.waitForTimeout(150);
 const f=page.frames().find(f=>f.url().includes('frame.html'));
 const actual=await f.evaluate(()=>({width:innerWidth,label:getComputedStyle(document.querySelector('.mq-label'),'::after').content}));
 if(actual.width!==width||!actual.label.includes(label))throw new Error('Viewport mismatch '+JSON.stringify(actual));
 if(mode==='Mobile')await page.screenshot({path:'.local/mobile.png',fullPage:true});
}
const before=await frame.locator('.task').count();await frame.getByRole('button',{name:'Add a next step'}).click();if(await frame.locator('.task').count()!==before+1)throw new Error('Add task failed');
await frame.getByRole('button',{name:'Completed',exact:true}).click();if(await frame.locator('.task').count()!==1)throw new Error('Filter failed');
await frame.getByRole('button',{name:'Find your focus'}).click();await frame.getByRole('status').waitFor();
console.log('BROWSER_ERRORS',errors);if(errors.length)throw new Error(errors.join('\n'));
await browser.close();console.log('Viewport and interactions passed');
