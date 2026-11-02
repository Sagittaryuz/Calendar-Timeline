// Scripting-only structural white stroke contract; never claims native iOS raster output.
const assert=require('node:assert/strict');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');

const instrumented=raw.replace('return {temporal:', `return {strokeProbe:{
  configured:DAY_BOUNDARY_LINE_WIDTH,
  divider:dayBoundaryLineWidth(),
  frame:currentDayFrameMetrics().lineWidth,
  drawFrame:drawCurrentDayFrameOverlay,
  drawOrigins:drawDayBoundaryOriginsBehindMoon,
  drawDivider:drawCurrentDayBoundaryVerticalOverlay,
  drawMoonBoundary:drawDayBoundaryMoonBorder,
  drawMoonRing:drawClippedDayBoundaryMoonBorder,
  framePath:currentDayOutlinePath().commands,
  width:CANVAS.width,
  height:CANVAS.height,
  inset:WIDGET_CONTOUR.strokeInset
},temporal:`);
const render=compile(instrumented),STRUCTURAL_WIDTH=8;

function pathPoints(path){
  return path.flatMap(([method,...args])=>method==='bezierCurveTo'
    ? [[args[0],args[1]],[args[2],args[3]],[args[4],args[5]]]
    : method==='moveTo'||method==='lineTo'?[[args[0],args[1]]]:[]);
}

(async()=>{
  const {host,options,d}=await fixture();let scenes=0,frameStrokes=0,dividerRects=0,ringStrokes=0;
  const dates=[
    new Date(2026,9,31,0),new Date(2026,9,31,12),new Date(2026,9,31,23,59),
    new Date(2026,10,1,0),new Date(2026,10,1,12),new Date(2026,10,1,23,59),
    new Date(2026,10,2,0),new Date(2026,10,2,12),new Date(2026,10,2,23,59),
    new Date(2026,11,31,23,59),new Date(2027,0,1,0)
  ];
  for(const now of dates){
    const model=await render(host,options(now)),probe=model.strokeProbe,ops=flatten(model.image);
    assert.equal(probe.configured,STRUCTURAL_WIDTH);assert.equal(probe.divider,STRUCTURAL_WIDTH);
    assert.equal(probe.frame,STRUCTURAL_WIDTH,'Frame geometry uses the common 8 px stroke');
    const frame=ops.filter(o=>o.type==='strokePath'&&o.state.stroke?.hex==='FFFFFF'&&o.state.stroke.alpha===0.96);
    assert.equal(frame.length,1,'Exactly one continuous today outline remains');
    assert.equal(frame[0].state.width,STRUCTURAL_WIDTH,'Rendered frame operation carries 8 logical canvas pixels');
    frameStrokes++;
    const whiteDividers=ops.filter(o=>o.type==='fillRect'&&o.state.fill?.hex==='FFFFFF'&&Math.abs(o.rect.width-STRUCTURAL_WIDTH)<1e-8);
    assert(whiteDividers.length>0,'Day dividers retain their full logical width, including clipped edge cases');
    dividerRects+=whiteDividers.length;
    for(const [x,y] of pathPoints(probe.framePath)){assert(Number.isFinite(x)&&Number.isFinite(y));assert(x>=0&&x<=probe.width&&y>=0&&y<=probe.height,'Thicker frame path stays inside its canvas');}
    scenes++;
  }

  const model=await render(host,options(new Date(2026,10,2,12))),p=model.strokeProbe;
  const frameCtx=new d.DrawContext();p.drawFrame(frameCtx);
  assert.equal(frameCtx.getImage().ops.find(o=>o.type==='strokePath')?.state.width,STRUCTURAL_WIDTH,'Standalone overlay uses the same width');

  const originCtx=new d.DrawContext();p.drawOrigins(originCtx,120);
  const origins=originCtx.getImage().ops.filter(o=>o.type==='fillRect');
  assert(origins.length>0&&origins.every(o=>Math.abs(o.rect.width-STRUCTURAL_WIDTH)<1e-8),'Behind-moon day dividers use exact 8 px rects');

  const dividerCtx=new d.DrawContext();p.drawDivider(dividerCtx);
  const divider=dividerCtx.getImage().ops.find(o=>o.type==='fillRect');
  assert(divider&&divider.rect.width===STRUCTURAL_WIDTH,'Current-day divider uses exact 8 px width');

  const ringCtx=new d.DrawContext();p.drawMoonRing(ringCtx,500,220,32,new Date(2026,10,3,0));
  const ring=ringCtx.getImage().ops.find(o=>o.type==='strokePath');
  assert(ring&&ring.state.width===STRUCTURAL_WIDTH,'Midnight moon ring uses exact 8 px width');
  assert(pathPoints(ring.path).length>300,'Moon ring retains its rounded high-resolution contour');
  ringStrokes++;

  const moonBoundaryCtx=new d.DrawContext();p.drawMoonBoundary(moonBoundaryCtx,500,220,32,new Date(2026,10,3,0));
  const moonBoundary=moonBoundaryCtx.getImage().ops.find(o=>o.type==='strokeEllipse');
  assert(moonBoundary&&moonBoundary.state.width===STRUCTURAL_WIDTH,'Moon ellipse boundary also uses exact 8 px width');
  ringStrokes++;

  const edgeRingCtx=new d.DrawContext();p.drawMoonRing(edgeRingCtx,p.inset,220,32,new Date(2026,10,3,0));
  const edgeRing=edgeRingCtx.getImage().ops.find(o=>o.type==='strokePath');
  assert(edgeRing&&edgeRing.state.width===STRUCTURAL_WIDTH,'Partially clipped boundary ring retains its stroke spec');
  for(const [x,y] of pathPoints(edgeRing.path)){
    assert(x>=p.inset-1e-8&&x<=p.width-p.inset+1e-8&&y>=0&&y<=p.height,'Visible ring centerline remains within the widget contour');
  }
  ringStrokes++;
  console.log(JSON.stringify({version:'0.3.34',canvasLineWidth:STRUCTURAL_WIDTH,scenes,
    continuousFrameStrokes:frameStrokes,visibleWhiteDividerRects:dividerRects,moonRingCases:ringStrokes,
    coverage:'actual render and direct frame/divider/both moon-boundary operations; intraday, weekends, DST date, month/year, canvas clipping',
    physicalIOS:'not tested; synthetic DrawContext contract only'}));
})().catch(error=>{console.error(error);process.exitCode=1});
