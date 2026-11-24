import {renderDemo, lines} from './render.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const key='not-a-real-key-for-testing';
const audio=()=>new Response(Buffer.from('ID3'+'.'.repeat(40)),{headers:{'content-type':'audio/mpeg'}});
test('three fixed synthetic lines use distinct official IDs and generate captions',async()=>{
 const out=await mkdtemp(join(tmpdir(),'dantavaani-voice-'));
 const requests=[];
 const fetcher=async(url,req)=>{requests.push({url,body:JSON.parse(req.body)});return audio();};
 try{
  const clips=await renderDemo({key,out,fetcher});
  assert.equal(new Set(requests.map(r=>r.url)).size,3);
  assert.deepEqual(requests.map(r=>r.body.text),lines.map(l=>l.text));
  assert.equal(clips.length,3);
  assert.deepEqual((await readdir(out)).sort(),['action-agent.mp3','demo-voices.json','triage-agent.mp3','voice-agent.mp3']);
  assert.equal(JSON.parse(await readFile(join(out,'demo-voices.json'))).synthetic,true);
  await assert.rejects(renderDemo({key,out,fetcher}),/already exist/);
  assert.equal(requests.length,3);
 }finally{await rm(out,{recursive:true,force:true});}
});
test('missing key contacts nobody; provider failure does not write partial audio',async()=>{
 const out=await mkdtemp(join(tmpdir(),'dantavaani-voice-'));
 let requests=0;
 const fetcher=async()=>{requests++;return new Response('diagnostic',{status:403});};
 try{
  await assert.rejects(renderDemo({out,fetcher}),/Set ELEVENLABS_API_KEY/);
  assert.equal(requests,0);
  await assert.rejects(renderDemo({key,out,fetcher}),/Provider status 403/);
  assert.equal(requests,3);
  assert.deepEqual(await readdir(out),[]);
 }finally{await rm(out,{recursive:true,force:true});}
});
