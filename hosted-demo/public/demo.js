'use strict';
const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll('[data-demo]')];
const audio=$('agentAudio');
const clipFor={booking:'booking',emergency:'urgent',query:'fees'};
const watched=['Voice','Triage','Action'];
const dialog=$('browserCall');
const callButtons=[...document.querySelectorAll('[data-call-example]')];
const supportedLocales=new Set(['en-IN','hi-IN','kn-IN','ta-IN','te-IN','mr-IN','bn-IN']);
const scenarioNames={booking:'Sandbox booking',emergency:'Practice callback',query:'Fees information'};
let pending=null,callStartedAt=0,callClock=null;
let liveMic=false,resumeTimer=null,promptTimer=null,promptEpoch=0,waitingForFollowup=false,liveResult='';
let speechBusy=false;
function modalText(role,text){if(!dialog.open)return; $('browserSpeaker').textContent=role; $('browserCaption').textContent=text;}
function modalState(text,state='ready'){if(!dialog.open)return; $('browserCallStatus').textContent=text; $('browserAvatar').dataset.state=state;}
function modalNote(text=''){$('browserError').textContent=text;}
function clearConfirmation(){
 pending=null;$('browserConfirmRow').hidden=true;
}
function revealReplay(show){$('replayDemo').hidden=!show;$('browserReplay').hidden=!show;}
function overlayTime(){
 const elapsed=Math.max(0,Math.floor((Date.now()-callStartedAt)/1000));
 $('browserTimer').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
}

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

function status(text,mode='ready'){$('callStatus').textContent=text;$('callStatus').dataset.state=mode;modalState(text,mode);}
function note(text=''){$('inlineError').textContent=text;if(dialog.open)modalNote(text);}
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
 updateLiveControl();
}
function updateLiveControl(){
 $('browserMic').setAttribute('aria-pressed',String(liveMic));
 $('browserMicText').textContent=$('browserMic').disabled?'Mic unavailable':liveMic?'Mute mic':'Unmute mic';
}
function stopPrompt(){
 promptEpoch++;clearTimeout(promptTimer);promptTimer=null;
 if(speechBusy)try{window.speechSynthesis.cancel();}catch{}
 speechBusy=false;
}
function stopLive(){
 liveMic=false;waitingForFollowup=false;liveResult='';
 clearTimeout(resumeTimer);resumeTimer=null;stopPrompt();cancelMic();
}
function scheduleListening(){
 clearTimeout(resumeTimer);
 if(!dialog.open||!liveMic||busy||rec||speechBusy||expectedSrc)return;
 resumeTimer=setTimeout(()=>{
  resumeTimer=null;
  if(dialog.open&&liveMic&&!busy&&!rec&&!speechBusy&&!expectedSrc)beginListen(true);
 },180);
}
function speakPrompt(text){
 if(!dialog.open||!liveMic)return;
 cancelMic();stopPrompt();
 modalText('Voice Agent',text);
 const synth=window.speechSynthesis, Utterance=window.SpeechSynthesisUtterance;
 if(!$('tts').checked||!synth||!Utterance){scheduleListening();return;}
 const stamp=promptEpoch;
 function finish(){
  if(stamp!==promptEpoch)return;
  promptEpoch++;clearTimeout(promptTimer);promptTimer=null;speechBusy=false;scheduleListening();
 }
 try{
  const line=new Utterance(text);line.lang='en-IN';line.rate=.96;
  line.onend=line.onerror=finish;
  speechBusy=true;modalState('Voice agent speaking','speaking');
  promptTimer=setTimeout(()=>{if(stamp===promptEpoch){finish();synth.cancel();}},16000);
  synth.speak(line);
 }catch{finish();}
}
function continueCall(){
 if(!dialog.open||!liveMic||busy||expectedSrc||speechBusy)return;
 if(waitingForFollowup){
  waitingForFollowup=false;
  speakPrompt((liveResult?liveResult+'. ':'')+'What else can I help you with?');
 }else scheduleListening();
}
function clearVoice(){
 replayEpoch++;voice=null;activeCaption=-1;elevenTurn=-1;mediaReady=false;expectedSrc='';
 audio.pause();showIdleVoice();
}
function reset(preserveLive=false){
 revision++; busy=false;if(preserveLive===true){cancelMic();stopPrompt();}else stopLive();
 clearVoice();current=null;
 $('chat').replaceChildren($('callEmpty').content.cloneNode(true));
 $('turnCount').textContent='No turns';
 $('desk').hidden=true;$('desk').open=false;
 revealReplay(false);clearConfirmation();$('browserResult').hidden=true;
 watched.forEach((s,i)=>stage(s,i===0?'Ready':'Standby'));
 buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});
 callButtons.forEach(b=>b.disabled=false);
 note();clearLog();status('Ready · Microphone is off');
 modalText('Reception','Say “book an appointment” or choose a sample below.');
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
  append(cue.text,cue.role);modalText(cue.role,cue.text);
  activeCaption=elevenTurn;
  $('turnCount').textContent=(elevenTurn+1)+' dialogue turns';
  return;
 }
 if(!voice||!callCues[voice])return;
 const cues=callCues[voice];
 let at=0;for(let i=1;i<cues.length;i++)if(cues[i].at<=audio.currentTime)at=i;
 if(at<=activeCaption)return;
 for(let i=activeCaption+1;i<=at;i++)append(cues[i].text,cues[i].voice+' agent');
 modalText(cues[at].voice+' agent',cues[at].text);
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
  note('Recorded dialogue could not play. You can keep speaking or tap Replay dialogue.');
  continueCall();
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
 modalState('Playing scripted agent dialogue','speaking');
 caption();
});
audio.addEventListener('ended',()=>{
 if(!mediaReady||!audio.ended||audio.currentSrc!==expectedSrc)return;
 caption();
 if(elevenTurn>=0&&elevenTurn<2){elevenTurn++;playEleven(replayEpoch);}
 else{
  expectedSrc='';mediaReady=false;
  if(liveMic)continueCall();else modalState('Dialogue finished · Microphone is off');
 }
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
 $('browserResult').textContent=data.result.title+' · '+data.result.detail;
 $('browserResult').hidden=false;
}
async function run(key,button){
 if(busy||!Object.hasOwn(clipFor,key))return;
 const keepLive=dialog.open&&liveMic;
 reset(keepLive);const epoch=revision;busy=true;current=key;
 waitingForFollowup=keepLive;liveResult='';
 if(button)button.setAttribute('aria-pressed','true');
 buttons.forEach(b=>b.disabled=true);callButtons.forEach(b=>b.disabled=true);revealReplay(true);
 status('Running isolated example','working');
 play(key);
 try{
  const response=await fetch('./api/demo/'+key,{method:'POST',cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Example request failed.');
  const data=await response.json();
  if(epoch!==revision)return;
  $('log').replaceChildren();
  for(const event of data.events)log(event);
  desk(data);liveResult=data.result.title;
   if(!$('tts').checked||activeCaption<0)append(data.result.detail,'DantaVaani');
  status('Sandbox example complete');
  if(!audio.paused&&mediaReady)modalState('Playing scripted agent dialogue','speaking');
 }catch{
  if(epoch!==revision)return;
  clearVoice();liveResult='This example is unavailable';current=null;revealReplay(false);status('Example unavailable');note('The server could not complete this example. No clinic was contacted.');
 }finally{
  if(epoch===revision){busy=false;buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});callButtons.forEach(b=>b.disabled=false);continueCall();}
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
$('tts').addEventListener('change',()=>{if(!$('tts').checked){clearVoice();stopPrompt();continueCall();}});
const Speech=window.isSecureContext!==false&&(window.SpeechRecognition||window.webkitSpeechRecognition);
const phraseToScenario=new Map([
 ['i want to book an appointment','booking'],['can i book an appointment','booking'],
 ['id like to book an appointment','booking'],['i d like to book an appointment','booking'],
 ['appointment book karo','booking'],['fees kitni hai','query'],['फीस कितनी है','query'],
 ['book an appointment','booking'],['book a visit','booking'],['mujhe appointment book karna hai','booking'],
 ['अपॉइंटमेंट बुक करें','booking'],['check fees','query'],['what are the fees','query'],
 ['try urgent callback','emergency'],['practice callback','emergency'],['request a callback','emergency']
]);
const confirmPhrases=new Set(['confirm','yes','yes please','run this example','haan','हाँ']);
const cancelPhrases=new Set(['no','cancel','choose another','nahi','नहीं']);
const hangupPhrases=new Set(['end call','hang up','goodbye']);
function normalizeCommand(value){
 return String(value??'').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M} ]+/gu,' ').replace(/\s+/g,' ').trim();
}
function stageScenario(key){
 if(busy||!Object.hasOwn(clipFor,key))return;
 if(!dialog.open){run(key);return;}
 pending=key;$('browserConfirmRow').hidden=false;
 cancelMic();clearVoice();modalNote();
 const prompt=scenarioNames[key]+' selected. Say “confirm” or “choose another.”';
 if(liveMic)speakPrompt(prompt);
 else{modalState('Ready to confirm · Microphone is off');modalText('Voice Agent',prompt+' You can also tap Run this example.');}
}
function confirmScenario(){
 const key=pending;
 if(!key||busy)return;
 clearConfirmation();if(dialog.open)$('browserCallStatus').focus();return run(key);
}
function chooseAnother(){
 clearConfirmation();modalNote();
 if(liveMic)speakPrompt('No problem. What would you like to try instead?');
 else{modalState('Ready · Microphone is off');modalText('Voice Agent','Choose another example.');}
}
function beginListen(inOverlay){
 if(!Speech||busy||inOverlay&&(!dialog.open||!liveMic))return;
 if(rec){if(!inOverlay){cancelMic();status('Ready · Microphone is off');}return;}
 if(!inOverlay)clearVoice();
 note();let recognizer;
 try{recognizer=new Speech();}catch{stopLive();note('Microphone unavailable. Choose an example.');return;}
 rec=recognizer;
 const chosen=$('browserLocale').value;
 recognizer.lang=inOverlay&&supportedLocales.has(chosen)?chosen:'en-IN';
 recognizer.continuous=false;recognizer.interimResults=false;
 recognizer.onresult=event=>{
  if(rec!==recognizer)return;
  const result=event.results?.[event.resultIndex??0];
  if(!result||result.isFinal===false)return;
  // Map in the browser. Never render or transmit caller transcripts.
  const command=normalizeCommand(result[0]?.transcript);
  const scenario=phraseToScenario.get(command);
  cancelMic();
  if(dialog.open&&hangupPhrases.has(command)){closeBrowserCall();return;}
  if(dialog.open&&pending&&confirmPhrases.has(command)){confirmScenario();return;}
  if(dialog.open&&pending&&cancelPhrases.has(command)){chooseAnother();return;}
  if(scenario){stageScenario(scenario);return;}
  if(inOverlay&&liveMic){speakPrompt(pending?'Please say confirm or choose another.':'Try saying book an appointment, check fees, or practice callback.');return;}
  status('No example recognized · Microphone is off');
  note('Say “book an appointment” or “check fees”, or choose an example. Do not share personal details.');
 };
 recognizer.onerror=event=>{
  if(rec!==recognizer)return;
  cancelMic();
  if(inOverlay&&liveMic&&['no-speech','aborted'].includes(event?.error)){scheduleListening();return;}
  stopLive();status('Microphone unavailable');note('Your browser could not use the microphone. Check permissions or choose an example.');
 };
 recognizer.onend=()=>{
  if(rec!==recognizer)return;
  cancelMic();
  if(inOverlay&&liveMic)scheduleListening();else status('No command captured · Microphone is off');
 };
 try{
  recognizer.start();$('mic').classList.add('listening');$('mic').setAttribute('aria-pressed','true');
  $('mic').setAttribute('aria-label','Stop microphone');updateLiveControl();
  status(inOverlay?(pending?'Listening for confirmation':'Listening · your turn'):'Listening for an example command','listening');
 }catch{stopLive();note('Could not start the microphone. Try a sample.');}
}
function toggleLive(){
 if(!dialog.open||!Speech)return;
 if(liveMic){
  stopLive();modalState(expectedSrc?'Playing scripted agent dialogue':'Microphone muted',expectedSrc?'speaking':'ready');return;
 }
 liveMic=true;updateLiveControl();modalNote();
 if(!busy&&!expectedSrc)speakPrompt(pending?'Say confirm or choose another.':'Hi, this is DantaVaani reception. How can I help? Try saying book an appointment or check fees.');
}
function closeBrowserCall(){
 stopLive();clearVoice();clearInterval(callClock);callClock=null;
 if(dialog.open)dialog.close();
}
function startBrowserCall(){
 if(busy||dialog.open)return;
 if(typeof dialog.showModal!=='function'){note('This browser does not support the call screen. Try an example above.');return;}
 reset();dialog.showModal();callStartedAt=Date.now();overlayTime();
 callClock=setInterval(overlayTime,1000);
}
// The text box maps only a fixed phrase to an existing sample. It never sends text.
$('exampleCommandForm')?.addEventListener('submit',event=>{
 event.preventDefault();if(busy)return;
 const input=$('exampleCommand');
 const sample=phraseToScenario.get(normalizeCommand(input.value));
 input.value='';
 if(!sample){note('Try “book an appointment”, “practice callback”, or “check fees”. Use sample commands only.');return;}
 note();stageScenario(sample);
});
$('startBrowserCall').addEventListener('click',startBrowserCall);
$('browserHang').addEventListener('click',closeBrowserCall);
dialog.addEventListener('close',()=>{clearInterval(callClock);callClock=null;reset();$('startBrowserCall').focus();});
$('browserConfirm').addEventListener('click',confirmScenario);
$('browserBack').addEventListener('click',chooseAnother);
callButtons.forEach(b=>b.addEventListener('click',()=>stageScenario(b.dataset.callExample)));
$('browserReplay').addEventListener('click',()=>{if(current){cancelMic();stopPrompt();note();play(current,true);}});
$('mic').disabled=!Speech;
$('browserMic').disabled=!Speech;
$('mic').addEventListener('click',()=>beginListen(false));
$('browserMic').addEventListener('click',toggleLive);
if(!Speech){$('browserMicText').textContent='Mic unavailable';$('micCaption').textContent='Microphone not supported. Choose an example above.';}
else $('micCaption').textContent='Say “book an appointment” or choose an example';
window.addEventListener('pagehide',()=>{clearInterval(callClock);stopLive();clearVoice();});
reset();
