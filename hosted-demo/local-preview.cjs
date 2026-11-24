'use strict';
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runExample,isScenario}=require('./engine.cjs');
const assets=new Map([['/','index.html'],['/zip-layout.css','zip-layout.css'],['/demo.js','demo.js'],['/voice-eleven/demo-voices.json','voice-eleven/demo-voices.json'],...['voice-agent','triage-agent','action-agent'].map(n=>['/voice-eleven/'+n+'.mp3','voice-eleven/'+n+'.mp3']),['/voice-cues.js','voice-cues.js'],['/THIRD_PARTY_NOTICES.txt','THIRD_PARTY_NOTICES.txt'],...['booking','urgent','fees'].map(n=>['/voice/'+n+'.mp3','voice/'+n+'.mp3'])]);
const mime={css:'text/css; charset=utf-8',html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',txt:'text/plain; charset=utf-8',json:'application/json; charset=utf-8',mp3:'audio/mpeg'};
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||4180);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');const p=url.pathname;
 const json=(n,body)=>{res.writeHead(n,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(req.method==='GET'&&p==='/healthz')return json(200,{ok:true});
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
if(require.main===module)server.listen(port,'127.0.0.1');
module.exports=server;
