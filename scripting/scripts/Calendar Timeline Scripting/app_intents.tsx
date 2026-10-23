import { AppIntentManager, AppIntentProtocol, Widget } from 'scripting'
import { autoSynchronize } from './bridge-auto'
import { localDay, validateSelection } from './selection'
import { reloadWidgets } from './pro-common'

export const SelectDay = AppIntentManager.register({
  name:'CalendarTimelineSelectDay',
  protocol:AppIntentProtocol.AppIntent,
  perform:async ({date}:{date:string})=>{
    const now=new Date()
    const selected=validateSelection(date,now)
    if(!Storage.set('selected-day',{date:selected,selectedOn:localDay(now)}))throw new Error('Não foi possível guardar o dia selecionado.')
    await reloadWidgets()
  },
})
export const SynchronizeAgenda=AppIntentManager.register({
  name:'CalendarTimelineSynchronize',protocol:AppIntentProtocol.AppIntent,perform:async()=>{
    await autoSynchronize({origin:'control-center',force:true,budgetMS:10000});await reloadWidgets()
  }
})
