import { getTimeRangeFromData, parseHour } from './timeUtils.js';
export function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '';
  if (!data.length) return;
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const { start, end } = getTimeRangeFromData(data);
  const slots = [];
  for (let t = start; t <= end; t += 0.5) slots.push(t);
  const table = document.createElement('table'); table.className = 'heatmap';
  const thead = document.createElement('thead'), hdr = document.createElement('tr');
  hdr.appendChild(document.createElement('th'));
  days.forEach(d => { const th = document.createElement('th'); th.textContent = d; hdr.appendChild(th); });
  thead.appendChild(hdr); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  slots.forEach(t => {
    const row = document.createElement('tr');
    const h = Math.floor(t), m = (t - h) * 60;
    const label = ((h % 12) || 12) + ':' + (m < 10 ? '0' + m : m) + (h < 12 ? 'AM' : 'PM');
    const timeCell = document.createElement('td'); timeCell.textContent = label; row.appendChild(timeCell);
    days.forEach(d => {
      const cell = document.createElement('td');
      data.forEach(r => {
        if (r.Days.includes(d)) {
          const s = parseHour(r.Start_Time), e = parseHour(r.End_Time);
          if (t >= s && t < e) cell.style.background = '#afd';
        }
      });
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody); container.appendChild(table);
}
