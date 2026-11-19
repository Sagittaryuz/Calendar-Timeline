// Synthetic data and substitute fonts. This is not an iPhone screenshot.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),c=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('../tests/scripting-rolling.cjs');
(async()=>{
 const {d,host,options}=await fixture(),{encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','MonoHeavy');c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','MonoRegular');
 host.DrawContext=class extends d.DrawContext{makeRaster=crop=>{const native=new c.Image();native.src=Buffer.from(encodePNG(crop));return {native,size:{width:crop.width,height:crop.height}}}};
 function paint(image){const canvas=c.createCanvas(Math.ceil(image.size.width),Math.ceil(image.size.height)),ctx=canvas.getContext('2d');const bridge=new Proxy(ctx,{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`${v.name.endsWith('Regular')?'':'bold '}${v.size}px ${v.name.endsWith('Regular')?'MonoRegular':'MonoHeavy'}`:v;return true},get(o,k){if(k==='drawImage')return (src,...args)=>o.drawImage(src.image??src,...args);const v=o[k];return typeof v==='function'?v.bind(o):v}});for(const part of d.segments(image)){if(part.type==='canvas')d.replay(bridge,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>null);else ctx.drawImage(paint(part.image),part.rect.x,part.rect.y,part.rect.width,part.rect.height)}if(image.outerClip){ctx.save();ctx.globalCompositeOperation='destination-in';ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.fillStyle='white';ctx.fill();ctx.restore()}if(image.blurRadius){const dest=c.createCanvas(canvas.width,canvas.height),b=dest.getContext('2d');b.filter=`blur(${image.blurRadius}px)`;b.drawImage(canvas,0,0);return dest}return canvas}

 const before=compile(cp.execFileSync('git',['show','d0f2da1:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'})),after=compile(raw);
 const sheet=c.createCanvas(1120,1135),ctx=sheet.getContext('2d');
 ctx.fillStyle='#16181C';ctx.fillRect(0,0,sheet.width,sheet.height);
 ctx.fillStyle='white';ctx.font='22px sans-serif';ctx.fillText('SIMULAÇÃO: dados fictícios e fontes substitutas; não é captura iOS.',14,28);
 const at=(d,h=0,m=0)=>new Date(2026,10,d,h,m);
 const items=[...Array.from({length:8},(_,i)=>({kind:'reminder',identifier:'r'+i,title:'PENDÊNCIA FICTÍCIA '+i,start:at(18),end:at(19),sourceIsAllDay:true,color:'#0088FF'})),
 {kind:'event',identifier:'example',title:'EVENTO DIA INTEIRO',start:at(19),end:at(20),isAllDay:true,color:'#FF3030'}];
 for(const [i,run]of [before,after].entries()){
  const y=45+i*540;ctx.fillStyle='white';ctx.font='22px sans-serif';ctx.fillText(i?'DEPOIS: evento visível; pendências preservadas no dia de origem':'ANTES: evento escondido em +1 pelo prolongamento das pendências',14,y+24);
  const m=await run(host,options(at(18,21,23),items));ctx.drawImage(paint(m.image),14,y+35);
 }
 const out=path.resolve(__dirname,'../work/all-day-0.3.47');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/comparison.png',sheet.toBuffer('image/png'));console.log(out+'/comparison.png');
})().catch(e=>{console.error(e);process.exitCode=1});
