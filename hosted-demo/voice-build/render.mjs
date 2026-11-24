import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {access,mkdir,writeFile,rename,rm} from 'node:fs/promises';

export const lines = Object.freeze([
 Object.freeze({role:'Voice Agent', file:'voice-agent.mp3', voice:'OZ0L6eISlOejga3XjDFt', name:'Talia', text:'Namaste, you’re through to DantaVaani. I heard a request to book a visit. Triage, can you review it?'}),
 Object.freeze({role:'Triage Agent', file:'triage-agent.mp3', voice:'BFd5oBc2DDna33pSi4Gf', name:'Alicia', text:'This is a routine scheduling request. No health details are needed. Action, can you check the sandbox calendar?'}),
 Object.freeze({role:'Action Agent', file:'action-agent.mp3', voice:'ktkP7Nsj67dw2zcplQYt', name:'Lawrence', text:'I’m checking the demo calendar. The result panel will show if a practice appointment was added. No real appointment or notification will be made.'}),
]);
const maxBytes=512*1024, model='eleven_multilingual_v2';
export async function renderDemo({key, out, fetcher=globalThis.fetch, timeoutMs=12_000}={}){
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{20,256}$/.test(key))throw Error('Set ELEVENLABS_API_KEY through a secure server environment.');
 if(typeof out!=='string'||!out)throw Error('Select an output directory.');
 const destination=resolve(out);
 await mkdir(destination,{recursive:true});
 // No partial publish: prepare in memory before touching any final paths.
 for(const line of lines) {
  let exists=true;try{await access(resolve(destination,line.file));}catch(e){if(e.code!=='ENOENT')throw e;exists=false;}
  if(exists)throw Error('Output clips already exist; use a new directory to avoid re-render charges.');
 }
 const clips=await Promise.all(lines.map(async line=>{
  const signal=AbortSignal.timeout(timeoutMs);
  try{
   const response=await fetcher('https://api.elevenlabs.io/v1/text-to-speech/'+line.voice+'?output_format=mp3_44100_128',{
    method:'POST',redirect:'error',signal,headers:{'xi-api-key':key,'Content-Type':'application/json',Accept:'audio/mpeg'},
    body:JSON.stringify({text:line.text,model_id:model}),
   });
   if(!response.ok){await response.body?.cancel();throw new Error('Provider status '+response.status);}
   if(!/^audio\/(?:mpeg|mp3)(?:;|$)/i.test(response.headers.get('content-type')??'')||Number(response.headers.get('content-length'))>maxBytes||!response.body){
    await response.body?.cancel();throw new Error('Unexpected audio headers');
   }
   const pieces=[];let size=0;
   for await(const buffer of response.body){size+=buffer.length;if(size>maxBytes)throw new Error('Audio was too large');pieces.push(Buffer.from(buffer));}
   const audio=Buffer.concat(pieces);
   if(audio.length<32||!(audio.subarray(0,3).toString('ascii')==='ID3'||(audio[0]===255&&(audio[1]&224)===224)))throw new Error('Invalid MP3');
   return {line,audio};
  }catch(e){
   const safeStatus=/^Provider status \d{3}$/.test(e.message??'')?' ('+e.message+')':'';
   throw new Error('ElevenLabs could not render '+line.role+safeStatus+'. No audio was published.');
  }
 }));
 const temp=await import('node:fs/promises').then(x=>x.mkdtemp(resolve(destination,'.render-')));
 try{
  for(const {line,audio} of clips)await writeFile(resolve(temp,line.file),audio,{flag:'wx',mode:0o644});
  const metadata=clips.map(({line})=>({role:line.role,file:line.file,voice:line.name,text:line.text}));
  await writeFile(resolve(temp,'demo-voices.json'),JSON.stringify({provider:'ElevenLabs',model,synthetic:true,clips:metadata},null,2)+'\n',{flag:'wx'});
  for(const f of [...lines.map(l=>l.file),'demo-voices.json'])await rename(resolve(temp,f),resolve(destination,f));
  return metadata;
 }finally{await rm(temp,{recursive:true,force:true});}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const [mode,out]=process.argv.slice(2);
 if(mode!=='--generate'||!out||process.argv.length!==4) {console.error('Usage: node render.mjs --generate <new-output-directory> (uses ElevenLabs credits)');process.exitCode=2;}
 else try{const clips=await renderDemo({key:process.env.ELEVENLABS_API_KEY,out}); console.log('Rendered '+clips.length+' synthetic demo clips.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
