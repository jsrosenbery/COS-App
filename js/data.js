// data.js - Loading, normalizing, and storing schedule data and backend API communication

import { normalizeRow } from './utils.js';

// Expose current data/term globally for other modules (if desired)
export let currentData = [];
export let currentTerm = "";

// Backend API base URL
const BACKEND_BASE_URL = "https://app-backend-pp98.onrender.com";

// Load schedule data from backend for a given term
export function loadScheduleFromBackend(term, onLoaded = () => {}) {
  fetch(`${BACKEND_BASE_URL}/api/schedule/${encodeURIComponent(term)}`)
    .then(res => res.json())
    .then(({ data, lastUpdated }) => {
      currentData = (data || []).map(normalizeRow);
      window.currentData = currentData; // for legacy/global code
      if (lastUpdated) {
        const tsDiv = document.getElementById('upload-timestamp');
        if (tsDiv) tsDiv.textContent = `Last upload: ${new Date(lastUpdated).toLocaleString()}`;
      }
      onLoaded(currentData);
    });
}

// Upload schedule CSV to backend for a given term
export function uploadScheduleToBackend(term, csvString, cb = () => {}) {
  fetch(`${BACKEND_BASE_URL}/api/schedule/${encodeURIComponent(term)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv: csvString, password: 'Upload2025' })
  })
    .then(res => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    })
    .then(() => {
      alert('Upload successful!');
      loadScheduleFromBackend(term, cb);
    })
    .catch(err => alert('Upload failed: ' + err.message));
}

// Build unique campus list from data
export function getUniqueCampuses(data) {
  const campuses = new Set();
  data.forEach(r => {
    const campus = r.Campus || r.campus || r.CAMPUS;
    if (campus) campuses.add(campus);
  });
  return Array.from(campuses).sort();
}

// Build unique room list from data
export function getUniqueRooms(data) {
  // Returns array of "Bldg-Room" combos, sorted, excluding blanks, N/A, LIVE, ONLINE
  return [...new Set(
    data
      .filter(i => i.Room && i.Room !== '' && i.Room !== 'N/A' && i.Room !== 'LIVE' && (i.Building || i.BUILDING) !== 'ONLINE')
      .map(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}`)
  )].sort();
}

// Setup: called on term change
export function handleTermChange(term, onLoaded = () => {}) {
  currentTerm = term;
  window.currentTerm = term;
  loadScheduleFromBackend(term, onLoaded);
}

// File upload handler (hook to file input)
export function handleUpload(term, fileInput, cb = () => {}) {
  // PASSWORD PROTECTION
  const password = prompt('Enter upload password:');
  if (password !== 'Upload2025') {
    alert('Incorrect password. Upload cancelled.');
    fileInput.value = '';
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(ev) {
    const csvString = ev.target.result;
    uploadScheduleToBackend(term, csvString, cb);
  };
  reader.readAsText(file);
}

// Build room dropdowns in the UI
export function buildRoomDropdowns() {
  const combos = getUniqueRooms(currentData);
  // Snapshot room filter
  const roomDiv = document.getElementById('room-filter');
  if (roomDiv) {
    roomDiv.innerHTML = `
      <label>Filter Bldg-Room:
        <select id="room-select">
          <option>All</option>
          ${combos.map(r => `<option>${r}</option>`).join('')}
        </select>
      </label>`;
    const snapshotRoomFilter = document.getElementById('room-select');
    if (snapshotRoomFilter)
      snapshotRoomFilter.onchange = () => window.renderSchedule && window.renderSchedule();
  }
  // Fullcalendar room filter
  const calendarRoomSelect = document.getElementById('calendar-room-select');
  if (calendarRoomSelect) {
    calendarRoomSelect.innerHTML = `
      <option>All</option>
      ${combos.map(r => `<option>${r}</option>`).join('')}
    `;
    calendarRoomSelect.onchange = () => window.renderFullCalendar && window.renderFullCalendar();
  }
}

// Initial load for default term
export function handleInitialLoad() {
  const defaultTerm = document.querySelector('.tab.active')?.textContent || '';
  if (defaultTerm) {
    handleTermChange(defaultTerm);
  }
}
