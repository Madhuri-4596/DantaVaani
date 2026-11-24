'use strict';
async function assess(_session,handoff) {
 const review=handoff.intent==='EMERGENCY';
 return {escalate:review,severity:review?'review':'routine',summary_for_doctor:review?'Sandbox review requested.':null,advice_for_caller:null,engine:'local'};
}
module.exports={assess};
