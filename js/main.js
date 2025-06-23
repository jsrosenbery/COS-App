import { parseCSVFile } from './parser.js';
import { renderHeatmap } from './heatmap.js';
import { renderLineChart } from './lineChart.js';
import { initCalendar } from './calendar.js';
import { initAvailability } from './availability.js';

const termTabs = document.getElementById('term-tabs');
const terms = ['Spring2026','Summer2026','Fall2026'];
terms.forEach((t,i)=>{const li=document.createElement('li');li.textContent=t;li.className=i?'':'active';
  li.onclick=()=>{document.querySelectorAll('#term-tabs li').forEach(el=>el.classList.remove('active'));li.classList.add('active');};
  termTabs.appendChild(li);
});

const viewSelect = document.getElementById('view-select');
const sections = {
  heatmap: document.getElementById('heatmap-container'),
  chart: document.getElementById('linechart-canvas'),
  calendar: document.getElementById('calendar'),
  availability: document.getElementById('availability-section')
};
viewSelect.addEventListener('change', ()=> {
  Object.keys(sections).forEach(k=>{
    sections[k].style.display = (k === viewSelect.value) ? '' : 'none';
  });
});

const roomSelect = document.getElementById('room-select');
const uploadInput = document.getElementById('schedule-upload');
let currentData = [];

uploadInput.addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  currentData = await parseCSVFile(file);
  // Populate room dropdown
  const rooms = [...new Set(currentData.map(r=>r.Room))].sort();
  roomSelect.innerHTML = '<option value="">All Rooms</option>' + rooms.map(r=>`<option>${r}</option>`).join('');
  // Initial render
  renderHeatmap(currentData);
  renderLineChart(currentData);
  initCalendar(currentData);
  initAvailability(currentData);
  // Show default view
  sections[viewSelect.value].style.display = '';
});

roomSelect.addEventListener('change', ()=> {
  const room = roomSelect.value;
  const filtered = room ? currentData.filter(r=>r.Room === room) : currentData;
  renderHeatmap(filtered);
  renderLineChart(filtered);
  initCalendar(filtered);
  initAvailability(filtered);
});
