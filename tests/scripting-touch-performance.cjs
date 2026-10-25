const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),{buildSync,transformSync}=require('esbuild'),{pathToFileURL}=require('url');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
(async()=>{
 const drawing=await import(pathToFileURL(path.join(dir,'drawing.js')).href);let clips=0;const corners=[];
 const raw=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8').replace('if(dayCardNeighbourClip.cache)return dayCardNeighbourClip.cache;','if(dayCardNeighbourClip.cache)return dayCardNeighbourClip.cache;host.clipBuild();').replace('fillTitleCardShape(ctx,card,radii,new Color','host.corner(date.getDay(),radii);fillTitleCardShape(ctx,card,radii,new Color');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,run=new AsyncFunction('host','options',raw.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
 const host={...drawing,clipBuild:()=>clips++,corner:(day,r)=>corners.push({day,...r}),SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})},DateFormatter:class{string(d){return String(d.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})}};
 const now=new Date(2026,9,21,12),start=new Date(2026,9,21,10),event={kind:'event',identifier:'one',title:'Synthetic',start,end:new Date(+start+3600000),color:'#0A84FF',calendarTitle:'Test',isAllDay:false};
 const model=await run(host,{now:+now,focusDate:+now,loadResult:{items:[event,{...event,identifier:'two'}],holidayDates:new Set(),error:null},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:[],daily:{}},holidayDates:new Set()});
 assert.equal(clips,1,'Shared neighbor contour calculated once, not six times');assert(corners.find(c=>c.day===0).bottomRight>0);assert(corners.find(c=>c.day===6).bottomLeft>0);
 function check(image){for(const op of image.ops){if(op.type==='text')assert(!/×\d+/.test(op.text),'Overlapping event multiplier absent');if(op.image?.ops)check(op.image)}}check(model.image);
 const first=drawing.segments(model.image);assert.equal(drawing.segments(model.image),first,'Immutable Canvas segmentation reused');
 const m={exports:{}},values=new Map([['calendar-local-touch',Date.now()]]);let bridge=0,loads=0;
 const sdk={Widget:{family:'systemMedium',displaySize:{width:338,height:170},present:()=>{}},Text:'Text'};
 const deps={scripting:sdk,'./bridge-auto':{autoSynchronize:async()=>bridge++},'./model':{loadModel:async()=>{loads++;return model}},'./timeline-view':{TimelineView:()=>{}},'./diagnostics':{VERSION:'fixture',failureDetails:String}};
 const code=transformSync(fs.readFileSync(path.join(dir,'widget.tsx'),'utf8').replace(/main\(\)\s*$/,'module.exports=main'),{loader:'tsx',format:'cjs',jsxFactory:'createElement'}).code;
 vm.runInNewContext(code,{module:m,exports:m.exports,require:id=>deps[id],createElement:()=>({}),Date,Storage:{get:k=>values.get(k),set:()=>true}});await m.exports();assert.equal(bridge,0,'Day tap does not wait for bridge');assert.equal(loads,1,'One native agenda render');
 console.log('PASS touch/render: Sun/Sat lower corners, overlap label removed, one neighbor mask, memoized Canvas segments, day tap reload without bridge wait. Physical latency pending.');
})().catch(e=>{console.error(e);process.exitCode=1});
