// Optional Google identity for cloud sync; visitor meeting submissions stay independent.
const DEFAULT_WORKSPACE={cities:locations.slice(0,4).map(z=>({zone:z.zone,country:z.country||null})),schedule:{start:'09:00',end:'18:00',days:[1,2,3,4,5]},teams:[],activeTeamId:null};
const DAY_NAMES=['日','一','二','三','四','五','六'];
let workspace=structuredClone(DEFAULT_WORKSPACE),currentUser=null,workspaceRevision=0,workspaceDirty=false,syncReady=false,syncTimer=null,syncChain=Promise.resolve(),authEpoch=0,managedTeamId=null,editingMemberId=null;
const googleClient=window.supabase?.createClient(TIMESYNC_SUPABASE.url,TIMESYNC_SUPABASE.key,{auth:{flowType:'pkce',storageKey:'timesync.google.auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
function workspaceKey(){return 'timesync.workspace.'+(currentUser?.id||'guest');}
function feedback(id,message,error=false){$(id).textContent=message;$(id).dataset.error=String(error);}
function scheduleValid(s){return s&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)&&s.start!==s.end&&Array.isArray(s.days)&&s.days.length>0&&s.days.length<=7&&s.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6);}
function resolveCity(saved){return allLocations.find(z=>z.zone===saved.zone&&(!saved.country||z.country===saved.country))||locations.find(z=>z.zone===saved.zone);}
function cleanWorkspace(input){
 const state=structuredClone(DEFAULT_WORKSPACE);
 if(!input||typeof input!=='object')return state;
 if(Array.isArray(input.cities)){
  const seen=new Set();const cities=[];
  input.cities.slice(0,100).forEach(saved=>{if(!saved||!resolveCity(saved))return;const key=saved.zone+'|'+(saved.country||'');if(!seen.has(key)){seen.add(key);cities.push({zone:saved.zone,country:saved.country||null})}});
  if(cities.length)state.cities=cities;
 }
 if(scheduleValid(input.schedule))state.schedule=structuredClone(input.schedule);
 const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
 if(Array.isArray(input.teams))state.teams=input.teams.slice(0,30).filter(t=>t&&validId(t.id)&&typeof t.name==='string'&&t.name.trim()).map(t=>({id:t.id,name:t.name.trim().slice(0,80),members:(Array.isArray(t.members)?t.members:[]).slice(0,100).filter(m=>m&&validId(m.id)&&typeof m.name==='string'&&m.name.trim()&&resolveCity(m)&&scheduleValid(m.schedule)).map(m=>({id:m.id,name:m.name.trim().slice(0,80),email:String(m.email||'').slice(0,254),zone:m.zone,schedule:structuredClone(m.schedule)}))}));
 if(state.teams.some(t=>t.id===input.activeTeamId&&t.members.length))state.activeTeamId=input.activeTeamId;
 return state;
}
function readLocal(){
 try{const cached=JSON.parse(localStorage.getItem(workspaceKey())||'null');if(cached){workspace=cleanWorkspace(cached.state);workspaceRevision=Number(cached.revision)||0;workspaceDirty=Boolean(cached.dirty);return true}}catch{}
 workspace=structuredClone(DEFAULT_WORKSPACE);workspaceRevision=0;workspaceDirty=false;return false;
}
function writeLocal(){
 try{localStorage.setItem(workspaceKey(),JSON.stringify({state:workspace,revision:workspaceRevision,dirty:workspaceDirty}));return true}
 catch{feedback('syncStatus','瀏覽器無法保存設定，請檢查儲存空間或隱私設定。',true);return false}
}
function activeTeam(){return workspace.teams.find(t=>t.id===workspace.activeTeamId);}
function applyWorkspace(){
 plannerSettings.schedule=structuredClone(workspace.schedule);
 const team=activeTeam();
 zones=team?.members.length?team.members.map(m=>({...resolveCity(m),memberId:m.id,displayName:m.name+' · '+resolveCity(m).city,schedule:m.schedule})):workspace.cities.map(resolveCity).filter(Boolean);
 $('addBtn').disabled=Boolean(team);$('addBtn').title=team?'請在「團隊與成員」管理此團隊的城市':'';
 render();renderWorkspaceBar();
}
function renderWorkspaceBar(){
 const select=$('workspaceScope');select.replaceChildren(new Option('我的常用城市','personal'));
 workspace.teams.forEach(t=>{const option=new Option(t.name+' · '+t.members.length+' 人',t.id);option.disabled=!t.members.length;select.appendChild(option)});
 select.value=workspace.activeTeamId||'personal';
 const team=activeTeam();
 $('workspaceSummary').textContent=team?`${team.members.length} 位成員 · 依各自的工作時間比較`:(currentUser?'個人設定 · 可同步至雲端':'個人設定 · 儲存在此裝置');
 $('accountBtn').textContent=currentUser?(currentUser.user_metadata?.full_name||currentUser.email||'我的帳號'):'Google 登入';
 $('googleLoginBtn').hidden=Boolean(currentUser);$('signedInActions').hidden=!currentUser;
 $('accountDescription').textContent=currentUser?`已登入 ${currentUser.email||'Google 帳號'}。可以同步城市、工作時間與團隊名單。`:'常用城市、工作時間與團隊會保存在這台裝置。登入 Google 後可同步到其他裝置；儲存會議仍可直接使用。';
}
function commitWorkspace(){
 workspaceDirty=true;const saved=writeLocal();applyWorkspace();
 if(currentUser&&syncReady){feedback('syncStatus','設定已更新，正在同步…');clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncWorkspace().catch(()=>{}),700)}
 else if(saved)feedback('syncStatus',currentUser?'變更已保存在此裝置，請選擇儲存到雲端或載入雲端設定。':'設定已保存在此裝置。');
}
function readSchedule(prefix){return {start:$(prefix==='work'?'workStart':'memberStart').value,end:$(prefix==='work'?'workEnd':'memberEnd').value,days:[...$(prefix==='work'?'workDays':'memberDays').querySelectorAll('input:checked')].map(input=>Number(input.value))};}
function fillSchedule(prefix,schedule){
 $(prefix==='work'?'workStart':'memberStart').value=schedule.start;$(prefix==='work'?'workEnd':'memberEnd').value=schedule.end;
 const container=$(prefix==='work'?'workDays':'memberDays');container.replaceChildren();
 [1,2,3,4,5,6,0].forEach(day=>{const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.value=day;input.checked=schedule.days.includes(day);label.append(input,document.createTextNode('週'+DAY_NAMES[day]));container.appendChild(label)});
}
function scheduleLabel(schedule){return schedule.days.map(day=>'週'+DAY_NAMES[day]).join('、')+' '+schedule.start+'–'+schedule.end+(schedule.start>schedule.end?'（跨夜）':'');}
function rowButton(text,label,handler,disabled=false){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);button.disabled=disabled;button.onclick=handler;return button;}
function renderFavorites(){
 const list=$('favoriteCitiesList');list.replaceChildren();
 workspace.cities.forEach((saved,index)=>{
  const city=resolveCity(saved);const row=document.createElement('div');row.className='favorite-row';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=city.flag+' '+city.city;const detail=document.createElement('small');detail.textContent=city.zone;info.append(title,detail);
  const actions=document.createElement('div');actions.className='row-actions';
  const move=delta=>{[workspace.cities[index],workspace.cities[index+delta]]=[workspace.cities[index+delta],workspace.cities[index]];workspace.activeTeamId=null;commitWorkspace();renderFavorites()};
  actions.append(rowButton('↑','將'+city.city+'往上移',()=>move(-1),index===0),rowButton('↓','將'+city.city+'往下移',()=>move(1),index===workspace.cities.length-1),rowButton('移除','移除常用城市'+city.city,()=>{workspace.cities.splice(index,1);workspace.activeTeamId=null;commitWorkspace();renderFavorites()},workspace.cities.length<=1));row.append(info,actions);list.appendChild(row);
 });
}
function managedTeam(){return workspace.teams.find(t=>t.id===managedTeamId);}
function resetMemberForm(){editingMemberId=null;$('memberForm').reset();$('memberZone').value='Asia/Taipei';fillSchedule('member',workspace.schedule);$('memberFormTitle').textContent='新增成員';$('saveMemberBtn').textContent='新增成員 ＋';$('cancelMemberEdit').hidden=true;feedback('memberMessage','');}
function editMember(member){editingMemberId=member.id;$('memberName').value=member.name;$('memberEmail').value=member.email;$('memberZone').value=member.zone;fillSchedule('member',member.schedule);$('memberFormTitle').textContent='編輯成員';$('saveMemberBtn').textContent='儲存成員變更';$('cancelMemberEdit').hidden=false;$('memberName').focus();}
function renderTeams(){
 if(!managedTeam())managedTeamId=workspace.teams[0]?.id||null;
 $('managedTeam').replaceChildren();workspace.teams.forEach(t=>$('managedTeam').appendChild(new Option(t.name,t.id)));$('managedTeam').value=managedTeamId||'';$('managedTeam').disabled=!workspace.teams.length;
 const team=managedTeam();$('teamEditor').hidden=!team;
 if(!team){feedback('teamsMessage','建立第一個團隊，再加入成員與工作時間。');return}
 $('teamName').value=team.name;$('applyTeamBtn').disabled=!team.members.length;
 feedback('teamsMessage',team.members.length?`${team.members.length} 位成員。名單由你管理，電子郵件僅作聯絡資訊。`:'尚無成員，請在下方新增。');
 const list=$('teamMembersList');list.replaceChildren();
 team.members.forEach((member,index)=>{
  const row=document.createElement('div');row.className='member-row';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=member.name;const detail=document.createElement('small');detail.textContent=member.zone+' · '+scheduleLabel(member.schedule)+(member.email?' · '+member.email:'');info.append(name,detail);
  const actions=document.createElement('div');actions.className='row-actions';
  actions.append(rowButton('↑','將'+member.name+'往上移',()=>{[team.members[index-1],team.members[index]]=[team.members[index],team.members[index-1]];commitWorkspace();renderTeams()},index===0),rowButton('編輯','編輯'+member.name,()=>editMember(member)),rowButton('移除','移除成員'+member.name,()=>{if(!confirm('移除成員「'+member.name+'」？'))return;team.members.splice(index,1);if(!team.members.length&&workspace.activeTeamId===team.id)workspace.activeTeamId=null;commitWorkspace();resetMemberForm();renderTeams()}));
  row.append(info,actions);list.appendChild(row);
 });
}
window.addEventListener('plannerchange',()=>{if(activeTeam())return;workspace.cities=zones.map(z=>({zone:z.zone,country:z.country||null}));commitWorkspace()});
$('workspaceScope').onchange=()=>{workspace.activeTeamId=$('workspaceScope').value==='personal'?null:$('workspaceScope').value;writeLocal();applyWorkspace()};
$('manageCitiesBtn').onclick=()=>{renderFavorites();$('citiesSettingsDialog').showModal()};
$('addFavoriteCity').onclick=()=>{workspace.activeTeamId=null;writeLocal();applyWorkspace();$('citiesSettingsDialog').close();$('addBtn').click()};
$('scheduleBtn').onclick=()=>{fillSchedule('work',workspace.schedule);feedback('scheduleMessage','');$('scheduleDialog').showModal()};
$('scheduleForm').onsubmit=event=>{event.preventDefault();const schedule=readSchedule('work');if(!scheduleValid(schedule)){feedback('scheduleMessage','請至少選一天工作日，開始與結束時間不可相同。',true);return}workspace.schedule=schedule;commitWorkspace();$('scheduleDialog').close();toast('工作時間已儲存')};
$('teamsBtn').onclick=()=>{renderTeams();resetMemberForm();$('teamsDialog').showModal()};
$('newTeamForm').onsubmit=event=>{event.preventDefault();const name=$('newTeamName').value.trim();if(!name)return;if(workspace.teams.length>=30){feedback('teamsMessage','最多可建立 30 個團隊。',true);return}const team={id:crypto.randomUUID(),name,members:[]};workspace.teams.push(team);managedTeamId=team.id;$('newTeamForm').reset();commitWorkspace();resetMemberForm();renderTeams()};
$('managedTeam').onchange=()=>{managedTeamId=$('managedTeam').value;resetMemberForm();renderTeams()};
$('renameTeamForm').onsubmit=event=>{event.preventDefault();const name=$('teamName').value.trim();if(!name)return;managedTeam().name=name;commitWorkspace();renderTeams()};
$('deleteTeamBtn').onclick=()=>{const team=managedTeam();if(!team||!confirm('刪除團隊「'+team.name+'」及其成員名單？'))return;workspace.teams=workspace.teams.filter(t=>t.id!==team.id);if(workspace.activeTeamId===team.id)workspace.activeTeamId=null;commitWorkspace();resetMemberForm();renderTeams()};
$('applyTeamBtn').onclick=()=>{const team=managedTeam();if(!team?.members.length)return;workspace.activeTeamId=team.id;writeLocal();applyWorkspace();$('teamsDialog').close();toast('已套用團隊時區與工作時間')};
$('cancelMemberEdit').onclick=resetMemberForm;
$('memberForm').onsubmit=event=>{
 event.preventDefault();const team=managedTeam();if(!team)return;const schedule=readSchedule('member');const name=$('memberName').value.trim();if(!name||!scheduleValid(schedule)){feedback('memberMessage','請輸入姓名，至少選一天工作日，開始與結束時間不可相同。',true);return}
 if(!editingMemberId&&team.members.length>=100){feedback('memberMessage','每個團隊最多 100 位成員。',true);return}
 const member={id:editingMemberId||crypto.randomUUID(),name,email:$('memberEmail').value.trim(),zone:$('memberZone').value,schedule};
 const index=team.members.findIndex(m=>m.id===editingMemberId);if(index>=0)team.members[index]=member;else team.members.push(member);
 commitWorkspace();resetMemberForm();renderTeams();toast(index>=0?'成員資料已更新':'成員已加入');
};
const knownZones=new Set();allLocations.forEach(city=>{if(!knownZones.has(city.zone)){$('memberZone').appendChild(new Option(city.flag+' '+city.countryName+' · '+city.city+' — '+city.zone,city.zone));knownZones.add(city.zone)}});
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$('accountBtn').onclick=()=>{$('accountDialog').showModal()};
async function startGoogleLogin(){
 if(!googleClient){feedback('accountMessage','登入程式尚未載入，請重新整理。',true);return}
 if(!['http:','https:'].includes(location.protocol)){feedback('accountMessage','請透過網站網址開啟頁面，再使用 Google 登入。',true);return}
 $('googleLoginBtn').disabled=true;feedback('accountMessage','正在確認 Google 登入…');
 try{
  const response=await fetch(TIMESYNC_SUPABASE.url+'/auth/v1/settings',{headers:{apikey:TIMESYNC_SUPABASE.key}});if(!response.ok)throw new Error('無法確認登入服務，請稍後再試。');const settings=await response.json();
  if(!settings.external?.google)throw new Error('Google 登入尚未開通，請管理者先完成 Google OAuth 設定。目前仍可使用此裝置的所有規劃功能。');
  writeLocal();const {error}=await googleClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,scopes:'openid email profile'}});if(error)throw error;
 }catch(error){feedback('accountMessage',error.message,true)}finally{$('googleLoginBtn').disabled=false}
}
$('googleLoginBtn').onclick=startGoogleLogin;
async function loadCloudWorkspace(force=false){
 const epoch=authEpoch;if(!currentUser||!googleClient)return;
 feedback('syncStatus','正在讀取雲端設定…');
 const {data:prefs,error:prefError}=await googleClient.from('timesync_preferences').select('*').eq('user_id',currentUser.id).maybeSingle();if(prefError)throw prefError;
 const {data:teams,error:teamError}=await googleClient.from('timesync_teams').select('*,members:timesync_team_members(*)').eq('owner_id',currentUser.id).order('position');if(teamError)throw teamError;
 if(epoch!==authEpoch)return;
 if(!prefs){workspaceRevision=0;syncReady=true;await syncWorkspace();return}
 if(workspaceDirty&&!force){workspaceRevision=prefs.revision;syncReady=false;writeLocal();feedback('syncStatus','此裝置有未同步的變更。請選擇「儲存到雲端」保留此裝置設定，或「載入雲端設定」使用雲端版本。');return}
 const active=workspace.activeTeamId;
 workspace=cleanWorkspace({cities:prefs.cities,schedule:{start:prefs.work_start.slice(0,5),end:prefs.work_end.slice(0,5),days:prefs.work_days},teams:(teams||[]).map(t=>({id:t.id,name:t.name,members:(t.members||[]).sort((a,b)=>a.position-b.position).map(m=>({id:m.id,name:m.name,email:m.email,zone:m.timezone,schedule:{start:m.work_start.slice(0,5),end:m.work_end.slice(0,5),days:m.work_days}}))})),activeTeamId:active});
 workspaceRevision=prefs.revision;workspaceDirty=false;syncReady=true;writeLocal();applyWorkspace();feedback('syncStatus','已載入雲端設定。');
}
function syncWorkspace(){
 const epoch=authEpoch;
 const job=syncChain.catch(()=>{}).then(async()=>{
  if(!currentUser||!googleClient||epoch!==authEpoch)return;
  const snapshot=JSON.stringify(workspace);feedback('syncStatus','正在儲存到雲端…');
  const {data,error}=await googleClient.rpc('save_timesync_workspace',{p_state:JSON.parse(snapshot),p_expected_revision:workspaceRevision});if(error){syncReady=false;feedback('syncStatus',error.message,true);throw error}
  if(epoch!==authEpoch)return;workspaceRevision=data;workspaceDirty=JSON.stringify(workspace)!==snapshot;syncReady=true;writeLocal();feedback('syncStatus',workspaceDirty?'仍有變更待同步。':'設定已同步至雲端。');
 });syncChain=job;return job;
}
$('syncWorkspaceBtn').onclick=async()=>{try{await syncWorkspace()}catch{}};
$('reloadWorkspaceBtn').onclick=async()=>{if(workspaceDirty&&!confirm('載入雲端設定會取代此裝置尚未同步的變更，確定載入？'))return;clearTimeout(syncTimer);try{await syncChain.catch(()=>{});await loadCloudWorkspace(true)}catch(error){feedback('syncStatus',error.message,true)}};
$('googleLogoutBtn').onclick=async()=>{
 $('googleLogoutBtn').disabled=true;
 try{clearTimeout(syncTimer);await syncChain.catch(()=>{});const {error}=await googleClient.auth.signOut({scope:'local'});if(error)throw error;feedback('accountMessage','已登出，現在使用此裝置的訪客設定。')}
 catch(error){feedback('accountMessage',error.message,true)}finally{$('googleLogoutBtn').disabled=false}
};
async function handleIdentity(user){
 if(currentUser?.id===user?.id)return;
 const guestState=structuredClone(workspace);authEpoch++;clearTimeout(syncTimer);currentUser=user||null;syncReady=false;
 const cached=readLocal();if(user&&!cached){workspace=guestState;workspaceDirty=true;workspaceRevision=0}
 applyWorkspace();
 if(user){try{await loadCloudWorkspace()}catch(error){feedback('syncStatus','雲端連線失敗，設定仍保存在此裝置：'+error.message,true)}}else feedback('syncStatus','設定儲存在此裝置。');
}
readLocal();applyWorkspace();
if(googleClient){
 googleClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='INITIAL_SESSION')setTimeout(()=>handleIdentity(session?.user).catch(error=>feedback('accountMessage',error.message,true)),0)});
 googleClient.auth.getSession().then(({data,error})=>{if(error){feedback('accountMessage','登入未完成：'+error.message,true);$('accountDialog').showModal();return}return handleIdentity(data.session?.user)}).catch(error=>feedback('accountMessage',error.message,true));
 const oauthError=new URLSearchParams(location.hash.slice(1)).get('error_description');if(oauthError){feedback('accountMessage','Google 登入未完成：'+oauthError,true);$('accountDialog').showModal();history.replaceState(null,'',location.pathname+location.search)}
}
