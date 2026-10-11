// Geometric contract: a common continuous translation, then one final clamp.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const directory=__dirname,harness=fs.readFileSync(path.join(directory,'moving-day-header.cjs'),'utf8').split('let count=0;const snapshots=[];')[0];
vm.runInNewContext(harness+`
const width=run('CANVAS.width'),step=width/7,dayStart=new Date(2026,9,11),limit=86400000*6/7;
const moments=[0,54*60000,12*3600000,Math.floor(limit)-1,Math.floor(limit)+1,23*3600000+59*60000];
const rows=[];
function snapshot(ms) {
 c.windowStart=new Date(+dayStart+ms);c.windowEnd=new Date(+c.windowStart+86400000);
 const index=c.titleTodayCardIndex();return {ms,today:c.titleDayCardRect(index),boundary:c.timeToX(c.addDays(c.startOfDay(c.windowStart),1)),cards:Array.from({length:13},(_,i)=>c.titleDayCardRect(index+i-6))};
}
for(const ms of moments) {
 const a=snapshot(ms),b=snapshot(ms+1000),dx=b.today.x-a.today.x;
 assert(a.today.x>=0&&a.today.x+a.today.width<=width,'HOJE inteiro durante o movimento.');
 for(let i=0;i<a.cards.length;i++)assert(Math.abs((b.cards[i].x-a.cards[i].x)-dx)<1e-9,'Nenhum quadro trava sozinho ou troca sua posição por índice.');
 if(ms<Math.floor(limit)-1)assert(Math.abs(dx-(b.boundary-a.boundary))<1e-9,'Mesma velocidade da régua temporal.');
 if(ms>limit) {assert.equal(dx,0);assert(b.boundary<a.boundary,'Corpo continua após o cabeçalho parar.');}
 rows.push(a);
}
const before=snapshot(Math.floor(limit)-1),after=snapshot(Math.floor(limit)+1);
assert(before.today.x>0);assert.equal(after.today.x,0);assert(before.today.x<width*3/86400000,'Sem salto na entrada da parada.');
const midnight=snapshot(86400000);assert.equal(c.dateKey(c.windowStart),'2026-10-12');assert.equal(midnight.today.x,width-step);
console.log('OK: 00h00/00h54/12h, limite 20:34:17.143±1ms, 23h59 e virada; velocidade única, clamp contínuo e corpo independente.');
`,{require,__dirname:directory,console});
