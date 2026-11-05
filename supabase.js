// Visitors can submit meetings; database records are never publicly readable.
const sbConfig=TIMESYNC_SUPABASE;
const submittedMeetings=[];
// Discard credentials retained by the previous sign-in version.
try {
 sessionStorage.removeItem('timesync.supabase.session');
 localStorage.removeItem('timesync.supabase.config');
} catch {}
function cloudMessage(message){$('cloudStatus').textContent=message;}
async function saveMeeting(meeting){
 const response=await fetch(sbConfig.url+'/rest/v1/timesync_meetings',{
  method:'POST',
  headers:{apikey:sbConfig.key,'Content-Type':'application/json',Prefer:'return=minimal'},
  body:JSON.stringify(meeting)
 });
 if(!response.ok){
  let data;try{data=await response.json()}catch{}
  throw new Error(data?.message || `儲存失敗 (${response.status})，請稍後再試。`);
 }
}
function renderSubmittedMeetings(){
 const list=$('savedMeetings');list.replaceChildren();
 submittedMeetings.forEach(meeting=>{
  const row=document.createElement('div');row.className='saved-meeting';
  const info=document.createElement('div');
  const title=document.createElement('strong');title.textContent=meeting.title;
  const date=document.createElement('small');
  date.textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date(meeting.starts_at))+' · 台北時間';
  info.append(title,date);
  const button=document.createElement('button');button.type='button';button.textContent='套用';button.onclick=()=>applyMeeting(meeting);
  row.append(info,button);list.appendChild(row);
 });
}
function applyMeeting(meeting){const p=parts(new Date(meeting.starts_at),'Asia/Taipei');selectedDate=`${p.year}-${p.month}-${p.day}`;selectedHour=Number(p.hour)+Number(p.minute)/60;$('meetingTitle').value=meeting.title;$('meetingTitle').setCustomValidity('');$('meetingDuration').value=String(meeting.duration_minutes);$('meetingLocation').value=meeting.location||'';$('meetingNotes').value=meeting.notes||'';if(Array.isArray(meeting.zones)){const restored=meeting.zones.map(saved=>allLocations.find(z=>z.zone===saved.zone && z.country===saved.country)||locations.find(z=>z.zone===saved.zone)).filter(Boolean);if(restored.length)zones=restored;}render();$('calendarStart').textContent=`${formatDate(selectedDate)} ${p.hour}:${p.minute} (UTC+08:00)`;toast('已套用會議資料');}
$('saveMeeting').onclick=async()=>{
 const button=$('saveMeeting');
 if(button.disabled || !$('calendarForm').reportValidity())return;
 const title=$('meetingTitle').value.trim();
 if(!title){$('meetingTitle').setCustomValidity('請輸入會議名稱');$('meetingTitle').reportValidity();return}
 button.disabled=true;cloudMessage('儲存中…');
 try{
  const meeting={title,starts_at:new Date(instant(selectedHour)).toISOString(),duration_minutes:Number($('meetingDuration').value),location:$('meetingLocation').value.trim(),notes:$('meetingNotes').value.trim(),zones:zones.map(z=>({zone:z.zone,country:z.country||null}))};
  await saveMeeting(meeting);
  submittedMeetings.unshift(meeting);submittedMeetings.splice(50);
  renderSubmittedMeetings();cloudMessage('會議已儲存。本清單僅顯示本次開啟頁面後儲存的會議。');toast('會議已儲存');
 }catch(error){cloudMessage(error.message);toast('儲存失敗，請稍後再試')}
 finally{button.disabled=false}
};
