import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';
import {buildRequest} from '../public/workflow.js';
test('request includes custom prompt, meeting metadata and unmodified transcript',()=>{const result=buildRequest({prompt:'期限未指定は本日18:00まで。表は禁止。',title:'週次会議',date:'2026-10-13',participants:'大月、和田',transcript:'和田：次回までに準備します。'});for(const expected of ['本日18:00まで','表は禁止','週次会議','2026-10-13','大月、和田','和田：次回までに準備します。'])assert.ok(result.includes(expected));});
test('empty transcript rejected',()=>assert.throws(()=>buildRequest({transcript:'   '})));
test('static workflow works without API configuration and has no AI endpoint',async()=>{const server=createApp();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}`;const html=await(await fetch(base)).text();assert.match(html,/ChatGPTへの依頼文をコピー/);assert.match(html,/id="minutes"[^>]*>/);assert.match(html,/https:\/\/chatgpt.com/);const js=await(await fetch(base+'/app.js')).text();assert.doesNotMatch(js,/fetch\(|\/api\/|OPENAI_API_KEY/);assert.equal((await fetch(base+'/workflow.js')).status,200);assert.equal((await fetch(base+'/api/minutes',{method:'POST'})).status,404);}finally{await new Promise(r=>server.close(r));}});
