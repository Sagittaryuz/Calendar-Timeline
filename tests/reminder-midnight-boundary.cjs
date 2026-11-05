const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('scripting/scripts/Calendar Timeline Scripting/original-engine.js','utf8');
const start=source.indexOf('    const reminderOccurrenceView =');
const end=source.indexOf('    const reminderOccurrenceKey =',start);
assert(start>=0&&end>start);
for(const tz of ['America/Sao_Paulo','UTC','Pacific/Auckland']){
 process.env.TZ=tz;
 const todayStart=new Date(2026,10,5), tomorrow=new Date(2026,10,6), past=new Date(2026,9,5);
 const reminder=(id,due,time=true)=>({identifier:id,dueDate:due,dueDateIncludesTime:time});
 const ctx={Date,todayStart,reminders:[reminder('tomorrow',tomorrow)],todayRemindersRaw:[reminder('tomorrow',tomorrow),reminder('today',todayStart),reminder('recurring',past)]};
 ctx.normalizedReminderDayStart=r=>new Date(r.dueDate.getFullYear(),r.dueDate.getMonth(),r.dueDate.getDate());
 vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nthis.result={rangeReminderViews,todayOccurrenceViews}',ctx);
 assert.deepEqual(Array.from(ctx.result.todayOccurrenceViews,x=>x.identifier),['today','recurring'],tz);
 assert.equal(ctx.result.rangeReminderViews[0].dueDate.getTime(),tomorrow.getTime());
 assert.equal(ctx.result.todayOccurrenceViews[1].dueDate.getTime(),todayStart.getTime());
}
console.log('OK: limite de meia-noite, data futura e recorrência anterior em três fusos.');
