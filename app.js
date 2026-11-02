const locations = [
  {city:'台北',en:'Taipei',zone:'Asia/Taipei',flag:'🇹🇼'},
  {city:'東京',en:'Tokyo',zone:'Asia/Tokyo',flag:'🇯🇵'},
  {city:'倫敦',en:'London',zone:'Europe/London',flag:'🇬🇧'},
  {city:'紐約',en:'New York',zone:'America/New_York',flag:'🇺🇸'},
  {city:'舊金山',en:'San Francisco',zone:'America/Los_Angeles',flag:'🇺🇸'},
  {city:'新加坡',en:'Singapore',zone:'Asia/Singapore',flag:'🇸🇬'},
  {city:'雪梨',en:'Sydney',zone:'Australia/Sydney',flag:'🇦🇺'},
  {city:'柏林',en:'Berlin',zone:'Europe/Berlin',flag:'🇩🇪'},
  {city:'巴黎',en:'Paris',zone:'Europe/Paris',flag:'🇫🇷'},
  {city:'杜拜',en:'Dubai',zone:'Asia/Dubai',flag:'🇦🇪'},
  {city:'孟買',en:'Mumbai',zone:'Asia/Kolkata',flag:'🇮🇳'},
  {city:'首爾',en:'Seoul',zone:'Asia/Seoul',flag:'🇰🇷'},
  {city:'多倫多',en:'Toronto',zone:'America/Toronto',flag:'🇨🇦'}
];
const countryNames = new Intl.DisplayNames(['zh-Hant'], {type:'region'});
const englishCountryNames = new Intl.DisplayNames(['en'], {type:'region'});
const flagFor = code => [...code].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
const originalLocations = locations.slice();
const allLocations = countryTimeZones.map(([country, zone]) => {
  const existing = originalLocations.find(item => item.zone === zone);
  const englishCity = zone.split('/').slice(1).join(' / ').replace(/_/g, ' ') || 'UTC';
  return {city:existing?.city || englishCity, en:existing?.en || englishCity, zone, country,
    countryName:countryNames.of(country), countryEnglish:englishCountryNames.of(country), flag:flagFor(country)};
}).filter(item => { try { new Intl.DateTimeFormat('en', {timeZone:item.zone}); return true; } catch { return false; } });
allLocations.sort((a,b) => a.countryName.localeCompare(b.countryName, 'zh-Hant') || a.en.localeCompare(b.en));
let zones = locations.slice(0,4); let selectedHour = 10; let selectedDate = dateInTaipei(new Date()); let recommendedHour = null;
const $ = id => document.getElementById(id);
function parts(date, zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
function dateInTaipei(date){const p=parts(date,'Asia/Taipei');return `${p.year}-${p.month}-${p.day}`;}
function instant(hour){return new Date(`${selectedDate}T00:00:00+08:00`).getTime()+hour*3600000;}
function offset(zone, time){const label=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date(time)).find(p=>p.type==='timeZoneName').value;return label.replace('GMT','UTC');}
function dayLabel(p){const d=`${p.year}-${p.month}-${p.day}`;if(d===selectedDate)return '當日';return d<selectedDate?'前一天':'隔一天';}
function formatDate(date){const [y,m,d]=date.split('-');return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`}
function render(){
 $('zoneCount').textContent=String(zones.length).padStart(2,'0'); $('dateInput').value=selectedDate;$('dateLabel').textContent=formatDate(selectedDate);$('selectedDate').textContent=`${formatDate(selectedDate)} · 台北時間 (UTC+08:00)`;
 $('hours').innerHTML=Array.from({length:8},(_,i)=>`<span>${String(i*3).padStart(2,'0')}:00</span>`).join('');
 $('zoneRows').innerHTML=zones.map((z,index)=>{const p=parts(new Date(instant(selectedHour)),z.zone);const cells=Array.from({length:24},(_,h)=>{let local=Number(parts(new Date(instant(h)+1800000),z.zone).hour);return `<div class="hour-cell ${local>=9&&local<18?'work':''}"></div>`}).join('');return `<div class="zone-row"><div class="zone-info"><div class="flag">${z.flag}</div><div><div class="city-name">${z.city}</div><div class="city-sub">${z.en} · ${offset(z.zone,instant(selectedHour))}</div></div><div class="local-time">${p.hour}:${p.minute}<small>${dayLabel(p)}</small></div>${index?`<button class="remove-zone" data-index="${index}" aria-label="移除${z.city}">×</button>`:''}</div><div class="track" data-track="${index}" title="點擊或拖曳選擇時間">${cells}<div class="selection-line" style="left:${selectedHour/24*100}%"></div></div></div>`}).join('');
 const hour=Math.floor(selectedHour),minute=Math.round((selectedHour-hour)*60);$('selectedTime').innerHTML=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} <span>${hour<12?'AM':'PM'}</span>`;
 findRecommendation();
 document.querySelectorAll('.track').forEach(track=>{const update=e=>{const rect=track.getBoundingClientRect();selectedHour=Math.max(0,Math.min(23.5,Math.round((e.clientX-rect.left)/rect.width*48)/2));render()};track.addEventListener('pointerdown',e=>{e.preventDefault();update(e);const move=ev=>update(ev);const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)});});
 document.querySelectorAll('.remove-zone').forEach(btn=>btn.onclick=()=>{zones.splice(Number(btn.dataset.index),1);render()});
}
function findRecommendation(){let best=-1,bestHours=[];for(let h=0;h<24;h++){let score=zones.reduce((n,z)=>{const local=Number(parts(new Date(instant(h)+1800000),z.zone).hour);return n+(local>=9&&local<18?1:0)},0);if(score>best){best=score;bestHours=[h]}else if(score===best)bestHours.push(h)}recommendedHour=bestHours.includes(10)?10:bestHours[0];const end=(recommendedHour+1)%24;$('recommendTime').textContent=`${String(recommendedHour).padStart(2,'0')}:00 – ${String(end).padStart(2,'0')}:00`;$('recommendDetail').textContent=best===zones.length?'所有城市都在工作時間內':`${best} / ${zones.length} 個城市在工作時間內 · 台北時間`;}
function shiftDate(n){const d=new Date(`${selectedDate}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);selectedDate=d.toISOString().slice(0,10);render()}
$('prevDay').onclick=()=>shiftDate(-1);$('nextDay').onclick=()=>shiftDate(1);$('todayBtn').onclick=()=>{selectedDate=dateInTaipei(new Date());render()};$('dateInput').onchange=e=>{if(e.target.value){selectedDate=e.target.value;render()}};
function renderCityOptions(){
 const query=$('citySearch').value.trim().toLocaleLowerCase();
 const available=allLocations.filter(item => !zones.some(zone => zone.zone===item.zone && (!zone.country || zone.country===item.country)));
 const matches=available.filter(item => [item.city,item.en,item.country,item.countryName,item.countryEnglish,item.zone].some(value => value.toLocaleLowerCase().includes(query)));
 const select=$('citySelect');select.replaceChildren();
 matches.forEach(item => {const option=document.createElement('option');option.value=allLocations.indexOf(item);option.textContent=`${item.flag} ${item.countryName} · ${item.city}${item.city===item.en?'':` (${item.en})`} — ${item.zone}`;select.appendChild(option)});
 if(matches.length)select.selectedIndex=0;
 $('cityResults').textContent=`${matches.length} 個結果`; $('cityEmpty').hidden=matches.length>0; $('confirmAdd').disabled=matches.length===0;
}
$('addBtn').onclick=()=>{$('citySearch').value='';renderCityOptions();$('cityDialog').showModal();$('citySearch').focus()};
$('citySearch').oninput=renderCityOptions;
$('citySearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('citySelect').focus()}};
$('confirmAdd').onclick=e=>{const value=$('citySelect').value;if(value===''){e.preventDefault();return}const city=allLocations[Number(value)];if(city)zones.push(city);render()};
$('applyRecommendation').onclick=()=>{selectedHour=recommendedHour;render();toast('已套用建議時間')};
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500)}
$('copyBtn').onclick=async()=>{const lines=zones.map(z=>{const p=parts(new Date(instant(selectedHour)),z.zone);return `${z.city}：${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute} (${offset(z.zone,instant(selectedHour))})`});try{await navigator.clipboard.writeText(`TimeSync 會議時間\n${lines.join('\n')}`);toast('會議時間已複製')}catch{toast('無法複製，請確認瀏覽器的剪貼簿權限')}};
// Export UTC timestamps so calendar apps display the same instant in each viewer's time zone.
function calendarTimestamp(ms){return new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}
function escapeCalendarText(value){return value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function foldCalendarLine(line){const encoder=new TextEncoder();let result='', current='';for(const character of line){if(encoder.encode(current+character).length>75){result+=current+'\r\n';current=' '+character}else current+=character}return result+current}
$('calendarBtn').onclick=()=>{const hour=String(Math.floor(selectedHour)).padStart(2,'0');const minute=String(Math.round((selectedHour%1)*60)).padStart(2,'0');$('calendarStart').textContent=`${formatDate(selectedDate)} ${hour}:${minute} (UTC+08:00)`;$('calendarDialog').showModal()};
$('closeCalendar').onclick=()=>$('calendarDialog').close();
$('calendarForm').onsubmit=e=>{e.preventDefault();const title=$('meetingTitle').value.trim();if(!title){$('meetingTitle').setCustomValidity('請輸入會議名稱');$('meetingTitle').reportValidity();return}const start=instant(selectedHour), end=start+Number($('meetingDuration').value)*60000;const uid=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`)+'@timesync.local';const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TimeSync//Meeting Planner//ZH-TW','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${calendarTimestamp(Date.now())}`,`DTSTART:${calendarTimestamp(start)}`,`DTEND:${calendarTimestamp(end)}`,`SUMMARY:${escapeCalendarText(title)}`];const location=$('meetingLocation').value.trim(), notes=$('meetingNotes').value.trim();if(location)lines.push(`LOCATION:${escapeCalendarText(location)}`);if(notes)lines.push(`DESCRIPTION:${escapeCalendarText(notes)}`);lines.push('END:VEVENT','END:VCALENDAR');const blob=new Blob([lines.map(foldCalendarLine).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download='timesync-meeting.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('calendarDialog').close();toast('行事曆檔案已下載，請匯入行事曆')};
$('meetingTitle').oninput=()=>$('meetingTitle').setCustomValidity('');
$('helpBtn').onclick=()=>toast('點擊或拖曳時間軸，即可同步查看各城市時間');render();
