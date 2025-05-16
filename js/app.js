document.addEventListener('DOMContentLoaded', () => {
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

  function selectTerm(term,tab){ Array.from(tabs.children).forEach(t=>t.classList.remove('active')); tab.classList.add('active'); currentTerm=term; tsDiv.textContent=''; currentData=[]; setupUpload(); clearSchedule(); }
  function setupUpload(){ roomDiv.innerHTML=''; uploadDiv.innerHTML=`<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`; document.getElementById('file-input').onchange=e=>{ parseCSVFile(e.target.files[0],data=>{ currentData=data; tsDiv.textContent='Last upload: '+new Date().toLocaleString(); buildRoomDropdown(); renderSchedule(); }); }; }
  function buildRoomDropdown(){ const combos=[...new Set(currentData.map(i=>`${i.Building}-${i.Room}`))].sort(); roomDiv.innerHTML=`<label>Filter Bldg-Room: <select id="room-select"><option>All</option>${combos.map(r=>`<option>${r}</option>`).join('')}</select></label>`; document.getElementById('room-select').onchange=renderSchedule; }
  function clearSchedule(){ table.innerHTML=''; container.querySelectorAll('.class-block').forEach(e=>e.remove()); const header=table.insertRow(); header.insertCell().outerHTML='<th>Time</th>'; daysOfWeek.forEach(d=>header.insertCell().outerHTML=`<th>${d}</th>`); for(let t=360;t<=22*60;t+=30){ const row=table.insertRow(); const hh=Math.floor(t/60),mm=t%60,h12=(hh+11)%12+1,ap=hh<12?'AM':'PM'; row.insertCell().outerHTML=`<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`; daysOfWeek.forEach(()=>row.insertCell()); } }
  function renderSchedule(){ clearSchedule(); const filt=document.getElementById('room-select')?.value||'All',data=filt==='All'?currentData:currentData.filter(i=>`${i.Building}-${i.Room}`===filt),rect=container.getBoundingClientRect(); daysOfWeek.forEach((day,dIdx)=>{ const events=data.filter(i=>i.Days.includes(day)).map(i=>({...i,startMin:parseTime(i.Start_Time),endMin:parseTime(i.End_Time)})).sort((a,b)=>a.startMin-b.startMin),cols=[]; events.forEach(ev=>{ let placed=false; for(let c=0;c<cols.length;c++){ if(cols[c][cols[c].length-1].endMin<=ev.startMin){ cols[c].push(ev); ev.col=c; placed=true; break; } } if(!placed){ ev.col=cols.length; cols.push([ev]); }}); const colCount=cols.length||1; cols.flat().forEach(ev=>{ const minutes=ev.startMin-360, rowIndex=Math.floor(minutes/30)+1, remainder=minutes%30; const cell=table.rows[rowIndex].cells[dIdx+1],cellRect=cell.getBoundingClientRect(), topPx=cellRect.top-rect.top+(remainder/30)*cellRect.height, leftPx=cellRect.left-rect.left+ev.col*(cellRect.width/colCount), widthPx=cellRect.width/colCount, heightPx=((ev.endMin-ev.startMin)/30)*cellRect.height; const block=document.createElement('div'); block.className='class-block'; block.style.top=topPx+'px'; block.style.left=leftPx+'px'; block.style.width=widthPx+'px'; block.style.height=heightPx+'px'; block.innerHTML=`<span>${ev.Subject_Course}</span><br><span>${ev.CRN}</span><br><span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span>`; container.appendChild(block); }); }); }
  function parseTime(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
  function format12(t){ let [h,m]=t.split(':').map(Number),ap=h<12?'AM':'PM'; h=(h+11)%12+1; return`${h}:${('0'+m).slice(-2)}${ap}`; }
});
