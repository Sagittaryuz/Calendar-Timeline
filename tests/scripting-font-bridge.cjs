const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
(async()=>{
 const {d,host,options}=await fixture();
 const faces={'SFMono-Heavy':'Menlo-Bold','SFMono-Regular':'Menlo-Regular','SFProRounded-Black':'AvenirNext-Heavy','SFProRounded-Bold':'AvenirNext-Bold','SFProRounded-Regular':'AvenirNext-Regular','SFProText-Bold':'HelveticaNeue-Bold','SFProText-Medium':'HelveticaNeue-Medium'};
 const calls=[];let font;const ctx=new Proxy({measureText:text=>{calls.push({type:'measure',font,text});return {width:text.length*15}},save(){},restore(){},scale(){},fillText(text,x,y){calls.push({type:'draw',font,text,x,y})}},{set(o,k,v){if(k==='font')font=v;o[k]=v;return true},get(o,k){return o[k]??(()=>{})}});
 for(const [alias,face]of Object.entries(faces)){
  const draw=new d.DrawContext();draw.setFont(new d.Font(alias,29));draw.drawText('PESO 29',new d.Point(10,20));const op=draw.getImage().ops[0];d.headerTextBounds(ctx,op);d.replay(ctx,[op],1092,510,1092,510,()=>null);const pair=calls.slice(-2);assert.deepEqual(pair.map(p=>p.font),[{name:face,size:29},{name:face,size:29}]);assert.equal(pair[1].text,'PESO 29');
 }
 const before=compile(cp.execFileSync('git',['show','d124c4c:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'})),after=compile(raw);let headers=0;
 const normalize=image=>JSON.parse(JSON.stringify(image),(k,v)=>Array.isArray(v)?v.filter(o=>o.type!=='header'):v);
 for(const day of [25,27,31]){
  const o=options(new Date(2026,9,day,20)),a=await after(host,o),b=await before(host,o);assert.deepEqual(normalize(a.image),normalize(b.image),'All recorded colors/alpha, charts, geometry and continuous frame unchanged');
  for(const h of flatten(a.image).filter(o=>o.type==='header')){assert.equal(h.title.state.font.size,29);assert.equal(h.word.state.font.name,h.isToday?'AvenirNextCondensed-Heavy':'AvenirNextCondensed-DemiBold');assert.deepEqual(h.number.state.font,h.word.state.font);assert.equal(h.number.state.text.hex,h.word.state.text.hex);headers++}
 }
 const c=require('@napi-rs/canvas'),path=require('node:path');
 for(const [file,name]of [['BarlowCondensed-SemiBold.ttf','Semi'],['BarlowCondensed-Black.ttf','Heavy']])c.GlobalFonts.registerFromPath(path.join(__dirname,'fixtures/fonts',file),name);
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf','BodyRegular');c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-ExtraBold.ttf','BodyHeavy');
 const density=name=>{const cv=c.createCanvas(400,70),x=cv.getContext('2d');x.font='29px '+name;x.textBaseline='top';x.fillStyle='white';x.fillText('DOM 28 EVENTO',10,5);const pixels=x.getImageData(0,0,400,70).data;let ink=0;for(let i=3;i<pixels.length;i+=4)ink+=pixels[i]/255;return ink/x.measureText('DOM 28 EVENTO').width};
 const rasterDensity={headerDemi:density('Semi'),headerHeavy:density('Heavy'),bodyRegular:density('BodyRegular'),bodyHeavy:density('BodyHeavy')};assert(rasterDensity.headerHeavy>rasterDensity.headerDemi*1.1);assert(rasterDensity.bodyHeavy>rasterDensity.bodyRegular*1.2);
 console.log(JSON.stringify({bridgeFaces:faces,headers,rasterDensity,sameFaceForMeasureAndDraw:true,duplicateDrawsAdded:0,size:29,nativeIOS:'not executed; public PostScript faces checked against Apple catalog; Canvas contract tested, UIKit/SwiftUI raster remains unverified'}));
})().catch(e=>{console.error(e);process.exitCode=1});
