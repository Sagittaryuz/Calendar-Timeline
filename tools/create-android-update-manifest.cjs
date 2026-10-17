// Creates release metadata only. Does not sign, upload, or publish anything.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
function fail(message){throw Error(message);}
try{
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){if(!['--apk','--channel','--verified-apk-sha256'].includes(args[i])||!args[i+1]||options[args[i]])fail('Use --apk FILE --channel test|stable --verified-apk-sha256 SHA256');options[args[i]]=args[i+1];}
 if(!options['--apk']||!['test','stable'].includes(options['--channel'])||!/^[a-f0-9]{64}$/i.test(options['--verified-apk-sha256']||''))fail('Informe o APK testado, canal e seu SHA-256 verificado.');
 const apk=path.resolve(options['--apk']),name=path.basename(apk);
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]*\.apk$/.test(name))fail('Nome de APK incompatível com links seguros de Release.');
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
 if(sha256!==options['--verified-apk-sha256'].toLowerCase())fail('O SHA-256 informado não corresponde ao APK. Teste exatamente o artefato que será publicado.');
 const sdk=process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME;if(!sdk)fail('Defina ANDROID_SDK_ROOT ou ANDROID_HOME para o SDK oficial.');
 const buildTools=path.join(sdk,'build-tools',process.env.ANDROID_BUILD_TOOLS_VERSION||'35.0.0');
 const run=(file,args)=>execFileSync(file,args,{encoding:'utf8',maxBuffer:4*1024*1024});
 const badging=run(path.join(buildTools,'aapt'),['dump','badging',apk]);
 const info=badging.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/),minimum=badging.match(/sdkVersion:'(\d+)'/);
 if(!info||!minimum||info[1]!=='com.sagittaryuz.calendartimeline')fail('Identidade do APK inválida.');
 const signature=run(path.join(buildTools,'apksigner'),['verify','--print-certs',apk]);
 const certificates=[...signature.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})/gi)];
 if(certificates.length!==1)fail('APK deve ter uma assinatura válida reconhecida.');
 const debug=/^application-debuggable/m.test(badging),debugCertificate=/CN=Android Debug(?:,|$)/m.test(signature);
 if(options['--channel']==='stable'&&(debug||debugCertificate))fail('Canal stable rejeitado: APK ou certificado de debug. Não apresente este APK como produção.');
 if(options['--channel']==='test'&&!debug)fail('Canal test espera um APK explicitamente debug.');
 const entries=run('unzip',['-Z1',apk]).split('\n');
 if(entries.some(name=>/(?:^|\/)(?:id_rsa|id_ed25519|credentials\.json)$|\.(?:jks|keystore|p12|pfx)$/i.test(name)))fail('Arquivo de chave/credencial encontrado no APK. Não publique.');
 const manifest={format:'calendar-timeline-android-release',schemaVersion:1,tested:true,applicationId:info[1],versionCode:Number(info[2]),versionName:info[3],minSdk:Number(minimum[1]),signingCertificateSha256:certificates[0][1].toLowerCase(),buildType:debug?'debug':'release',channel:options['--channel'],apk:name,sha256};
 process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
