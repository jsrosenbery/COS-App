// js/app.js

const BACKEND_BASE_URL = window.BACKEND_BASE_URL || '';

let scheduleData = [];
let roomMetadata = [];
const metadataMap = {};

function renderTerms() {
  const terms = ['Summer 2025','Fall 2025','Spring 2026'];
  const container = document.getElementById('term-tabs');
  terms.forEach((t,i) => {
    const btn = document.createElement('button');
    btn.textContent = t;
    btn.onclick = () => selectTerm(t);
    if (i===0) btn.classList.add('active');
    container.appendChild(btn);
  });
}

function selectTerm(term) {
  document.querySelectorAll('#term-tabs button').forEach(b => {
    b.classList.toggle('active', b.textContent === term);
  });
  loadSchedule();
}

async function uploadSchedule(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BACKEND_BASE_URL}/api/schedule`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(res.statusText);
  return loadSchedule();
}

async function loadSchedule() {
  const res = await fetch(`${BACKEND_BASE_URL}/api/schedule`);
  scheduleData = await res.json();
  document.getElementById('upload-timestamp').textContent = 'Uploaded: ' + new Date().toLocaleString();
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

// Room metadata
async function fetchRoomMetadata() {
  const res = await fetch(`${BACKEND_BASE_URL}/api/rooms/metadata`);
  roomMetadata = await res.json();
  metadataMap = {};
  roomMetadata.forEach(r => {
    metadataMap[`${r.building}-${r.room}`] = r;
  });
  populateFilters();
}

function populateFilters() {
  const camps = [...new Set(roomMetadata.map(r=>r.campus))];
  const types = [...new Set(roomMetadata.map(r=>r.type))];
  const csel = document.getElementById('avail-campus-select');
  const tsel = document.getElementById('avail-type-select');
  camps.forEach(c=> csel.append(new Option(c,c)));
  types.forEach(t=> tsel.append(new Option(t,t)));
}

// Availability
function handleAvailability() {
  const days = Array.from(document.querySelectorAll('#days input:checked')).map(i=>i.value);
  const s = document.getElementById('avail-start').value;
  const e = document.getElementById('avail-end').value;
  const selCampus = document.getElementById('avail-campus-select').value;
  const selType = document.getElementById('avail-type-select').value;
  const minCap = Number(document.getElementById('avail-min-capacity').value) || 0;
  const occ = new Set();
  scheduleData.forEach(r => {
    if (r.Days.some(d=>days.includes(d))) {
      occ.add(`${r.Building}-${r.Room}`);
    }
  });
  let rooms = roomMetadata.map(r=>`${r.building}-${r.room}`);
  let avail = rooms.filter(r=>!occ.has(r));
  if(selCampus) avail = avail.filter(r=>metadataMap[r].campus===selCampus);
  if(selType) avail = avail.filter(r=>metadataMap[r].type===selType);
  if(minCap) avail = avail.filter(r=>metadataMap[r].capacity>=minCap);
  const resDiv = document.getElementById('avail-results');
  resDiv.innerHTML = avail.map(r=>`<div>${r} — max ${metadataMap[r].capacity}</div>`).join('');
}

function init() {
  renderTerms();
  document.getElementById('viewSelect').onchange = e=>{};
  document.getElementById('scheduleUpload').addEventListener('change', e=>uploadSchedule(e.target.files[0]).catch(err=>alert(err)));
  document.getElementById('metadata-input').addEventListener('change', e=>{
    const fd=new FormData();fd.append('file',e.target.files[0]);
    fetch(`${BACKEND_BASE_URL}/api/rooms/metadata`,{method:'POST',body:fd})
      .then(r=>r.ok?fetchRoomMetadata():Promise.reject(r.statusText))
      .catch(err=>alert(err));
  });
  document.getElementById('avail-check-btn').onclick = handleAvailability;
  fetchRoomMetadata();
}

document.addEventListener('DOMContentLoaded', init);
