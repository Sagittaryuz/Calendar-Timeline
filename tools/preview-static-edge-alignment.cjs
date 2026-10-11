// Compara desenho real com fontes/ícones sintéticos, sem dados pessoais.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const [beforeFile,afterFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw Error('Uso: node tools/preview-fixed-day-header.cjs antes depois saída.json');
const testsDirectory=path.join(__dirname,'..','tests');
const harness=fs.readFileSync(path.join(testsDirectory,'moving-day-header.cjs'),'utf8')
 .split('let count=0;const snapshots=[];')[0]
 .replace(/const source=fs.readFileSync[^;]+;/,'const source=SOURCE_TEXT;');
const result=[];
for(const [label,file] of [['ANTES',beforeFile],['DEPOIS',afterFile]]) {
 const sandbox={require,__dirname:testsDirectory,SOURCE_TEXT:fs.readFileSync(file,'utf8'),OUTPUT:result,label};
 vm.runInNewContext(harness+`
 c.titleDailyTemperatureForDay=d=>({minimum:19+d.getDate()%3,maximum:29+d.getDate()%3});
 for(const [day,hour] of [[10,6],[10,12],[10,22+40/60],[11,0]]) {
  c.windowStart=new Date(2026,9,day);c.windowStart.setTime(+c.windowStart+hour*3600000);
  c.windowEnd=new Date(+c.windowStart+86400000);c.currentDayUnifiedPolygon.points=null;
  texts=[];paths=[];icons=[];ops=[];
  c.drawDatePanel(ctx,new Set());c.drawCurrentDayFrame(ctx);
  OUTPUT.push({label,day,hour,card:c.titleDayCardRect(c.titleTodayCardIndex()),
   midnight:c.timeToX(c.addDays(c.startOfDay(c.windowStart),1)),
   otherCards:Array.from({length:6},(_,i)=>c.titleDayCardRect(c.titleTodayCardIndex()+i+1)),
   left:paths.at(-2).path.points,upper:paths.at(-1).path.points,
   contour:c.widgetLeftContourPoints().slice(0,65),ops,icons});
 }
 `,sandbox);
}
const before=result.filter(s=>s.label==='ANTES'),after=result.filter(s=>s.label==='DEPOIS');
for(let index=0;index<after.length;index++) {
 const a=after[index],b=before[index];
 assert.deepEqual(JSON.parse(JSON.stringify(a.card)),JSON.parse(JSON.stringify(b.card)),'HOJE conserva posição, largura, altura e clamp.');
 assert.equal(a.midnight,b.midnight,'A linha temporal de meia-noite permanece inalterada.');
 assert.deepEqual(JSON.parse(JSON.stringify(a.upper.slice(1))),JSON.parse(JSON.stringify(b.upper.slice(1))),
  'Topo direito, lado direito e ligação à régua não mudam.');
 const normalize=p=>JSON.parse(JSON.stringify(p));
 assert.deepEqual(normalize(a.left),normalize(b.left),'Toda a moldura permanece idêntica.');
 if(index>0)assert.deepEqual(normalize(a.otherCards),normalize(after[0].otherCards),
  'Os seis retângulos permanecem fixos, inclusive na virada.');
}
fs.writeFileSync(outputFile,JSON.stringify(result));
console.log('OK: 4 pares antes/depois; HOJE e régua preservados, seis quadros fixos, moldura idêntica; alinhamento apenas nos extremos estáticos.');
