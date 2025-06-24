// js/app.js
const API_BASE = window.BACKEND_BASE_URL;
let scheduleData = [], roomMetadata = [], metadataMap = {}, currentTerm = '';

document.addEventListener('DOMContentLoaded', () => {
  setupTermTabs(); setupViewSelector(); setupScheduleUpload();
  setupMetadataUpload(); loadRoomMetadata();
});

function setupTermTabs() {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const tabs = document.getElementById('term-tabs');
  terms.forEach((term,i) => {
    const btn = document.createElement('button'); btn.textContent=term;
    if(i===0) btn.classList.add('active');
    btn.onclick = () => { currentTerm=term; tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn)); showView('snapshot'); loadSchedule(term); };
    tabs.appendChild(btn);
  });
  currentTerm = terms[0]; loadSchedule(currentTerm);
}

function setupViewSelector() {
  document.getElementById('viewSelect').onchange = e => showView(e.target.value);
}

function showView(view) {
  ['snapshot','heatmap','linechart','calendar'].forEach(v => {
    document.getElementById(v+'-view').style.display = v===view?'block':'none';
  });
  if(view==='snapshot') renderScheduleGrid();
}

async function loadSchedule(term) {
  try {
    let res = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(term)}`);
    if(!res.ok) res = await fetch(`${API_BASE}/api/schedule`);
    scheduleData = await res.json();
    document.getElementById('upload-timestamp').textContent = 'Last upload: '+new Date().toLocaleString();
    if(document.getElementById('viewSelect').value==='snapshot') renderScheduleGrid();
  } catch(e){ alert('Load failed'); }
}

async function setupScheduleUpload() {
  document.getElementById('scheduleUpload').onchange = async e => {
    const file=e.target.files[0], pwd=document.getElementById('uploadPassword').value||prompt('Password:');
    if(!file||!pwd) return;
    const fd=new FormData(); fd.append('file',file); fd.append('password',pwd);
    let res=await fetch(API_BASE+'/api/schedule',{method:'POST',body:fd});
    if(res.ok) loadSchedule(currentTerm),alert('Uploaded'); else alert('Upload error');
  };
}

function setupMetadataUpload() {
  const inp=document.getElementById('metadata-input'); if(!inp) return;
  inp.onchange = async e => {
    const fd=new FormData(); fd.append('file',e.target.files[0]);
    const res=await fetch(API_BASE+'/api/rooms/metadata',{method:'POST',body:fd});
    if(res.ok) loadRoomMetadata(),alert('Metadata uploaded'); else alert('Meta error');
  };
}

async function loadRoomMetadata() {
  const res=await fetch(API_BASE+'/api/rooms/metadata'); roomMetadata=await res.json();
  metadataMap={}; roomMetadata.forEach(r=>metadataMap[`${r.building}-${r.room}`]=r);
}

function renderScheduleGrid() {
  const data = normalizeRows(scheduleData);
  const table=document.getElementById('schedule-table'); table.innerHTML='';
  if($.fn.dataTable.isDataTable(table)) $(table).DataTable().clear().destroy();
  $(table).DataTable({ data, columns:[
    {title:'Building',data:'Building'},{title:'Room',data:'Room'},{title:'Days',data:'Days'},{title:'Start',data:'Start_Time'},{title:'End',data:'End_Time'}
  ]});
}
