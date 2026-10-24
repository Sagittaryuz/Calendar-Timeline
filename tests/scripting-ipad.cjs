const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting'),moduleObject={exports:{}};
const sdk={Button:'Button',Rectangle:'Rectangle',ZStack:'ZStack',Link:'Link',AppIntentProtocol:{AppIntent:0},AppIntentManager:{register:()=>params=>({params})}};
const code=buildSync({entryPoints:[path.join(root,'timeline-view.tsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['scripting'],jsxFactory:'createElement'}).outputFiles[0].text;
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,require:()=>sdk,createElement:(type,props,...children)=>({type,props,children})});
const {timelineLayout,TimelineView}=moduleObject.exports;
const model={width:1092,height:510,image:{},hourLegend:{x:0,y:450,width:1092,height:40},header:Array.from({length:7},(_,i)=>({date:'2026-10-'+(18+i),label:'Dia '+i,x:i*156,y:4,width:156,height:100}))};
const medium=timelineLayout(1092,510,364,170);assert.equal(medium.width,364);assert.equal(medium.height,170);assert.equal(medium.left,0);assert.equal(medium.top,0);
for(const [width,height] of [[715,342],[744,348],[1064,510],[980,400]]){
 const fit=timelineLayout(1092,510,width,height,true);assert(Math.abs(fit.sx-fit.sy)<1e-12,'iPad drawing must keep its proportions');assert(fit.left>=0&&fit.top>=0);assert(fit.left+fit.width<=width+1e-8);assert(fit.top+fit.height<=height+1e-8);
 const view=TimelineView({model,width,height,extraLarge:true}),link=view.children[0],buttons=view.children[1];assert.equal(view.props.frame.width,width);assert.equal(link.props.url,'calshow://');assert.equal(link.props.position.x,width/2);assert.equal(link.props.position.y,height/2);assert.equal(buttons.length,7);const legend=view.children[2];assert.equal(legend.type,'Button');assert.equal(legend.props.accessibilityLabel,'Atualizar todos os widgets pela legenda de horas');assert.equal(legend.children[0].type,'Rectangle');assert.equal(legend.children[0].props.opacity,0.001,'Hour refresh has no visible icon');assert(Math.abs(legend.props.position.y-(fit.top+470*fit.sy))<1e-8);assert(legend.props.position.y-legend.props.frame.height/2>buttons[0].props.position.y+buttons[0].props.frame.height/2);assert(legend.props.position.y+legend.props.frame.height/2<=height);
 buttons.forEach((button,i)=>{const p=button.props;assert.equal(p.intent.params.date,model.header[i].date);assert(p.position.x-p.frame.width/2>=-1e-8);assert(p.position.x+p.frame.width/2<=width+1e-8);assert(p.position.y-p.frame.height/2>=0);assert(p.position.y+p.frame.height/2<=height);if(i)assert(p.position.x>buttons[i-1].props.position.x)});
}
for(const size of [0,-1,NaN,Infinity])assert.throws(()=>timelineLayout(1092,510,size,348,true));
(async()=>{
 for(const family of ['systemMedium','systemExtraLarge','systemSmall']){
  let calls=0,presented;const m={exports:{}},native={Widget:{family,displaySize:{width:744,height:348},present:element=>{presented=element}},Text:'Text'};
  const dependencies={scripting:native,'./bridge-auto':{autoSynchronize:async()=>{calls++}},'./model':{loadModel:async()=>model},'./timeline-view':{TimelineView},'./diagnostics':{VERSION:'test',failureDetails:String}};
  const source=fs.readFileSync(path.join(root,'widget.tsx'),'utf8').replace(/main\(\)\s*$/,'module.exports=main');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'createElement'}}).outputText,{module:m,exports:m.exports,require:name=>dependencies[name],createElement:(type,props,...children)=>({type,props,children}),Storage:{set:()=>true},Date});
  await m.exports();assert(presented);assert.equal(calls,family==='systemSmall'?0:1);if(family!=='systemSmall'){assert.equal(presented.props.extraLarge,family==='systemExtraLarge');assert.equal(presented.props.width,744)}
 }
 console.log('PASS iPad: actual widget accepts extralarge/medium, other sizes fail visibly; full display bounds, proportional drawing and seven aligned day targets across four landscape sizes. Physical iPad remains unverified.');
})().catch(e=>{console.error(e);process.exitCode=1});
