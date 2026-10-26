// Real engine + production UI tree. Dispatch below models frontmost sibling
// hit testing; it cannot prove WidgetKit gesture arbitration on an iOS device.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'scripting/scripts/Calendar Timeline Scripting');
const baseline='6a5688e3ae3e20aed3ddaaae4f691f831a89e054';
const code=buildSync({entryPoints:[path.join(dir,'timeline-view.tsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['scripting'],jsxFactory:'createElement'}).outputFiles[0].text;
const definitions={},sdk={Link:'Link',Button:'Button',Rectangle:'Rectangle',ZStack:'ZStack',AppIntentProtocol:{AppIntent:0},AppIntentManager:{register:d=>{definitions[d.name]=d;return params=>({name:d.name,params})}}};
const moduleObject={exports:{}};
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,require:()=>sdk,createElement:(type,props,...children)=>({type,props,children})});
const {TimelineView,timelineLayout}=moduleObject.exports;
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function engine(source,probe=false){
 if(probe)source=source.replace('return {hourLegend:', 'return {probe:{chartTop:CANVAS.timelineTop+timelineChartTop(),chartBottom:CANVAS.timelineTop+timelineChartBottom(),thermalTop:CANVAS.timelineTop+thermalTemperatureLabelTopY(),thermalBottom:CANVAS.timelineTop+thermalBandBottomY()},hourLegend:');
 return new AsyncFunction('host','options',source.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
}
const current=engine(fs.readFileSync(path.join(dir,'original-engine.js'),'utf8'),true);
const previous=engine(cp.execFileSync('git',['show',baseline+':scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{cwd:root,encoding:'utf8'}));
const sizes=[[338,158,false],[364,170,false],[402,186,false],[715,342,true],[744,348,true],[1064,510,true],[980,400,true]];
function contains(rect,x,y){return x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height}
(async()=>{
 const drawing=await import(pathToFileURL(path.join(dir,'drawing.js')).href);
 const host={...drawing,SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})},DateFormatter:class{string(d){return String(d.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})}};
 let scenes=0,points=0,trees=0;const geometries=[];
 for(const populated of [false,true])for(let day=18;day<=24;day++){
  const now=new Date(2026,9,21,12),focus=new Date(2026,9,day),start=new Date(+focus+10*3600000);
  const event={kind:'event',identifier:'event',title:'Synthetic event',start,end:new Date(+start+3600000),color:'#0A84FF',calendarTitle:'Test',isAllDay:false};
  const reminder={...event,kind:'reminder',identifier:'reminder',title:'Synthetic reminder',start:new Date(+start+2*3600000),end:new Date(+start+3*3600000)};
  const options={now:+now,focusDate:+focus,loadResult:{items:populated?[event,reminder]:[],holidayDates:new Set(),error:null},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:populated?Array.from({length:25},(_,i)=>({timestamp:+focus+i*3600000,temperature:25+5*Math.sin(i/4),rainChance:i%8===0?80:0,rainMM:i%8===0?2:0,cloudiness:15,symbol:'d0'})):[],daily:{}},holidayDates:new Set()};
  const model=await current(host,options),old=await previous(host,options);
  assert.equal(JSON.stringify(model.image),JSON.stringify(old.image),'Every drawing operation stays identical to 0.3.16');
  const {probe,thermalBand,...rest}=model;assert.equal(JSON.stringify(rest),JSON.stringify(old),'Existing geometry, agenda and model metadata unchanged');
  assert.equal(thermalBand.y,probe.thermalTop);assert.equal(thermalBand.y+thermalBand.height,probe.thermalBottom);
  assert(probe.chartBottom<thermalBand.y);assert(thermalBand.y+thermalBand.height<=model.hourLegend.y);
  if(!scenes)geometries.push({header:model.header.map(({x,y,width,height})=>({x,y,width,height})),charts:{top:probe.chartTop,bottom:probe.chartBottom},thermalBand,hourLegend:model.hourLegend});
  for(const [width,height,extraLarge] of sizes){
   const view=TimelineView({model,width,height,extraLarge}),layout=timelineLayout(model.width,model.height,width,height,extraLarge);
   const nodes=view.children.flat().filter(Boolean),link=nodes[0],buttons=nodes.slice(1);
   assert.equal(link.type,'Link');assert.equal(link.props.url,'calshow://');assert.equal(link.props.intent,undefined);
   assert.equal(buttons.length,9);assert.equal(link.children.length,1);assert.equal(typeof link.children[0].type,'function','Rendering tree untouched');
   const targets=buttons.map(node=>{assert.equal(node.type,'Button');assert.equal(node.props.url,undefined);assert.equal(node.children[0].type,'Rectangle');assert.equal(node.children[0].props.opacity,0.001);const {frame,position}=node.props;return {node,x:position.x-frame.width/2,y:position.y-frame.height/2,width:frame.width,height:frame.height}});
   for(let i=0;i<targets.length;i++){
    const a=targets[i];assert(a.x>=-1e-8&&a.y>=-1e-8&&a.x+a.width<=width+1e-8&&a.y+a.height<=height+1e-8);
    for(const b of targets.slice(i+1))assert(!(a.x<b.x+b.width-1e-8&&a.x+a.width>b.x+1e-8&&a.y<b.y+b.height-1e-8&&a.y+a.height>b.y+1e-8),'No two intents overlap');
   }
   function dispatch(x,y){
    const px=layout.left+x*layout.sx,py=layout.top+y*layout.sy;
    const hits=targets.filter(r=>contains(r,px,py));assert(hits.length<=1,'No double intent');points++;
    return hits.length?hits[0].node.props.intent:link.props.url;
   }
   for(const [i,dayRect] of model.header.entries())for(let repeat=0;repeat<3;repeat++){
    const action=dispatch(dayRect.x+dayRect.width/2,dayRect.y+dayRect.height/2);assert.equal(action.name,'CalendarTimelineSelectDay');assert.equal(action.params.date,model.header[i].date);
   }
   for(const x of [1,156,546,936,1091])for(const y of [probe.chartTop+0.01,(probe.chartTop+probe.chartBottom)/2,probe.chartBottom-0.01,thermalBand.y-0.01,thermalBand.y+0.01,probe.thermalBottom-0.01,probe.thermalBottom+0.01,model.hourLegend.y-0.01,model.hourLegend.y+0.01,model.hourLegend.y+model.hourLegend.height-0.01,model.hourLegend.y+model.hourLegend.height+0.01]){
    const expected=contains(thermalBand,x,y)||contains(model.hourLegend,x,y)?'CalendarTimelineRefresh':'calshow://';
    for(let repeat=0;repeat<3;repeat++){const result=dispatch(x,y);assert.equal(typeof result==='string'?result:result.name,expected)}
   }
   trees++;
  }
  scenes++;
 }
 // Exercise the existing production refresh/select implementation repeatedly,
 // with its native and bridge boundaries mocked. No agenda writes are exposed.
 const values=new Map(),calls=[];const m={exports:{}};
 // Intercept bridge-auto at bundle time so no real network/agenda is touched.
 const {transformSync}=require('esbuild');
 const source=transformSync(fs.readFileSync(path.join(dir,'app_intents.tsx'),'utf8'),{loader:'tsx',format:'cjs'}).code;
 const selection=transformSync(fs.readFileSync(path.join(dir,'selection.ts'),'utf8'),{loader:'ts',format:'cjs'}).code,sm={exports:{}};
 vm.runInNewContext(selection,{module:sm,exports:sm.exports,Date});
 vm.runInNewContext(source,{module:m,exports:m.exports,Date,Storage:{set:(k,v)=>{values.set(k,v);return true}},require:name=>name==='scripting'?{...sdk,Widget:{reloadAll:()=>calls.push('reload')}}:name==='./selection'?sm.exports:{autoSynchronize:async()=>calls.push('bridge')}});
 const today=sm.exports.localDay(new Date());
 for(let i=0;i<10;i++){
  await definitions.CalendarTimelineSelectDay.perform({date:today});assert.equal(values.get('selected-day').date,today);
  await definitions.CalendarTimelineRefresh.perform();assert.equal(values.get('selected-day').date,today);assert.equal(values.get('manual-refresh').state,'requested');assert(values.get('calendar-force-weather')>0);
 }
 assert.equal(calls.filter(c=>c==='reload').length,20);assert.equal(calls.filter(c=>c==='bridge').length,10);
 console.log(JSON.stringify({baseline,scenes,trees,points,sizes,geometries,drawing:'byte-identical serialized operations',repeatIntents:20,nativeGestureArbitration:'pending physical iOS'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
