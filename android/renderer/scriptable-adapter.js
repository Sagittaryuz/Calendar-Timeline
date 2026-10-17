/* Scriptable drawing API implemented with the local Android System WebView Canvas.
 * No remote scripts, fonts, analytics, or network requests are used by this renderer. */
const rasterImages = new Map();
let temperatureLabels = 0;
class Point { constructor(x,y){this.x=x;this.y=y;} }
class Size { constructor(width,height){this.width=width;this.height=height;} }
class Rect { constructor(x,y,width,height){Object.assign(this,{x,y,width,height});} }
class Color {
 constructor(hex,alpha=1){this.hex=String(hex).replace('#','');this.alpha=alpha;const n=parseInt(this.hex,16);this.red=(n>>16&255)/255;this.green=(n>>8&255)/255;this.blue=(n&255)/255;}
 static white(){return new Color('FFFFFF');} static black(){return new Color('000000');}
 get css(){return `rgba(${this.red*255},${this.green*255},${this.blue*255},${this.alpha})`;}
}
const Font = new Proxy({}, {get:(_,name)=>size=>({size,weight:/black/.test(name)?900:/bold/.test(name)?700:/medium/.test(name)?500:400,family:/Monospaced/.test(name)?'monospace':'sans-serif'})});
class Path {
 constructor(){this.path=new Path2D();} move(p){this.path.moveTo(p.x,p.y);} addLine(p){this.path.lineTo(p.x,p.y);}
 addCurve(end,c1,c2){this.path.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,end.x,end.y);} closeSubpath(){this.path.closePath();}
}
class DrawContext {
 constructor(){this.canvas=document.createElement('canvas');this.size=new Size(1,1);this.font={size:12,weight:400,family:'sans-serif'};this.align='left';}
 set size(s){this._size=s;this.canvas.width=Math.ceil(s.width);this.canvas.height=Math.ceil(s.height);this.g=this.canvas.getContext('2d');} get size(){return this._size;}
 setFillColor(c){this.g.fillStyle=c.css;} setStrokeColor(c){this.g.strokeStyle=c.css;} setTextColor(c){this.textColor=c.css;}
 setLineWidth(w){this.g.lineWidth=w;} setFont(f){this.font=f;} setTextAlignedCenter(){this.align='center';} setTextAlignedLeft(){this.align='left';}
 fillRect(r){this.g.fillRect(r.x,r.y,r.width,r.height);} strokeRect(r){this.g.strokeRect(r.x,r.y,r.width,r.height);}
 ellipse(r,stroke){this.g.beginPath();this.g.ellipse(r.x+r.width/2,r.y+r.height/2,Math.max(0,r.width/2),Math.max(0,r.height/2),0,0,Math.PI*2);stroke?this.g.stroke():this.g.fill();}
 fillEllipse(r){this.ellipse(r,false);} strokeEllipse(r){this.ellipse(r,true);}
 addPath(p){this.path=p.path;} fillPath(){this.g.fill(this.path);} strokePath(){this.g.stroke(this.path);}
 drawImageAtPoint(img,p){if(img)this.g.drawImage(img,p.x,p.y);} drawImageInRect(img,r){if(img&&r.width>0&&r.height>0)this.g.drawImage(img,r.x,r.y,r.width,r.height);}
 drawText(text,p){this.text(text,new Rect(p.x,p.y,0,0),false);}
 drawTextInRect(text,r){this.text(text,r,true);}
 text(text,r,rect){if(/[0-9][º°]/.test(String(text)))temperatureLabels++;const g=this.g,f=this.font;g.save();g.font=`${f.weight} ${f.size}px ${f.family}`;g.textBaseline='alphabetic';g.textAlign=this.align;g.fillStyle=this.textColor||'#fff';
  if(rect){g.beginPath();g.rect(r.x,r.y,Math.max(0,r.width),Math.max(0,r.height));g.clip();}
  const x=r.x+(rect&&this.align==='center'?r.width/2:0);g.fillText(String(text),x,r.y+f.size*.95);g.restore();}
 getImage(){const c=document.createElement('canvas');c.width=this.canvas.width;c.height=this.canvas.height;c.getContext('2d').drawImage(this.canvas,0,0);return c;}
}
class DateFormatter {
 string(d){const weekdays=['dom.','seg.','ter.','qua.','qui.','sex.','sáb.'];const pad=x=>String(x).padStart(2,'0');return String(this.dateFormat).replace(/yyyy|MMMM|MMM|EEE|MM|dd|HH|mm|d/g,k=>({yyyy:d.getFullYear(),MMMM:d.toLocaleDateString('pt-BR',{month:'long'}),MMM:d.toLocaleDateString('pt-BR',{month:'short'}),EEE:weekdays[d.getDay()],MM:pad(d.getMonth()+1),dd:pad(d.getDate()),HH:pad(d.getHours()),mm:pad(d.getMinutes()),d:d.getDate()})[k]);}
}
const Data={fromBase64String:s=>s};
const Image={fromData:s=>{const c=rasterImages.get(s);if(!c)throw Error('Raster not prepared');return c;}};
class WebView {
 async loadHTML(html){this.frame=document.createElement('iframe');this.frame.hidden=true;document.body.append(this.frame);this.frame.contentDocument.open();this.frame.contentDocument.write(html);this.frame.contentDocument.close();const w=this.frame.contentWindow,original=w.HTMLCanvasElement.prototype.toDataURL;w.HTMLCanvasElement.prototype.toDataURL=function(...args){const url=original.apply(this,args);const snapshot=document.createElement('canvas');snapshot.width=this.width;snapshot.height=this.height;snapshot.getContext('2d').drawImage(this,0,0);rasterImages.set(url.split(',')[1],snapshot);return url;};}
 async evaluateJavaScript(js){const r=this.frame.contentWindow.eval(js);this.frame.remove();return r;}
}
let platformInput={};
function reviveEvent(e){return {...e,startDate:new Date(e.startDate),endDate:new Date(e.endDate)};}
function reviveReminder(e){return {...e,dueDate:new Date(e.dueDate)};}
const CalendarEvent={between:async()=>platformInput.events.map(reviveEvent),today:async()=>platformInput.events.map(reviveEvent).filter(e=>{const d=new Date(platformInput.now||Date.now());d.setHours(0,0,0,0);return e.startDate<new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)&&e.endDate>d;})};
const Reminder={incompleteDueBetween:async()=> (platformInput.reminders||[]).map(reviveReminder),incompleteDueToday:async()=>[],scheduled:async()=> (platformInput.reminders||[]).map(reviveReminder)};
class Request {constructor(url){this.url=url;this.response={statusCode:200};}async loadJSON(){return platformInput.weatherResponse;}}
async function draw(input){
 platformInput={events:[],...input};rasterImages.clear();temperatureLabels=0;
 try {const result=await renderTimeline(platformInput);const canvas=document.getElementById('timeline');canvas.width=1092;canvas.height=510;
 const g=canvas.getContext('2d');g.clearRect(0,0,1092,510);g.save();
 // Match the measured outer superellipse. Android launchers do not supply iOS clipping.
 const p=new Path2D(),rx=102,ry=101,n=2/2.45;const corners=[[rx,ry,Math.PI,1.5*Math.PI],[1092-rx,ry,1.5*Math.PI,2*Math.PI],[1092-rx,510-ry,0,.5*Math.PI],[rx,510-ry,.5*Math.PI,Math.PI]];
 corners.forEach(([x,y,a,b],i)=>{for(let j=0;j<=64;j++){const t=a+(b-a)*j/64,c=Math.cos(t),s=Math.sin(t),px=x+rx*Math.sign(c)*Math.abs(c)**n,py=y+ry*Math.sign(s)*Math.abs(s)**n;if(!i&&!j)p.moveTo(px,py);else p.lineTo(px,py);}});p.closePath();g.clip(p);g.drawImage(result.image,0,0);g.restore();
 window.lastRender={count:result.count,version:result.version,weatherHours:result.weatherHours,weatherDays:result.weatherDays,temperatureLabels};
 if(window.Android)Android.rendered(canvas.toDataURL('image/png').split(',')[1],JSON.stringify(window.lastRender));
 return window.lastRender;
 }catch(e){document.getElementById('error').textContent='Não foi possível desenhar a timeline.';if(window.Android)Android.failed(String(e));throw e;}
}
