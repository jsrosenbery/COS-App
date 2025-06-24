// js/app.js

const API_BASE = window.BACKEND_BASE_URL;
let scheduleData = [];
let roomMetadata = [];
const metadataMap = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderTermTabs();
  setupViewSelector();
  document.getElementById('scheduleUpload').onchange = handleScheduleUpload;
  document.getElementById('metadataUpload').onchange = handleMetadataUpload;
  document.getElementById('avail-check-btn').onclick = handleAvailability;
  fetchRoomMetadata();
});

// Terms
function renderTermTabs() {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const container = document.getElementById('term-tabs');
  terms.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.textContent = t;
    btn.onclick = () => currentTerm = t;
    if(i===0) btn.classList.add('active');
    container.appendChild(btn);
  });
  window.currentTerm = terms[0];
}

function setupViewSelector() {
  // stub
}

// Upload schedule
async function handleScheduleUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  const password = prompt('Enter upload password:');
  if(!password) return alert('Password required');
  try {
    const res = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(currentTerm)}`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({csv: text, password})
    });
    if(!res.ok) throw new Error(res.statusText);
    alert('Upload successful');
    loadSchedule();
  } catch(err) {
    alert('Upload failed: '+err.message);
  }
}

// Load schedule
async function loadSchedule() {
  try {
    const res = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(currentTerm)}`);
    const {data} = await res.json();
    scheduleData = data;
  } catch {
    // fallback generic
    const res = await fetch(`${API_BASE}/api/schedule`);
    scheduleData = await res.json();
  }
  renderSchedule();
  document.getElementById('upload-timestamp').textContent = 'Last upload: '+new Date().toLocaleString();
}

// Render grid
function renderSchedule() {
  const tbl = document.getElementById('schedule-table');
  tbl.innerHTML = '';
  scheduleData.forEach(r => {
    const tr = document.createElement('tr');
    ['Building','Room','Days','Start_Time','End_Time'].forEach(key => {
      const td = document.createElement('td');
      td.textContent = Array.isArray(r[key])? r[key].join(','): r[key];
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  });
}

// Metadata
async function handleMetadataUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/api/rooms/metadata`, {method:'POST', body: fd});
    if(!res.ok) throw new Error(res.statusText);
    fetchRoomMetadata();
    alert('Metadata uploaded');
  } catch(err) {
    alert('Metadata upload failed: '+err.message);
  }
}

async function fetchRoomMetadata() {
  const res = await fetch(`${API_BASE}/api/rooms/metadata`);
  roomMetadata = await res.json();
  roomMetadata.forEach(r => {
    metadataMap[`${r.building}-${r.room}`] = r;
  });
  populateFilters();
}

function populateFilters() {
  const csel = document.getElementById('avail-campus');
  const tsel = document.getElementById('avail-type');
  csel.innerHTML = '<option value="">All</option>';
  tsel.innerHTML = '<option value="">All</option>';
  Array.from(new Set(roomMetadata.map(r=>r.campus))).forEach(c=>csel.append(new Option(c,c)));
  Array.from(new Set(roomMetadata.map(r=>r.type))).forEach(t=>tsel.append(new Option(t,t)));
}

// Availability
function handleAvailability() {
  const days = Array.from(document.getElementById('daySelect').selectedOptions).map(o=>o.value);
  const s = document.getElementById('avail-start').value;
  const e = document.getElementById('avail-end').value;
  let avail = Object.keys(metadataMap);
  // exclude occupied
  scheduleData.forEach(r => {
    if(r.Days.some(d=>days.includes(d))) {
      delete metadataMap[`${r.Building}-${r.Room}`];
    }
  });
  // filters
  const campus = document.getElementById('avail-campus').value;
  const type = document.getElementById('avail-type').value;
  const minCap = Number(document.getElementById('avail-min-capacity').value)||0;
  avail = avail.filter(id=>{
    const m = metadataMap[id];
    if(campus && m.campus!==campus) return false;
    if(type && m.type!==type) return false;
    if(m.capacity<minCap) return false;
    return true;
  });
  document.getElementById('avail-results').innerHTML = avail.map(id=>`<div>${id} — max ${metadataMap[id].capacity}</div>`).join('') || 'No rooms available';
}
