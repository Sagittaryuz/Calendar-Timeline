// Exercise visual order and common translation near every crossing, local midnight and DST.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const directory=__dirname,harness=fs.readFileSync(path.join(directory,'moving-day-header.cjs'),'utf8').split('let count=0;const snapshots=[];')[0];
vm.runInNewContext(harness+`
let cases=0;
c.restoreWidgetBackgroundSpan=()=>{}; // Geometry/selection test; full rendering is covered separately.
for(const width of [960,1092,1200])for(const hours of [1,12,24,48,96])for(const base of [[2026,9,11],[2026,9,31],[2026,10,1],[2026,11,31]]) {
 run('CANVAS.width='+width+';CANVAS.plotRight='+width+';');
 const minutes=[0,20,54,720,1360,1439.999];
 // Each slot crossing uses the real hour-window projection, not a hardcoded time.
 for(let slot=0;slot<7;slot++)for(const delta of [-0.0001,0,0.0001]) {
  const m=1440-hours*60*(slot+1)/7+delta;if(m>=0&&m<1440)minutes.push(m);
 }
 for(const minute of minutes) {
  c.windowStart=new Date(...base);c.windowStart.setTime(+c.windowStart+minute*60000);c.windowEnd=new Date(+c.windowStart+hours*3600000);
  const cards=[];const original=c.drawTitleDayCard;c.drawTitleDayCard=(_,d,r,selected,last,bg,txt)=>{if(txt)cards.push({d,r,selected});};
  ops=[];c.drawDatePanel(ctx,new Set());c.drawTitleDayCard=original;
  const ordered=cards.slice().sort((a,b)=>a.r.x-b.r.x),today=cards.find(v=>v.selected),step=width/7;
  assert.equal(cards.filter(v=>v.selected).length,1);assert(ordered[0].r.x<=c.titleCardGap()+0.001);assert.equal(new Set(cards.map(v=>c.dateKey(v.d))).size,cards.length);
  for(let i=1;i<ordered.length;i++)assert.equal(+c.addDays(ordered[i-1].d,1),+ordered[i].d,'Datas locais consecutivas na tela: '+JSON.stringify({width,hours,minute,ordered:ordered.map(v=>[c.dateKey(v.d),v.r.x])}));
  for(const v of cards.filter(v=>!v.selected)) {
   const offset=Math.round((Date.parse(c.dateKey(v.d))-Date.parse(c.dateKey(today.d)))/86400000);
   assert(Math.abs(v.r.x-(today.r.x+offset*step+(offset>0?c.titleCardGap():0)))<1e-7,'Uma única translação, sem saltos por floor de índice.');
   assert((v.r.x<today.r.x)===(v.d<today.d));
  }
  if(c.dateKey(c.windowStart)==='2026-10-11'&&hours===24&&minute===20) {
   assert(cards.some(v=>c.dateKey(v.d)==='2026-10-10'&&v.r.x<today.r.x),'SAB10 antes de DOM11.');
   assert(cards.some(v=>c.dateKey(v.d)==='2026-10-09'&&v.r.x<today.r.x),'SEX09 antes de DOM11.');
   assert(cards.some(v=>c.dateKey(v.d)==='2026-10-12'&&v.r.x>today.r.x),'SEG12 somente à direita de DOM11.');
  }
  cases++;
 }
}
console.log('OK: '+cases+' composições; início/meio/fim, todos os cruzamentos, 1–96h, viradas e DST; TZ='+process.env.TZ);
`,{require,__dirname:directory,process,console});
