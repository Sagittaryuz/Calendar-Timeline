// Explicit demonstration only. Never mixed with the user's calendar or weather.
function demoInput(){
 const now=new Date(2026,9,17,12,10),day=new Date(2026,9,17),at=(d,h)=>+new Date(2026,9,17+d,h);
 const calendar={identifier:'demo',title:'Demonstração',color:{hex:'0A84FF'}};
 const events=[{identifier:'sample-event',title:'REVISAR PROJETO',startDate:at(0,13),endDate:at(0,15),isAllDay:false,calendar},{identifier:'sample-next',title:'ENCONTRO DA EQUIPE',startDate:at(1,9),endDate:at(1,10),isAllDay:false,calendar}];
 const reminders=[{identifier:'sample-reminder',title:'ORGANIZAR A SEMANA',dueDate:at(0,13),dueDateIncludesTime:true,priority:1,calendar:{...calendar,color:{hex:'FF9F0A'}}}];
 const hours=Array.from({length:24*15},(_,i)=>{const date=new Date(+day-6*86400000+i*3600000),h=date.getHours();return {timestamp:+date,temperature:Math.round(22+5*Math.sin((h-8)/24*Math.PI*2)),rainMM:0,rainChance:0,symbol:h>=6&&h<18?'d1':'n1',cloudiness:5};});
 const daily={};for(let d=-6;d<=8;d++){const t=new Date(at(d,0));daily[`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`]={minimum:18,maximum:27,symbol:'d1'};}
 return {now:+now,hours:24,events,reminders,weather:{hours,daily},latitude:-17.88,longitude:-51.71};
}
