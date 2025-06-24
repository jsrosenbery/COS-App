// COS-App js/app.js

// Define your backend URL
const BACKEND_BASE_URL = "https://app-backend-pp98.onrender.com";

// Existing variable declarations...
let scheduleData = [];
let selectedTerm = null;
let termData = {};
// ... plus all your existing variables

// --- Room Metadata Integration ---
let roomMetadata = [];
const metadataMap = {};

// Fetch room metadata from backend
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

// Populate campus and type selectors
function populateAvailabilityFilters() {
  const campSel = document.getElementById('avail-campus-select');
  const typeSel = document.getElementById('avail-type-select');
  const campuses = [...new Set(roomMetadata.map(r=>r.campus))].sort();
  const types    = [...new Set(roomMetadata.map(r=>r.type))].sort();
  campSel.innerHTML = '<option value="">All campuses</option>' +
    campuses.map(c=>`<option value="${c}">${c}</option>`).join('');
  typeSel.innerHTML = '<option value="">All types</option>' +
    types.map(t=>`<option value="${t}">${t}</option>`).join('');
}

// Hook metadata upload input
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

// Load metadata on startup
fetchRoomMetadata();

// Existing DOMContentLoaded handler and term-tabs logic...
document.addEventListener('DOMContentLoaded', () => {
  // Your original initialization: load terms, set up schedule upload, term-tabs, view-selector, etc.

  // Example: Setup availability checkbox & buttons
  document.getElementById('avail-check-btn').addEventListener('click', handleAvailability);
  document.getElementById('avail-clear-btn').addEventListener('click', () => {
    // Clear logic...
  });

  // other initialization...
});

// Modified availability handler to include new filters
function handleAvailability() {
  const checkedDays = Array.from(document.querySelectorAll('#availability-ui .days input:checked')).map(i => i.value);
  const start = document.getElementById('avail-start').value;
  const end   = document.getElementById('avail-end').value;
  const resultsDiv = document.getElementById('avail-results');

  // Your existing scheduling logic to compute available rooms:
  let rooms = computeAvailableRooms(scheduleData, selectedTerm, checkedDays, start, end); 
  // (Replace computeAvailableRooms with your actual function)

  // Apply Campus filter
  const selCampus = document.getElementById('avail-campus-select').value;
  if (selCampus) rooms = rooms.filter(r => metadataMap[r]?.campus === selCampus);

  // Apply Type filter
  const selType = document.getElementById('avail-type-select').value;
  if (selType) rooms = rooms.filter(r => metadataMap[r]?.type === selType);

  // Apply Capacity filter
  const minCap = Number(document.getElementById('avail-min-capacity').value) || 0;
  if (minCap > 0) rooms = rooms.filter(r => (metadataMap[r]?.capacity || 0) >= minCap);

  // Render results
  if (rooms.length) {
    resultsDiv.innerHTML = '<ul>' + rooms.map(r => {
      const cap = metadataMap[r]?.capacity || 'N/A';
      return `<li>${r} — max ${cap} seats</li>`;
    }).join('') + '</ul>';
  } else {
    resultsDiv.textContent = 'No rooms available.';
  }
}

// ... rest of your original app.js code ...
