import { parseCSVFile } from './parser.js';
import { renderHeatmap } from './heatmap.js';
import { renderLineChart } from './lineChart.js';
import { initCalendar } from './calendar.js';
import { getTimeRangeFromData } from './timeUtils.js';

const terms = ['Spring2026', 'Summer2026', 'Fall2026'];
const termTabs = document.getElementById('term-tabs');
terms.forEach((t, i) => {
  const li = document.createElement('li');
  li.textContent = t;
  li.className = i===0 ? 'active' : '';
  li.onclick = () => {
    document.querySelectorAll('#term-tabs li').forEach(el => el.classList.remove('active'));
    li.classList.add('active');
    // reload for term
  };
  termTabs.appendChild(li);
});

const roomSelect = document.getElementById('room-select');
let currentData = [];

document.getElementById('schedule-upload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  currentData = await parseCSVFile(file);
  // populate room dropdown
  const rooms = [...new Set(currentData.map(r => r.Room))].sort();
  roomSelect.innerHTML = '<option value="">All Rooms</option>' + rooms.map(r => `<option>${r}</option>`).join('');
  renderHeatmap(currentData);
  renderLineChart(currentData);
  initCalendar(currentData);
});

roomSelect.addEventListener('change', () => {
  const room = roomSelect.value;
  const filterData = room ? currentData.filter(r => r.Room === room) : currentData;
  renderHeatmap(filterData);
  renderLineChart(filterData);
  initCalendar(filterData);
});