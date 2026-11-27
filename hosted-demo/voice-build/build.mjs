import {mkdtemp, rm, writeFile, rename, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {renderDemo} from './render.mjs';
const destination='public/voice-eleven';
const offline='{"provider":"offline","synthetic":true,"clips":[]}\n';
await mkdir(destination,{recursive:true});
await writeFile(join(destination,'demo-voices.json'),offline);
if(process.env.DANTAVAANI_GENERATE_ELEVENLABS==='true'&&process.env.ELEVENLABS_API_KEY){
 let scratch;
 try{
  scratch=await mkdtemp(join(process.cwd(),'.voice-stage-'));
  const scenarios={};
  for(const scenario of ['booking','emergency','query']){
   const clips=await renderDemo({key:process.env.ELEVENLABS_API_KEY,out:join(scratch,scenario),timeoutMs:6500,scenario});
   scenarios[scenario]=clips.map(clip=>({...clip,file:scenario+'-'+clip.file}));
  }
  for(const [scenario,clips] of Object.entries(scenarios)){
   for(const clip of clips)await rename(join(scratch,scenario,clip.file.slice(scenario.length+1)),join(destination,clip.file));
  }
  let call=[];
  try{
   call=await renderDemo({key:process.env.ELEVENLABS_API_KEY,out:join(scratch,'call'),timeoutMs:6500,scenario:'call'});
   for(const clip of call)await rename(join(scratch,'call',clip.file),join(destination,clip.file));
  }catch{call=[];console.warn('Natural call prompts unavailable. Browser voice will be used for live prompts.');}
  const manifest=join(scratch,'manifest.json');
  await writeFile(manifest,JSON.stringify({provider:'ElevenLabs',synthetic:true,scenarios,call})+'\n');
  await rename(manifest,join(destination,'demo-voices.json'));
  console.log('Natural voice recordings available for booking, callback and fees.');
 }catch{
  // The default manifest stays offline; never expose API errors or credentials.
  console.warn('ElevenLabs audio unavailable. Included offline dialogue will be used.');
 }finally{if(scratch)await rm(scratch,{recursive:true,force:true});}
}else console.log('Optional voice rendering disabled. Included offline dialogue will be used.');
