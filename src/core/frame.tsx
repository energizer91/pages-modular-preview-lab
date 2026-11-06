import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';
import { Button } from '@lab/ui';
import '../styles/app.css';
class Boundary extends Component<{children: ReactNode},{error:string}> {
 state={error:''}; static getDerivedStateFromError(error:Error){return {error:error.message};}
 render(){return this.state.error?<div className="load-error"><h1>Preview could not load</h1><p>{this.state.error}</p><Button onClick={()=>location.reload()}>Retry</Button></div>:this.props.children;}
}
async function boot(){
 const remote=new URLSearchParams(location.search).get('remote');
 if(!remote) throw new Error('Missing remote entry URL');
 const entry=new URL(remote,location.href);
 if(entry.origin!==location.origin) throw new Error('Remote must be hosted on this Pages origin');
 registerRemotes([{name:'preview',entry:entry.href,type:'module'}]);
 const loaded=await loadRemote<{default:React.ComponentType}>('preview/App');
 if(!loaded?.default)throw new Error('Remote did not expose App');
 createRoot(document.getElementById('root')!).render(<Boundary><loaded.default/></Boundary>);
}
boot().catch(error=>{document.getElementById('root')!.textContent='Preview load failed: '+String(error);console.error(error);});
