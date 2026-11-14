// Pixel equivalence and bridge-call counts with synthetic data and desktop fonts.
// These are not native iPhone timing or font measurements.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {createCanvas,ImageData}=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('./scripting-rolling.cjs');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const baseline='d7310b6';
function adapter(ctx,count){return new Proxy(ctx,{set(target,key,value){if(['fillStyle','strokeStyle','lineWidth'].includes(key))count.styles++;target[key]=key==='font'&&typeof value==='object'?`${value.size}px sans-serif`:value;return true;},get(target,key){if(key==='drawImage')return(source,...args)=>target.drawImage(source.image??source,...args);const value=target[key];return typeof value==='function'?value.bind(target):value;}})}
function paint(image,d,count,view={x:0,y:0,width:image.size.width,height:image.size.height}){
 const canvas=createCanvas(image.size.width,image.size.height),ctx=canvas.getContext('2d'),bridge=adapter(ctx,count);
 if(image.outerClip){ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.clip();}
 const symbol=createCanvas(30,30);symbol.getContext('2d').fillRect(3,3,24,24);
 for(const part of d.segments(image,view)){
  if(part.type==='canvas')d.replay(bridge,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>symbol);
  else{const child=d.childViewport(part.image,part.rect,view);if(!child)continue;const sub=paint(part.image,d,count,child);ctx.save();if(part.image.blurRadius)ctx.filter=`blur(${part.image.blurRadius}px)`;ctx.drawImage(sub,part.rect.x,part.rect.y,part.rect.width,part.rect.height);ctx.restore();}
 }
 return canvas;
}
(async()=>{
 const {d,host,options}=await fixture();
 const previous=compile(cp.execFileSync('git',['show','026be645177d619158e7d974d5a5f609c9ceabb3:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'})),render=compile(raw);
 let changed=0;
 function compare(a,b){
  if(a&&typeof a==='object'){
   if(a.type && !a.type.startsWith('stroke') && a.state?.width===8 && b.state?.width===4) b.state.width=8;
   if(a.type==='strokePath'||a.type==='strokeEllipse'){
    if(a.state?.width===8&&b.state?.width===4){
     const copy=structuredClone(b);copy.state.width=8;assert.deepEqual(copy,a,'Only lunar stroke width changes');changed++;return;
    }
   }
   assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))compare(a[k],b[k]);
  }else assert.deepEqual(b,a);
 }
 for(const hour of [0,6,12,18,23]){
  const config=options(new Date(2026,10,14,hour));const a=await previous(host,config),b=await render(host,config);
  compare(JSON.parse(JSON.stringify(a.image)),JSON.parse(JSON.stringify(b.image)));assert.deepEqual(a.header,b.header);assert.deepEqual(a.touchSplit,b.touchSplit);
  if(hour===12){for(const [name,model]of [['before',a],['after',b]]){const canvas=paint(model.image,d,{styles:0});fs.writeFileSync('/tmp/calendar-moon-'+name+'.png',canvas.toBuffer('image/png'));}}
 }
 assert(changed>0);console.log(JSON.stringify({passed:true,scenes:5,onlyMoonStrokeChanges:changed,moonWidth:4,dividerWidth:8,frameWidth:6,physicalIOS:'not tested'}));
})().catch(e=>{console.error(e);process.exitCode=1});
