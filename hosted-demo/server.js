'use strict';
const express=require('express');
const path=require('node:path');
const {runExample,isScenario}=require('./engine.cjs');
const {runLyzrCallback}=require('./lyzr-callback.cjs');
const {authorizePreview}=require('./lyzr-preview-auth.cjs');
const app=express();
const root=path.join(__dirname,'public');
app.disable('x-powered-by');
app.use((req,res,next)=>{
 res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
 next();
});
app.get('/healthz',(_req,res)=>res.json({ok:true}));
app.post('/api/demo/:scenario',async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!isScenario(req.params.scenario))return res.status(404).json({error:'Unknown example.'});
 if((req.headers['content-length']&&req.headers['content-length']!=='0')||req.headers['transfer-encoding']||Object.keys(req.query).length)return res.status(400).json({error:'This demo accepts a predefined example only.'});
 if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return res.status(403).json({error:'Use this demo directly in your browser.'});
 try{return res.json(await runExample(req.params.scenario));}catch(error){return res.status(error.status||503).json({error:'Example unavailable. Try again.'});}
});
app.get('/lyzr',(req,res)=>{
 if(process.env.VERCEL_ENV!=='preview')return res.status(404).send('Not found');
 res.set('Cache-Control','no-store');
 return res.sendFile(path.join(__dirname,'sponsor-preview.html'));
});
app.post('/api/private/lyzr-callback',async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(process.env.VERCEL_ENV!=='preview')return res.status(404).json({error:'Not found'});
 if(Object.keys(req.query).length||(req.headers['content-length']&&req.headers['content-length']!=='0')||req.headers['transfer-encoding'])return res.status(400).json({error:'Only the fixed fictional example is allowed.'});
 const decision=authorizePreview(process.env,req.headers.authorization);
 if(decision)return res.status(decision.status).json({error:decision.error});
 try{return res.json(await runLyzrCallback());}
 catch(e){return res.status(e.status||502).json({error:'Live Lyzr handoff failed. No fallback was counted.'});}
});
app.use('/api',(_req,res)=>res.status(404).json({error:'Not found'}));
app.use(express.static(root,{extensions:false,dotfiles:'deny'}));
app.use((_req,res)=>res.status(404).send('Not found'));
if(require.main===module)app.listen(Number(process.env.PORT)||3000,'0.0.0.0');
module.exports=app;
