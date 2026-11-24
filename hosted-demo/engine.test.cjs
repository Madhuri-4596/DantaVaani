'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runExample}=require('./engine.cjs');
const server=require('./local-preview.cjs');
test('original booking and callback have isolated results and disclose no raw data',async()=>{
 const [book,urgent,fees,bookAgain]=await Promise.all(['booking','emergency','query','booking'].map(runExample));
 assert.deepEqual(book.dashboard,{bookings:1,reviews:0});
 assert.deepEqual(urgent.dashboard,{bookings:0,reviews:1});
 assert.deepEqual(fees.dashboard,{bookings:0,reviews:0});
 assert.deepEqual(bookAgain.dashboard,book.dashboard);
 for(const r of [book,urgent,fees]){
  assert.ok(r.events.some(e=>e.type==='handoff'));
  assert.ok(r.events.some(e=>e.type==='triage'));
  assert.ok(r.events.some(e=>e.type==='result'));
  assert.doesNotMatch(JSON.stringify(r),/\b(?:Demo Visitor|demo-contact-[ab]|transcript|utterance|sessionId|slotId)\b/);
 }
 await assert.rejects(runExample('call me back with my record'),{status:404});
});
test('local HTTP contract serves assets and example only, no public state/reset',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/healthz')).status,200);
  assert.match(await (await fetch(base+'/')).text(),/Sandbox only/);
  for(const asset of ['/demo.js','/voice-cues.js','/voice/booking.mp3'])assert.equal((await fetch(base+asset)).status,200);
  const manifest=await (await fetch(base+'/voice-eleven/demo-voices.json')).json();
  assert.equal(manifest.provider,'offline');
  assert.deepEqual(manifest.clips,[]);
  assert.equal((await fetch(base+'/api/demo/booking',{method:'POST',body:'arbitrary text'})).status,400);
  assert.equal((await fetch(base+'/api/state')).status,404);
  assert.equal((await fetch(base+'/api/reset',{method:'POST'})).status,404);
  const run=await (await fetch(base+'/api/demo/booking',{method:'POST'})).json();
  assert.equal(run.dashboard.bookings,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
