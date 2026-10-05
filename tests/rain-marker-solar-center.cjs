// Integra o caminho preenchido real; não depende das frações usadas no layout.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname,'..','Calendar Timeline'),'utf8');
class Point { constructor(x,y){Object.assign(this,{x,y});} }
class Path {
  constructor(){this.points=[];}
  move(p){this.points.push(p);}
  addLine(p){this.points.push(p);}
  addCurve(end,c1,c2){
    const start=this.points.at(-1);
    for(let i=1;i<=2000;i++){
      const t=i/2000,u=1-t;
      this.points.push(new Point(u**3*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t**3*end.x,
        u**3*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t**3*end.y));
    }
  }
  closeSubpath(){}
}
const c={Point,Path,timelineChartTop:()=>100};vm.createContext(c);
function load(name){
  const start=source.indexOf(`function ${name}(`);
  const next=source.slice(start+1).search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start,start+next+1),c);
}
for(const name of ['solarLineY','rainTopMarkerTopY','drawRainTopMarker'])load(name);
function centroid(points){
  let area=0,mx=0,my=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],cross=a.x*b.y-b.x*a.y;
    area+=cross;mx+=(a.x+b.x)*cross;my+=(a.y+b.y)*cross;
  }
  return {x:mx/(3*area),y:my/(3*area)};
}
let cases=0;
for(const hours of [1,24,48,96])for(const line of [80,100,130])for(const storm of [false,true])
  for(const height of [16,24,40])for(const x of [0,48/hours,1024]){
    c.timelineChartTop=()=>line;
    let shape;
    const ctx={setFillColor(color){assert.equal(color,'cyan');},addPath(p){shape=p;},fillPath(){}};
    const top=c.rainTopMarkerTopY(height,storm);
    c.drawRainTopMarker(ctx,x,top,height,7,storm,'cyan');
    const center=centroid(shape.points);
    assert(Math.abs(center.y-line)<0.00001,'Centro real da forma preenchida coincide com a linha solar.');
    assert(top<line&&top+height>line,'Símbolo ocupa os dois lados da linha solar.');
    if(!storm)assert(Math.abs(center.x-x)<0.00001,'Centro horizontal da gota preservado.');
    assert(Math.max(...shape.points.map(p=>p.y))<=line+height,
      'Deslocamento para cima não amplia a extensão em direção à legenda inferior.');
    cases++;
  }
assert(!source.includes('RAIN_TOP_MARKER_VERTICAL_OFFSET'));
console.log(`OK: ${cases} caminhos reais, gotas/raios centrados na linha solar; dimensões e eixo horizontal preservados.`);
