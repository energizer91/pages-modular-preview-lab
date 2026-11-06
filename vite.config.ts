import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { fileURLToPath } from 'node:url';
const remote=process.env.BUILD_TARGET==='remote';
const alias=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
const shared=Object.fromEntries(['react','react/jsx-runtime','react-dom/client','@lab/ui'].map(name=>[name,{
 singleton:true as const, requiredVersion:false as const,
 ...(remote ? {import:false as const,suppressMissingImportWarning:true} : name==='@lab/ui' ? {import:'./src/core/ui.tsx'} : {})
}]));
export default defineConfig({
 base:'./',
 resolve:{alias:{'styled-system':alias('./styled-system'),'@':alias('./src')}},
 plugins:[react(),federation({name:remote?'preview':'preview_host',filename:'remoteEntry.js',exposes:remote?{'./App':'./src/remote/App.tsx'}:{},shared,dts:false,manifest:false})],
 build:{target:'es2022',outDir:remote?'dist/remote':'dist/core',emptyOutDir:true,sourcemap:false,cssCodeSplit:true,rolldownOptions:{input:remote?{remote:alias('./src/remote/entry.ts')}:{index:alias('./index.html'),frame:alias('./frame.html')}}},
});

