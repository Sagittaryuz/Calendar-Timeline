import { Script, Widget } from 'scripting'
import { configuration, synchronize } from './bridge-client'
async function run(){
 try{
  if(!configuration()||!Storage.get<boolean>('test-scope-consent'))throw Error('Abra o projeto no Scripting e conclua o pareamento primeiro.')
  const report=await synchronize()
  Widget.reloadAll()
  Script.exit(report)
 }catch(error:any){Script.exit({ok:false,error:String(error?.message??error)})}
}
run()
