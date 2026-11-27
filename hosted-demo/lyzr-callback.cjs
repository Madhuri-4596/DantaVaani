'use strict';
const {randomUUID}=require('node:crypto');
const ENDPOINT='https://agent-prod.studio.lyzr.ai/v3/inference/chat/';
const SAMPLE='Fictional demo only: a caller asks the office to call back about changing the time of a sample appointment. No names, contact details, symptoms, or records are provided. Classify this administrative request. Return exactly CALLBACK_NOTE_READY for a scheduling callback, or REVIEW_REQUIRED if it cannot be classified. Do not contact anyone or take other actions.';
const results=new Map([
 ['CALLBACK_NOTE_READY','The sample scheduling callback was recognized. Nothing was sent or booked.'],
 ['REVIEW_REQUIRED','The agent asked for staff review of the fictional request. Nothing was sent or booked.'],
]);
function unavailable(message,status=503){return Object.assign(new Error(message),{status});}
async function runLyzrCallback({env=process.env,request=fetch}={}){
 const apiKey=env.LYZR_API_KEY?.trim(), agentId=env.LYZR_CALLBACK_AGENT_ID?.trim(), userId=env.LYZR_DEMO_USER_ID?.trim();
 if(!apiKey||!agentId||!userId)throw unavailable('Lyzr credentials have not been configured.');
 const reply=await request(ENDPOINT,{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{'content-type':'application/json','x-api-key':apiKey},
  body:JSON.stringify({user_id:userId,agent_id:agentId,session_id:agentId+'-'+randomUUID(),message:SAMPLE}),
 });
 if(!reply.ok)throw unavailable('Lyzr did not accept the request.',502);
 const type=reply.headers.get('content-type')??'';
 if(!type.toLowerCase().startsWith('application/json'))throw unavailable('Unexpected response format.',502);
 const reader=reply.body?.getReader();
 if(!reader)throw unavailable('Empty provider response.',502);
 let size=0, chunks=[];
 while(true){
  const {done,value}=await reader.read();
  if(done)break;
  size+=value.byteLength;
  if(size>16384){await reader.cancel();throw unavailable('Provider response was too large.',502);}
  chunks.push(value);
 }
 let result;
 try{result=JSON.parse(Buffer.concat(chunks).toString('utf8')).response?.trim();}
 catch{throw unavailable('Unexpected response format.',502);}
 if(!results.has(result))throw unavailable('Lyzr did not return a recognized routing status.',502);
 return {provider:'Lyzr',status:result,message:results.get(result)};
}
module.exports={runLyzrCallback};
