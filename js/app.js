// js/app.js

// Use global BACKEND_BASE_URL from index.html
const API_BASE = window.BACKEND_BASE_URL;

// Data stores
let scheduleData = [];
let roomMetadata = [];
const metadataMap = {};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupTermTabs();
  setupViewSelector();
  setupUpload();
  setupMetadataUpload();
  setupAvailability();
});

// Semester tabs
function setupTermTabs() {
  const terms = ['Summer 2025','Fall 2025','Spring 2026'];
  const tabs = document.getElementById('term-tabs');
  terms.forEach((term, idx) => {
    const btn = document.createElement('button');
    btn.textContent = term;
    btn.className = idx === 0 ? 'active' : '';
    btn.onclick = () => selectTerm(term, btn);
    tabs.appendChild(btn);
  });
  selectTerm(terms[0], tabs.children[0]);
}

// Select term
function selectTerm(term, btn) {
  Array.from(document.getElementById('term-tabs').children)
    .forEach(b=>b.classList.toggle('active', b===btn));
  loadSchedule();
}

// View selector (noop until implemented)
function setupViewSelector() {
  document.getElementById('viewSelect').onchange = () => {};
}

// Upload schedule
function setupUpload() {
  document.getElementById('scheduleUpload')
    .addEventListener('change', async e => {
      try {
        const file = e.target.files[0];
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${API_BASE}/api/schedule`, { method:'POST', body: fd });
        if(!res.ok) throw new Error(res.statusText);
        await loadSchedule();
      } catch(err) {
        alert('Upload failed: '+err.message);
      }
    });
}

// Load schedule from backend and render
async function loadSchedule() {
  const res = await fetch(`${API_BASE}/api/schedule`);
  scheduleData = await res.json();
  document.getElementById('upload-timestamp').textContent =
    'Uploaded: '+new Date().toLocaleString();
  renderSchedule();
}

// Render schedule grid
function renderSchedule() {
  const table = document.getElementById('schedule-table');
  table.innerHTML = '';
  scheduleData.forEach(r => {
    const tr = document.createElement('tr');
    ['Building','Room','Days','Start_Time','End_Time'].forEach(key => {
      const td = document.createElement('td');
      td.textContent = Array.isArray(r[key]) ? r[key].join(',') : r[key];
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}

// Metadata upload
function setupMetadataUpload() {
  document.getElementById('metadata-input')
    .addEventListener('change', async e => {
      try {
        const file = e.target.files[0];
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch(`${API_BASE}/api/rooms/metadata`, { method:'POST', body:fd });
        if(!res.ok) throw new Error(res.statusText);
        await fetchRoomMetadata();
      } catch(err) {
        alert('Metadata upload failed: '+err.message);
      }
    });
  fetchRoomMetadata();
}

// Fetch metadata and populate filters
async function fetchRoomMetadata() {
  const res = await fetch(`${API_BASE}/api/rooms/metadata`);
  roomMetadata = await res.json();
  metadataMapClear();
  roomMetadata.forEach(r => metadataMap[`${r.building}-${r.room}`]=r);
  populateFilters();
}

function metadataMapClear() {
  for(const k in metadataMap) delete metadataMap[k];
}

function populateFilters() {
  const campusSel = document.getElementById('avail-campus-select');
  const typeSel = document.getElementById('avail-type-select');
  campusSel.innerHTML = '<option value="">All</option>';
  typeSel.innerHTML = '<option value="">All</option>';
  Array.from(new Set(roomMetadata.map(r=>r.campus)))
    .sort().forEach(c=>campusSel.append(new Option(c,c)));
  Array.from(new Set(roomMetadata.map(r=>r.type)))
    .sort().forEach(t=>typeSel.append(new Option(t,t)));
}

// Availability logic
function setupAvailability() {
  document.getElementById('avail-check-btn')
    .addEventListener('click', handleAvailability);
}

function handleAvailability() {
  const days = Array.from(document.querySelectorAll('#days input:checked')).map(i=>i.value);
  const start = document.getElementById('avail-start').value;
  const end = document.getElementById('avail-end').value;
  let rooms = roomMetadata.map(r=>`${r.building}-${r.room}`);
  // mark occupied
  const occ = new Set();
  scheduleData.forEach(r => {
    const id = `${r.Building}-${r.Room}`;
    if(days.some(d=>r.Days.includes(d))) occ.add(id);
  });
  let avail = rooms.filter(id=>!occ.has(id));
  // filters
  const campus = document.getElementById('avail-campus-select').value;
  const type = document.getElementById('avail-type-select').value;
  const minCap = Number(document.getElementById('avail-min-capacity').value)||0;
  if(campus) avail=avail.filter(id=>metadataMap[id].campus===campus);
  if(type) avail=avail.filter(id=>metadataMap[id].type===type);
  if(minCap) avail=avail.filter(id=>metadataMap[id].capacity>=minCap);
  // render
  const resDiv = document.getElementById('avail-results');
  resDiv.innerHTML = avail.length
    ? '<ul>'+avail.map(id=>`<li>${id} — max ${metadataMap[id].capacity}</li>`).join('')+'</ul>'
    : 'No rooms available.';
}
