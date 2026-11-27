'use strict';
const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll('[data-demo]')];
const audio=$('agentAudio');
const preview=$('voicePreview');
const clipFor={booking:'booking',emergency:'urgent',query:'fees'};
const watched=['Voice','Triage','Action'];
const dialog=$('browserCall');
const callButtons=[...document.querySelectorAll('[data-call-example]')];
const supportedLocales=new Set(['en-IN','hi-IN','kn-IN','ta-IN','te-IN','mr-IN','bn-IN']);
const scenarioNames={booking:'Sandbox booking',emergency:'Practice callback',query:'Fees information'};
let pending=null,callStartedAt=0,callClock=null,confirmationMisses=0,confirmationPaused=false;
let liveMic=false,resumeTimer=null,promptTimer=null,promptEpoch=0,waitingForFollowup=false,liveResult='';
let speechBusy=false;
let caller=null, firstPart='', callStep='welcome', missedTurns=0, nameDeclined=false;
const welcomeLine='Hi, thanks for calling DantaVaani. Who am I speaking with?';
function forgetCaller(){caller=null;firstPart='';callStep='welcome';missedTurns=0;nameDeclined=false;}
function modalText(role,text){if(!dialog.open)return; $('browserSpeaker').textContent=role; $('browserCaption').textContent=text;}
function modalState(text,state='ready'){if(!dialog.open)return; $('browserCallStatus').textContent=text; $('browserAvatar').dataset.state=state;}
function modalNote(text=''){$('browserError').textContent=text;}
function clearConfirmation(){
 pending=null;confirmationMisses=0;confirmationPaused=false;$('browserConfirmRow').hidden=true;
}
function revealReplay(show){$('replayDemo').hidden=!show;$('browserReplay').hidden=!show;}
function overlayTime(){
 const elapsed=Math.max(0,Math.floor((Date.now()-callStartedAt)/1000));
 $('browserTimer').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
}

const names={'Voice Agent':'Voice','Triage Agent':'Triage','Action Agent':'Action','Action Agent ⚠ ESCALATE':'Action','Clinic System':'Clinic'};
let revision=0,busy=false,current=null,voice=null,activeCaption=-1,rec=null,replayEpoch=0;
let voiceSets={},elevenClips=null,elevenKey=null,elevenTurn=-1,mediaReady=false,expectedSrc="";
const clipNames=['voice-agent.mp3','triage-agent.mp3','action-agent.mp3'];
function verifiedManifest(manifest){
 if(manifest?.provider!=='ElevenLabs'||manifest.synthetic!==true)return {};
 const checked={};
 for(const key of Object.keys(clipFor)){
  const legacy=key==='booking'&&!manifest.scenarios;
  const clips=legacy?manifest.clips:manifest.scenarios?.[key];
  if(Array.isArray(clips)&&clips.length===3&&clips.every((clip,i)=>
   clip?.file===(legacy?'':key+'-')+clipNames[i]&&clip.role===watched[i]+' Agent'&&typeof clip.text==='string'&&clip.text.length>0&&clip.text.length<=250
  ))checked[key]=clips.map(({role,file,text})=>({role,file,text}));
 }
 return checked;
}
fetch('./voice-eleven/demo-voices.json',{cache:'no-store'}).then(response=>response.ok?response.json():null)
 .then(manifest=>{voiceSets=verifiedManifest(manifest);if(!voice)showIdleVoice();}).catch(()=>{});

function status(text,mode='ready'){$('callStatus').textContent=text;$('callStatus').dataset.state=mode;modalState(text,mode);}
function note(text=''){$('inlineError').textContent=text;if(dialog.open)modalNote(text);}
function showIdleVoice(){$('audioProvider').textContent=Object.keys(voiceSets).length?'ElevenLabs demo recordings available':'Bundled offline audio';}
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
 if(!dialog.open||!liveMic||busy||rec||speechBusy||expectedSrc||confirmationPaused)return;
 resumeTimer=setTimeout(()=>{
  resumeTimer=null;
  if(dialog.open&&liveMic&&!busy&&!rec&&!speechBusy&&!expectedSrc&&!confirmationPaused)beginListen(true);
 },180);
}
function speakPrompt(text,withoutName=text){
 if(!dialog.open)return;
 modalText('Voice Agent',text);
 if(!liveMic)return;
 cancelMic();stopPrompt();
 const synth=window.speechSynthesis, Utterance=window.SpeechSynthesisUtterance;
 if(!$('tts').checked||!synth||!Utterance){scheduleListening();return;}
 const stamp=promptEpoch;
 function finish(){
  if(stamp!==promptEpoch)return;
  promptEpoch++;clearTimeout(promptTimer);promptTimer=null;speechBusy=false;scheduleListening();
 }
 try{
  const local=(synth.getVoices?.()??[]).filter(v=>v.localService&&/^en(?:-|_)/i.test(v.lang));
  const rank=v=> (/premium|enhanced|natural/i.test(v.name)?12:0)+(/^en[-_]in$/i.test(v.lang)?8:0)+(/samantha|rishi|karen|moira/i.test(v.name)?2:0);
  const selected=local.sort((a,b)=>rank(b)-rank(a))[0];
  const line=new Utterance(selected?text:withoutName);
  if(selected)line.voice=selected;
  line.lang=selected?.lang||'en-IN';line.rate=1;
  // If only remote voices are offered, never include the caller's name in speech output.
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
  speakPrompt(liveResult||'What else can I help you with?');
 }else scheduleListening();
}
function stopPreview(){if(preview&&!preview.paused){preview.pause();preview.currentTime=0;}}
function clearVoice(){
 stopPreview();replayEpoch++;voice=null;elevenClips=null;elevenKey=null;activeCaption=-1;elevenTurn=-1;mediaReady=false;expectedSrc='';
 audio.pause();showIdleVoice();
}
function reset(preserveLive=false){
 revision++; busy=false;if(preserveLive===true){cancelMic();stopPrompt();}else{stopLive();forgetCaller();}
 clearVoice();current=null;
 $('chat').replaceChildren($('callEmpty').content.cloneNode(true));
 $('turnCount').textContent='No turns';
 $('desk').hidden=true;$('desk').open=false;
 revealReplay(false);clearConfirmation();$('browserResult').hidden=true;
 watched.forEach((s,i)=>stage(s,i===0?'Ready':'Standby'));
 buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});
 callButtons.forEach(b=>b.disabled=false);
 note();clearLog();status('Ready · Microphone is off');
 modalText('Reception',welcomeLine);
}
function append(text,who,caller=false){
 $('chat').querySelector('.chat-empty')?.remove();
 const article=document.createElement('div');article.className=caller?'bubble caller':'bubble agent';
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
  playOffline(elevenKey,stamp);
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
 if(voiceSets[key]){
  elevenClips=voiceSets[key];elevenKey=key;elevenTurn=0;voice=clipFor[key];$('audioProvider').textContent='Loading agent dialogue';playEleven(stamp);
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
const spokenOutcome={
 booking:'You’re all set. I’ve added your visit to the demo calendar. Anything else I can help with?',
 emergency:'I’ve logged a practice callback request. No one was contacted. Is there anything else I can help with?',
 query:'I don’t have a verified clinic price to quote. Is there anything else I can help with?'
};
async function run(key,button,conversation=false){
 if(busy||!Object.hasOwn(clipFor,key))return;
 const keepLive=dialog.open&&liveMic;
 reset(keepLive||conversation);const epoch=revision;busy=true;current=key;if(conversation)callStep='help';
 waitingForFollowup=keepLive;liveResult='';
 append(scenarioNames[key],'You',true);
 if(button)button.setAttribute('aria-pressed','true');
 buttons.forEach(b=>b.disabled=true);callButtons.forEach(b=>b.disabled=true);revealReplay(!conversation);
 status(conversation?'Checking the practice calendar':'Running isolated example','working');
 if(!conversation)play(key);
 try{
  const response=await fetch('./api/demo/'+key,{method:'POST',cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Example request failed.');
  const data=await response.json();
  if(epoch!==revision)return;
  $('log').replaceChildren();
  for(const event of data.events)log(event);
  desk(data);liveResult=conversation?spokenOutcome[key]:data.result.title;
  if(conversation&&!keepLive)modalText('Voice Agent',liveResult);
   if(!$('tts').checked||activeCaption<0)append(data.result.detail,'DantaVaani');
  status($('tts').checked?'Sandbox example complete':'Sandbox example complete · Speech off');
  if(!audio.paused&&mediaReady)modalState('Playing scripted agent dialogue','speaking');
 }catch{
  if(epoch!==revision)return;
  clearVoice();liveResult='I couldn’t finish that practice request. Would you like to try again?';if(conversation&&!keepLive)modalText('Voice Agent',liveResult);current=null;revealReplay(false);status('Example unavailable');note('The server could not complete this example. No clinic was contacted.');
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
$('tts').addEventListener('change',()=>{
 if(!$('tts').checked){
  clearVoice();stopPrompt();continueCall();$('audioProvider').textContent='Speech off';
 }else{showIdleVoice();if(current&&!busy&&!dialog.open)play(current,true);}
});
$('testVoice').addEventListener('click',()=>{
 if(dialog.open||busy)return;
 cancelMic();clearVoice();note();$('tts').checked=true;
 $('audioProvider').textContent='Playing voice preview';
 const failed=()=>{showIdleVoice();note('The browser blocked audio playback. Check the tab’s sound settings and tap Test voice again.');};
 try{preview.currentTime=0;Promise.resolve(preview.play()).catch(failed);}catch{failed();}
});
preview.addEventListener('ended',()=>{
 if(!expectedSrc)showIdleVoice();
});
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
function confirmationAnswer(command){
 if(cancelPhrases.has(command)||/^(?:not now|no thanks|never mind|no (?:don t|do not) (?:book|go ahead)|नहीं धन्यवाद|వద్దు)$/u.test(command))return 'no';
 const words=command.replace(/^(?:okay|ok|yes|yeah|yep|yup) (?=.)/,'').replace(/ please$/,'');
 if(confirmPhrases.has(command)||/^(?:sure|go ahead|please do|that works|okay|ok|yeah|yep|yup|please go ahead|please (?:book|schedule) (?:it|the appointment|the visit)|(?:book|schedule) (?:it|the appointment|the visit)|kar do|haan kar do|हाँ कर दो|అవును)$/u.test(words))return 'yes';
 return null;
}
const hangupPhrases=new Set(['end call','hang up','goodbye','bye','that s all']);
const skipNamePhrases=new Set(['skip','skip name','skip my name','continue','no name','prefer not to say']);
function conversationIntent(command){
 if(/\b(?:don t|do not|not interested|cancel (?:my|the))\b/.test(command))return null;
 const exact=exampleFor(command);
 if(exact)return exact;
 if(/\b(?:call me back|callback|call back)\b/.test(command))return 'emergency';
 if(/\b(?:fees?|prices?|cost|charges?|how much)\b|फीस|कितना|ధర/u.test(command))return 'query';
 if(/\b(?:appointment|checkup|check up|book a slot|see (?:a|the|my) dentist|schedule (?:me )?(?:in|a visit))\b|अपॉइंटमेंट|अपॉइंटमेन्ट|అపాయింట్‌?మెంట్|अपॉइंटमें/u.test(command))return 'booking';
 return null;
}
function readName(raw,maxParts){
 const cleaned=String(raw??'').normalize('NFC').trim()
  .replace(/^(?:hi[, ]+|hello[, ]+)?(?:my (?:first |last |full )?name is |this is |i am |i['’]m |mera naam |मेरा नाम )/iu,'')
  .replace(/[.!?,]+$/u,'').trim().replace(/\s+/g,' ');
 const words=cleaned.split(' ');
 if(!cleaned||cleaned.length>64||words.length>maxParts||words.some(w=>!/^\p{L}[\p{L}\p{M}]*(?:[-'’]\p{L}[\p{L}\p{M}]*)*$/u.test(w)))return null;
 if(/\b(?:yes|hello|hi|hey|sorry|okay|the|and|no|skip|help|unknown|need|want|dont|don t|cannot|can t|name)\b/i.test(normalizeCommand(cleaned))||conversationIntent(normalizeCommand(cleaned)))return null;
 return words.map(w=>w[0].toLocaleUpperCase()+w.slice(1));
}
function askCall(text,withoutName=text){modalNote();speakPrompt(text,withoutName);}
function namedBooking(){
 callStep='confirm';pending='booking';$('browserConfirmRow').hidden=false;
 const general='Shall I go ahead and book the visit?';
 askCall(caller?'Thanks, '+caller.first+'. '+general:general,general);
}
function acceptCaller(first,last){
 caller={first,last};firstPart='';missedTurns=0;
 if(pending==='booking'){namedBooking();return;}
 callStep='help';
 askCall('Hi, '+first+'. How can I help today?','Thanks. How can I help today?');
}
function hearCall(raw,alternatives=[]){
 const command=normalizeCommand(raw);
 if(!command){scheduleListening();return;}
 if(hangupPhrases.has(command)){closeBrowserCall();return;}
 const intent=conversationIntent(command)||alternatives.map(x=>conversationIntent(normalizeCommand(x))).find(Boolean);
 if(intent&&callStep!=='confirm'){missedTurns=0;stageScenario(intent);return;}
 if(callStep==='welcome'||callStep==='last'){
  if(skipNamePhrases.has(command)){nameDeclined=true;firstPart='';if(pending==='booking')namedBooking();else{callStep='help';askCall('Of course. How can I help today?');}return;}
  const name=readName(raw,callStep==='last'?3:4);
  if(name){
   if(callStep==='last'){acceptCaller(firstPart,name.join(' '));return;}
   if(name.length>1){acceptCaller(name[0],name.slice(1).join(' '));return;}
   firstPart=name[0];callStep='last';askCall('And your last name? You can also say skip.');return;
  }
  if(callStep==='last'){askCall('Sorry, I missed your last name. You can type it or say skip.');return;}
  if(/^(?:hi|hey|hello|namaste)$/.test(command)){askCall(welcomeLine);return;}
  askCall('Sorry, I didn’t quite catch your name. You can type it or say skip.');return;
 }
 if(callStep==='confirm'){
  const decision=confirmationAnswer(command);
  const heard=alternatives.map(x=>confirmationAnswer(normalizeCommand(x))).filter(Boolean);
  // Never commit when the recognizer supplied a conflicting answer.
  if(decision==='no'){chooseAnother();return;}
  if(decision==='yes'&&!heard.includes('no')){confirmScenario();return;}
  if(intent&&intent!==pending&&!decision){stageScenario(intent);return;}
  if(++confirmationMisses===1){
   askCall('Sorry, I missed that. Should I go ahead, or leave it for now?');
  }else{
   confirmationPaused=true;
   askCall('I’m having trouble hearing you. Use the button below to go ahead or go back.');
   modalNote('Listening paused. You can also type your answer.');
  }
  return;
 }
 if(/^(?:hi|hey|hello|namaste)$/.test(command)){askCall('Hi. How can I help today?');return;}
 if(/^thank(?:s| you)(?: so much)?$/.test(command)){askCall('You’re welcome. Anything else I can help with?');return;}
 missedTurns++;
 askCall(missedTurns===1?'Sorry, I missed that. What can I help you with?':'I’m having trouble hearing you. You can type your request below.');
}
function exampleFor(command){
 const direct=phraseToScenario.get(command);
 if(direct)return direct;
 if(/^(?:(?:hi|hello|hey) )?(?:(?:can|could|may) (?:i|you) |i (?:want|need|would like) to |please )?(?:(?:help me )?book|schedule|make) (?:me )?(?:(?:a|an|my|the) )?(?:dental |dentist )?(?:appointment|visit|checkup|check up)(?: please)?$/.test(command))return 'booking';
 if(/^(?:(?:can|could) you (?:tell|show) me |(?:what|how much) (?:are|is) |please )?(?:the )?(?:(?:dental |clinic |consultation |appointment )?(?:fee|fees|cost|price))(?: please)?$/.test(command))return 'query';
 return null;
}
function normalizeCommand(value){
 return String(value??'').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M} ]+/gu,' ').replace(/\s+/g,' ').trim();
}
function stageScenario(key){
 if(busy||!Object.hasOwn(clipFor,key))return;
 if(!dialog.open)return run(key);
 pending=key;confirmationMisses=0;confirmationPaused=false;
 cancelMic();clearVoice();modalNote();
 if(key==='booking'){
  if(caller||nameDeclined){namedBooking();return;}
  callStep='welcome';firstPart='';$('browserConfirmRow').hidden=true;
  askCall('Of course, I can help book a practice visit. What’s your first and last name? You can say skip.');
  return;
 }
 callStep='confirm';$('browserConfirmRow').hidden=false;
 askCall(key==='query'?'You’re asking about fees. Shall I check what information is available?':'Would you like me to log a practice callback request?');
}
function confirmScenario(){
 const key=pending;
 if(!key||busy||callStep!=='confirm')return;
 clearConfirmation();if(dialog.open)$('browserCallStatus').focus();return run(key,null,true);
}
function chooseAnother(){
 clearConfirmation();callStep='help';firstPart='';modalNote();
 askCall('No problem. What else can I help you with?');
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
 recognizer.continuous=false;recognizer.interimResults=false;recognizer.maxAlternatives=3;
 recognizer.onresult=event=>{
  if(rec!==recognizer)return;
  const result=event.results?.[event.resultIndex??0];
  if(!result||result.isFinal===false)return;
  const raw=result[0]?.transcript;
  const alternatives=Array.from(result).slice(1).map(x=>x.transcript);
  cancelMic();
  if(inOverlay&&dialog.open){hearCall(raw,alternatives);return;}
  const scenario=conversationIntent(normalizeCommand(raw));
  if(scenario){stageScenario(scenario);return;}
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
 liveMic=true;confirmationPaused=false;confirmationMisses=0;updateLiveControl();modalNote();
 if(!busy&&!expectedSrc){
  if(callStep==='last')askCall('And your last name? You can also say skip.');
  else if(callStep==='confirm')askCall('Shall I go ahead with the practice request?');
  else if(callStep==='help')askCall('How can I help today?');
  else askCall(pending==='booking'?'What’s your first and last name? You can say skip.':welcomeLine);
 }
}
function closeBrowserCall(){
 stopLive();clearVoice();clearInterval(callClock);callClock=null;
 if(dialog.open)dialog.close();
}
function startBrowserCall(){
 if(busy||dialog.open)return;
 if(typeof dialog.showModal!=='function'){note('This browser does not support the call screen. Try an example above.');return;}
 reset();dialog.showModal();modalText('Voice Agent',welcomeLine);callStartedAt=Date.now();overlayTime();
 callClock=setInterval(overlayTime,1000);
}
// Both inputs select only reviewed examples. Caller text stays out of chat history and API payloads.
function bindCommand(formId,inputId){
 $(formId)?.addEventListener('submit',event=>{
  event.preventDefault();if(busy)return;
  const input=$(inputId);
  const raw=input.value;input.value='';
  if(dialog.open){hearCall(raw);return;}
  const key=conversationIntent(normalizeCommand(raw));
  if(!key){note('This demo understands booking, fees, and callback commands. Try “Book an appointment.” Do not share personal details.');return;}
  note();return stageScenario(key);
 });
}
bindCommand('exampleCommandForm','exampleCommand');
bindCommand('browserCommandForm','browserCommand');
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
window.addEventListener('pagehide',()=>{clearInterval(callClock);stopLive();clearVoice();forgetCaller();modalText('Voice Agent',welcomeLine);});
reset();
