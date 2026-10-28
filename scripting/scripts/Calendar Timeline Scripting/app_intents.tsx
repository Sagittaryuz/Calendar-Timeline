import { AppIntentManager, AppIntentProtocol, Widget } from 'scripting'
import { clearTimelineSelection } from './selection'

export const SelectDay = AppIntentManager.register({
  name:'CalendarTimelineSelectDay',
  protocol:AppIntentProtocol.AppIntent,
  perform:async ({date}:{date:string})=>{
    // Retired intent remains registered for already rendered widgets only.
    // It can request a fresh present-day render, never navigate to its old date.
    clearTimelineSelection()
    Storage.set('calendar-local-touch',Date.now())
    Storage.set('calendar-force-weather',Date.now())
    Widget.reloadAll()
  },
})

export const RefreshCalendar=AppIntentManager.register({
  name:'CalendarTimelineRefresh',protocol:AppIntentProtocol.AppIntent,
  perform:async()=>{
    try{
      clearTimelineSelection()
      Storage.set('calendar-force-weather',Date.now())
      Storage.set('manual-refresh',{at:Date.now(),state:'requested'})
    }catch{
      Storage.set('manual-refresh',{at:Date.now(),state:'failed-cache-preserved'})
    }finally{Widget.reloadAll()}
  },
})
