document.addEventListener('DOMContentLoaded', () => {
  let schedules = JSON.parse(localStorage.getItem('cos_schedules') || '{}');

  // Load schedules cache
  let schedules = JSON.parse(localStorage.getItem('cos_schedules') || '{}');

  const terms=['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const daysOfWeek=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData=[], currentTerm='';

  const tabs=document.getElementById('term-tabs');
  const uploadDiv=document.getElementById('upload-container');
  const tsDiv=document.getElementById('upload-timestamp');
  const roomDiv=document.getElementById('room-filter');
  const startSel=document.getElementById('avail-start'), endSel=document.getElementById('avail-end');
  const checkBtn=document.getElementById('avail-check-btn'), resultsDiv=document.getElementById('avail-results');
  const table=document.getElementById('schedule-table'), container=document.getElementById('schedule-container');

  // build tabs
  terms.forEach((term,i)=>{ const tab=document.createElement('div'); tab.className='tab'+(i===2?' active':''); tab.textContent=term; tab.onclick=()=>selectTerm(term,tab); tabs.appendChild(tab); });
  selectTerm(terms[2],tabs.children[2]);

  // populate availability times
  for(let m=360;m<=22*60;m+=5){ const h=Math.floor(m/60),mm=m%60,ap=h<12?'AM':'PM',h12=(h+11)%12+1,label=`${h12}:${('0'+mm).slice(-2)} ${ap}`; startSel.innerHTML+=`<option>${label}</option>`; endSel.innerHTML+=`<option>${label}</option>`; }

  checkBtn.onclick=()=>{
    const days=[...document.querySelectorAll('.availability-ui input[type=checkbox]:checked')].map(cb=>cb.value);
    const s=startSel.value,e=endSel.value; if(!days.length||!s||!e){resultsDiv.textContent='Please select days and times.'; return;}
    const toMin=t=>{const [time,ap]=t.split(' '); let [h,m]=time.split(':').map(Number); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h*60+m;};
    const sMin=toMin(s),eMin=toMin(e);
    const rooms=[...new Set(currentData.map(i=>`${i.Building}-${i.Room}`))];
    const occ=new Set(); currentData.forEach(i=>{ if(i.Days.some(d=>days.includes(d))){ const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time); if(!(ei<=sMin||si>=eMin))occ.add(`${i.Building}-${i.Room}`); }} );
    const avail=rooms.filter(r=>!occ.has(r));
    if(avail.length) resultsDiv.innerHTML='<table><tr><th>Available Rooms</th></tr>'+avail.map(r=>`<tr><td>${r}</td></tr>`).join('')+'</table>';
    else resultsDiv.textContent='No rooms available.';
  };

  
function selectTerm(term, tab) {
    // Set active tab
    currentTerm = term;
    document.querySelectorAll('#term-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    // Clear and setup UI
    clearSchedule();
    setupUpload();
    // Load existing schedule for this term if present
    if (schedules[currentTerm]) {
      currentData = schedules[currentTerm].data;
      tsDiv.textContent = schedules[currentTerm].timestamp;
      buildRoomDropdown();
      renderSchedule();
    } else {
      currentData = [];
      tsDiv.textContent = '';
      document.getElementById('room-filter').innerHTML = '';
    }
}
);
