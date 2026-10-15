import http from 'node:http';
import {createAIHandler} from './lib/ai.js';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./public/',import.meta.url));
export function createApp(aiOptions){const handlers=Object.fromEntries(['status','transcribe','minutes'].map(k=>['/api/'+k,createAIHandler(k,aiOptions)]));return http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(handlers[path])return handlers[path](req,res);
 const paths={'/':'index.html','/app.js':'app.js','/workflow.js':'workflow.js','/recording.js':'recording.js','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest'};
 const file=paths[new URL(req.url,'http://localhost').pathname];
 if(req.method!=='GET'||!file){res.writeHead(404);res.end('Not found');return;}
 try{const body=await readFile(root+file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.webmanifest')?'application/manifest+json':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(500);res.end('Unable to load application');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url))createApp().listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Meeting Note server started'));
