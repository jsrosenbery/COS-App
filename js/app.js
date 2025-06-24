// js/app.js
const API_BASE = window.BACKEND_BASE_URL;

let scheduleData = [];
let roomMetadata = [];
const metadataMap = {};

document.addEventListener('DOMContentLoaded', () => {
  setupTermTabs();
  setupScheduleUpload();
  setupMetadataUpload();
  setupAvailability();
});

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
  loadSchedule(terms[0]);
}

async function loadSchedule(term) {
  let url = `${API_BASE}/api/schedule/${encodeURIComponent(term)}`;
  let res = await fetch(url);
  if (res.status === 404) {
    res = await fetch(`${API_BASE}/api/schedule`);
  }
  if (!res.ok) {
    alert('Failed to load schedule: ' + res.statusText);
    return;
  }
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

function setupScheduleUpload() {
  const input = document.getElementById('scheduleUpload');
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    let password = document.getElementById('uploadPassword').value;
    if (!password) password = prompt('Enter upload password:');
    if (!password) return alert('Password required');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('password', password);
    try {
      const res = await fetch(`${API_BASE}/api/schedule`, { method:'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      await loadSchedule();
      alert('Upload successful');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  });
}

function setupMetadataUpload() {
  const metaInput = document.getElementById('metadata-input');
  if (!metaInput) return console.error('metadata-input element not found');
  metaInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/rooms/metadata`, { method:'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      await fetchRoomMetadata();
      alert('Metadata upload successful');
    } catch (err) {
      alert('Metadata upload failed: ' + err.message);
    }
  });
  fetchRoomMetadata();
}

async function fetchRoomMetadata() {
  const res = await fetch(`${API_BASE}/api/rooms/metadata`);
  if (!res.ok) return;
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

function setupAvailability() {
  document.getElementById('avail-check-btn').addEventListener('click', handleAvailability);
}

function handleAvailability() {
  const days = [...document.querySelectorAll('#days input:checked')].map(i => i.value);
  const campus = document.getElementById('avail-campus-select').value;
  const type = document.getElementById('avail-type-select').value;
  const minCap = +document.getElementById('avail-min-capacity').value || 0;
  const occupied = new Set(scheduleData
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
