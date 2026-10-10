// Regera o bootstrap offline a partir do arquivo distribuído, sem rede.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'Calendar Timeline'),'utf8');
const loaderPath=path.join(root,'Calendar Timeline Loader');
const loader=fs.readFileSync(loaderPath,'utf8');
const begin='// BEGIN BUNDLED CALENDAR CODE',end='// END BUNDLED CALENDAR CODE';
const start=loader.indexOf(begin),finish=loader.indexOf(end);
if(start<0||finish<=start)throw Error('Marcadores do bundle não encontrados');
const sha256=crypto.createHash('sha256').update(code).digest('hex');
const block=`${begin}\nconst BUNDLED_CALENDAR_CODE = ${JSON.stringify(code)};\nconst BUNDLE_CREATED_AT = ${Date.now()};\nconst BUNDLE_SHA256 = ${JSON.stringify(sha256)};\n`;
fs.writeFileSync(loaderPath,loader.slice(0,start)+block+loader.slice(finish));
console.log(`Bundle ${code.match(/WIDGET_BUILD_VERSION = "([^"]+)"/)[1]}, SHA256 ${sha256}.`);
