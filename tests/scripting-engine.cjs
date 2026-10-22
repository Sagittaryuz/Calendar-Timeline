const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dir=path.join(root,'scripting/scripts/Calendar Timeline Scripting');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function main(){
  const drawing=await import(require('node:url').pathToFileURL(path.join(dir,'drawing.js')).href);
  const {renderOriginal}=await import(require('node:url').pathToFileURL(path.join(dir,'original-engine.js')).href);
  const host={...drawing,SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})},DateFormatter:class{string(d){return this.dateFormat==='HH:mm'?`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:String(d.getDate())}},
    Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})}};
  let count=0,maxOps=0,maxLayers=0,totalRasterBytes=0;
  if(process.env.RASTER_BATCH==='1'){
    const {encodePNG}=await import(require('node:url').pathToFileURL(path.join(dir,'rect-raster.js')).href);
    host.DrawContext=class extends drawing.DrawContext {
      onInvalidColor=detail=>{throw Error('Unexpected raster color in synthetic scene: '+JSON.stringify(detail))};
      makeRaster=crop=>{const png=encodePNG(crop);totalRasterBytes+=png.length;return {native:{},size:{width:crop.width,height:crop.height}}};
    };
  }
  for(const date of ['2026-10-22T12:00:00','2026-10-22T15:18:00','2026-10-23T00:00:00','2026-10-25T00:00:00','2026-12-31T23:59:00','2027-01-01T00:00:00']){
    for(const populated of [false,true]){
      const focus=new Date(date),now=new Date('2026-10-22T12:00:00');
      const start=new Date(focus);start.setHours(14,0,0,0);
      const item={kind:'event',identifier:'synthetic',title:'Reunião de teste',start,end:new Date(+start+3600000),color:'#0A84FF',calendarTitle:'Teste',isAllDay:false};
      const loadResult={items:populated?[item]:[],holidayDates:new Set(),todayEventCount:populated?1:0,todayReminderCount:0,error:null};
      const options={now:+now,focusDate:+focus,loadResult,astronomy:{latitude:-16.68,longitude:-49.25},hourlyWeather:{hours:[],daily:{}},holidayDates:new Set()};
      if(process.env.WEATHER_FIXTURE==='1')options.hourlyWeather.hours=Array.from({length:49},(_,i)=>({
        timestamp:+focus+i*3600000,temperature:25+5*Math.sin(i/4),rainChance:i%8===0?80:0,rainMM:i%8===0?2:0,
        rainRate:i%8===0?2:0,cloudiness:i%8===0?85:15,symbol:i%8===0?'d5':'d0'}));
      const model=await renderOriginal(host,options);
      assert.equal(model.width,1092);assert.equal(model.height,510);assert(model.image.ops.length>0);
      assert(model.header.length>=7&&model.header.length<=8);
      assert.equal(model.header.filter(d=>d.selected).length,1);
      assert(model.header.every(d=>d.width>0&&d.x>=0&&d.x+d.width<=1092.001));
      assert.equal(model.focusDate,date.slice(0,10));
      let total=0,layers=0;
      const context=new Proxy({font:12,measureText:text=>({width:String(text).length*18,actualBoundingBoxAscent:20,actualBoundingBoxDescent:3})},
        {get:(o,k)=>k in o?o[k]:(...args)=>{assert(args.filter(v=>typeof v==='number').every(Number.isFinite),'Finite Canvas arguments: '+String(k))}});
      function validateGraph(image,depth=0,viewport={x:0,y:0,width:image.size.width,height:image.size.height}){
        assert(depth<30,'Bounded native layer depth');
        for(const part of drawing.segments(image,viewport)){
          if(part.type==='canvas'){
            total+=part.ops.length;layers++;
            drawing.replay(context,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>null);
          }else {const child=drawing.childViewport(part.image,part.rect,viewport);if(child)validateGraph(part.image,depth+1,child);}
        }
      }
      validateGraph(model.image);maxOps=Math.max(total,maxOps);maxLayers=Math.max(layers,maxLayers);
      count++;
    }
  }
  console.log(`PASS: ${count} complete original-engine renders; empty/populated, navigation, weekend, year boundary.`);
  console.log(`Replay validated; maximum ${maxOps} operations / ${maxLayers} Canvas layers in synthetic scenarios. Device memory/performance unverified.`);
  if(process.env.RASTER_BATCH==='1'){
    assert(maxOps<5000,'Bitmap batching bounds Canvas traffic');
    console.log(`Raster batch PNG bytes across ${count} scenarios: ${totalRasterBytes}.`);
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
