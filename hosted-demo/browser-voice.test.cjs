'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {runExample}=require('./engine.cjs');
function fixture(provider){
 const elements=new Map(),playCalls=[],requests=[],recognitions=[];
 function node(){
  return {
   textContent:'',dataset:{},kids:[],listeners:{},attrs:{},hidden:false,lastElementChild:{},paused:true,
   classList:{remove(){},add(){}},content:{cloneNode(){return node();}},
   append(...x){this.kids.push(...x);},replaceChildren(...x){this.kids=x;},
   setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},
   querySelector(){return null;},addEventListener(type,fn){this.listeners[type]=fn;}
  };
 }
 function get(id){
  if(!elements.has(id))elements.set(id,node());
  return elements.get(id);
 }
 const audio=Object.assign(get('agentAudio'),{
  pause(){this.paused=true;},
  play(){this.paused=false;playCalls.push(this.src);return Promise.resolve();},
  at(type,url,time=0){this.currentSrc=url;this.currentTime=time;this.ended=type==='ended';this.listeners[type]();}
 });
 get('tts').checked=true;
 const buttons=['booking','emergency','query'].map(demo=>Object.assign(node(),{dataset:{demo}}));
 const manifest=provider?{
  provider:'ElevenLabs',synthetic:true,clips:['Voice','Triage','Action'].map(agent=>{
    return {role:agent+' Agent',file:agent.toLowerCase()+'-agent.mp3',text:agent+' tells the demo status.'};
  })
 }:{provider:'offline',clips:[]};
 const choices=['booking','emergency','query'].map(callExample=>Object.assign(node(),{dataset:{callExample}}));
 const dialog=Object.assign(get('browserCall'),{
  open:false,showModal(){this.open=true;},close(){this.open=false;this.listeners.close();}
 });
 class SpeechRecognition {
  constructor(){recognitions.push(this);}
  start(){}
  abort(){}
  hear(transcript){this.onresult({resultIndex:0,results:[Object.assign([{transcript}],{isFinal:true})]});}
 }
 const doc={
  baseURI:'http://localhost:9999/', getElementById:get,
  querySelectorAll(s){return s==='[data-demo]'?buttons:choices;},createElement:node,createTextNode:text=>({textContent:text})
 };
 const ctx=vm.createContext({
  document:doc,window:{addEventListener(){},SpeechRecognition,isSecureContext:true},URL,setInterval:()=>1,clearInterval:()=>{},
  fetch:async(path,opts)=>{
   requests.push({path,opts});
   const val=path.startsWith('./api/demo/')?await runExample(path.split('/').at(-1)):manifest;
   return {ok:true,json:async()=>val};
  }
 });
 for(const name of ['voice-cues.js','demo.js'])vm.runInContext(fs.readFileSync('public/'+name,'utf8'),ctx,{filename:name});
 return {get,audio,buttons,choices,requests,recognitions,dialog,playCalls,roles:()=>get('chat').kids.map(x=>x.kids[0]?.textContent).filter(Boolean)};
}
const next=()=>new Promise(resolve=>setImmediate(resolve));
test('bundled audio starts in the booking gesture and captions all three agents',async()=>{
 const f=fixture(false);
 await f.buttons[0].listeners.click();
 const src=f.playCalls[0];
 assert.match(src,/\/voice\/booking\.mp3$/);
 assert.equal(f.get('kBooked').textContent,1);
 f.audio.at('timeupdate',src,19);
 assert.ok(!f.roles().includes('Triage agent'));
 f.audio.at('playing',src);
 f.audio.at('timeupdate',src,21);
 assert.ok(f.roles().includes('Voice agent'));
 assert.ok(f.roles().includes('Triage agent'));
 assert.ok(f.roles().includes('Action agent'));
 f.get('replayDemo').listeners.click();
 assert.equal(f.playCalls.at(-1),src);
 f.get('newCall').listeners.click();
 assert.ok(f.audio.paused);
 assert.ok(f.get('desk').hidden);
});
test('three provider clips sequence without mistaking stale events for a new speaker; media failure falls back',async()=>{
 const f=fixture(true);
 await next();
 await f.buttons[0].listeners.click();
 const voice=f.playCalls.at(-1);
 assert.match(voice,/\/voice-eleven\/voice-agent\.mp3$/);
 assert.doesNotMatch(f.get('audioProvider').textContent,/ElevenLabs recording/);
 f.audio.at('playing',voice);
 assert.ok(f.roles().includes('Voice Agent'));
 f.audio.at('ended',voice);
 const triage=f.playCalls.at(-1);
 assert.match(triage,/\/voice-eleven\/triage-agent\.mp3$/);
 f.audio.at('ended',voice);
 assert.equal(f.playCalls.at(-1),triage);
 assert.ok(!f.roles().includes('Triage Agent'));
 f.audio.at('playing',triage);
 assert.ok(f.roles().includes('Triage Agent'));
 f.audio.at('ended',triage);
 const action=f.playCalls.at(-1);
 assert.match(action,/\/voice-eleven\/action-agent\.mp3$/);
 f.audio.at('error',action);
 const fallback=f.playCalls.at(-1);
 assert.match(fallback,/\/voice\/booking\.mp3$/);
 f.audio.at('playing',fallback);
 assert.equal(f.get('audioProvider').textContent,'Bundled offline audio');
 assert.ok(f.roles().includes('Voice agent'));
});
test('complete provider dialogue plays Voice, Triage, and Action in order',async()=>{
 const f=fixture(true);await next();await f.buttons[0].listeners.click();
 for(const role of ['voice','triage','action']){
  const src=f.playCalls.at(-1);
  assert.match(src,new RegExp('/'+role+'-agent\\.mp3$'));
  f.audio.at('playing',src);f.audio.at('ended',src);
 }
 assert.deepEqual(f.roles().filter(role=>role!=='DantaVaani'),['Voice Agent','Triage Agent','Action Agent']);
 assert.equal(f.playCalls.length,3);
});
test('modal starts with mic off, sends no transcript, and asks for confirmation before booking',async()=>{
 const f=fixture(false);
 f.get('startBrowserCall').listeners.click();
 assert.equal(f.dialog.open,true);
 assert.equal(f.recognitions.length,0);
 assert.equal(f.get('browserMic').attrs['aria-pressed'],'false');
 f.get('browserLocale').value='te-IN';
 f.get('browserMic').listeners.click();
 assert.equal(f.recognitions[0].lang,'te-IN');
 const sampleNotACommand='my private example identifier';
 f.recognitions[0].hear(sampleNotACommand);
 assert.ok(!JSON.stringify(f.requests).includes(sampleNotACommand));
 assert.match(f.get('browserError').textContent,/Do not share personal details/);
 f.get('browserMic').listeners.click();
 f.recognitions[1].hear('book an appointment');
 assert.match(f.get('browserCaption').textContent,/selected/);
 assert.equal(f.get('browserConfirmRow').hidden,false);
 assert.ok(!f.requests.some(r=>r.path.includes('/api/demo/')));
 f.get('browserMic').listeners.click();
 f.recognitions[2].hear('confirm');
 for(let i=0;i<30&&f.get('browserResult').hidden;i++)await new Promise(r=>setTimeout(r,10));
 const workflow=f.requests.find(r=>r.path.includes('/api/demo/'));
 assert.equal(workflow.path,'./api/demo/booking');
 assert.equal(workflow.opts.method,'POST');
 assert.equal(workflow.opts.body,undefined);
 assert.match(f.get('browserResult').textContent,/Sandbox appointment recorded/);
 assert.equal(f.get('kBooked').textContent,1);
 f.get('browserHang').listeners.click();
 assert.equal(f.dialog.open,false);
 assert.equal(f.audio.paused,true);
 assert.equal(f.get('startBrowserCall').focused,true);
});
