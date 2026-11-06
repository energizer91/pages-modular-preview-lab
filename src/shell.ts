import './styles/shell.css';
type Manifest={label:string;commit:string;coreId:string;coreBytes:number;remoteBytes:number;pngBytes:number;entry:string};
const app=document.querySelector<HTMLDivElement>('#app')!;
const format=(n:number)=>n>=1048576?(n/1048576).toFixed(2)+' MiB':(n/1024).toFixed(1)+' KiB';
async function boot(){
 const manifestUrl=new URL('manifest.json',location.href);
 const response=await fetch(manifestUrl,{cache:'no-store'});if(!response.ok)throw new Error('Preview manifest is unavailable');
 const m:Manifest=await response.json();
 const coreRoot=new URL(/* @vite-ignore */ '../',import.meta.url);
 app.innerHTML='<header class="lab-bar"><a class="lab-logo" href="#">◧ <strong>Viewport</strong><span>PREVIEW LAB</span></a><div class="devices" role="group" aria-label="Preview viewport"><button data-mode="desktop" aria-pressed="true">▱ <span>Desktop</span></button><button data-mode="tablet" aria-pressed="false">▯ <span>Tablet</span></button><button data-mode="mobile" aria-pressed="false">▯ <span>Mobile</span></button></div><a class="source-link" target="_blank" rel="noopener">View source ↗</a></header><div class="lab-meta"><div><span class="live-dot"></span><strong id="preview-label"></strong><span id="commit"></span></div><div><span id="dimensions">1280 × 900</span><span class="meta-divider">/</span><span>REAL IFRAME VIEWPORT</span></div></div><div class="canvas-scroll"><div class="frame-wrap"><div class="frame-chrome"><div><i></i><i></i><i></i></div><span>fieldwork / workspace</span><span>↗</span></div><iframe title="Responsive workspace preview" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe></div></div><footer class="lab-footer"><span><span class="live-dot"></span>Shared core <b id="core-id"></b></span><span>Core <b id="core-size"></b> <span class="footer-plus">+</span> This preview <b id="remote-size"></b></span><span>PNG stored once <b id="png-size"></b></span></footer>';
 document.getElementById('preview-label')!.textContent=m.label;
 document.getElementById('commit')!.textContent=m.commit.slice(0,7);
 document.getElementById('core-id')!.textContent=m.coreId.slice(0,8);
 document.getElementById('core-size')!.textContent=format(m.coreBytes);
 document.getElementById('remote-size')!.textContent=format(m.remoteBytes);
 document.getElementById('png-size')!.textContent=format(m.pngBytes);
 document.querySelector<HTMLAnchorElement>('.source-link')!.href='https://github.com/energizer91/pages-modular-preview-lab/tree/'+encodeURIComponent(m.commit);
 const frame=document.querySelector<HTMLIFrameElement>('iframe')!;
 const src=new URL('frame.html',coreRoot);src.searchParams.set('remote',new URL(m.entry,manifestUrl).href);frame.src=src.href;
 const sizes={desktop:[1280,900],tablet:[768,1024],mobile:[390,844]} as const;
 const wrap=document.querySelector<HTMLDivElement>('.frame-wrap')!;
 document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.onclick=()=>{
  const mode=button.dataset.mode as keyof typeof sizes;const [w,h]=sizes[mode];wrap.style.width=w+'px';frame.style.height=h+'px';document.getElementById('dimensions')!.textContent=w+' × '+h;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 });
}
boot().catch(error=>{app.textContent='Could not open preview: '+String(error);});
