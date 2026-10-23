import { ControlWidget, ControlWidgetButton } from 'scripting'
import { SynchronizeAgenda } from './app_intents'
ControlWidget.present(<ControlWidgetButton intent={SynchronizeAgenda(undefined)} label={{title:'Sincronizar agenda',systemImage:'calendar.badge.clock'}} privacySensitive/>)
