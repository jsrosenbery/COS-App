// js/app.js

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

// Semester tabs: full term list
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
    btn.className = idx === 0 ? 'active' : '';
    btn.onclick = () => selectTerm(term, btn);
    tabs.appendChild(btn);
  });
  selectTerm(terms[0], tabs.children[0]);
}

function selectTerm(term, btn) {
  Array.from(document.getElementById('term-tabs').children)
    .forEach(b => b.classList.toggle('active', b === btn));
  loadSchedule();
}

// View selector stub
function setupViewSelector() {
  document.getElementById('viewSelect').onchange = () => {};
}

// Upload schedule with password
function setupUpload() {
  document.getElementById('scheduleUpload')
    .addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const password = document.getElementById('uploadPassword').value ||
        prompt('Enter upload password:');
      if (!password) return alert('Password required');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', password);
      try {
        const res = await fetch(`${API_BASE}/api/schedule`, {
          method: 'POST',
          body: fd
        });
        if (res.status === 401) throw new Error('Unauthorized: wrong password');
        if (!res.ok) throw new Error(res.statusText);
        await loadSchedule();
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    });
}

async function loadSchedule() {
  const res = await fetch(`${API_BASE}/api/schedule`);
  scheduleData = await res.json();
  document.getElementById('upload-timestamp').textContent =
    'Last upload: ' + new Date().toLocaleString();
  renderSchedule();
}

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

// Metadata upload & fetch
function setupMetadataUpload() {
  document.getElementById('metadata-input')
    .addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch(`${API_BASE}/api/rooms/metadata`, {
          method: 'POST',
          body: fd
        });
        if (!res.ok) throw new Error(res.statusText);
        await fetchRoomMetadata();
      } catch (err) {
        alert('Metadata upload failed: ' + err.message);
      }
    });
  fetchRoomMetadata();
}

async function fetchRoomMetadata() {
  const res = await fetch(`${API_BASE}/api/rooms/metadata`);
  roomMetadata = await res.json();
  Object.keys(metadataMap).forEach(k => delete metadataMap[k]);
  roomMetadata.forEach(r => metadataMap[`${r.building}-${r.room}`] = r);
  populateFilters();
}

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
  const days = [...document.querySelectorAll('#days input:checked')]
    .map(i => i.value);
  const start = document.getElementById('avail-start').value;
  const end = document.getElementById('avail-end').value;
  let avail = roomMetadata.map(r => `${r.building}-${r.room}`);
  const occ = new Set();
  scheduleData.forEach(r => {
    if (r.Days.some(d => days.includes(d))) {
      occ.add(`${r.Building}-${r.Room}`);
    }
  });
  avail = avail.filter(id => !occ.has(id));
  const campus = document.getElementById('avail-campus-select').value;
  const type = document.getElementById('avail-type-select').value;
  const minCap = Number(document.getElementById('avail-min-capacity').value) || 0;
  if (campus) avail = avail.filter(id => metadataMap[id].campus === campus);
  if (type)   avail = avail.filter(id => metadataMap[id].type === type);
  if (minCap) avail = avail.filter(id => metadataMap[id].capacity >= minCap);
  const resDiv = document.getElementById('avail-results');
  resDiv.innerHTML = avail.length
    ? '<ul>' + avail.map(id => `<li>${id} — max ${metadataMap[id].capacity}</li>`).join('') + '</ul>'
    : 'No rooms available.';
}
