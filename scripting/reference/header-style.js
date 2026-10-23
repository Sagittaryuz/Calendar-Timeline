// Build-time typography override for the fixed week. Coordinates stay logical.
function drawTitleDayCard(ctx,date,card,isSelected,isLast) {
  if(!isSelected){
    const radii={topLeft:date.getDay()===0?TITLE_CARD_OUTER_CORNER_RADIUS:0,
      topRight:isLast?TITLE_CARD_OUTER_CORNER_RADIUS:0,bottomLeft:0,bottomRight:0};
    fillTitleCardShape(ctx,card,radii,new Color('#303136',0.82));
    fillTitleCardShape(ctx,new Rect(card.x+2,card.y+2,card.width-4,card.height-4),
      {...radii,topLeft:Math.max(0,radii.topLeft-2),topRight:Math.max(0,radii.topRight-2)},
      new Color(timelineBackgroundColorForDate(date)));
  }
  const daily=titleDailyTemperatureForDay(date);
  const temp=value=>{const n=finiteWeatherNumber(value);return n===null?'--º':`${Math.round(n)}º`};
  const maximum=temp(daily?.maximum),minimum=temp(daily?.minimum);
  const counts=titleScheduleCountsForDay(date),summary=`E: ${counts.events} | L: ${counts.reminders}`;
  const weekday=shortWeekday(date),number=String(date.getDate()).padStart(2,'0'),headline=`${weekday} ${number}`;
  const temperatureSize=scaleFontSize(18),smallSize=Math.min(scaleFontSize(15),(card.width-16)/(summary.length*0.62));
  const gap=scaleVertical(32),maxWidth=maximum.length*temperatureSize*0.62,minWidth=minimum.length*temperatureSize*0.62;
  const temperatureWidth=maxWidth+gap+minWidth,temperatureLeft=card.x+(card.width-temperatureWidth)/2;
  const temperatureRight=temperatureLeft+temperatureWidth;
  let headlineSize=scaleFontSize(34),layout;
  for(let attempt=0;attempt<30;attempt++){
    const height=headlineSize*1.12+scaleVertical(3)+temperatureSize*1.12+scaleVertical(4)+smallSize*1.12;
    const top=card.y+(card.height-height)/2-scaleVertical(1);
    const width=headline.length*headlineSize*0.60;
    const x=date.getDay()===0?temperatureRight-width:date.getDay()===6?temperatureLeft:card.x+(card.width-width)/2;
    const bounds=widgetVisibleContentBounds(top,headlineSize*1.12,2);
    layout={top,x,width};
    if(x>=Math.max(card.x+3,bounds.left)&&x+width<=Math.min(card.x+card.width-3,bounds.right))break;
    headlineSize-=scaleFontSize(0.5);
  }
  ctx.setTextAlignedLeft();ctx.setFont(Font.blackMonospacedSystemFont(headlineSize));
  ctx.setTextColor(titleWeekdayColor(date,loadResult.holidayDates));
  ctx.drawTextInRect(headline,new Rect(layout.x,layout.top,card.x+card.width-3-layout.x,card.y+card.height-3-layout.top));
  const temperatureY=layout.top+headlineSize*1.12+scaleVertical(3);
  ctx.setFont(Font.blackMonospacedSystemFont(temperatureSize));
  ctx.setTextColor(new Color(SETTINGS.maximumTemperatureColor));
  ctx.drawTextInRect(maximum,new Rect(temperatureLeft,temperatureY,card.x+card.width-3-temperatureLeft,card.y+card.height-3-temperatureY));
  drawTitleWeatherIcon(ctx,titleForecastForDay(date),temperatureLeft+maxWidth+gap/2,
    temperatureY+temperatureSize*0.56,scaleVertical(22));
  ctx.setTextColor(new Color(SETTINGS.minimumTemperatureColor));
  ctx.drawTextInRect(minimum,new Rect(temperatureRight-minWidth,temperatureY,card.x+card.width-3-temperatureRight+minWidth,card.y+card.height-3-temperatureY));
  const countY=temperatureY+temperatureSize*1.12+scaleVertical(4);
  ctx.setFont(Font.regularMonospacedSystemFont(smallSize));ctx.setTextAlignedCenter();
  ctx.setTextColor(new Color('#D1D1D6',0.96));
  ctx.drawTextInRect(summary,new Rect(card.x+8,countY,card.width-16,smallSize*1.2));
}
