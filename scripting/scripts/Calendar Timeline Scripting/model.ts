import { createHost } from './host'
import { renderOriginal } from './original-engine'
import { resolveFocus } from './selection'
import { markPhase } from './diagnostics'

export async function loadModel(options:{background?:boolean}={}){
  const started=Date.now()
  markPhase('inicialização e cache',started)
  const now=new Date(),focus=resolveFocus(Storage.get('selected-day'),now)
  const snapshot=Storage.get<{savedAt:number;weather:any;location:any}>('weather-model')
  const reusable=snapshot&&Date.now()-snapshot.savedAt<15*60*1000
    &&snapshot.weather?.hours?.length>0&&snapshot.location
  markPhase('adaptador nativo',started)
  const host=createHost(now,options)
  markPhase('inicialização do motor',started)
  const model=await renderOriginal(host,{now:now.getTime(),focusDate:focus.getTime(),hours:'24',onPhase:(phase:string)=>markPhase(phase,started),
    ...(reusable?{hourlyWeather:snapshot.weather,astronomy:snapshot.location}:{})})
  markPhase('salvamento do cache',started)
  Storage.set('raster-warnings',host.renderWarnings())
  if(!reusable&&model.weatherSnapshot?.hours?.length>0){
    Storage.set('weather-model',{savedAt:Date.now(),weather:model.weatherSnapshot,location:model.locationSnapshot})
  }
  Storage.set('last-render',{version:model.version,focusDate:model.focusDate,renderedAt:Date.now()})
  markPhase('modelo pronto',started)
  return model
}
