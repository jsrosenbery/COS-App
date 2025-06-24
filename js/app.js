// --- New room metadata integration ---

// room metadata storage
let roomMetadata = [];
const metadataMap = {};

// fetch room metadata from backend
async function fetchRoomMetadata() {
  try {
    const res = await fetch('/api/rooms/metadata');
    roomMetadata = await res.json();
    roomMetadata.forEach(r => {
      metadataMap[`${r.building}-${r.room}`] = r;
    });
    populateAvailabilityFilters();
  } catch (err) {
    console.error('Failed to load room metadata', err);
  }
}

// populate campus and type selectors
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

// hook up metadata upload
document.getElementById('metadata-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch('/api/rooms/metadata', { method: 'POST', body: fd });
  if (resp.ok) {
    await fetchRoomMetadata();
    alert('Room metadata uploaded');
  } else {
    alert('Metadata upload failed');
  }
});

// load metadata on startup
fetchRoomMetadata();

// modify existing availability handler (example seed; adapt into your function)
function handleAvailability() {
  // ... existing logic to get `avail` list ...
  let avail = getBaseAvailability(); // placeholder

  const selCampus = document.getElementById('avail-campus-select').value;
  if (selCampus) avail = avail.filter(r => metadataMap[r]?.campus === selCampus);

  const selType = document.getElementById('avail-type-select').value;
  if (selType) avail = avail.filter(r => metadataMap[r]?.type === selType);

  const minCap = Number(document.getElementById('avail-min-capacity').value) || 0;
  if (minCap > 0) avail = avail.filter(r => (metadataMap[r]?.capacity || 0) >= minCap);

  // render results
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
