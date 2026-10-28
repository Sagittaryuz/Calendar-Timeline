// Local-only package recovery: removal of the retired Bridge never migrates native data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting'),base='481bbce',prefix='scripting/scripts/Calendar Timeline Scripting/';
const old=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'--',prefix],{encoding:'utf8'}).trim().split('\n').map(p=>path.basename(p));
const retired=old.filter(n=>n.startsWith('bridge'));assert.equal(retired.length,9);assert.deepEqual(fs.readdirSync(dir).sort(),old.filter(n=>!retired.includes(n)).sort());
for(const name of ['drawing.js','diagonal-canvas.js','rect-raster.js','graph-view.tsx','timeline-view.tsx','host.ts','widget-refresh.ts','selection.ts'])assert(fs.readFileSync(path.join(dir,name)).equals(cp.execFileSync('git',['show',base+':'+prefix+name])),name+' remains byte-identical: local reads/cache, layout/fonts/frame, navigation');
assert(fs.readFileSync(path.join(dir,'original-engine.js'),'utf8').replace('titleSize:38,','titleSize:29,')===cp.execFileSync('git',['show',base+':'+prefix+'original-engine.js'],{encoding:'utf8'}),'Only first-row title size changes in engine');
const descriptor=JSON.parse(fs.readFileSync(path.join(dir,'script.json')));assert(fs.readFileSync(path.join(dir,'diagnostics.ts'),'utf8').includes("VERSION='"+descriptor.version+"'"));
for(const name of ['index.tsx','widget.tsx','app_intents.tsx','intent.tsx'])assert(!/from ['"]\.\/bridge/.test(fs.readFileSync(path.join(dir,name),'utf8')),'No active entry imports retired modules');
console.log('PASS recovery: 16-file local package; nine Bridge modules removed; renderer/local host and caches byte-identical; version coherent; migration handlers verified separately.');
