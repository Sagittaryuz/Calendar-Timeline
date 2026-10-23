// @ts-nocheck
// Shared, dependency-free wire contract. Mirrored in the private service.
export const EXTRA_FIELDS=['notes','notesMode','location','url','structuredLocation','priority','alarms']
const bad=m=>{throw Object.assign(Error(m),{status:400})}
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))bad('Campos de detalhes não permitidos')}
const string=(v,max)=>{if(typeof v!=='string'||v.length>max)bad('Texto de detalhes inválido');return v.replace(/\r\n?/g,'\n')}
const nullable=(v,max)=>v==null||v===''?null:string(v,max)
const num=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)bad('Número de detalhes inválido');return v}
const stamp=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))bad('Alerta exige data com fuso');return new Date(v).toISOString()}
export function normalizeLocation(v){
 if(v===null)return null
 exact(v,['title','latitude','longitude','radius'])
 return {title:nullable(v.title,500),latitude:num(v.latitude,-90,90),longitude:num(v.longitude,-180,180),radius:num(v.radius,0,100000)}
}
export function normalizeAlarms(list){
 if(!Array.isArray(list)||list.length>10)bad('Use até dez alertas; [] remove os alertas')
 return list.map(a=>{
  exact(a,['absoluteDate','relativeOffset','location','proximity'])
  const absoluteDate=a.absoluteDate==null?null:stamp(a.absoluteDate),relativeOffset=a.relativeOffset??0,location=a.location==null?null:normalizeLocation(a.location),proximity=a.proximity??'none'
  num(relativeOffset,-366*86400,366*86400)
  if(location&&location.radius<1)bad('Alerta por local exige raio positivo')
  if(absoluteDate&&relativeOffset!==0)bad('Alerta não pode ter data absoluta e deslocamento juntos')
  if(!['none','enter','leave'].includes(proximity)||!!location!==(proximity!=='none'))bad('Local exige proximidade enter ou leave')
  return {absoluteDate,relativeOffset:absoluteDate?0:relativeOffset,location,proximity}
 }).sort((a,b)=>(JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0))
}
export function normalizeExtras(raw,kind){
 exact(raw,EXTRA_FIELDS);const p={}
 if('notes'in raw){p.notes=nullable(raw.notes,16000);if(p.notes?.split('\n').some(x=>/^ct-bridge-(real|command):/.test(x)))bad('Linha reservada da ponte nas notas')}
 if('notesMode'in raw){if(!['replace','append','prepend'].includes(raw.notesMode)||!('notes'in raw)||raw.notesMode!=='replace'&&raw.notes===null)bad('Modo de notas inválido');p.notesMode=raw.notesMode}
 if(kind==='event'){
  if('priority'in raw)bad('Prioridade somente em lembretes')
  if('location'in raw)p.location=nullable(raw.location,2000)
  if('url'in raw){p.url=nullable(raw.url,2000);if(p.url&&!/^https?:\/\/[^\s]+$/i.test(p.url))bad('Link deve usar http ou https')}
  if('structuredLocation'in raw)p.structuredLocation=normalizeLocation(raw.structuredLocation)
 }else{
  if(['location','url','structuredLocation'].some(k=>k in raw))bad('Localização de lembrete é configurada nos alertas; link não é suportado nesta API')
  if('priority'in raw){if(!Number.isInteger(raw.priority))bad('Prioridade deve ser inteira');p.priority=num(raw.priority,0,9)}
 }
 if('alarms'in raw)p.alarms=normalizeAlarms(raw.alarms)
 return p
}
export function normalizeDetails(raw,kind){
 const allowed=kind==='event'?['notes','alarms','location','url','structuredLocation']:['notes','alarms','priority'];exact(raw,allowed)
 if(allowed.some(k=>!(k in raw)))bad('Leitura detalhada incompleta')
 const out=normalizeExtras(kind==='event'?Object.fromEntries(Object.entries(raw).filter(([k])=>k!=='url')):raw,kind)
 if(kind==='event')out.url=nullable(raw.url,2000)
 return kind==='event'?{notes:out.notes,alarms:out.alarms,location:out.location,url:out.url,structuredLocation:out.structuredLocation}:{notes:out.notes,alarms:out.alarms,priority:out.priority}
}
export function detailsKey(raw,kind){return JSON.stringify(normalizeDetails(raw,kind))}
export function hasExtras(p){return EXTRA_FIELDS.some(k=>k in p)}
export function patchedDetails(before,p,kind){
 const out={...before},extras=normalizeExtras(Object.fromEntries(Object.entries(p).filter(([k])=>EXTRA_FIELDS.includes(k))),kind)
 if('notes'in extras&&extras.notesMode&&extras.notesMode!=='replace'){
  const parts=extras.notesMode==='append'?[before.notes,extras.notes]:[extras.notes,before.notes]
  extras.notes=parts.filter(v=>v!==null&&v!=='').join('\n')||null
 }
 delete extras.notesMode
 Object.assign(out,extras);return normalizeDetails(out,kind)
}
export function coreItem(i){const {details,detailsRevision,...core}=i;return core}
