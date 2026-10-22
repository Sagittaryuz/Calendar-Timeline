const assert=require('node:assert/strict'),path=require('node:path'),zlib=require('node:zlib');
const {pathToFileURL}=require('node:url');
async function main(){
 const dir=path.join(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
 const {RectRaster,encodePNG}=await import(pathToFileURL(path.join(dir,'rect-raster.js')).href);
 const drawing=await import(pathToFileURL(path.join(dir,'drawing.js')).href);
 const raster=new RectRaster(4,3);
 raster.fill({x:1,y:1,width:2,height:1},new drawing.Color('FF0000'));
 raster.fill({x:2,y:1,width:1,height:1},new drawing.Color('0000FF',0.5));
 const crop=raster.crop();assert.deepEqual([crop.x,crop.y,crop.width,crop.height],[1,1,2,1]);
 assert.deepEqual([...crop.pixels],[255,0,0,255,128,0,128,255]);
 const png=encodePNG(crop);assert.deepEqual([...png.slice(0,8)],[137,80,78,71,13,10,26,10]);
 const data=[];let header;
 for(let p=8;p<png.length;){const n=Buffer.from(png.buffer).readUInt32BE(p),type=Buffer.from(png.slice(p+4,p+8)).toString();if(type==='IDAT')data.push(png.slice(p+8,p+8+n));if(type==='IHDR')header=Buffer.from(png.slice(p+8,p+8+n));p+=12+n;}
 assert.equal(header.readUInt32BE(0),2);assert.equal(header.readUInt32BE(4),1);
 assert.deepEqual([...zlib.inflateSync(Buffer.concat(data.map(x=>Buffer.from(x))))],[0,...crop.pixels]);
 // Multi-block stored DEFLATE and crop boundaries, including negative/offscreen rectangles.
 const big=new RectRaster(256,256);big.fill({x:-2,y:-2,width:260,height:260},new drawing.Color('00FF00'));
 const raw=encodePNG(big.crop());assert(raw.length>65535);
 const sharp=require(process.env.SHARP_PATH||'sharp');
 const decoded=await sharp(Buffer.from(raw)).raw().toBuffer({resolveWithObject:true});
 assert.equal(decoded.info.width,256);assert.equal(decoded.info.height,256);
 assert(decoded.data.every((v,i)=>v===[0,255,0,255][i%4]));
 const edge=new RectRaster(2,1);edge.fill({x:0.5,y:0,width:1,height:1},new drawing.Color('FFFFFF'));
 assert.deepEqual([...edge.crop().pixels],[255,255,255,128,255,255,255,128]);
 const context=new drawing.DrawContext();context.size={width:256,height:2};let batches=0;
 context.makeRaster=c=>{batches++;return {native:{},size:{width:c.width,height:c.height}}};
 for(let x=0;x<256;x++){context.setFillColor(new drawing.Color('FF0000'));context.fillRect(new drawing.Rect(x,0,1,1));}
 context.drawText('above',new drawing.Point(0,0));const image=context.getImage();
 assert.equal(batches,1);assert.deepEqual(image.ops.map(x=>x.type),['image','text']);
 console.log('PASS: PNG decoded independently by Sharp; alpha, crop, fractional edges, multi-block DEFLATE and painter order.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
