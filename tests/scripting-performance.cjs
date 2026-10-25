const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const source=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8');
const baseline=cp.execFileSync('git',['show','0519c3d:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'}).replace('topRight:isLast?TITLE_CARD_OUTER_CORNER_RADIUS:0,bottomLeft:0,bottomRight:0','topRight:isLast?TITLE_CARD_OUTER_CORNER_RADIUS:0,bottomLeft:0,bottomRight:date.getDay()===0?TITLE_CARD_OUTER_CORNER_RADIUS:0').replace('topRight:Math.max(0,radii.topRight-2)},','topRight:Math.max(0,radii.topRight-2),bottomLeft:Math.max(0,radii.bottomLeft-2),bottomRight:Math.max(0,radii.bottomRight-2)},');
function compile(text){return new AsyncFunction('host','options',text.replace('export async function renderOriginal(host, options = {}) {','') .replace(/}\s*$/,''));}
const current=compile(source),previous=compile(baseline);
const now=new Date(2026,9,22,12),astronomy={latitude:-16.68,longitude:-49.25},weather={hours:[],daily:{}};
const fixture={now:+now,focusDate:+now,loadResult:{items:[],holidayDates:new Set(),error:null},astronomy,hourlyWeather:weather,holidayDates:new Set()};
async function main(){
 const d=await import(pathToFileURL(path.join(dir,'drawing.js')).href);
 const host={...d,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 // Count actual font-fit work, rather than asserting machine-specific timings.
 async function fits(text){let checks=0;const fn=compile(text.replace('function weekHeaderHeadlineFits(date,card,size) {','function weekHeaderHeadlineFits(date,card,size) { host.fit();'));await fn({...host,fit:()=>checks++},fixture);return checks;}
 const fitBefore=await fits(baseline),fitAfter=await fits(source);assert(fitAfter<fitBefore/2);
 // Compare every recorded visual operation except the two requested titles.
 const oldModel=await previous(host,fixture),newModel=await current(host,fixture);
 const clean=image=>({...image,ops:image.ops.filter(o=>!(o.type==='text'&&/^(DOM|SAB) \d\d$/i.test(o.text))).map(o=>o.image?.ops?{...o,image:clean(o.image)}:o)});
 assert.deepEqual(JSON.parse(JSON.stringify(clean(newModel.image))),JSON.parse(JSON.stringify(clean(oldModel.image))),'All other drawing operations remain identical');
 let drawings=0;class CountDraw extends d.DrawContext{constructor(){super();drawings++}}
 const prepared=await current({...host,DrawContext:CountDraw},{...fixture,prepareOnly:true});assert.equal(drawings,0);assert.equal(prepared.image,null);assert.equal(prepared.focusDate,newModel.focusDate);assert.deepEqual(prepared.sourceStatus,newModel.sourceStatus);
 // Deferred native reads prove agenda and location overlap without clock thresholds.
 let release;const wait=new Promise(r=>release=r),calls=[];
 const native={...host,CalendarEvent:{between:async()=>{calls.push('agenda');await wait;return []},today:async()=>[]},Reminder:{incompleteDueBetween:async()=>[],incompleteDueToday:async()=>[],scheduled:async()=>[]},Location:{setAccuracyToThreeKilometers(){},current:async()=>{calls.push('location');await wait;return astronomy}}};
 const loading=current(native,{...fixture,loadResult:undefined,astronomy:undefined,prepareOnly:true});await new Promise(r=>setImmediate(r));assert(calls.includes('agenda')&&calls.includes('location'));release();await loading;
 // Equivalent synthetic I/O benchmark; not a phone measurement.
 const delayed=()=>{const pause=async value=>{await new Promise(r=>setTimeout(r,50));return value};return {...native,CalendarEvent:{between:()=>pause([]),today:()=>pause([])},Reminder:{incompleteDueBetween:()=>pause([]),incompleteDueToday:()=>pause([]),scheduled:()=>pause([])},Location:{setAccuracyToThreeKilometers(){},current:()=>pause(astronomy)}}};
 const timed=async fn=>{const start=performance.now();await fn(delayed(),{...fixture,loadResult:undefined,astronomy:undefined});return Math.round(performance.now()-start)};
 const beforeMS=await timed(previous),afterMS=await timed(current);
 console.log(JSON.stringify({passed:true,fontFitChecks:{before:fitBefore,after:fitAfter},syntheticIOms:{before:beforeMS,after:afterMS},prepareOnlyDrawContexts:drawings,nativeDevicePerformance:'not-measured'}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
