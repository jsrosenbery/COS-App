// main.js - integrate backend persistence
import { parseCSVFile, normalizeRows } from './parser.js';
import { renderHeatmap } from './heatmap.js';
import { renderLineChart } from './lineChart.js';
import { initCalendar } from './calendar.js';
import { initAvailability } from './availability.js';

const BACKEND = 'https://app-backend-pp98.onrender.com';
const UPLOAD_PW = 'Upload2025';

const termTabs = document.getElementById('term-tabs');
const terms = ['Spring2026','Summer2026','Fall2026'];
let currentTerm = terms[0];
let currentData = [];

terms.forEach((t,i)=>{
  const li = document.createElement('li');
  li.textContent = t; li.className = i?'':'active';
  li.onclick = () => {
    document.querySelectorAll('#term-tabs li').forEach(el=>el.classList.remove('active'));
    li.classList.add('active');
    currentTerm = t;
    loadTermData(t);
  };
  termTabs.appendChild(li);
});

// View handling
const viewSelect = document.getElementById('viewSelect');
const sections = {
  heatmap: document.getElementById('heatmap-container'),
  chart:   document.getElementById('linechart-canvas'),
  calendar:document.getElementById('calendar'),
  availability:document.getElementById('availability-section')
};
viewSelect.addEventListener('change', ()=> {
  Object.keys(sections).forEach(k=>{
    sections[k].style.display = (k===viewSelect.value)?'':'none';
  });
});

// Room filter
const roomSelect = document.getElementById('calendar-room-select');
roomSelect.addEventListener('change',()=> applyFilters());

// Upload/initial load
const uploadInput = document.getElementById('schedule-upload');
uploadInput.addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const csvText = await file.text();
  // POST to backend
  await fetch(`${BACKEND}/api/schedule/${currentTerm}`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ csv: csvText, password: UPLOAD_PW })
  });
  // parse & normalize
  const raw = await parseCSVFile(file);
  currentData = normalizeRows(raw);
  populateUI();
});

// Load from backend
async function loadTermData(term) {
  const res = await fetch(`${BACKEND}/api/schedule/${term}`);
  const json = await res.json();
  currentData = normalizeRows(json.data);
  populateUI();
}

// Populate dropdowns & render all
function populateUI() {
  // rooms
  const rooms = [...new Set(currentData.map(r=>r.Room))].sort();
  roomSelect.innerHTML = '<option value="">All Rooms</option>' + rooms.map(r=>`<option>${r}</option>`).join('');
  applyFilters();
}

// Apply room filter then render views
function applyFilters() {
  const room = roomSelect.value;
  const data = room ? currentData.filter(r=>r.Room===room) : currentData;
  renderHeatmap(data);
  renderLineChart(data);
  initCalendar(data);
  initAvailability(data);
  // show default view section
  sections[viewSelect.value].style.display = '';
}

// Initial load
loadTermData(currentTerm);
