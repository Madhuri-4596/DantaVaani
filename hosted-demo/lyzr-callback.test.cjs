'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {runLyzrCallback}=require('./lyzr-callback.cjs');
const {createPreview}=require('./local-preview.cjs');
const env={LYZR_API_KEY:'demo-key',LYZR_CALLBACK_AGENT_ID:'demo-agent',LYZR_DEMO_USER_ID:'demo-user',DANTAVAANI_LYZR_DEMO:'1'};
const reply=value=>new Response(JSON.stringify({response:value}),{headers:{'content-type':'application/json'}});
test('sends only the fictional scenario with a fresh session and returns an allowlisted result', async()=>{
 const ids=[];
 const request=async(url,options)=>{
  assert.equal(url,'https://agent-prod.studio.lyzr.ai/v3/inference/chat/');
  assert.equal(options.headers['x-api-key'],'demo-key');
  assert.equal(options.redirect,'error');
  const b=JSON.parse(options.body);
  assert.equal(b.agent_id,'demo-agent');
  assert.equal(b.user_id,'demo-user');
  ids.push(b.session_id);
  assert.match(b.message,/Fictional demo only/);
  assert.match(b.message,/Do not contact anyone/);
  return reply('CALLBACK_NOTE_READY');
 };
 for(let i=0;i<2;i++) {
  const data=await runLyzrCallback({env,request});
  assert.equal(data.provider,'Lyzr');
  assert.equal(data.status,'CALLBACK_NOTE_READY');
  assert.doesNotMatch(JSON.stringify(data),/demo-key|demo-user|session_id/);
 }
 assert.notEqual(ids[0],ids[1]);
});
test('fails closed for missing credentials, unexpected output and non-2xx replies',async()=>{
 await assert.rejects(runLyzrCallback({env:{},request:()=>assert.fail('must not call')}),{status:503});
 await assert.rejects(runLyzrCallback({env,request:()=>reply('unknown output with secret words')}),{status:502});
 await assert.rejects(runLyzrCallback({env,request:()=>new Response('failure',{status:401})}),{status:502});
 await assert.rejects(runLyzrCallback({env,request:()=>reply('a'.repeat(17000))}),{status:502});
});
async function inPreview(options,check){
 const server=createPreview(options);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await check('http://127.0.0.1:'+server.address().port);}
 finally{await new Promise(resolve=>server.close(resolve));}
}
test('private route absent by default; enabled page reaches provider only for an empty same-origin POST',async()=>{
 await inPreview({env:{}},async base=>{
  assert.equal((await fetch(base+'/lyzr')).status,404);
  assert.equal((await fetch(base+'/api/private/lyzr-callback',{method:'POST'})).status,404);
 });
 let calls=0;
 await inPreview({env,callback:options=>runLyzrCallback({...options,request:()=>{++calls;return reply('CALLBACK_NOTE_READY');}})},async base=>{
  const target=base+'/api/private/lyzr-callback';
  assert.match(await (await fetch(base+'/lyzr')).text(),/Run live Lyzr handoff/);
  assert.equal((await fetch(target,{method:'POST'})).status,403);
  const headers={'origin':base,'sec-fetch-site':'same-origin'};
  assert.equal((await fetch(target,{method:'POST',headers,body:'do not forward'})).status,400);
  assert.equal((await fetch(target+'?text=private',{method:'POST',headers})).status,400);
  const actual=await fetch(target,{method:'POST',headers});
  assert.equal(actual.status,200);
  assert.equal((await actual.json()).status,'CALLBACK_NOTE_READY');
  assert.equal((await fetch(target,{method:'POST',headers})).status,429);
  assert.equal(calls,1);
 });
});
test('Vercel preview authorization fails closed and never uses the provider API key as access code',()=>{
 const {authorizePreview}=require('./lyzr-preview-auth.cjs');
 const config={...env,DANTAVAANI_PREVIEW_TOKEN:'private-example-token-for-test-only'};
 assert.equal(authorizePreview({},'anything').status,503);
 assert.equal(authorizePreview({...config,DANTAVAANI_PREVIEW_TOKEN:'short'},'Bearer short').status,503);
 assert.equal(authorizePreview(config,'Bearer '+env.LYZR_API_KEY).status,401);
 assert.equal(authorizePreview(config,'Bearer '+config.DANTAVAANI_PREVIEW_TOKEN),null);
});
