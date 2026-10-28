import { AppIntentManager, AppIntentProtocol } from 'scripting'
import { openCalendarFromWidget } from './widget-refresh'

// Compatibility with already rendered buttons: never update or select a day.
const openCalendar=()=>openCalendarFromWidget((url:string)=>Safari.openURL(url))
export const SelectDay=AppIntentManager.register({name:'CalendarTimelineSelectDay',protocol:AppIntentProtocol.AppIntent,perform:openCalendar})
export const RefreshCalendar=AppIntentManager.register({name:'CalendarTimelineRefresh',protocol:AppIntentProtocol.AppIntent,perform:openCalendar})
