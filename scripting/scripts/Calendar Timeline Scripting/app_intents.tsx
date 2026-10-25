import { AppIntentManager, AppIntentProtocol, Widget } from 'scripting'
import { autoSynchronize } from './bridge-auto'
import { localDay, validateSelection } from './selection'

export const SelectDay = AppIntentManager.register({
  name:'CalendarTimelineSelectDay',
  protocol:AppIntentProtocol.AppIntent,
  perform:async ({date}:{date:string})=>{
    const now=new Date()
    const selected=validateSelection(date,now)
    if(!Storage.set('selected-day',{date:selected,selectedOn:localDay(now)}))throw new Error('Não foi possível guardar o dia selecionado.')
    Storage.set('calendar-local-touch',Date.now())
    Widget.reloadAll()
  },
})

export const RefreshCalendar=AppIntentManager.register({
  name:'CalendarTimelineRefresh',protocol:AppIntentProtocol.AppIntent,
  perform:async()=>{
    try{
      const today=localDay(new Date())
      if(!Storage.set('selected-day',{date:today,selectedOn:today}))throw Error('Não foi possível voltar para hoje.')
      Storage.set('calendar-force-weather',Date.now())
      await autoSynchronize({origin:'refresh-button',force:true,budgetMS:4500})
      Storage.set('manual-refresh',{at:Date.now(),state:'requested'})
    }catch{
      Storage.set('manual-refresh',{at:Date.now(),state:'failed-cache-preserved'})
    }finally{Widget.reloadAll()}
  },
})
