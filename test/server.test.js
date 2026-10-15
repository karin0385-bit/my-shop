import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';
import {buildRequest, handoffToChatGPT} from '../public/workflow.js';
test('request includes custom prompt, meeting metadata and unmodified transcript',()=>{const result=buildRequest({prompt:'期限未指定は本日18:00まで。表は禁止。',title:'週次会議',date:'2026-10-13',participants:'大月、和田',transcript:'和田：次回までに準備します。'});for(const expected of ['本日18:00まで','表は禁止','週次会議','2026-10-13','大月、和田','和田：次回までに準備します。'])assert.ok(result.includes(expected));});
test('empty transcript rejected',()=>assert.throws(()=>buildRequest({transcript:'   '})));
test('manual workflow works without API credentials and paid endpoint fails closed',async()=>{const server=createApp({key:''});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}`;const html=await(await fetch(base)).text();assert.match(html,/依頼文をコピーしてChatGPTへ/);assert.match(html,/id="minutes"[^>]*>/);assert.match(html,/https:\/\/chatgpt.com/);const js=await(await fetch(base+'/app.js')).text();assert.doesNotMatch(js,/fetch\(|\/api\/|OPENAI_API_KEY/);assert.equal((await fetch(base+'/workflow.js')).status,200);assert.equal((await fetch(base+'/api/minutes',{method:'POST'})).status,503);}finally{await new Promise(r=>server.close(r));}});

test('ChatGPT handoff saves input, copies complete prompt, then navigates',async()=>{
 const calls=[];
 await handoffToChatGPT({prompt:'期限なしは本日18:00まで',transcript:'会議記録'},{saveDraft:()=>calls.push('saved'),writeClipboard:async text=>{assert.match(text,/会議記録/);assert.match(text,/本日18:00まで/);calls.push('copied');},navigate:()=>calls.push('opened')});
 assert.deepEqual(calls,['saved','copied','opened']);
});
test('failed clipboard or draft persistence does not open ChatGPT',async()=>{
 for(const failure of ['save','copy']){
  let opened=false;
  await assert.rejects(handoffToChatGPT({transcript:'記録'},{saveDraft:()=>{if(failure==='save')throw Error('storage denied');},writeClipboard:async()=>{if(failure==='copy')throw Error('clipboard denied');},navigate:()=>{opened=true;}}));
  assert.equal(opened,false);
 }
});
