import {buildRequest, handoffToChatGPT} from './workflow.js';
const $=id=>document.getElementById(id);
const defaultPrompt="# やってほしいこと\n参加者情報に記載のメンバーによる会議の文字起こしをもとに、最高の議事録を作成してください。\n\n# 役割\n会議で決まったこと、解像度の上がったことをテキストにまとめて、プロジェクト（事業）の進行を後押しするプロの書記担当者。\n\n# 最高の議事録とは\n- 決定事項とアクションプラン（誰が、いつまでに、何をするか）をテキスト化し、参加者全員の認識を揃える。\n- 議論によって解像度の上がったタスクの内容を余さずまとめ、メンバーが取り掛かる際の補助にする。\n\n# 制約条件\n- 会議記録にない内容を創作しない。\n- ビジネス文書として丁寧かつ簡潔に記述する。\n- アクションプランに担当者、タスク内容、期限を必ず明記する。\n- MTG内で期限の言及がなければ「本日18:00まで」と記載する。\n- タスクの内容に関して議論されたことがあれば補足として記載する。\n- 参加者は画面から渡される参加者情報を使用する。担当者が不明な場合は「未定」とする。\n\n# 出力フォーマット\n【議事録】（会議名_日付）\n━━━━━━━━━━━━━━\n■参加者\n（参加者名）\n\n■決定事項と背景\n（決まったことの内容を簡潔に）\n・詳細：\n・背景：\n\n■アクションプラン（誰が・いつまでに）\n【1】（タスク内容）\n・担当：\n・期限：\n・補足：\n\n【2】（タスク内容）\n…\n\n━━━━━━━━━━━━━━\n以上\n\n# LINE送付・スマホ閲覧のための最適化\n- 表（テーブル）形式を使用せず、箇条書きで構成する。\n- 重要なポイントや区切りには記号（■、●、・など）を使用する。";
const defaultParticipants="大月（専務）、和田（部長）、黒崎（課長）、東（担当）";
let meetings=[],currentId=null,leavingForChatGPT=false;
try{meetings=JSON.parse(localStorage.getItem('shirす-meetings')||'[]');if(!Array.isArray(meetings))meetings=[];$('prompt').value=localStorage.getItem('shirす-prompt')||defaultPrompt;}catch{$('prompt').value=defaultPrompt;}
$('date').value=new Date().toLocaleDateString('sv-SE');$('participants').value=defaultParticipants;
function notice(text){$('status').textContent=text;}
function output(text){$('minutes').value=text||'';}
function changed(){$('saveState').textContent='未保存';}
function persist(){try{localStorage.setItem('shirす-meetings',JSON.stringify(meetings));return true;}catch{notice('端末に保存できませんでした。容量やブラウザの保存設定を確認してください。');return false;}}
function render(){ $('history').replaceChildren();for(const m of meetings){const button=document.createElement('button');button.className='nav';button.textContent=m.title||'無題の会議';button.onclick=()=>{if(($('minutes').value||$('transcript').value)&&$('saveState').textContent==='未保存'&&!confirm('未保存の内容を破棄して開きますか？'))return;currentId=m.id;for(const field of ['title','date','participants','transcript'])$(field).value=m[field]||'';output(m.minutes);$('requestText').hidden=true;$('saveState').textContent='保存済み';try{saveDraft();}catch{}notice('保存した議事録を開きました。');};$('history').append(button);}}
const draftKey='shirusu-current-draft';
function saveDraft(){
 const data={currentId,saveState:$('saveState').textContent};
 for(const field of ['title','date','participants','transcript','minutes'])data[field]=$(field).value;
 localStorage.setItem(draftKey,JSON.stringify(data));
}
try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(draft){for(const field of ['title','date','participants','transcript','minutes'])if(typeof draft[field]==='string')$(field).value=draft[field];currentId=draft.currentId||null;$('saveState').textContent=draft.saveState==='保存済み'?'保存済み':'未保存';}}catch{}
async function paste(field){
 if($(field).value.trim()&&!confirm('現在の内容をクリップボードの内容で置き換えますか？'))return;
 try{const text=await navigator.clipboard.readText();if(!text.trim())return notice('クリップボードが空です。先に文字起こしや回答をコピーしてください。');if(field==='transcript'&&text.length>100000)return notice('10万文字を超えています。会議の記録を分割して貼り付けてください。');$(field).value=text;changed();try{saveDraft();}catch{}notice(field==='transcript'?'文字起こしを貼り付けました。「依頼文をコピーしてChatGPTへ」を押してください。':'回答を貼り付けました。内容を確認して保存・LINE共有してください。');}
 catch{$(field).focus();notice('自動貼り付けが利用できません。入力欄を長押しして「ペースト」を選んでください。');}
}
$('pasteTranscript').onclick=()=>paste('transcript');
$('pasteMinutes').onclick=()=>paste('minutes');
$('generate').onclick=async()=>{
 if(!$('transcript').value.trim())return notice('ボイスメモの文字起こしを貼り付けてください。');
 const data={};for(const field of ['title','date','participants','transcript','prompt'])data[field]=$(field).value;
 $('requestText').value=buildRequest(data);$('requestText').hidden=false;
 try{await handoffToChatGPT(data,{saveDraft,writeClipboard:text=>navigator.clipboard.writeText(text),navigate:()=>{leavingForChatGPT=true;window.location.assign('https://chatgpt.com/');}});}
 catch{$('requestText').focus();$('requestText').select();notice('自動コピーまたは一時保存ができませんでした。表示された依頼文を長押ししてコピーし、「ChatGPTを開く」を押してください。');}
};
$('voiceMemoShortcut').onclick=()=>{try{saveDraft();}catch{notice('入力を一時保存できません。重要な内容を保存してから移動してください。');return false;}};
$('save').onclick=()=>{if(!$('minutes').value.trim())return notice('先に議事録を作成してください。');const m={id:currentId||crypto.randomUUID()};for(const field of ['title','date','participants','transcript','minutes'])m[field]=$(field).value;const previous=meetings;meetings=[m,...meetings.filter(x=>x.id!==m.id)];if(!persist()){meetings=previous;return;}currentId=m.id;render();$('saveState').textContent='保存済み';try{saveDraft();}catch{}notice('この端末のブラウザに保存しました。共有端末では会議情報の取り扱いに注意してください。');};
function shareText(){return [$('title').value,$('date').value,$('participants').value?`参加者：${$('participants').value}`:'',$('minutes').value].filter(Boolean).join('\n\n');}
$('copy').onclick=async()=>{if(!$('minutes').value.trim())return notice('共有する議事録がありません。');try{await navigator.clipboard.writeText(shareText());notice('コピーしました。LINEのトークに貼り付けて送信できます。');}catch{notice('コピーできません。議事録を長押しして選択・コピーしてください。');}};
$('share').onclick=async()=>{if(!$('minutes').value.trim())return notice('共有する議事録がありません。');try{if(navigator.share){await navigator.share({title:$('title').value||'議事録',text:shareText()});notice('共有画面を閉じました。送信状況はLINEで確認してください。');}else{$('copy').click();notice('このブラウザでは共有画面を開けません。「コピー」でLINEに貼り付けてください。');}}catch(e){if(e.name!=='AbortError')notice('共有できませんでした。「コピー」を利用してください。');}};
$('newMeeting').onclick=()=>{if(($('minutes').value||$('transcript').value)&&$('saveState').textContent==='未保存'&&!confirm('未保存の内容を破棄しますか？'))return;currentId=null;for(const id of ['title','participants','transcript'])$(id).value='';$('date').value=new Date().toLocaleDateString('sv-SE');$('participants').value=defaultParticipants;output('');$('requestText').hidden=true;changed();try{saveDraft();}catch{}notice('新しい会議を作成します。');};
for(const id of ['title','date','participants','transcript','minutes'])$(id).addEventListener('input',()=>{changed();try{saveDraft();}catch{}});
$('prompt').oninput=()=>{try{localStorage.setItem('shirす-prompt',$('prompt').value);}catch{notice('プロンプト設定を保存できませんでした。');}};
window.addEventListener('beforeunload',e=>{if(!leavingForChatGPT&&(($('transcript').value||$('minutes').value)&&$('saveState').textContent==='未保存')){e.preventDefault();e.returnValue='';}});
render();notice($('transcript').value?'作業中の内容を復元しました。ChatGPTの回答を貼り付けて続けられます。':'初回は「会議を録音」の設定をしてください。APIキーは不要です。');
