import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
const width=1280,height=960;let seed=20261106;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const raw=Buffer.alloc((width*3+1)*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const nx=x/width,ny=y/height;const grain=(random()-.5)*24;
 const ridge=.43+.12*Math.sin(nx*4.5)-.13*nx;
 const lake=ny>ridge;const glow=Math.exp(-((nx-.8)**2*4+(ny-.25)**2*5));
 const color=lake?[66+glow*54,104+glow*57,85+glow*28]:[134+glow*43,159+glow*33,127+glow*36];
 const wave=lake?Math.sin(ny*300+nx*8)*3:0;
 const o=y*(width*3+1)+1+x*3;for(let c=0;c<3;c++)raw[o+c]=Math.max(0,Math.min(255,color[c]+grain+wave));
}
const crc=buf=>{let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const t=Buffer.from(type);const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),b.length-4);return b;};
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:0})),chunk('IEND',Buffer.alloc(0))]);
fs.mkdirSync('src/core',{recursive:true});fs.writeFileSync('src/core/shared-landscape.png',png);console.log('Shared PNG:',png.length,'bytes');
