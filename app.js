'use strict';
const samples=Object.freeze({
 booking:Object.freeze({
  steps:['Recognized a request to book an appointment.','Identified scheduling as the next step. No health details were requested.','No clinic calendar is connected. No availability was checked.'],
  title:'Booking not available',
  detail:'No clinic is connected. No visit was scheduled.',
  spoken:'I recognized a booking request. No clinic calendar is connected and no visit was scheduled.'
 }),
 urgent:Object.freeze({
  steps:['Recognized a request for a callback.','Identified a request for a human response. No symptoms were assessed.','No clinic is connected. No request was saved or sent.'],
  title:'Callback not sent',
  detail:'No clinic is connected. This screen does not assess symptoms or contact a clinician.',
  spoken:'I recognized a callback request. No clinic is connected and no one was contacted.'
 }),
 fees:Object.freeze({
  steps:['Recognized a request to check fees.','Identified a pricing question. No clinical review was performed.','No clinic price list is connected. No price was displayed.'],
  title:'Fees not available',
  detail:'No clinic is connected, so there is no verified price to show.',
  spoken:'I recognized a request for fees. No clinic price list is connected.'
 })
});
function commandIntent(value){
 const words=String(value??'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 // No retention: this text exists only for the duration of command matching.
 const candidates=[];
 if(/^(?:(?:please )?(?:book|schedule)(?: me)? (?:an? )?(?:appointment|visit)(?: please)?|mujhe appointment book karna hai|appointment book karna hai|बुक अपॉइंटमेंट)$/.test(words))candidates.push('booking');
 if(/^(?:(?:please )?(?:check|tell me the) (?:fees|prices)(?: please)?|how much is a cleaning|check fees|fees check karo)$/.test(words))candidates.push('fees');
 if(/^(?:urgent callback|try (?:the )?urgent callback|try (?:the )?callback sample)$/.test(words))candidates.push('urgent');
 return candidates.length===1?candidates[0]:null;
}
const $=id=>document.getElementById(id);
const mic=$('mic'), trace=$('trace'), result=$('result'), disclosure=$('callError');
const rows=[...document.querySelectorAll('[data-stage]')], buttons=[...document.querySelectorAll('[data-sample]')];
const Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
const micAvailable=typeof Recognizer==='function'&&window.isSecureContext!==false;
const speechAvailable=!!(window.speechSynthesis&&window.SpeechSynthesisUtterance);
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let active=null, run=0, playing=false, lastButton=null;
const messages=['Waiting for a sample request.','Waiting for the hand-off.','Waiting for status.'];
function status(state,text){$('connection').dataset.state=state;$('connectionText').textContent=text;}
function setAlert(text=''){disclosure.textContent=text;}
function configure(){
 mic.disabled=!micAvailable||playing;
 mic.setAttribute('aria-pressed',String(Boolean(active)));
 mic.setAttribute('aria-label',active?'Stop microphone':'Start microphone');
 if(!micAvailable)$('micCaption').textContent='Mic unavailable · Try a sample';
 else if(playing)$('micCaption').textContent='Sample in progress';
 else $('micCaption').textContent=active?'Listening · Tap to stop':'Tap to speak';
}
function stopMic(listen){
 if(active!==listen)return;
 active=null;
 try{listen.abort();}catch{}
 configure();
}
function startMic(){
 if(!micAvailable||playing)return;
 if(active){stopMic(active);status('ready','Ready');return;}
 setAlert();
 if(speechAvailable)window.speechSynthesis.cancel();
 let rec;
 try{rec=new Recognizer();}catch{setAlert('Could not open the microphone. You can still try a sample.');return;}
 active=rec;configure();
 rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;rec.lang='en-IN';
 rec.onstart=()=>{if(active===rec)status('listening','Listening');};
 rec.onresult=event=>{
  if(active!==rec)return;
  const res=event.results?.[event.resultIndex??0];
  if(res?.isFinal===false)return;
  const intent=commandIntent(res?.[0]?.transcript);
  stopMic(rec);
  if(!intent){status('error','Try a sample');setAlert('Try saying “book an appointment” or “check fees” exactly, or choose a sample below. Do not share personal details.');return;}
  play(intent);
 };
 rec.onerror=event=>{
  if(active!==rec)return;
  stopMic(rec);status('error','Mic unavailable');
  setAlert(event.error==='not-allowed'?'Microphone access was not allowed. Check browser permissions or use a sample below.':'Your browser’s speech service could not hear the command. Use a sample below.');
 };
 rec.onend=()=>{
  if(active!==rec)return;
  active=null;configure();status('ready','Ready');
  setAlert('No command was captured. You can try again or pick a sample.');
 };
 status('working','Opening microphone');
 try{rec.start();}catch{stopMic(rec);status('error','Mic unavailable');setAlert('Could not start recognition. Try a sample below.');}
}
function announce(text){
 if(!speechAvailable||!$('speak').checked)return;
 try{
  window.speechSynthesis.cancel();
  const speech=new SpeechSynthesisUtterance(text);speech.lang='en-IN';speech.rate=.93;
  speech.onerror=event=>{if(!['interrupted','canceled'].includes(event.error))setAlert('Audio playback was unavailable. The reply is written below.');};
  window.speechSynthesis.speak(speech);
 }catch{setAlert('Audio playback was unavailable. The reply is written below.');}
}
function resetRows(){
 rows.forEach((row,i)=>{row.dataset.state='';row.querySelector('div span').textContent=messages[i];});
 result.hidden=true;
}
async function play(key,button=null){
 if(!Object.hasOwn(samples,key))return;
 const item=samples[key]; const id=++run;
 if(active)stopMic(active);
 if(speechAvailable)window.speechSynthesis.cancel();
 setAlert();lastButton=button||mic;playing=true;configure();
 buttons.forEach(b=>b.disabled=true);
 trace.hidden=false;resetRows();status('working','Checking request');
 for(let i=0;i<item.steps.length;i++){
  if(!reducedMotion)await new Promise(done=>setTimeout(done,260));
  if(id!==run)return;
  rows[i].dataset.state='complete';rows[i].querySelector('div span').textContent=item.steps[i];
 }
 $('resultTitle').textContent=item.title;$('resultText').textContent=item.detail;result.hidden=false;
 status('ready','No clinic connected');playing=false;configure();buttons.forEach(b=>b.disabled=false);
 announce(item.spoken);
}
function reset(){
 ++run;if(active)stopMic(active);if(speechAvailable)window.speechSynthesis.cancel();
 playing=false;configure();buttons.forEach(b=>b.disabled=false);setAlert();resetRows();trace.hidden=true;status('ready','Ready');
 if(lastButton&&!lastButton.disabled)lastButton.focus();
 lastButton=null;
}
mic.addEventListener('click',startMic);
buttons.forEach(b=>b.addEventListener('click',()=>play(b.dataset.sample,b)));
$('reset').addEventListener('click',reset);
if(!speechAvailable){$('speak').disabled=true;$('speak').title='Spoken playback unavailable in this browser';}
$('speak').addEventListener('change',()=>{if(speechAvailable&&!$('speak').checked)window.speechSynthesis.cancel();});
window.addEventListener('pagehide',()=>{++run;if(active)stopMic(active);if(speechAvailable)window.speechSynthesis.cancel();});
configure();
