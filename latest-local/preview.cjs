// Private, synthetic, offline UI preview, using only Node's standard modules.
// Deliberately does not load .env or use external providers.
process.env.TZ='Asia/Kolkata';
const http=require('node:http');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const clinic=require('./src/clinic');
const {handleTurn,feed,sessions}=require('./src/orchestrator');
const html=readFileSync(join(__dirname,'public','index.html'));
const clips=new Set(['/voice/booking.mp3','/voice/urgent.mp3','/voice/fees.mp3']);
const mode={voice:'offline',triage:'offline',action:'skills',band:false};
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag>=0?process.argv[portFlag+1]:process.env.PORT||4177);
const bodies={json:'application/json; charset=utf-8',html:'text/html; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 const send=(status,body,type='json')=>{res.writeHead(status,{'content-type':bodies[type],'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(type==='json'?JSON.stringify(body):body);};
 const host=req.headers.host||'';
 if(!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host))return send(403,{error:'Loopback requests only'});
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return send(200,html,'html');
 if(req.method==='GET'&&url.pathname==='/voice-cues.js'){
  res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});
  return res.end(readFileSync(join(__dirname,'public','voice-cues.js')));
 }
 if(req.method==='GET'&&clips.has(url.pathname)){
  res.writeHead(200,{'content-type':'audio/mpeg','x-content-type-options':'nosniff'});
  return res.end(readFileSync(join(__dirname,'public',url.pathname.slice(1))));
 }
 if(req.method==='GET'&&url.pathname==='/api/state')return send(200,{...clinic.state(),mode,feed:feed.slice(-60)});
 if(req.method!=='POST')return send(404,{error:'Not found'});
 if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`))return send(403,{error:'Cross-origin requests are disabled'});
 if(url.pathname==='/api/reset'){clinic.seed();sessions.clear();feed.length=0;return send(200,{ok:true});}
 if(url.pathname!=='/api/chat')return send(404,{error:'Not found'});
 if(!/^application\/json\b/i.test(req.headers['content-type']||''))return send(415,{error:'JSON required'});
 try{
  let size=0;const parts=[];
  for await(const chunk of req){size+=chunk.length;if(size>8192){send(413,{error:'Request too large'});return;}parts.push(chunk);}
  const {sessionId,text,langHint}=JSON.parse(Buffer.concat(parts).toString('utf8'));
  if(typeof sessionId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(sessionId)||typeof text!=='string'||text.length>1000||!text.trim())return send(400,{error:'Invalid session or message'});
  if (/@|(?:\d[ .()+-]?){7,}/.test(text))return send(400,{error:'Use a demo contact code instead of a real phone number or email.'});
  send(200,await handleTurn(sessionId,text.trim(),langHint));
 }catch{send(400,{error:'Unable to read request'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Synthetic DantaVaani preview: http://127.0.0.1:${port}/`));
