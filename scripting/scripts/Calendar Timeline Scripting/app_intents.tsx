import { AppIntentManager, AppIntentProtocol, Widget } from 'scripting'
import { autoSynchronize } from './bridge-auto'
import { loadModel } from './model'
import { localDay, validateSelection } from './selection'

export const SelectDay = AppIntentManager.register({
  name:'CalendarTimelineSelectDay',
  protocol:AppIntentProtocol.AppIntent,
  perform:async ({date}:{date:string})=>{
    const now=new Date()
    const selected=validateSelection(date,now)
    if(!Storage.set('selected-day',{date:selected,selectedOn:localDay(now)}))throw new Error('Não foi possível guardar o dia selecionado.')
    try{await autoSynchronize({origin:'day-touch',force:true,budgetMS:4500})}finally{Widget.reloadAll()}
  },
})

export const RefreshCalendar=AppIntentManager.register({
  name:'CalendarTimelineRefresh',protocol:AppIntentProtocol.AppIntent,
  perform:async()=>{
    try{
      const today=localDay(new Date())
      if(!Storage.set('selected-day',{date:today,selectedOn:today}))throw Error('Não foi possível voltar para hoje.')
      await autoSynchronize({origin:'refresh-button',force:true,budgetMS:4500})
      await loadModel({background:true,forceWeather:true,prepareOnly:true})
      Storage.set('manual-refresh',{at:Date.now(),state:'prepared'})
    }catch{
      Storage.set('manual-refresh',{at:Date.now(),state:'failed-cache-preserved'})
    }finally{Widget.reloadAll()}
  },
})
