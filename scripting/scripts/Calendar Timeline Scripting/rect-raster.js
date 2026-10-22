// @ts-nocheck
// Rasterize only long consecutive rectangle runs at the original logical
// bitmap resolution. Text, paths, clocks and tap geometry stay vector-based.
export class RectRaster {
  constructor(width,height){
    this.width=Math.ceil(width);this.height=Math.ceil(height);
    this.pixels=new Uint8ClampedArray(this.width*this.height*4);
    this.left=this.width;this.top=this.height;this.right=0;this.bottom=0;
  }
  fill(r,color){
    const left=Math.max(0,Math.floor(r.x)),top=Math.max(0,Math.floor(r.y));
    const right=Math.min(this.width,Math.ceil(r.x+r.width)),bottom=Math.min(this.height,Math.ceil(r.y+r.height));
    if(right<=left||bottom<=top||color.alpha<=0)return;
    this.left=Math.min(this.left,left);this.top=Math.min(this.top,top);this.right=Math.max(this.right,right);this.bottom=Math.max(this.bottom,bottom);
    const h=color.hex,red=parseInt(h.slice(0,2),16),green=parseInt(h.slice(2,4),16),blue=parseInt(h.slice(4,6),16);
    if(![red,green,blue,color.alpha].every(Number.isFinite))throw new Error('Cor raster inválida');
    const p=this.pixels;
    for(let y=top;y<bottom;y++){
      const cy=Math.min(y+1,r.y+r.height)-Math.max(y,r.y);
      for(let x=left;x<right;x++){
        const a=Math.min(1,Math.max(0,color.alpha*cy*(Math.min(x+1,r.x+r.width)-Math.max(x,r.x))));
        const i=(y*this.width+x)*4;
        if(a===1){p[i]=red;p[i+1]=green;p[i+2]=blue;p[i+3]=255;continue;}
        const back=p[i+3]/255*(1-a),alpha=a+back;
        if(!alpha)continue;
        p[i]=(red*a+p[i]*back)/alpha;p[i+1]=(green*a+p[i+1]*back)/alpha;p[i+2]=(blue*a+p[i+2]*back)/alpha;p[i+3]=alpha*255;
      }
    }
  }
  crop(){
    const width=this.right-this.left,height=this.bottom-this.top;
    if(width<=0||height<=0)return null;
    const pixels=new Uint8Array(width*height*4);
    for(let y=0;y<height;y++)pixels.set(this.pixels.subarray(((y+this.top)*this.width+this.left)*4,((y+this.top)*this.width+this.right)*4),y*width*4);
    return {pixels,width,height,x:this.left,y:this.top};
  }
}

const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xFFFFFFFF;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;}
function u32(bytes,offset,value){bytes[offset]=value>>>24;bytes[offset+1]=value>>>16;bytes[offset+2]=value>>>8;bytes[offset+3]=value;}
function chunk(type,body){const out=new Uint8Array(body.length+12);u32(out,0,body.length);out.set(Array.from(type,c=>c.charCodeAt(0)),4);out.set(body,8);u32(out,body.length+8,crc32(out.subarray(4,body.length+8)));return out;}
// A standards-compliant PNG with stored DEFLATE blocks. No external runtime,
// network, eval, or undocumented iOS image-rendering API is required.
export function encodePNG({pixels,width,height}){
  const stride=width*4,raw=new Uint8Array((stride+1)*height);
  for(let y=0;y<height;y++)raw.set(pixels.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);
  const count=Math.ceil(raw.length/65535),z=new Uint8Array(2+raw.length+count*5+4);
  z.set([0x78,0x01]);let cursor=2,offset=0,a=1,b=0;
  while(offset<raw.length){
    const length=Math.min(65535,raw.length-offset),final=offset+length===raw.length;
    z[cursor++]=final?1:0;z[cursor++]=length&255;z[cursor++]=length>>>8;
    z[cursor++]=(~length)&255;z[cursor++]=((~length)>>>8)&255;
    z.set(raw.subarray(offset,offset+length),cursor);cursor+=length;
    for(let i=offset;i<offset+length;i++){a=(a+raw[i])%65521;b=(b+a)%65521;}
    offset+=length;
  }
  u32(z,cursor,((b<<16)|a)>>>0);
  const header=new Uint8Array(13);u32(header,0,width);u32(header,4,height);header.set([8,6,0,0,0],8);
  const parts=[Uint8Array.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',z),chunk('IEND',new Uint8Array())];
  const png=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));cursor=0;for(const part of parts){png.set(part,cursor);cursor+=part.length;}return png;
}
