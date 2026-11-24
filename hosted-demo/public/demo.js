'use strict';
const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll('[data-demo]')];
const audio=$('agentAudio');
const clipFor={booking:'booking',emergency:'urgent',query:'fees'};
const watched=['Voice','Triage','Action'];
const names={'Voice Agent':'Voice','Triage Agent':'Triage','Action Agent':'Action','Action Agent ⚠ ESCALATE':'Action','Clinic System':'Clinic'};
let revision=0,busy=false,current=null,voice=null,activeCaption=-1,rec=null,replayEpoch=0;
let elevenClips=null,elevenTurn=-1,mediaReady=false,expectedSrc="";
const clipNames=['voice-agent.mp3','triage-agent.mp3','action-agent.mp3'];
function verifiedManifest(manifest){
 const clips=manifest?.clips;
 return manifest?.provider==='ElevenLabs'&&manifest.synthetic===true&&Array.isArray(clips)&&clips.length===3&&clips.every((clip,i)=>
  clip?.file===clipNames[i]&&clip.role===watched[i]+' Agent'&&typeof clip.text==='string'&&clip.text.length>0&&clip.text.length<=250
 )?clips.map(({role,file,text})=>({role,file,text})):null;
}
fetch('./voice-eleven/demo-voices.json',{cache:'no-store'}).then(response=>response.ok?response.json():null)
 .then(manifest=>{elevenClips=verifiedManifest(manifest);if(!voice)showIdleVoice();}).catch(()=>{});

function status(text,mode='ready'){$('callStatus').textContent=text;$('callStatus').dataset.state=mode;}
function note(text=''){$('inlineError').textContent=text;}
function showIdleVoice(){$('audioProvider').textContent=elevenClips?'Offline audio · ElevenLabs available for booking':'Bundled offline audio';}
function stage(agent,message,state=''){
 const target=$('stage'+agent);target.dataset.state=state;target.lastElementChild.textContent=message;
}
function clearLog(){
 const p=document.createElement('p');p.className='empty';p.textContent='Run a demo to see the server’s hand-offs here.';$('log').replaceChildren(p);
}
function cancelMic(){
 const old=rec;rec=null;
 if(old)try{old.abort();}catch{}
 $('mic').classList.remove('listening');$('mic').setAttribute('aria-pressed','false');$('mic').setAttribute('aria-label','Start example command');
}
function clearVoice(){
 replayEpoch++;voice=null;activeCaption=-1;elevenTurn=-1;mediaReady=false;expectedSrc='';
 audio.pause();showIdleVoice();
}
function reset(){
 revision++; busy=false;cancelMic();clearVoice();current=null;
 $('chat').replaceChildren($('callEmpty').content.cloneNode(true));
 $('turnCount').textContent='No turns';
 $('desk').hidden=true;$('desk').open=false;
 $('replayDemo').hidden=true;
 watched.forEach((s,i)=>stage(s,i===0?'Ready':'Standby'));
 buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});
 note();clearLog();status('Ready for a demo call');
}
function append(text,who){
 $('chat').querySelector('.chat-empty')?.remove();
 const article=document.createElement('div');article.className='bubble agent';
 const sender=document.createElement('div');sender.className='who';sender.textContent=who;
 article.append(sender,document.createTextNode(text));$('chat').append(article);
 $('chat').scrollTop=$('chat').scrollHeight;
}
function caption(){
 if(!mediaReady||audio.currentSrc!==expectedSrc)return;
 if(elevenTurn>=0&&elevenClips){
  if(activeCaption===elevenTurn)return;
  const cue=elevenClips[elevenTurn];
  append(cue.text,cue.role);
  activeCaption=elevenTurn;
  $('turnCount').textContent=(elevenTurn+1)+' dialogue turns';
  return;
 }
 if(!voice||!callCues[voice])return;
 const cues=callCues[voice];
 let at=0;for(let i=1;i<cues.length;i++)if(cues[i].at<=audio.currentTime)at=i;
 if(at<=activeCaption)return;
 for(let i=activeCaption+1;i<=at;i++)append(cues[i].text,cues[i].voice+' agent');
 activeCaption=at;
 $('turnCount').textContent=(at+1)+' dialogue turns';
}
function armAudio(relative,stamp){
 if(stamp!==replayEpoch)return;
 mediaReady=false;
 expectedSrc=new URL(relative,document.baseURI).href;
 const source=expectedSrc;
 try{
  audio.src=source;
  void Promise.resolve(audio.play()).catch(()=>failedPlayback(stamp,source));
 }catch{failedPlayback(stamp,source);}
}
function failedPlayback(stamp,source){
 if(stamp!==replayEpoch||source!==expectedSrc)return;
 mediaReady=false;expectedSrc='';
 if(elevenTurn>=0){
  $('chat').replaceChildren();$('turnCount').textContent='No turns';
  playOffline('booking',stamp);
 }else{
  showIdleVoice();
  note('Audio could not play. Tap Replay dialogue to try again.');
 }
}
function playOffline(key,stamp){
 elevenTurn=-1;activeCaption=-1;voice=clipFor[key];
 $('audioProvider').textContent='Loading offline audio';
 armAudio('./voice/'+voice+'.mp3',stamp);
}
function playEleven(stamp){
 if(stamp!==replayEpoch||elevenTurn<0||!elevenClips)return;
 const cue=elevenClips[elevenTurn];
 armAudio('./voice-eleven/'+cue.file,stamp);
}
function play(key,userClick=false){
 if(!$('tts').checked&&!userClick)return;
 clearVoice();const stamp=replayEpoch;
 if(key==='booking'&&elevenClips){
  elevenTurn=0;voice='booking';$('audioProvider').textContent='Loading booking dialogue';playEleven(stamp);
 }else playOffline(key,stamp);
}
audio.addEventListener('timeupdate',caption);
audio.addEventListener('playing',()=>{
 if(!expectedSrc||audio.currentSrc!==expectedSrc)return;
 mediaReady=true;
 $('audioProvider').textContent=elevenTurn>=0?'ElevenLabs recording':'Bundled offline audio';
 caption();
});
audio.addEventListener('ended',()=>{
 if(!mediaReady||!audio.ended||audio.currentSrc!==expectedSrc)return;
 caption();
 if(elevenTurn>=0&&elevenTurn<2){elevenTurn++;playEleven(replayEpoch);}
});
audio.addEventListener('error',()=>{
 if(expectedSrc&&(!audio.currentSrc||audio.currentSrc===expectedSrc))failedPlayback(replayEpoch,expectedSrc);
});
function log(event){
 const {type,payload:p}=event;
 if(type==='handoff')stage('Voice','Request passed','done');
 if(type==='triage')stage('Triage',p.escalate?'Review requested':'Checked',p.escalate?'review':'done');
 if(type==='tool_call')stage('Action','Running clinic skill','active');
 if(type==='result')stage('Action','Result returned','done');
 const div=document.createElement('div'),heading=document.createElement('div'),body=document.createElement('div');
 div.className='evt t-'+type;heading.className='hd';body.className='sum';
 heading.textContent=(names[event.from]??'Agent')+' → '+(names[event.to]??'Agent')+' · '+type.replace('_',' ');
 body.textContent=p.tool?'Ran '+p.tool.replaceAll('_',' '):p.severity?'Review: '+p.severity:p.intent||p.status||'';
 div.append(heading,body);$('log').append(div);
}
function desk(data){
 $('kBooked').textContent=data.dashboard.bookings;
 $('kAlerts').textContent=data.dashboard.reviews;
 $('kFree').textContent='—';
 $('resultCount').textContent='Current sandbox run';
 $('alerts').textContent=data.result.detail;
 $('appts').replaceChildren();
 $('clinicName').textContent=data.result.title;
 $('desk').hidden=false;$('desk').open=true;
}
async function run(key,button){
 if(busy||!Object.hasOwn(clipFor,key))return;
 reset();const epoch=revision;busy=true;current=key;
 if(button)button.setAttribute('aria-pressed','true');
 buttons.forEach(b=>b.disabled=true);$('replayDemo').hidden=false;
 status('Running isolated example','working');
 play(key);
 try{
  const response=await fetch('./api/demo/'+key,{method:'POST',cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Example request failed.');
  const data=await response.json();
  if(epoch!==revision)return;
  $('log').replaceChildren();
  for(const event of data.events)log(event);
  desk(data);
  if(!$('tts').checked||activeCaption<0)append(data.result.detail,'DantaVaani');
  status('Sandbox example complete');
 }catch{
  if(epoch!==revision)return;
  clearVoice();current=null;$('replayDemo').hidden=true;status('Example unavailable');note('The server could not complete this example. No clinic was contacted.');
 }finally{
  if(epoch===revision){busy=false;buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});}
 }
}
buttons.forEach(b=>b.addEventListener('click',()=>run(b.dataset.demo,b)));
$('clearLog').addEventListener('click',clearLog);
$('reset').addEventListener('click',reset);
$('newCall').addEventListener('click',reset);
$('replayDemo').addEventListener('click',()=>{
 if(!current)return;
 $('chat').replaceChildren();$('turnCount').textContent='No turns';note();play(current,true);
});
$('tts').addEventListener('change',()=>{if(!$('tts').checked)clearVoice();});
const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
$('mic').disabled=!Speech;
$('mic').addEventListener('click',()=>{
 if(!Speech||busy)return;
 if(rec){cancelMic();status('Ready for a demo call');return;}
 clearVoice();note();
 let recognizer;
 try{recognizer=new Speech();}catch{note('Microphone unavailable. Choose an example above.');return;}
 rec=recognizer;
 recognizer.lang='en-IN';recognizer.continuous=false;recognizer.interimResults=false;
 recognizer.onresult=event=>{
  if(rec!==recognizer)return;
  const text=String(event.results?.[event.resultIndex]?.[0]?.transcript??'').toLowerCase().trim().replace(/[.!?]$/,'');
  const key={
   'book an appointment':'booking','mujhe appointment book karna hai':'booking',
   'check fees':'query','try urgent callback':'emergency'
  }[text];
  cancelMic();
  if(typeof key==='string')run(key);
  else{status('Try an example command');note('Say “book an appointment”, “check fees”, or “try urgent callback”. Do not share personal details.');}
 };
 recognizer.onerror=()=>{if(rec===recognizer){cancelMic();status('Microphone unavailable');note('Use one of the example call buttons above.');}};
 recognizer.onend=()=>{if(rec===recognizer){cancelMic();status('Ready for a demo call');}};
 try{
  recognizer.start();$('mic').classList.add('listening');$('mic').setAttribute('aria-pressed','true');
  $('mic').setAttribute('aria-label','Stop microphone');status('Listening','listening');
 }catch{cancelMic();note('Could not start the microphone. Try a sample.');}
});
$('micCaption').textContent=Speech?'Say “book an appointment” or choose an example':'Microphone not supported. Choose an example above.';
window.addEventListener('pagehide',()=>{cancelMic();clearVoice();});
reset();
