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
    try{await autoSynchronize({origin:'day-touch',force:true,budgetMS:4500})}finally{Widget.reloadAll()}
  },
})
