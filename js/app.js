// js/app.js

let scheduleData = null;
let roomMetadata = [];

// Upload schedule CSV
document.getElementById('scheduleUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  await fetch('/api/schedule', { method: 'POST', body: formData });
  // Fetch updated schedule
  const res = await fetch('/api/schedule');
  scheduleData = await res.json();
});

// Upload room metadata XLSX
document.getElementById('roomMetadataUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  await fetch('/api/rooms/metadata', { method: 'POST', body: formData });
  await fetchRoomMetadata();
});

// Fetch room metadata and populate selectors
async function fetchRoomMetadata() {
  const res = await fetch('/api/rooms/metadata');
  roomMetadata = await res.json();
  populateSelectors();
}

// Populate campus and type dropdowns
function populateSelectors() {
  const campusSelect = document.getElementById('campusSelect');
  const typeSelect = document.getElementById('typeSelect');
  const campuses = [...new Set(roomMetadata.map(r => r.campus))];
  const types = [...new Set(roomMetadata.map(r => r.type))];

  // Clear existing options except default
  campusSelect.innerHTML = '<option value="">All campuses</option>';
  typeSelect.innerHTML = '<option value="">All types</option>';

  campuses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    campusSelect.appendChild(opt);
  });
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });
}

// Filter and display available rooms
document.getElementById('findRoomsBtn').addEventListener('click', () => {
  if (!scheduleData) { alert('Please upload schedule first'); return; }
  if (!roomMetadata.length) { alert('Please upload room metadata first'); return; }

  const selectedCampus = document.getElementById('campusSelect').value;
  const selectedType = document.getElementById('typeSelect').value;
  const minCapacity = Number(document.getElementById('capacityInput').value) || 0;

  // TODO: Replace with your actual availability logic
  const availableRoomIds = getAvailableRooms(scheduleData);

  const filtered = roomMetadata
    .filter(r => availableRoomIds.includes(r.room))
    .filter(r => !selectedCampus || r.campus === selectedCampus)
    .filter(r => !selectedType || r.type === selectedType)
    .filter(r => r.capacity >= minCapacity);

  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';
  filtered.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.building}-${r.room} (${r.type}) — max ${r.capacity} seats`;
    resultsList.appendChild(li);
  });
});

// Placeholder function: implement your schedule availability logic
function getAvailableRooms(schedule) {
  // Example stub: return all room IDs
  return schedule.map(entry => entry.room);
}
