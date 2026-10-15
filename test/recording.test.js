import test from 'node:test';
import assert from 'node:assert/strict';
import {setupRecording} from '../public/recording.js';
test('two independent recording segments are transcribed in order; retry skips completed segments and creates minutes',async()=>{
 const originals=Object.getOwnPropertyDescriptors(globalThis);const elements=new Map();let segmentTimer;let recorderCount=0;let transcribeCalls=0;let minutesCalls=0;let fail=true;let result='';
 const element=id=>{if(!elements.has(id))elements.set(id,{value:id==='prompt'?'期限は本日18:00まで':'',textContent:'',disabled:false,hidden:false,children:[],querySelectorAll:()=>[],replaceChildren(){this.children=[];},append(a){this.children.push(a);}});return elements.get(id);};
 const tracks=[{readyState:'live',addEventListener(){},stop(){this.readyState='ended';}}];
 function override(key,value){Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 try{
  override('document',{getElementById:element,createElement:()=>({}),addEventListener(){}});
  override('window',{MediaRecorder:true,addEventListener(){}});override('confirm',()=>true);
  override('navigator',{mediaDevices:{getUserMedia:async()=>({getAudioTracks:()=>tracks,getTracks:()=>tracks})}});
  override('setTimeout',fn=>{segmentTimer=fn;return 1;});override('clearTimeout',()=>{});override('setInterval',()=>2);override('clearInterval',()=>{});
  override('MediaRecorder',class{static isTypeSupported(t){return t==='audio/mp4';}constructor(){this.mimeType='audio/mp4';this.id=++recorderCount;}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob([`segment${this.id}`],{type:this.mimeType})});queueMicrotask(()=>this.onstop());}});
  override('fetch',async(path,options)=>{if(path==='/api/status')return Response.json({configured:true});if(path==='/api/transcribe'){transcribeCalls++;assert.ok(options.body.size>0);if(transcribeCalls===2&&fail)return Response.json({error:'一時エラー'},{status:502});return Response.json({text:transcribeCalls===1?'前半の発言':'後半の発言'});}if(path==='/api/minutes'){minutesCalls++;const payload=JSON.parse(options.body);assert.equal(payload.transcript,'前半の発言\n後半の発言');assert.match(payload.prompt,/本日18:00まで/);return Response.json({text:'完成した議事録'});}throw Error(path);});
  setupRecording({notice(){},changed(){},saveDraft(){},output(text){result=text;}});
  const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};await flush();
  await element('startRecord').onclick();assert.equal(recorderCount,1);segmentTimer();await flush();assert.equal(recorderCount,2);
  element('stopRecord').onclick();await flush();assert.equal(transcribeCalls,2);assert.equal(minutesCalls,0);assert.match(element('recordStatus').textContent,/一時エラー/);assert.equal(tracks[0].readyState,'ended');
  fail=false;await element('retryAuto').onclick();await flush();assert.equal(transcribeCalls,3);assert.equal(minutesCalls,1);assert.equal(result,'完成した議事録');assert.equal(element('audioDownloads').children.length,2);
 }finally{
  for(const key of ['document','window','navigator','confirm','setTimeout','clearTimeout','setInterval','clearInterval','MediaRecorder','fetch']){if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
 }
});
