const fs=require('node:fs'),path=require('node:path'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');let count=0;
for(const file of fs.readdirSync(root).filter(n=>/\.tsx?$/.test(n))){
 buildSync({entryPoints:[path.join(root,file)],bundle:true,write:false,format:'cjs',platform:'neutral',external:['scripting'],target:'es2022',jsxFactory:'createElement',jsxFragment:'Fragment'});count++;
}
const version=JSON.parse(fs.readFileSync(path.join(root,'script.json'),'utf8')).version;
console.log(JSON.stringify({version,syntaxAndImports:true,modules:count,nativeTypes:'pending-iPhone'}));
