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
  const clips=await renderDemo({key:process.env.ELEVENLABS_API_KEY,out:scratch,timeoutMs:6500});
  for(const clip of clips)await rename(join(scratch,clip.file),join(destination,clip.file));
  await rename(join(scratch,'demo-voices.json'),join(destination,'demo-voices.json'));
  console.log('Three fixed booking clips are available.');
 }catch{
  // No exception/HTTP body is logged. The default manifest remains offline.
  console.warn('ElevenLabs audio unavailable. Included offline dialogue will be used.');
 }finally{if(scratch)await rm(scratch,{recursive:true,force:true});}
}else console.log('Optional voice rendering disabled. Included offline dialogue will be used.');
