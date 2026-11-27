'use strict';
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runExample,isScenario}=require('./engine.cjs');
const {runLyzrCallback}=require('./lyzr-callback.cjs');
const assets=new Map([['/','index.html'],['/demo.js','demo.js'],['/voice-eleven/demo-voices.json','voice-eleven/demo-voices.json'],...['voice-agent','triage-agent','action-agent'].map(n=>['/voice-eleven/'+n+'.mp3','voice-eleven/'+n+'.mp3']),['/voice-cues.js','voice-cues.js'],['/THIRD_PARTY_NOTICES.txt','THIRD_PARTY_NOTICES.txt'],...['booking','urgent','fees'].map(n=>['/voice/'+n+'.mp3','voice/'+n+'.mp3'])]);
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',txt:'text/plain; charset=utf-8',json:'application/json; charset=utf-8',mp3:'audio/mpeg'};
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||4180);
function createPreview({env=process.env,callback=runLyzrCallback}={}){
 let running=false,lastStart=-Infinity;
 return createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');const p=url.pathname;
 const json=(n,body)=>{res.writeHead(n,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(req.method==='GET'&&p==='/healthz')return json(200,{ok:true});
 if(p==='/lyzr' || p==='/api/private/lyzr-callback'){
  if(env.DANTAVAANI_LYZR_DEMO!=='1')return json(404,{error:'Not found'});
  const port=String(req.socket.localPort);
  const host=req.headers.host;
  if(host!=='127.0.0.1:'+port&&host!=='localhost:'+port)return json(403,{error:'Open the preview on localhost.'});
  if(p==='/lyzr'&&req.method==='GET'&&!url.search){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
   return res.end(readFileSync(join(__dirname,'sponsor-preview.html')));
  }
  if(p!=='/api/private/lyzr-callback'||req.method!=='POST')return json(404,{error:'Not found'});
  if(req.headers['sec-fetch-site']!=='same-origin'||req.headers.origin!=='http://'+host)return json(403,{error:'Run the callback from the preview page.'});
  if(url.search||(req.headers['content-length']&&req.headers['content-length']!=='0')||req.headers['transfer-encoding'])return json(400,{error:'Only the fixed fictional example is allowed.'});
  if(running||Date.now()-lastStart<2500)return json(429,{error:'Wait a moment before trying again.'});
  running=true;lastStart=Date.now();
  try{return json(200,await callback({env}));}
  catch(e){return json(e.status||502,{error:e.status===503?'Lyzr is not configured.':'Live Lyzr handoff failed. No fallback was counted.'});}
  finally{running=false;}
 }
 if(req.method==='POST'&&p.startsWith('/api/demo/')){
  const key=p.split('/').at(-1);
  if(!isScenario(key)||p!=='/api/demo/'+key)return json(404,{error:'Unknown example.'});
  if(url.search||(req.headers['content-length']&&req.headers['content-length']!=='0')||req.headers['transfer-encoding'])return json(400,{error:'This demo accepts a predefined example only.'});
  if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return json(403,{error:'Use this demo directly in your browser.'});
  try{return json(200,await runExample(key));}catch(e){return json(e.status||503,{error:'Example unavailable. Try again.'});}
 }
 const asset=assets.get(p);
 if(!asset||req.method!=='GET')return json(404,{error:'Not found'});
 let bytes;try{bytes=readFileSync(join(__dirname,'public',asset));}catch{return json(404,{error:'Not found'});}
 res.writeHead(200,{'content-type':mime[asset.split('.').at(-1)],'x-content-type-options':'nosniff'});
 res.end(bytes);
 });
}
const server=createPreview();
if(require.main===module)server.listen(port,'127.0.0.1');
module.exports=server;
module.exports.createPreview=createPreview;
