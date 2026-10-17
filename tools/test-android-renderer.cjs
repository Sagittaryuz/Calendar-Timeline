// Browser compatibility checks for the shared renderer. These are NOT Android device screenshots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
const root=path.join(__dirname,'..'),assets=path.join(root,'android/app/src/main/assets');
execFileSync(process.execPath,[path.join(__dirname,'build-android-renderer.cjs')]);
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!/^[a-z.-]+$/.test(name)){res.writeHead(404).end();return;}try{res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(assets,name)));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});let count=0;
 for(const timezoneId of ['America/Sao_Paulo','UTC','America/New_York']){
  const page=await browser.newPage({timezoneId,viewport:{width:1092,height:510}});await page.goto(`http://127.0.0.1:${server.address().port}`);const hashes=new Set();
  for(const hours of [1,24,48,96])for(const hour of [0,12,20,23]){
   const result=await page.evaluate(async({hours,hour})=>{const data=demoInput();data.hours=hours;const date=new Date(data.now);date.setHours(hour,59);data.now=+date;await draw(data);const c=document.getElementById('timeline'),g=c.getContext('2d');return {alpha:g.getImageData(0,0,1,1).data[3],center:g.getImageData(546,255,1,1).data[3],png:c.toDataURL(),frames:document.querySelectorAll('iframe').length};},{hours,hour});
   assert.equal(result.alpha,0,'Outer clipping');assert.equal(result.center,255,'Opaque content');assert.equal(result.frames,0,'Temporary WebViews cleaned');assert(result.png.length>40000,'A complete image was rendered');hashes.add(result.png);count++;
  }
  assert.equal(hashes.size,16,'Time/horizon changes redraw the timeline');
  const layers=await page.evaluate(async()=>{await draw(demoInput());return [...rasterImages.values()].map(canvas=>{const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i])count++;return count;});});
  assert.equal(layers.length,2,'Diagonal weekday and midnight capsule are rasterized');
  assert(layers.every(count=>count>100),'Raster layers survive their temporary document closing');
  const empty=await page.evaluate(async()=>{const labels=[],original=DrawContext.prototype.text;DrawContext.prototype.text=function(text,...args){labels.push(text);return original.call(this,text,...args);};const result=await draw({now:Date.now(),hours:24,events:[],reminders:[]});DrawContext.prototype.text=original;return {...result,temperatures:labels.filter(t=>/\d+[º°]/.test(t))};});assert.equal(empty.count,0);assert.deepEqual(empty.temperatures,[],'Missing weather never fabricates temperatures');
  const injection=await page.evaluate(async()=>{const data=demoInput();data.events[0].title='</script><script>window.__probe=1</script>';await draw(data);return window.__probe||null;});assert.equal(injection,null,'Calendar titles remain data');
  await page.close();
 }
 console.log(`PASS: ${count} canvas scenarios; 3 timezones, 4 horizons, midnight/midday/clamp/day-end, missing sources, text isolation.`);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
