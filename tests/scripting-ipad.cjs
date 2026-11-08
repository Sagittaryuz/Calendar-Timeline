const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting'),moduleObject={exports:{}};
const sdk={Button:'Button',Rectangle:'Rectangle',ZStack:'ZStack',Link:'Link',AppIntentProtocol:{AppIntent:0},AppIntentManager:{register:()=>params=>({params})}};
const code=buildSync({entryPoints:[path.join(root,'timeline-view.tsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['scripting'],jsxFactory:'createElement'}).outputFiles[0].text;
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,require:()=>sdk,createElement:(type,props,...children)=>({type,props,children})});
const {timelineLayout,TimelineView}=moduleObject.exports;
const model={width:1092,height:510,image:{},touchSplit:{y:300},hourLegend:{x:0,y:450,width:1092,height:40},temporal:{midnightX:472},header:Array.from({length:16},(_,i)=>({date:'2026-10-'+(10+i),label:'Dia '+i,x:472+4-154.9468+(i-8)*156.175,y:4,width:154.9468,height:100,selected:i===8}))};
const medium=timelineLayout(1092,510,364,170);assert.equal(medium.width,364);assert.equal(medium.height,170);assert.equal(medium.left,0);assert.equal(medium.top,0);
for(const [width,height] of [[715,342],[744,348],[1064,510],[980,400]]){
 const fit=timelineLayout(1092,510,width,height,true);assert(Math.abs(fit.sx-fit.sy)<1e-12,'iPad drawing must keep its proportions');assert(fit.left>=0&&fit.top>=0);assert(fit.left+fit.width<=width+1e-8);assert(fit.top+fit.height<=height+1e-8);
 const view=TimelineView({model,width,height,extraLarge:true}),[link,weatherLink]=view.children[1],graphic=view.children[0];assert.equal(view.props.frame.width,width);assert.equal(link.type,'Link');assert.equal(link.props.url,'scripting://run_single/Calendar%20Timeline%20Scripting?refresh=1','Calendar tap retains the 0.3.37 bounded refresh-and-open flow');assert.equal(link.props.position.x,width/2);assert.equal(graphic.props.position.y,height/2);assert(Math.abs(link.props.position.y-link.props.frame.height/2-fit.top)<1e-8);assert(Math.abs(link.props.frame.height-300*fit.sy)<1e-8);assert.equal(weatherLink.type,'Link');assert.equal(weatherLink.props.url,'weathergraph://');assert(Math.abs(weatherLink.props.position.y-(fit.top+(300+105)*fit.sy))<1e-8);assert(Math.abs(weatherLink.props.frame.height-210*fit.sy)<1e-8);const today=model.header.find(day=>day.selected),displayedBoundary=fit.left+model.temporal.midnightX*fit.sx,displayedFrameRight=fit.left+(today.x+today.width-4)*fit.sx;assert(Math.abs(displayedBoundary-displayedFrameRight)<1e-8,'Canvas/iPad scaling keeps the drawn right frame edge and day-change line aligned');assert.equal(graphic.children[0].props.width,fit.width);assert.equal(graphic.children[0].props.height,fit.height);
 assert(!JSON.stringify(view).includes('CalendarTimelineSelectDay'));
}
for(const size of [0,-1,NaN,Infinity])assert.throws(()=>timelineLayout(1092,510,size,348,true));
(async()=>{
 for(const family of ['systemMedium','systemExtraLarge','systemSmall']){
  let calls=0,presented;const m={exports:{}},native={Widget:{family,displaySize:{width:744,height:348},present:element=>{presented=element}},Text:'Text'};
  const dependencies={scripting:native,'./bridge-auto':{autoSynchronize:async()=>{calls++}},'./model':{loadModel:async()=>model},'./timeline-view':{TimelineView},'./diagnostics':{VERSION:'test',failureDetails:String}};
  const source=fs.readFileSync(path.join(root,'widget.tsx'),'utf8').replace(/main\(\)\s*$/,'module.exports=main');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'createElement'}}).outputText,{module:m,exports:m.exports,require:name=>dependencies[name],createElement:(type,props,...children)=>({type,props,children}),Storage:{get:()=>null,set:()=>true},Date});
  await m.exports();assert(presented);assert.equal(calls,0,'Widget never starts Bridge');if(family!=='systemSmall'){assert.equal(presented.props.extraLarge,family==='systemExtraLarge');assert.equal(presented.props.width,744)}
 }
 console.log('PASS iPad: actual widget accepts extralarge/medium, other sizes fail visibly; full display bounds, proportional drawing and both touch routes across four landscape sizes. Physical iPad remains unverified.');
})().catch(e=>{console.error(e);process.exitCode=1});
