const $=id=>document.getElementById(id);
export function setupRecording({notice,changed,saveDraft,output}){
 let stream,recorder,segmentTimer,clockTimer,started,recording=false,working=false,configured=false;
 let segments=[],urls=[],wakeLock,interruption=false;
 const recordStatus=text=>{$('recordStatus').textContent=text;notice(text);};
 const snapshot=()=>Object.fromEntries(['title','date','participants','prompt'].map(k=>[k,$(k).value]));
 const blocked=['title','date','participants','prompt','transcript','minutes','newMeeting','generate','generateAI','voiceMemoShortcut','pasteTranscript','pasteMinutes','save'];
 function lock(active){for(const id of blocked)$(id).disabled=active;for(const button of $('history').querySelectorAll('button'))button.disabled=active;$('startRecord').disabled=active||!configured;$('stopRecord').disabled=!recording;$('retryAuto').disabled=active;}
 function persist(){changed();try{saveDraft();}catch{notice('処理結果を一時保存できません。内容をコピーして保管してください。');}}
 async function call(path,body,type){const response=await fetch(path,{method:'POST',headers:{'Content-Type':type},body,signal:AbortSignal.timeout(175000)});let data;try{data=await response.json();}catch{throw Error('サーバーの応答を取得できません。Vercelへのログイン・通信状態を確認して再試行してください。');}if(!response.ok)throw Error(data.error||'AI処理に失敗しました。');return data.text;}
 function downloads(){for(const url of urls)URL.revokeObjectURL(url);urls=[];$('audioDownloads').replaceChildren();segments.forEach((part,i)=>{const a=document.createElement('a');const url=URL.createObjectURL(part.blob);urls.push(url);a.href=url;a.download=`会議録音-${i+1}.${part.blob.type.includes('mp4')?'m4a':'webm'}`;a.textContent=`音声 ${i+1} を保存`;$('audioDownloads').append(a);});$('audioRecovery').hidden=!segments.length;}
 async function makeMinutes(meta){const transcript=$('transcript').value;if(!transcript.trim())throw Error('文字起こしがありません。音声が入っているか確認してください。');recordStatus('議事録を作成中です…');const text=await call('/api/minutes',JSON.stringify({...meta,transcript}),'application/json');output(text);persist();}
 async function processRecording(){if(working||recording)return;working=true;lock(true);const meta=snapshot();try{
  for(let i=0;i<segments.length;i++){const part=segments[i];if(part.text!==null)continue;if(part.blob.size>4000000)throw Error(`音声${i+1}が4MBを超えています。保存して別途文字起こししてください。`);recordStatus(`音声を文字起こし中… ${i+1} / ${segments.length}`);part.text=await call('/api/transcribe',part.blob,part.blob.type||'audio/webm');$('transcript').value=segments.filter(p=>p.text!==null).map(p=>p.text).join('\n');persist();}
  await makeMinutes(meta);recordStatus('議事録ができました。内容・担当者・期限を確認して、保存・LINE共有してください。');
 }catch(e){recordStatus(e.name==='TimeoutError'?'処理がタイムアウトしました。「音声処理を再開」で続けられます。':e.message);}finally{working=false;lock(false);}}
 async function release(){clearInterval(clockTimer);clearTimeout(segmentTimer);stream?.getTracks().forEach(t=>t.stop());try{await wakeLock?.release();}catch{}wakeLock=null;}
 function startSegment(){
  const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:32000});const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onerror=()=>{interruption=true;stop();};
  recorder.onstop=()=>{
   clearTimeout(segmentTimer);const blob=new Blob(chunks,{type:recorder.mimeType});if(blob.size)segments.push({blob,text:null});
   if(recording&&stream.getAudioTracks().some(t=>t.readyState==='live')){try{startSegment();return;}catch{interruption=true;recording=false;}}
   recording=false;release();downloads();lock(false);
   if(interruption){recordStatus('録音が中断されました。保存された音声を確認し、「音声処理を再開」で議事録を作成できます。');return;}
   processRecording();
  };
  recorder.start();segmentTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},60000);
 }
 function stop(){if(!recording)return;recording=false;$('stopRecord').disabled=true;recordStatus('録音を停止しています…');clearTimeout(segmentTimer);if(recorder?.state==='recording')recorder.stop();}
 $('startRecord').onclick=async()=>{
  if(working||recording)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return recordStatus('このブラウザでは録音できません。HTTPSのSafariで開いてください。');
  if(($('transcript').value||$('minutes').value||segments.length)&&!confirm('現在の文字起こし・議事録・録音を置き換えます。必要なものは保存しましたか？'))return;
  working=true;lock(true);
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   segments=[];downloads();$('transcript').value='';output('');persist();interruption=false;recording=true;working=false;started=Date.now();
   stream.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(recording){interruption=true;stop();}}));
   startSegment();lock(true);recordStatus('録音中 00:00 — この画面を開いたままにしてください。');
   clockTimer=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);$('recordStatus').textContent=`録音中 ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} — 最長60分`;if(seconds>=3600)stop();},1000);
   try{wakeLock=await navigator.wakeLock?.request('screen');if(!recording)await wakeLock?.release();}catch{}
  }catch{recording=false;working=false;await release();lock(false);recordStatus('録音を開始できません。マイクの許可とSafariの対応状況を確認してください。');}
 };
 $('stopRecord').onclick=stop;$('retryAuto').onclick=processRecording;
 $('generateAI').onclick=async()=>{
  if(working||recording)return;if(!$('transcript').value.trim())return recordStatus('文字起こしを入力してください。');
  if($('minutes').value&&!confirm('現在の議事録を置き換えて作成しますか？'))return;
  working=true;lock(true);try{await makeMinutes(snapshot());recordStatus('議事録ができました。内容を確認して保存・共有してください。');}catch(e){recordStatus(e.message);}finally{working=false;lock(false);}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&recording){interruption=true;stop();}});
 window.addEventListener('beforeunload',e=>{if(recording||working||segments.length){e.preventDefault();e.returnValue='';}});
 fetch('/api/status').then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{configured=data.configured;lock(false);$('generateAI').disabled=!configured;$('recordStatus').textContent=configured?'API接続設定済み。録音停止後に自動処理します（従量課金）。':'APIキーが未設定です。手動モードは利用できます。';}).catch(()=>{$('recordStatus').textContent='API設定を確認できません。再読み込み、またはVercelへのログインをお試しください。';$('generateAI').disabled=true;});
}
