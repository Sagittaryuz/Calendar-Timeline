import * as Host from 'scripting'
// Independent entry: deliberately imports no project modules and reads no agenda or credentials.
const EXPECTED_VERSION="0.3.4"
const EXPECTED_FILES=[{"name":"app_intents.tsx","sha256":"bdb1565b483449cbaf30a08a60e8e7b7827bca929a624d3eeab9394eef8fb87d"},{"name":"assistant_tool.json","sha256":"e110319988364a6767afd50b354078deaf5b065beed7283847860f4b666aa986"},{"name":"assistant_tool.tsx","sha256":"8a30472f7cb7fb805dfcac2aafa6cb6b633e66443941bc651b6d5da5056fae0b"},{"name":"bridge-agenda.ts","sha256":"80e96a54e207329e88dbccabe299cd3abf2f3db642abb7b508a757b670d0086c"},{"name":"bridge-attempts.ts","sha256":"467d2747e9f5c73098849d8efb5ea08d57dff0a608e44e8cdc52959a1f806ecc"},{"name":"bridge-auto.ts","sha256":"fcdb2fac5b92995b1e6d276d76bf2dec1b64fa8e385e61f3e0f76907a5a60b5a"},{"name":"bridge-client.ts","sha256":"5ba71e65b84d41cebee9c59e16dcd67d138a8fef3d56132937b2aab33ec47a73"},{"name":"bridge-event-reader.ts","sha256":"5609815040f4c2127ebe16a8cce52c7cdbe28b06995788743829db7bb7e81805"},{"name":"bridge-fields.ts","sha256":"0f5fe0968b6b1074640fdb871443f18157fc8b96baafe13193203524bcc741d3"},{"name":"bridge-protocol.ts","sha256":"91e60529a927300cc5cab904a6fcc54a2a3f464f9ae371013b129b856638f447"},{"name":"bridge-read-state.ts","sha256":"dd2407ee952ce4fff61fe232b8e1ccdd47ba9616c3e948cc7f88d710ee99e0cc"},{"name":"bridge-real.ts","sha256":"bf9fe4686cded17dfdc8a4db6908e8b5d218c0930345033ff42a91e6bdec2f0d"},{"name":"bridge.tsx","sha256":"9bb37c63b95791170b5db5432032a6a4253017cc5c2d9b693b7f9d01b8b1cf65"},{"name":"control_widget_button.tsx","sha256":"38bd1c23ffbd6d827029d7364ce7dd4f94ab00b6046562d23550eed55eb39852"},{"name":"create-item.ts","sha256":"79788eac3ceb6134c7be8fabbaf9eddf0a477edfb9c82665e42f72cc57d0445c"},{"name":"day-model.ts","sha256":"8ec3ffefd18c2c97268e70040995037ca7dc3bc1466afeac80c0806c1d9546c3"},{"name":"day-screen.tsx","sha256":"7185f60724d49f26e41dc743da371b78e309c7a1de96a864d8d9b511156d8d0c"},{"name":"diagnostics.ts","sha256":"095666667baccd7a16cca451a2c891024c4396dc273a2602732559e222401e3c"},{"name":"diagonal-canvas.js","sha256":"845cfa29f61466dde19e7a5b440d87d3be4e777ef50ce36221243d2cf9c4591c"},{"name":"drawing.js","sha256":"0dcb40b5e354dbf47373e8b3a244b3fc8810b124de815dc2df6321a44b1220de"},{"name":"graph-view.tsx","sha256":"17356208cf39677d36d203b9d31f0a30cadd6cce4858b77e08cafe93c294189a"},{"name":"home_screen_default_ui.tsx","sha256":"1acde3e73eb90d06651183ba7040e077ac61c94b802935fccc0e89889b16eb51"},{"name":"host.ts","sha256":"c505ba2d24bc8aa3c4d5e9654fafc16593c1527c1ddf3aa854abf7bcb2b6fb94"},{"name":"index.tsx","sha256":"ff01fbb49b661002aa223b4ccdbe9b5a25404b8de02b6d7353feec4e35699a5f"},{"name":"intent.tsx","sha256":"6afee27f6c5e88e32d59cdd65f357541a1902f34de744009175a89616bab74a7"},{"name":"model.ts","sha256":"a9fd67e7d9683205e010bf1903c8b64d92477890730c8a25f2f55f900fd85f70"},{"name":"original-engine.js","sha256":"be576065c770e22ddafbcc942ee061e4a75b268b91ec52a30075267988667ef7"},{"name":"pro-common.ts","sha256":"d2821c35707e2ef8d583e09aa65a474d5f61639b165da62625fee33877593220"},{"name":"rect-raster.js","sha256":"7ccb077b7c935fabfff852573155c4424bb1443ac0c329c0e4197dc6eb4ad8a8"},{"name":"script.json","sha256":"f97432d621132fce93d49394ff00b61063096b9ed33256f0c4930c4b3ab119b8"},{"name":"selection.ts","sha256":"334b7dd51e5bd03f047cbd32c9b2eb28753c967c7301a2e61ba433589f6a0d80"},{"name":"timeline-view.tsx","sha256":"b7242dbe7e354fc6210c39a9557c124eb3f30cb96e12bba9e3566571e59e9c99"},{"name":"widget-refresh.ts","sha256":"f247e01ed282b36ceae0ec261d33295956daec99305f5ce64e552fe129468401"},{"name":"widget.tsx","sha256":"fb0b1bb19a3837e2a8a2e184cee38f01cc4f553635affb2d9165236936e885a5"}]
async function diagnose(){
  const runtime=(Host as any).Script
  const issues:string[]=[]
  const folder=runtime.directory||FileManager.scriptsDirectory+'/'+runtime.name
  const normalized=(value:string)=>value.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')
  const canHash=typeof Crypto!=='undefined'&&typeof Crypto.sha256==='function'&&typeof Data!=='undefined'
  for(const file of EXPECTED_FILES){
    try{
      const content=normalized(await FileManager.readAsString(folder+'/'+file.name))
      if(canHash){
        const data=Data.fromString(content)
        const hash=Crypto.sha256(data).toHexString().toLowerCase()
        if(hash!==file.sha256)issues.push('Divergente: '+file.name)
      }
    }catch{issues.push('Ausente ou ilegível: '+file.name)}
  }
  const ui=['Widget','Text','Navigation','NavigationStack','ScrollView','VStack','HStack','Button','Canvas','ZStack','Rectangle','Link','useState','useRef','useEffect','AppIntentManager','AppIntentProtocol']
  for(const name of ui)if((Host as any)[name]===undefined)issues.push('API ausente no app: '+name)
  if(runtime.metadata.version!==EXPECTED_VERSION)issues.unshift('Metadados: '+runtime.metadata.version+'; esperado: '+EXPECTED_VERSION)
  const report={version:EXPECTED_VERSION,metadataVersion:runtime.metadata.version,at:new Date().toISOString(),hashesChecked:canHash,issues}
  Storage.set('source-integrity-report',report)
  const message='Pacote esperado: '+EXPECTED_VERSION+'\n'+EXPECTED_FILES.length+' arquivos consultados. '+(canHash?'Hashes conferidos.':'API de hash indisponível; apenas presença conferida.')+'\n'+(issues.length?issues.join('\n'):'Arquivos e APIs conferidos. A compilação nativa e o widget ainda precisam executar.')
  console.log(JSON.stringify(report))
  await Dialog.alert({title:'Diagnóstico Calendar Timeline',message})
}
diagnose().catch(async error=>{await Dialog.alert({title:'Diagnóstico independente',message:String(error)})}).finally(()=>{(Host as any).Script.exit()})
