'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {runExample}=require('./engine.cjs');
function fixture(provider,withSpeech=false){
 const elements=new Map(),playCalls=[],requests=[],recognitions=[],spoken=[],timers=new Map();
 let timerSeq=0;
 const synth=withSpeech?{speak(line){spoken.push(line);},cancel(){}}:undefined;
 const advance=()=>{for(const [id,t] of [...timers])if(t.ms<1000&&timers.delete(id))t.fn();};
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
  at(type,url,time=0){this.currentSrc=url;this.currentTime=time;this.ended=type==='ended';if(this.ended)this.paused=true;this.listeners[type]();}
 });
 const preview=Object.assign(get('voicePreview'),{
  pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}
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
  document:doc,window:{addEventListener(){},SpeechRecognition,isSecureContext:true,speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text;} }},URL,setInterval:()=>1,clearInterval:()=>{},setTimeout:(fn,ms)=>{timers.set(++timerSeq,{fn,ms});return timerSeq;},clearTimeout:id=>timers.delete(id),
  fetch:async(path,opts)=>{
   requests.push({path,opts});
   const val=path.startsWith('./api/demo/')?await runExample(path.split('/').at(-1)):manifest;
   return {ok:true,json:async()=>val};
  }
 });
 for(const name of ['voice-cues.js','demo.js'])vm.runInContext(fs.readFileSync('public/'+name,'utf8'),ctx,{filename:name});
 return {get,audio,buttons,choices,requests,recognitions,dialog,playCalls,advance,spoken,roles:()=>get('chat').kids.map(x=>x.kids[0]?.textContent).filter(Boolean)};
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
 assert.deepEqual(f.roles().filter(role=>role!=='DantaVaani'&&role!=='You'),['Voice Agent','Triage Agent','Action Agent']);
 assert.equal(f.playCalls.length,3);
});
test('hands-free call greets, confirms by voice, waits for dialogue, then listens again',async()=>{
 const f=fixture(false,true);
 f.get('startBrowserCall').listeners.click();
 assert.equal(f.dialog.open,true);
 assert.equal(f.recognitions.length,0);
 assert.equal(f.get('browserMic').attrs['aria-pressed'],'false');
 f.get('browserLocale').value='en-IN';
 f.get('browserMic').listeners.click();
 assert.match(f.spoken[0].text,/DantaVaani reception/);
 f.advance();assert.equal(f.recognitions.length,0);
 f.spoken[0].onend();f.advance();assert.equal(f.recognitions[0].lang,'en-IN');
 const privateWords='my private example identifier';
 f.recognitions[0].hear(privateWords);
 assert.ok(!JSON.stringify(f.requests).includes(privateWords));
 assert.ok(!JSON.stringify(f.spoken).includes(privateWords));
 f.spoken.at(-1).onend();f.advance();
 f.recognitions[1].hear('I want to book an appointment');
 assert.match(f.get('browserCaption').textContent,/selected/);
 assert.equal(f.get('browserConfirmRow').hidden,false);
 assert.ok(!f.requests.some(r=>r.path.includes('/api/demo/')));
 f.advance();assert.equal(f.recognitions.length,2);
 f.spoken.at(-1).onend();f.advance();
 f.recognitions[2].hear('confirm');
 for(let i=0;i<30&&f.get('browserResult').hidden;i++)await new Promise(r=>setTimeout(r,10));
 const workflow=f.requests.find(r=>r.path.includes('/api/demo/'));
 assert.equal(workflow.path,'./api/demo/booking');
 assert.equal(workflow.opts.method,'POST');
 assert.equal(workflow.opts.body,undefined);
 assert.match(f.get('browserResult').textContent,/Sandbox appointment recorded/);
 const src=f.playCalls.at(-1);
 f.audio.at('playing',src);
 f.advance();assert.equal(f.recognitions.length,3);
 f.audio.at('ended',src,99);
 assert.match(f.spoken.at(-1).text,/What else/);
 f.spoken.at(-1).onend();f.advance();
 f.recognitions[3].hear('check fees');
 f.spoken.at(-1).onend();f.advance();
 f.recognitions[4].hear('choose another');
 f.spoken.at(-1).onend();f.advance();
 f.recognitions[5].hear('end call');
 f.advance();
 assert.equal(f.recognitions.length,6);
 assert.equal(f.dialog.open,false);
 assert.equal(f.audio.paused,true);
 assert.equal(f.get('startBrowserCall').focused,true);
});
test('no speech restarts listening; mute and permission errors prevent restart',()=>{
 const f=fixture(false);
 f.get('startBrowserCall').listeners.click();
 f.get('browserMic').listeners.click();f.advance();
 f.recognitions[0].onerror({error:'no-speech'});f.advance();
 assert.equal(f.recognitions.length,2);
 f.get('browserMic').listeners.click();
 f.recognitions[1].onend();f.advance();
 assert.equal(f.recognitions.length,2);
 assert.equal(f.get('browserMic').attrs['aria-pressed'],'false');
 f.get('browserMic').listeners.click();f.advance();
 f.recognitions[2].onerror({error:'not-allowed'});f.advance();
 assert.equal(f.recognitions.length,3);
 assert.match(f.get('browserError').textContent,/Check permissions/);
});

test('typed booking accepts natural variants without exposing text; Test voice works even when speech is off',async()=>{
 const f=fixture(false);
 const field=f.get('exampleCommand');
 const submit=()=>f.get('exampleCommandForm').listeners.submit({preventDefault(){}});
 field.value='Could you help me book a dental appointment?';
 await submit();
 assert.equal(field.value,'');
 assert.ok(f.roles().includes('You'));
 assert.equal(f.requests.filter(r=>r.path==='./api/demo/booking').length,1);
 assert.equal(f.requests.at(-1).opts.body,undefined);
 f.get('tts').checked=false;f.get('tts').listeners.change();
 assert.equal(f.audio.paused,true);
 f.get('testVoice').listeners.click();
 assert.equal(f.get('tts').checked,true);
 assert.equal(f.get('voicePreview').paused,false);
 assert.equal(f.requests.filter(r=>r.path.startsWith('./api')).length,1);
 field.value='my personal details';
 await submit();
 assert.match(f.get('inlineError').textContent,/understands booking/);
 assert.ok(!JSON.stringify(f.requests).includes('my personal details'));
});
test('type and confirm a command from inside the call screen',async()=>{
 const f=fixture(false);
 f.get('startBrowserCall').listeners.click();
 const field=f.get('browserCommand');
 const submit=()=>f.get('browserCommandForm').listeners.submit({preventDefault(){}});
 field.value='What is the consultation fee?';await submit();
 assert.match(f.get('browserCaption').textContent,/Fees information selected/);
 assert.ok(!f.requests.some(x=>x.path.startsWith('./api')));
 field.value='Confirm';await submit();
 for(let i=0;i<30&&f.get('browserResult').hidden;i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(f.requests.at(-1).path,'./api/demo/query');
 assert.equal(f.get('browserResult').hidden,false);
});
