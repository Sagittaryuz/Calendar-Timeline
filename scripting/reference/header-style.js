// Build-time typography override for the fixed week. Coordinates stay logical.
function drawTitleDayCard(ctx,date,card,isSelected,isLast) {
  const parent=ctx;
  if(!isSelected){ctx=new DrawContext();ctx.size=new Size(CANVAS.width,CANVAS.height);ctx.opaque=false;ctx.respectScreenScale=false;}
  if(!isSelected){
    const radii={topLeft:date.getDay()===0?TITLE_CARD_OUTER_CORNER_RADIUS:0,
      topRight:isLast?TITLE_CARD_OUTER_CORNER_RADIUS:0,bottomLeft:0,bottomRight:0};
    fillTitleCardShape(ctx,card,radii,new Color('#303136',0.82));
    fillTitleCardShape(ctx,new Rect(card.x+2,card.y+2,card.width-4,card.height-4),
      {...radii,topLeft:Math.max(0,radii.topLeft-2),topRight:Math.max(0,radii.topRight-2)},
      new Color(timelineBackgroundColorForDate(date)));
  }
  const headlineSize=weekHeaderHeadlineSize(date);
  const layout=weekHeaderLayout(date,card,headlineSize);
  const {maximum,minimum,summary,headline,temperatureSize,smallSize,gap,maxWidth,minWidth,temperatureLeft,temperatureRight}=layout;
  const weekend=date.getDay()===0||date.getDay()===6;
  if(date.getDay()===0)ctx.setTextAlignedRight();
  else if(date.getDay()===6)ctx.setTextAlignedLeft();
  else ctx.setTextAlignedCenter();
  ctx.setFont(Font.blackMonospacedSystemFont(headlineSize));
  ctx.setTextColor(titleWeekdayColor(date,loadResult.holidayDates));
  ctx.drawTextInRect(headline,new Rect(weekend?temperatureLeft:card.x+3,layout.top,weekend?temperatureRight-temperatureLeft:card.width-6,card.y+card.height-3-layout.top));
  ctx.setTextAlignedCenter();
  const temperatureY=layout.temperatureY;
  ctx.setFont(Font.blackMonospacedSystemFont(temperatureSize));
  ctx.setTextColor(new Color(SETTINGS.maximumTemperatureColor));
  ctx.drawTextInRect(maximum,new Rect(temperatureLeft,temperatureY,maxWidth,card.y+card.height-3-temperatureY));
  drawTitleWeatherIcon(ctx,titleForecastForDay(date),temperatureLeft+maxWidth+gap/2,
    temperatureY+temperatureSize*0.56,scaleVertical(24));
  ctx.setTextColor(new Color(SETTINGS.minimumTemperatureColor));
  ctx.drawTextInRect(minimum,new Rect(temperatureRight-minWidth,temperatureY,minWidth,card.y+card.height-3-temperatureY));
  const countY=layout.countY;
  ctx.setFont(Font.regularMonospacedSystemFont(smallSize));ctx.setTextAlignedCenter();
  ctx.setTextColor(new Color('#D1D1D6',0.96));
  ctx.drawTextInRect(summary,new Rect(card.x+8,countY,card.width-16,smallSize*1.2));
  if(!isSelected){
    const image={...ctx.getImage(),outerClip:dayCardNeighbourClip()};
    parent.drawImageInRect(image,new Rect(0,0,CANVAS.width,CANVAS.height));
  }
}

function weekHeaderLayout(date,card,headlineSize) {
  const daily=titleDailyTemperatureForDay(date);
  const temp=value=>{const n=finiteWeatherNumber(value);return n===null?'--º':`${Math.round(n)}º`};
  const maximum=temp(daily?.maximum),minimum=temp(daily?.minimum);
  const counts=titleScheduleCountsForDay(date),summary=`E: ${counts.events} | L: ${counts.reminders}`;
  const headline=`${shortWeekday(date)} ${String(date.getDate()).padStart(2,'0')}`;
  const temperatureSize=scaleFontSize(21),smallSize=Math.min(scaleFontSize(16),(card.width-16)/(summary.length*0.62));
  const gap=scaleVertical(38),maxWidth=maximum.length*temperatureSize*0.62,minWidth=minimum.length*temperatureSize*0.62;
  const temperatureWidth=maxWidth+gap+minWidth,temperatureLeft=card.x+(card.width-temperatureWidth)/2;
  const temperatureRight=temperatureLeft+temperatureWidth;
  const height=headlineSize+scaleVertical(1.5)+temperatureSize+scaleVertical(1.5)+smallSize*1.2;
  const top=card.y+card.height-height-scaleVertical(2),width=headline.length*headlineSize*0.60;
  const temperatureY=top+headlineSize+scaleVertical(1.5),countY=temperatureY+temperatureSize+scaleVertical(1.5);
  const x=date.getDay()===0?temperatureRight-width:date.getDay()===6?temperatureLeft:card.x+(card.width-width)/2;
  return {maximum,minimum,summary,headline,temperatureSize,smallSize,gap,maxWidth,minWidth,temperatureLeft,temperatureRight,top,x,width,temperatureY,countY,height};
}

function weekHeaderHeadlineFits(date,card,size) {
  const layout=weekHeaderLayout(date,card,size);
  const bounds=widgetVisibleContentBounds(layout.top,size*1.05,2);
  return layout.top>=card.y+scaleVertical(2)
    &&layout.x>=Math.max(card.x+3,bounds.left)
    &&layout.x+layout.width<=Math.min(card.x+card.width-3,bounds.right)
    &&layout.countY+layout.smallSize*1.2<=card.y+card.height-scaleVertical(1);
}
function weekHeaderHeadlineSize(date) {
  // Shared typography for ordinary cards, including both weekends. Today's
  // headline may use extra space without shifting either of the lower rows.
  let shared=sharedHeaderSize;
  if(shared===null){
  shared=scaleFontSize(25);
  for(let size=scaleFontSize(38);size>=scaleFontSize(25);size-=0.5){
    let fits=true;
    for(let i=0;i<TITLE_CARD_COUNT;i++){
      if(!weekHeaderHeadlineFits(addDays(titleWeekStart(),i),titleDayCardRect(i),size)){fits=false;break;}
    }
    if(fits){shared=size;break;}
  }
  sharedHeaderSize=shared;
  }
  if(dateKey(date)!==dateKey(now))return shared;
  const card=titleDayCardRect(date.getDay());
  for(let size=scaleFontSize(36);size>shared;size-=0.5){
    if(weekHeaderHeadlineFits(date,card,size))return size;
  }
  return shared;
}
