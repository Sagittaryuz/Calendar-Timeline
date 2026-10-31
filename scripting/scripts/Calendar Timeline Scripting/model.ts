import { createHost } from './host'
import { renderOriginal } from './original-engine'
import { resolveFocus, clearTimelineSelection } from './selection'
import { markPhase } from './diagnostics'

export async function loadModel(options:{background?:boolean;forceWeather?:boolean;prepareOnly?:boolean;shouldPersist?:()=>boolean}={}){
  const started=Date.now()
  markPhase('inicialização e cache',started)
  clearTimelineSelection()
  const now=new Date(),focus=resolveFocus(null,now)
  const snapshot=Storage.get<{savedAt:number;weather:any;location:any}>('weather-model')
  const reusable=!options.forceWeather&&snapshot&&Date.now()>=snapshot.savedAt&&Date.now()-snapshot.savedAt<15*60*1000
    &&snapshot.weather?.hours?.length>0&&snapshot.location
  markPhase('adaptador nativo',started)
  const host=createHost(now,options)
  markPhase('inicialização do motor',started)
  const model=await renderOriginal(host,{prepareOnly:options.prepareOnly===true,now:now.getTime(),focusDate:focus.getTime(),hours:'24',onPhase:(phase:string)=>markPhase(phase,started),
    ...(reusable?{hourlyWeather:snapshot.weather,astronomy:snapshot.location}:{})})
  // A timed-out foreground handoff cannot publish a late preparation result.
  if(options.shouldPersist&&!options.shouldPersist())return model
  markPhase('salvamento do cache',started)
  if(!options.prepareOnly)Storage.set('raster-warnings',host.renderWarnings())
  if(!reusable&&model.weatherSnapshot?.hours?.length>0){
    Storage.set('weather-model',{savedAt:Date.now(),weather:model.weatherSnapshot,location:model.locationSnapshot})
  }
  if(options.prepareOnly)Storage.set('last-preparation',{version:model.version,focusDate:model.focusDate,preparedAt:Date.now()})
  else Storage.set('last-render',{version:model.version,focusDate:model.focusDate,renderedAt:Date.now()})
  // Small, optional contract for the independent homepage. No UI/motor import.
  try{if(model.panel){
    const sources=Object.values(model.panel.freshness??{}) as {source:string;fetchedAt:number|null}[]
    const times=sources.map(s=>s.fetchedAt).filter((n):n is number=>Number.isFinite(n)&&Number(n)>0)
    if(!sources.length||times.length)Storage.set('sagittaryuz-dashboard-v1:Calendar',{schema:1,source:'Calendar',at:times.length?Math.min(...times):Date.now(),version:'0.3.33',...model.panel,cached:sources.some(s=>s.source!=='live')},{shared:true})
  }}catch{}
  markPhase('modelo pronto',started)
  return model
}
