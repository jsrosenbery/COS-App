// js/app.js

// API base URL from global
const API_BASE = window.BACKEND_BASE_URL || 'https://app-backend-pp98.onrender.com';

// Data stores
let scheduleData = [];
let roomMetadata = [];
const metadataMap = {};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupTermTabs();
  setupViewSelector();
  setupScheduleUpload();
  setupMetadataUpload();
  setupAvailability();
});

// Semester tabs
function setupTermTabs() {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const tabs = document.getElementById('term-tabs');
  terms.forEach((term, idx) => {
    const btn = document.createElement('button');
    btn.textContent = term;
    if (idx === 0) btn.classList.add('active');
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      loadSchedule(term);
    });
    tabs.appendChild(btn);
  });
  // Load first term by default
  loadSchedule(terms[0]);
}

// View selector (no-op for now)
function setupViewSelector() {
  document.getElementById('viewSelect').addEventListener('change', () => {
    // Implement view switching if needed
  });
}

// Schedule upload
function setupScheduleUpload() {
  const input = document.getElementById('scheduleUpload');
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    let password = document.getElementById('uploadPassword')?.value;
    if (!password) password = prompt('Enter upload password:');
    if (!password) return alert('Password required');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('password', password);
    try {
      const res = await fetch(`${API_BASE}/api/schedule`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      await loadSchedule(); // reload with current term
      alert('Upload successful');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  });
}

// Load schedule for a term
async function loadSchedule(term) {
  try {
    const url = term ? `${API_BASE}/api/schedule/${encodeURIComponent(term)}` : `${API_BASE}/api/schedule`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    scheduleData = await res.json();
    document.getElementById('upload-timestamp').textContent = 'Last upload: ' + new Date().toLocaleString();
    renderSchedule();
  } catch (err) {
    console.error('Failed to load schedule:', err);
    alert('Failed to load schedule: ' + err.message);
  }
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
  const input = document.getElementById('metadata-input');
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/rooms/metadata`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      await fetchRoomMetadata();
      alert('Metadata upload successful');
    } catch (err) {
      alert('Metadata upload failed: ' + err.message);
    }
  });
  fetchRoomMetadata();
}

// Fetch room metadata
async function fetchRoomMetadata() {
  try {
    const res = await fetch(`${API_BASE}/api/rooms/metadata`);
    if (!res.ok) throw new Error(res.statusText);
    roomMetadata = await res.json();
    metadataMapClear();
    roomMetadata.forEach(r => metadataMap[`${r.building}-${r.room}`] = r);
    populateFilters();
  } catch (err) {
    console.error('Failed to fetch metadata:', err);
  }
}

function metadataMapClear() {
  Object.keys(metadataMap).forEach(k => delete metadataMap[k]);
}

// Populate campus/type filters
function populateFilters() {
  const campusSel = document.getElementById('avail-campus-select');
  const typeSel = document.getElementById('avail-type-select');
  campusSel.innerHTML = '<option value="">All</option>';
  typeSel.innerHTML = '<option value="">All</option>';
  [...new Set(roomMetadata.map(r => r.campus))].sort()
    .forEach(c => campusSel.append(new Option(c, c)));
  [...new Set(roomMetadata.map(r => r.type))].sort()
    .forEach(t => typeSel.append(new Option(t, t)));
}

// Availability check
function setupAvailability() {
  document.getElementById('avail-check-btn')
    .addEventListener('click', handleAvailability);
}

function handleAvailability() {
  const days = [...document.querySelectorAll('#days input:checked')].map(i => i.value);
  const start = document.getElementById('avail-start').value;
  const end = document.getElementById('avail-end').value;
  const campus = document.getElementById('avail-campus-select').value;
  const type = document.getElementById('avail-type-select').value;
  const minCap = +document.getElementById('avail-min-capacity').value || 0;
  const occupied = new Set(
    scheduleData
      .filter(r => r.Days.some(d => days.includes(d)))
      .map(r => `${r.Building}-${r.Room}`)
  );
  let avail = roomMetadata.map(r => `${r.building}-${r.room}`)
    .filter(id => !occupied.has(id));
  if (campus) avail = avail.filter(id => metadataMap[id].campus === campus);
  if (type) avail = avail.filter(id => metadataMap[id].type === type);
  if (minCap) avail = avail.filter(id => metadataMap[id].capacity >= minCap);
  const resDiv = document.getElementById('avail-results');
  resDiv.innerHTML = avail.length
    ? `<ul>${avail.map(id => `<li>${id} — max ${metadataMap[id].capacity}</li>`).join('')}</ul>`
    : 'No rooms available.';
}
