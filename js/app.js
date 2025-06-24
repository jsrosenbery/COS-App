// js/app.js

// Use absolute URL for backend
// BACKEND_BASE_URL is defined in index.html

// Schedule upload
document.getElementById('scheduleUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/schedule`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    scheduleData = data;
    renderSchedule();
  } catch (err) {
    console.error('Upload failed:', err);
    alert('Upload failed: ' + err.message);
  }
});

// Room metadata upload
document.getElementById('metadata-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/rooms/metadata`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(res.statusText);
    await fetchRoomMetadata();
    alert('Room metadata uploaded');
  } catch (err) {
    console.error('Metadata upload failed:', err);
    alert('Upload metadata failed: ' + err.message);
  }
});

// Populate and use room metadata
let roomMetadata = [];
const metadataMap = {};

async function fetchRoomMetadata() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/rooms/metadata`);
    if (!res.ok) throw new Error(res.statusText);
    roomMetadata = await res.json();
    metadataMap = {};
    roomMetadata.forEach(r => {
      metadataMap[`${r.building}-${r.room}`] = r;
    });
    populateAvailabilityFilters();
  } catch (err) {
    console.error('Fetch metadata failed:', err);
  }
}

function populateAvailabilityFilters() {
  const campSel = document.getElementById('avail-campus-select');
  const typeSel = document.getElementById('avail-type-select');
  const campuses = [...new Set(roomMetadata.map(r => r.campus))].sort();
  const types = [...new Set(roomMetadata.map(r => r.type))].sort();
  campSel.innerHTML = '<option value="">All campuses</option>' +
    campuses.map(c => `<option value="${c}">${c}</option>`).join('');
  typeSel.innerHTML = '<option value="">All types</option>' +
    types.map(t => `<option value="${t}">${t}</option>`).join('');
}

fetchRoomMetadata();

// Availability handling (simplified)
document.getElementById('avail-check-btn').addEventListener('click', handleAvailability);

function handleAvailability() {
  // Compute base available rooms (stub)
  let avail = computeAvailableRooms(scheduleData, selectedTerm);

  const selCampus = document.getElementById('avail-campus-select').value;
  if (selCampus) avail = avail.filter(r => metadataMap[r]?.campus === selCampus);

  const selType = document.getElementById('avail-type-select').value;
  if (selType) avail = avail.filter(r => metadataMap[r]?.type === selType);

  const minCap = Number(document.getElementById('avail-min-capacity').value) || 0;
  if (minCap > 0) avail = avail.filter(r => (metadataMap[r]?.capacity || 0) >= minCap);

  const resultsDiv = document.getElementById('avail-results');
  if (avail.length) {
    resultsDiv.innerHTML = '<ul>' + avail.map(r => {
      const cap = metadataMap[r]?.capacity || 'N/A';
      return `<li>${r} — max ${cap} seats</li>`;
    }).join('') + '</ul>';
  } else {
    resultsDiv.textContent = 'No rooms available.';
  }
}

// Placeholder functions: renderSchedule, computeAvailableRooms, selectedTerm
