'use strict';
const {Worker}=require('node:worker_threads');
const scenarios=new Set(['booking','emergency','query']);
let count=0;
function isScenario(value){return typeof value==='string'&&scenarios.has(value);}
function runExample(scenario){
 if(!isScenario(scenario))return Promise.reject(Object.assign(Error('Unknown example.'),{status:404}));
 if(count>=4)return Promise.reject(Object.assign(Error('The demo is busy. Try again.'),{status:429}));
 ++count;
 return new Promise((resolve,reject)=>{
  let worker;
  try{worker=new Worker(require.resolve('./worker.cjs'),{workerData:scenario,env:{TZ:'Asia/Kolkata'},resourceLimits:{maxOldGenerationSizeMb:32}});}
  catch(err){--count;reject(err);return;}
  let closed=false;
  const timer=setTimeout(()=>done(Error('Example timed out.')),3500);
  function done(error,data){
   if(closed)return;closed=true;clearTimeout(timer);
   void worker.terminate().finally(()=>{--count;});
   if(error)reject(error);else resolve(data);
  }
  worker.once('message',data=>done(data?.error?Error(data.error):null,data));
  worker.once('error',()=>done(Error('Example stopped.')));
  worker.once('exit',()=>done(Error('Example stopped.')));
 });
}
module.exports={runExample,isScenario};
