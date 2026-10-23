import { Script } from 'scripting'
import { configuration, synchronize } from './client'
async function run(){
 try{
  if(!configuration()||!Storage.get<boolean>('test-scope-consent'))throw Error('Abra o projeto no Scripting e conclua o pareamento primeiro.')
  Script.exit(await synchronize())
 }catch(error:any){Script.exit({ok:false,error:String(error?.message??error)})}
}
run()
