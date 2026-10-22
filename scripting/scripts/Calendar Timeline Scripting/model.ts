import { createHost } from './host'
import { renderOriginal } from './original-engine'
import { resolveFocus } from './selection'

export async function loadModel(){
  const now=new Date(),focus=resolveFocus(Storage.get('selected-day'),now)
  const snapshot=Storage.get<{savedAt:number;weather:any;location:any}>('weather-model')
  const reusable=snapshot&&Date.now()-snapshot.savedAt<15*60*1000
    &&snapshot.weather?.hours?.length>0&&snapshot.location
  const model=await renderOriginal(createHost(now),{now:now.getTime(),focusDate:focus.getTime(),hours:'24',
    ...(reusable?{hourlyWeather:snapshot.weather,astronomy:snapshot.location}:{})})
  if(!reusable&&model.weatherSnapshot?.hours?.length>0){
    Storage.set('weather-model',{savedAt:Date.now(),weather:model.weatherSnapshot,location:model.locationSnapshot})
  }
  Storage.set('last-render',{version:model.version,focusDate:model.focusDate,renderedAt:Date.now()})
  return model
}
