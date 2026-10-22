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
function drawCurrentDaySpecialBackground() {
}
function drawCurrentDayFrameOverlay() {
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
  ctx.setStrokeColor(new Color('#FFFFFF',0.9));
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
