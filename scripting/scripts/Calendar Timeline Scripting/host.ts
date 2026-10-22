import { CalendarEvent, Reminder, DateFormatter, Keychain, Location, UIImage, fetch } from 'scripting'
import * as drawing from './drawing'

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

export function createHost(now=new Date()) {
  const files=storedFiles(),today=dayRange(now)
  const promises=new Map<string,Promise<any[]>>()
  const memo=(key:string,fn:()=>Promise<any[]>)=>{
    if(!promises.has(key))promises.set(key,fn());return promises.get(key)!
  }
  class Request {
    method='GET';headers:Record<string,string>={};body?:string;timeoutInterval=12;response?:{statusCode:number}
    constructor(public url:string){}
    async loadString(){
      const allowed=['api.open-meteo.com','api.met.no','brasilapi.com.br','nominatim.openstreetmap.org','servicodados.ibge.gov.br','date.nager.at']
      const url=new URL(this.url)
      if(url.protocol!=='https:'||!allowed.includes(url.hostname))throw new Error('Destino externo não habilitado nesta edição')
      const res=await fetch(this.url,{method:this.method,headers:this.headers,body:this.body,timeout:this.timeoutInterval})
      this.response={statusCode:res.status};if(!res.ok)throw new Error('HTTP '+res.status)
      return res.text()
    }
    async loadJSON(){return JSON.parse(await this.loadString())}
  }
  return {
    ...drawing,DateFormatter,
    CalendarEvent:{between:(a:Date,b:Date)=>memo('events:'+a.toISOString()+b.toISOString(),async()=>
      (await CalendarEvent.getAll(a,b)).map(event)),
      today:()=>memo('today-events',async()=>(await CalendarEvent.getAll(today.start,today.end)).map(event))},
    Reminder:{incompleteDueBetween:(a:Date,b:Date)=>memo('reminders:'+a.toISOString()+b.toISOString(),async()=>
      (await Reminder.getIncompletes({startDate:a,endDate:b})).map(reminder)),
      incompleteDueToday:()=>memo('today-reminders',async()=>(await Reminder.getIncompletes({startDate:today.start,endDate:today.end})).map(reminder)),
      scheduled:()=>memo('pending-reminders',async()=>(await Reminder.getIncompletes()).map(reminder))},
    FileManager:{local:()=>files},Keychain,
    Location:{setAccuracyToThreeKilometers:()=>{},current:async()=>{
      await Location.setAccuracy('threeKilometers');const point=await Location.requestCurrent();
      if(!point)throw new Error('Localização indisponível');return point
    },reverseGeocode:(latitude:number,longitude:number)=>Location.reverseGeocode({latitude,longitude,locale:'pt_BR'})},
    Request,
    SFSymbol:{named:(symbol:string)=>({image:{symbol,size:{width:30,height:30}},applyFont:()=>{}})},
    Data:{fromBase64String:(value:string)=>value},
    Image:{fromData:(value:string)=>{const native=UIImage.fromBase64String(value);if(!native)throw new Error('Imagem inválida');return {native,size:{width:native.width,height:native.height}}}},
    Timer:undefined,
  }
}
