import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {access,mkdir,writeFile,rename,rm} from 'node:fs/promises';

const cast=Object.freeze([
 {role:'Voice Agent',file:'voice-agent.mp3',voice:'OZ0L6eISlOejga3XjDFt',name:'Talia',style:0.28},
 {role:'Triage Agent',file:'triage-agent.mp3',voice:'BFd5oBc2DDna33pSi4Gf',name:'Alicia',style:0.42},
 {role:'Action Agent',file:'action-agent.mp3',voice:'ktkP7Nsj67dw2zcplQYt',name:'Lawrence',style:0.2},
]);
const scripts=Object.freeze({
 booking:[
  'Hi, thanks for calling. I can help with a visit. Do we need anything else before I check the calendar?',
  'No, we’re set. We don’t need any health details just to check a time.',
  'I found a spot. I’ll add it to the demo calendar now.',
 ],
 emergency:[
  'Got it. You’d like a call back from the clinic. Can we take a message?',
  'Yes. Let’s keep it simple and just note that they’d like a call back.',
  'Okay, I’ve logged it for review in the demo. Nothing went out to the clinic.',
 ],
 query:[
  'Sure, I can check on the cost of a visit. Do we have a current price list?',
  'Let’s check what the clinic has on file. I don’t want to give them a guess.',
  'There isn’t a verified price here. I’d check with the clinic before booking.',
 ],
});
const callPrompts=[
 'Hi, thanks for calling DantaVaani. Who am I speaking with?',
 'What else can I help you with?',
 'Shall I go ahead and book the visit?',
 'Thanks. How can I help today?',
 'Of course. How can I help today?',
 'And your last name? You can also say skip.',
 'Sorry, I missed your last name. You can type it or say skip.',
 'Sorry, I didn’t quite catch your name. You can type it or say skip.',
 'Sorry, I missed that. Should I go ahead, or leave it for now?',
 'I’m having trouble hearing you. Use the button below to go ahead or go back.',
 'Hi. How can I help today?',
 'You’re welcome. Anything else I can help with?',
 'Sorry, I missed that. What can I help you with?',
 'I’m having trouble hearing you. You can type your request below.',
 'Of course, I can help book a practice visit. What’s your first and last name? You can say skip.',
 'You’re asking about fees. Shall I check what information is available?',
 'Would you like me to log a practice callback request?',
 'No problem. What else can I help you with?',
 'Shall I go ahead with the practice request?',
 'How can I help today?',
 'What’s your first and last name? You can say skip.',
 'You’re all set. I’ve added your visit to the demo calendar. Anything else I can help with?',
 'I’ve logged a practice callback request. No one was contacted. Is there anything else I can help with?',
 'I don’t have a verified clinic price to quote. Is there anything else I can help with?',
 'I couldn’t finish that practice request. Would you like to try again?',
];
const forScenario=scenario=>scripts[scenario].map((text,i)=>Object.freeze({...cast[i],text}));
export const lines=Object.freeze(forScenario('booking'));
const maxBytes=512*1024, model='eleven_multilingual_v2';
export async function renderDemo({key, out, fetcher=globalThis.fetch, timeoutMs=12_000,scenario='booking'}={}){
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{20,256}$/.test(key))throw Error('Set ELEVENLABS_API_KEY through a secure server environment.');
 if(typeof out!=='string'||!out)throw Error('Select an output directory.');
 if(scenario!=='call'&&!Object.hasOwn(scripts,scenario))throw Error('Unknown voice scenario.');
 const lines=scenario==='call'?callPrompts.map((text,i)=>({...cast[0],file:'call-'+(i+1)+'.mp3',text})):forScenario(scenario);
 const destination=resolve(out);
 await mkdir(destination,{recursive:true});
 // No partial publish: prepare in memory before touching any final paths.
 for(const line of lines) {
  let exists=true;try{await access(resolve(destination,line.file));}catch(e){if(e.code!=='ENOENT')throw e;exists=false;}
  if(exists)throw Error('Output clips already exist; use a new directory to avoid re-render charges.');
 }
 const render=async line=>{
  const signal=AbortSignal.timeout(timeoutMs);
  try{
   const response=await fetcher('https://api.elevenlabs.io/v1/text-to-speech/'+line.voice+'?output_format=mp3_44100_128',{
    method:'POST',redirect:'error',signal,headers:{'xi-api-key':key,'Content-Type':'application/json',Accept:'audio/mpeg'},
    body:JSON.stringify({text:line.text,model_id:model,voice_settings:{stability:0.43,similarity_boost:0.75,style:line.style,use_speaker_boost:true}}),
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
 };
 const clips=[];
 for(let i=0;i<lines.length;i+=3)clips.push(...await Promise.all(lines.slice(i,i+3).map(render)));
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
