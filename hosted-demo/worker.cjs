'use strict';
const {workerData,parentPort}=require('node:worker_threads');
// Each demonstration starts with fresh state. The worker environment omits every provider setting.
const clinic=require('./src/clinic');
const {handleTurn}=require('./src/orchestrator');
const next=clinic.addDays(new Date(),1);
if(!clinic.isOpen(clinic.ymd(next)))next.setDate(next.getDate()+1);
const scenario=workerData;
const steps={
 booking:['I want to book an appointment','Practice visit',clinic.ymd(next),'evening','My name is Demo Visitor','demo contact A'],
 emergency:['Request a demo callback','demo contact B'],
 query:['Is any clinic fee list available?']
};
const labels={booking:'Appointment booking',emergency:'Callback review',query:'Clinic information'};
const supported=new Set(['handoff','triage','tool_call','result']);
const tools=new Set(['check_slots','nearest_alternatives','book_appointment','escalate_to_doctor','update_alert']);
const participants=new Set(['Voice Agent','Triage Agent','Action Agent','Action Agent ⚠ ESCALATE','Clinic System']);
const returnStatuses=new Set(['success','failed','escalated','needs_choice']);
function clean(e){
 if(!supported.has(e.type)||!participants.has(e.from)||!participants.has(e.to))return null;
 const p=e.payload??{};
 let payload;
 if(e.type==='handoff')payload={intent:labels[scenario]};
 else if(e.type==='triage')payload={escalate:p.escalate===true,severity:['critical','urgent','routine'].includes(p.severity)?p.severity:'n/a'};
 else if(e.type==='tool_call'){
  if(!tools.has(p.tool))return null;
  payload={tool:p.tool,args:{},result:{ok:!p.result?.error}};
 }else payload={status:returnStatuses.has(p.status)?p.status:'failed'};
 return {from:e.from,to:e.to,type:e.type,payload,engine:'local'};
}
(async()=>{
 const events=[];
 for(const utterance of steps[scenario]){
  const r=await handleTurn('ephemeral-demo',utterance);
  events.push(...r.events.map(clean).filter(Boolean));
 }
 const st=clinic.state();
 const bookings=st.appointments.filter(a=>a.source==='DantaVaani'&&a.status==='confirmed').length;
 const reviews=st.alerts.filter(a=>a.status==='demo_callback_recorded').length;
 if(scenario==='booking'&&bookings!==1)throw Error('The fixture could not verify one sandbox booking.');
 if(scenario==='emergency'&&reviews!==1)throw Error('The fixture could not verify one sandbox review.');
 const result={
  booking:{title:'Sandbox appointment recorded',detail:'The Action Agent wrote one appointment to this run’s practice calendar. No real appointment or message was sent.'},
  emergency:{title:'Sandbox review recorded',detail:'The Action Agent wrote one review to this run only. No clinician was contacted, and no callback was sent.'},
  query:{title:'Clinic information route complete',detail:'The Action Agent read the practice information. No real clinic hours or prices are provided.'}
 }[scenario];
 parentPort.postMessage({scenario,events,result,dashboard:{bookings,reviews}});
})().catch(()=>{parentPort.postMessage({error:'The example could not be completed.'});});
