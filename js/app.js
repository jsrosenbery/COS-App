// js/app.js

const BACKEND_BASE_URL = "https://app-backend-pp98.onrender.com";

let scheduleData = [];
let selectedTerm = null;
let termData = {};
// ... other original app.js variables and functions ...

// Room metadata integration
let roomMetadata = [];
const metadataMap = {};

function populateAvailabilityFilters() {
  const campSel = document.getElementById('avail-campus-select');
  const typeSel = document.getElementById('avail-type-select');
  const campuses = [...new Set(roomMetadata.map(r => r.campus))].sort();
  const types = [...new Set(roomMetadata.map(r => r.type))].sort();
  campSel.innerHTML = '<option value="">All campuses</option>' + campuses.map(c => `<option>${c}</option>`).join('');
  typeSel.innerHTML = '<option value="">All types</option>' + types.map(t => `<option>${t}</option>`).join('');
}

async function fetchRoomMetadata() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/rooms/metadata`);
    roomMetadata = await res.json();
    roomMetadata.forEach(r => {
      metadataMap[`${r.building}-${r.room}`] = r;
    });
    populateAvailabilityFilters();
  } catch (err) {
    console.error('Failed to load room metadata', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Original initialization: term-tabs, schedule upload, view-selector...
  initTerms();      // assume this sets up semester tabs
  initUpload();     // original schedule upload
  initViewSwitch(); // original view selector logic

  // Load room metadata after DOM is ready
  fetchRoomMetadata();

  // Hook metadata upload
  document.getElementById('metadata-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${BACKEND_BASE_URL}/api/rooms/metadata`, { method: 'POST', body: fd });
    if (resp.ok) {
      await fetchRoomMetadata();
      alert('Room metadata uploaded');
    } else {
      alert('Metadata upload failed');
    }
  });

  // Hook availability check
  document.getElementById('avail-check-btn').addEventListener('click', handleAvailability);
  document.getElementById('avail-clear-btn').addEventListener('click', () => {
    document.getElementById('avail-results').innerHTML = '';
  });
});

function handleAvailability() {
  // Original availability logic to compute rooms list
  let rooms = computeAvailableRooms(scheduleData, selectedTerm); // your function

  // Apply filters
  const selCampus = document.getElementById('avail-campus-select').value;
  if (selCampus) rooms = rooms.filter(r => metadataMap[r]?.campus === selCampus);

  const selType = document.getElementById('avail-type-select').value;
  if (selType) rooms = rooms.filter(r => metadataMap[r]?.type === selType);

  const minCap = Number(document.getElementById('avail-min-capacity').value) || 0;
  if (minCap > 0) rooms = rooms.filter(r => (metadataMap[r]?.capacity || 0) >= minCap);

  const resultsDiv = document.getElementById('avail-results');
  if (rooms.length) {
    resultsDiv.innerHTML = '<ul>' + rooms.map(r => {
      const cap = metadataMap[r]?.capacity || 'N/A';
      return `<li>${r} — max ${cap} seats</li>`;
    }).join('') + '</ul>';
  } else {
    resultsDiv.textContent = 'No rooms available.';
  }
}

// ... rest of original functions like initTerms, initUpload, initViewSwitch, computeAvailableRooms ...
