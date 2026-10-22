// Native utilities are runtime globals; importing them from the UI module
// produces undefined on the installed Scripting host (confirmed on device).
import * as drawing from './drawing'
import { encodePNG } from './rect-raster'

function storedFiles() {
  const key=(p:string)=>'engine-file:'+p
  return {
    documentsDirectory:()=>'/calendar-timeline',
    joinPath:(a:string,b:string)=>a+'/'+b,
    fileExists:(p:string)=>Storage.contains(key(p)),
    readString:(p:string)=>{const v=Storage.get<string>(key(p));if(v===null)throw new Error('Cache ausente');return v},
    writeString:(p:string,s:string)=>{if(!Storage.set(key(p),s))throw new Error('Falha ao salvar cache')},
    remove:(p:string)=>Storage.remove(key(p)),
    move:(a:string,b:string)=>{const v=Storage.get(key(a));if(v===null)throw new Error('Cache ausente');if(!Storage.set(key(b),v))throw new Error('Falha no cache');Storage.remove(key(a))},
  }
}

function calendar(value:any){
  return value ? {identifier:value.identifier,title:value.title,
    color:{hex:typeof value.color==='string'?value.color.replace('#',''):''}} : null
}
function event(value:any){return {...value,identifier:value.identifier,title:value.title,
  startDate:value.startDate,endDate:value.endDate,isAllDay:value.isAllDay,
  calendar:calendar(value.calendar),location:value.location,notes:value.notes,url:value.url}}
function reminder(value:any){
  const c=value.dueDateComponents
  return {identifier:value.identifier,title:value.title,notes:value.notes,
    calendar:calendar(value.calendar),dueDate:c?.date??null,
    dueDateIncludesTime:c?.hour!=null&&c?.minute!=null,
    isCompleted:value.isCompleted,priority:value.priority}
}
function dayRange(now:Date){const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());const end=new Date(start);end.setDate(end.getDate()+1);return {start,end}}

async function within<T>(task:Promise<T>,milliseconds:number):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined
  try{return await Promise.race([task,new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('Tempo de consulta excedido')),milliseconds)
  })])}finally{if(timer!==undefined)clearTimeout(timer)}
}

export function createHost(now=new Date(),options:{background?:boolean}={}) {
  const files=storedFiles(),today=dayRange(now)
  const background=options.background===true,networkDeadline=Date.now()+(background?6000:15000)
  const promises=new Map<string,Promise<any[]>>()
  const memo=(key:string,fn:()=>Promise<any[]>)=>{
    if(!promises.has(key))promises.set(key,within(fn(),background?5000:10000));return promises.get(key)!
  }
  class Request {
    method='GET';headers:Record<string,string>={};body?:string;timeoutInterval=12;response?:{statusCode:number}
    constructor(public url:string){}
    async loadString(){
      const allowed=['api.open-meteo.com','api.met.no','brasilapi.com.br','nominatim.openstreetmap.org','servicodados.ibge.gov.br','date.nager.at']
      const url=new URL(this.url)
      const holidaySource=url.hostname==='raw.githubusercontent.com'&&url.pathname.startsWith('/joaopbini/feriados-brasil/master/dados/feriados/')
      if(url.protocol!=='https:'||(!allowed.includes(url.hostname)&&!holidaySource))throw new Error('Destino externo não habilitado nesta edição')
      const remaining=networkDeadline-Date.now()
      if(remaining<=0)throw new Error('Orçamento de rede encerrado; manter cache')
      const timeout=Math.min(this.timeoutInterval,background?3:8,remaining/1000)
      const res=await within(fetch(this.url,{method:this.method,headers:this.headers,body:this.body,timeout}),Math.ceil(timeout*1000))
      this.response={statusCode:res.status};if(!res.ok)throw new Error('HTTP '+res.status)
      return res.text()
    }
    async loadJSON(){return JSON.parse(await this.loadString())}
  }
  class BitmapDrawContext extends drawing.DrawContext {
    makeRaster=(crop:any)=>{
      const data=Data.fromUint8Array(encodePNG(crop))
      const native=data?UIImage.fromData(data):null
      if(!native)throw new Error('Falha ao preparar camada bitmap')
      return {native,size:{width:crop.width,height:crop.height}}
    }
  }
  return {
    ...drawing,DrawContext:BitmapDrawContext,DateFormatter,
    CalendarEvent:{between:(a:Date,b:Date)=>memo('events:'+a.toISOString()+b.toISOString(),async()=>
      (await CalendarEvent.getAll(a,b)).map(event)),
      today:()=>memo('today-events',async()=>(await CalendarEvent.getAll(today.start,today.end)).map(event))},
    Reminder:{incompleteDueBetween:(a:Date,b:Date)=>memo('reminders:'+a.toISOString()+b.toISOString(),async()=>
      (await Reminder.getIncompletes({startDate:a,endDate:b})).map(reminder)),
      incompleteDueToday:()=>memo('today-reminders',async()=>(await Reminder.getIncompletes({startDate:today.start,endDate:today.end})).map(reminder)),
      scheduled:()=>memo('pending-reminders',async()=>(await Reminder.getIncompletes()).map(reminder))},
    FileManager:{local:()=>files},Keychain,
    Location:{setAccuracyToThreeKilometers:()=>{},current:async()=>{
      await within(Location.setAccuracy('threeKilometers'),1000);const point=await within(Location.requestCurrent(),background?2000:5000);
      if(!point)throw new Error('Localização indisponível');return point
    },reverseGeocode:(latitude:number,longitude:number)=>within(Location.reverseGeocode({latitude,longitude,locale:'pt_BR'}),background?1500:3000)},
    Request,
    SFSymbol:{named:(symbol:string)=>({image:{symbol,size:{width:30,height:30}},applyFont:()=>{}})},
    Data:{fromBase64String:(value:string)=>value},
    Image:{fromData:(value:string)=>{const native=UIImage.fromBase64String(value);if(!native)throw new Error('Imagem inválida');return {native,size:{width:native.width,height:native.height}}}},
    Timer:undefined,
  }
}
