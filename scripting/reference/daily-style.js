// Build-time overrides for the fixed-day Scripting edition. Original stays intact.
function timelineBackgroundColorForDate(date, holidayDates = loadResult.holidayDates) {
  if (dateKey(date) === dateKey(now)) return SETTINGS.timelineBackgroundColor;
  if (holidayDates?.has(dateKey(date))) return SETTINGS.holidayTimelineBackgroundColor;
  if (date.getDay() === 6) return SETTINGS.saturdayTimelineBackgroundColor;
  if (date.getDay() === 0) return SETTINGS.sundayTimelineBackgroundColor;
  return SETTINGS.nonTodayTimelineOverlayColor;
}

function drawTimelineBackground(ctx, localToTimeline = false) {
  ctx.setFillColor(new Color(timelineBackgroundColorForDate(windowStart)));
  ctx.fillRect(new Rect(localToTimeline ? 0 : CANVAS.plotLeft,
    localToTimeline ? 0 : CANVAS.timelineTop, timelineWidth(), timelineHeight()));
}

function shouldBlurFutureTimeline() {
  return false;
}
function drawCurrentDaySpecialBackground(ctx) {
  ctx.setFillColor(new Color(timelineBackgroundColorForDate(windowStart)));
  ctx.addPath(currentDayUnifiedShape());ctx.fillPath();
}
function drawCurrentDayFrameOverlay(ctx) {
  ctx.addPath(currentDayUnifiedShape());
  ctx.setStrokeColor(new Color('#FFFFFF',0.96));
  ctx.setLineWidth(scaleVertical(3));ctx.strokePath();
}

function currentDayUnifiedShape(path = new Path()) {
  const c=titleDayCardRect(titleTodayCardIndex());
  const inset=WIDGET_CONTOUR.strokeInset,left=c.x+inset,right=c.x+c.width-inset;
  const bridgeY=dayBoundaryMoonBorderTopY();
  const first=titleTodayCardIndex()===0,last=titleTodayCardIndex()===6;
  const radius=windowStart.getDay()%6===0?0:Math.min(WIDGET_COMMON_CORNER_RADIUS,
    (bridgeY-c.y)/2,Math.max(0,left-inset),Math.max(0,CANVAS.width-inset-right));
  const contour=widgetLeftContourPoints(inset);
  const upper=contour.slice(0,65);
  path.move(first?upper[0]:new Point(left,c.y));
  if(last){
    path.addLine(new Point(CANVAS.width-upper[0].x,c.y));
    for(const p of upper.slice(1))path.addLine(new Point(CANVAS.width-p.x,p.y));
  }else{
    path.addLine(new Point(right,c.y));path.addLine(new Point(right,bridgeY-radius));
    if(radius)appendContourArc(path,right+radius,bridgeY-radius,radius,radius,Math.PI,Math.PI/2);
    path.addLine(new Point(CANVAS.width-inset,bridgeY));
  }
  for(const p of contour.filter(p=>p.y>=bridgeY))path.addLine(new Point(CANVAS.width-p.x,p.y));
  for(const p of contour.slice().reverse().filter(p=>p.y>=bridgeY))path.addLine(p);
  path.addLine(new Point(inset,bridgeY));
  if(first){
    for(const p of upper.slice().reverse())path.addLine(p);
  }else{
    path.addLine(new Point(left-radius,bridgeY));
    if(radius)appendContourArc(path,left-radius,bridgeY-radius,radius,radius,Math.PI/2,0);
    path.addLine(new Point(left,c.y));
  }
  path.closeSubpath();return path;
}
function dayCardNeighbourClip() {
  const path=new Path();
  path.move(new Point(0,0));path.addLine(new Point(CANVAS.width,0));
  path.addLine(new Point(CANVAS.width,CANVAS.height));path.addLine(new Point(0,CANVAS.height));path.closeSubpath();
  // Nonzero winding hole: keep adjacent cards outside the selected fill,
  // its half-stroke and the same clear gap used between header cards.
  const offset=scaleVertical(3)/2+titleCardGap();
  const vertices=[];
  for(const [,x,y] of currentDayUnifiedShape().commands.filter(c=>c.length===3)){
    const previous=vertices[vertices.length-1];
    if(!previous||Math.hypot(x-previous.x,y-previous.y)>1e-6)vertices.push(new Point(x,y));
  }
  if(Math.hypot(vertices[0].x-vertices.at(-1).x,vertices[0].y-vertices.at(-1).y)<1e-6)vertices.pop();
  // Offset the actual superellipse polyline along its normals. Shrinking
  // radii alone would change the gap around this non-circular profile.
  const normal=(a,b)=>{const length=Math.hypot(b.x-a.x,b.y-a.y);return {x:(b.y-a.y)/length,y:(a.x-b.x)/length}};
  const points=vertices.map((p,i)=>{
    const a=normal(vertices[(i+vertices.length-1)%vertices.length],p),b=normal(p,vertices[(i+1)%vertices.length]);
    const factor=offset/Math.max(1e-6,1+a.x*b.x+a.y*b.y);
    return new Point(p.x+(a.x+b.x)*factor,p.y+(a.y+b.y)*factor);
  }).reverse();
  path.move(points[0]);
  for(const p of points.slice(1))path.addLine(p);
  path.closeSubpath();return path.commands;
}
function shiftWidgetImage(image) {
  return image;
}

function drawTimelineOuterBorder(ctx) {
  // One contour in final canvas coordinates; no translated or rescaled copy.
  // The iOS container still performs its own device-specific final clipping.
  const inset = WIDGET_CONTOUR.strokeInset;
  const left = widgetLeftContourPoints(inset);
  const vertices = [...left, ...left.slice().reverse().map(p => new Point(CANVAS.width-p.x,p.y))];
  const path = new Path();path.move(vertices[0]);
  for (const point of vertices.slice(1)) path.addLine(point);
  path.closeSubpath();ctx.addPath(path);
  ctx.setStrokeColor(new Color('#303136',0.82));
  ctx.setLineWidth(Math.min(inset,scaleVertical(3)));ctx.strokePath();
}

function drawTimelineBar(ctx, rect, color, item) {
  const radius = isCompactMode() ? scaleVertical(6) : scaleVertical(7);
  const border = Math.min(scaleVertical(2),Math.max(scaleVertical(0.75),Math.min(rect.width,rect.height)/4));
  fillRoundedRect(ctx,rect,radius,new Color('#000000'));
  fillRoundedRect(ctx,new Rect(rect.x+border,rect.y+border,
    Math.max(1,rect.width-2*border),Math.max(1,rect.height-2*border)),Math.max(1,radius-border),color);
}

function drawCurrentTimeMarker(ctx) {
  if (dateKey(windowStart) !== dateKey(now)) return;
  const x = timeToX(now),width = scaleVertical(3);
  if (x < 0 || x >= timelineWidth()) return;
  ctx.setFillColor(new Color('#30D158'));
  ctx.fillRect(new Rect(Math.max(0,Math.min(timelineWidth()-width,x-width/2)),0,width,timelineHeight()-WIDGET_CONTOUR.strokeInset*2));
}
