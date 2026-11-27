'use strict';
const {timingSafeEqual,createHash}=require('node:crypto');
function authorizePreview(env,authorization){
 const token=env.DANTAVAANI_PREVIEW_TOKEN?.trim();
 if(!token||token.length<24||!env.LYZR_API_KEY?.trim()||!env.LYZR_CALLBACK_AGENT_ID?.trim()||!env.LYZR_DEMO_USER_ID?.trim()){
  return {status:503,error:'Lyzr preview credentials are not configured.'};
 }
 const hash=value=>createHash('sha256').update(value).digest();
 if(typeof authorization!=='string'||!timingSafeEqual(hash(authorization),hash('Bearer '+token))){
  return {status:401,error:'Enter the private preview access code.'};
 }
 return null;
}
module.exports={authorizePreview};
