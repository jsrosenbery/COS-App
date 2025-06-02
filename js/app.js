// app.js
let parsedRows = [];
document.addEventListener('DOMContentLoaded', () => {
  initViewButtons();
  initCSVUpload();
  initAvailability();
  initHeatmapTool();
});
function initViewButtons() {
  document.getElementById('btnHeatmap').addEventListener('click', () => {
    document.getElementById('heatmap-tool').style.display = 'block';
    document.getElementById('conflict-report').style.display = 'none';
    toggleActive('btnHeatmap');
  });
  document.getElementById('btnConflicts').addEventListener('click', () => {
    document.getElementById('heatmap-tool').style.display = 'none';
    document.getElementById('conflict-report').style.display = 'block';
    toggleActive('btnConflicts');
  });
}
function toggleActive(activeId) {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === activeId);
  });
}
function initCSVUpload() {
  const uploadDiv = document.getElementById('upload-container');
  uploadDiv.innerHTML = '<input type="file" id="csvInput" accept=".csv" />';
  document.getElementById('csvInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    parseCSVFile(file, parsed => {
      parsedRows = parsed;
      document.getElementById('upload-timestamp').textContent = 'Last uploaded: ' + new Date().toLocaleString();
      feedHeatmapTool(parsedRows);
      generateConflictReport(parsedRows);
    });
  });
}
function initAvailability() {
  document.getElementById('avail-check-btn').addEventListener('click', () => {
    const selectedDays = Array.from(
      document.querySelectorAll('#availability-ui input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    const startTime = document.getElementById('avail-start').value;
    const endTime = document.getElementById('avail-end').value;
    const occupiedRooms = new Set();
    parsedRows.forEach(ev => {
      if (ev.DAYS.some(d => selectedDays.includes(d)) && ev.Start_Time < endTime && ev.End_Time > startTime) {
        occupiedRooms.add(ev.ROOM);
      }
    });
    const allRooms = Array.from(new Set(parsedRows.map(r => r.ROOM)));
    const available = allRooms.filter(rm => !occupiedRooms.has(rm)).sort();
    const resDiv = document.getElementById('avail-results');
    resDiv.innerHTML = '';
    if (available.length === 0) {
      resDiv.textContent = 'No rooms available for that time.';
    } else {
      const ul = document.createElement('ul');
      available.forEach(rm => {
        const li = document.createElement('li');
        li.textContent = rm;
        ul.appendChild(li);
      });
      resDiv.appendChild(ul);
    }
  });
  document.getElementById('avail-clear-btn').addEventListener('click', () => {
    document.querySelectorAll('#availability-ui input[type="checkbox"]').forEach(cb => (cb.checked = false));
    document.getElementById('avail-start').value = '';
    document.getElementById('avail-end').value = '';
    document.getElementById('avail-results').innerHTML = '';
  });
}
const dayMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const hours = Array.from({ length: 17 }, (_, i) => i + 6);
let heatmapData = [];
let dataTableInstance;
let choiceInstance;
function initHeatmapTool() {
  choiceInstance = new Choices('#courseSelect', {
    removeItemButton: true,
    searchEnabled: true,
    placeholderValue: 'Filter by discipline/course'
  });
  dataTableInstance = $('#dataTable').DataTable({
    data: [],
    columns: [
      { title: 'Course' },
      { title: 'Building' },
      { title: 'Room' },
      { title: 'Days' },
      { title: 'Time' }
    ],
    destroy: true,
    searching: true
  });
  dataTableInstance.on('search.dt', updateHeatmap);
}
function feedHeatmapTool(rows) {
  heatmapData = rows.map(r => {
    const parts = r.Subject_Course.trim().split(/\s+/);
    const key = parts.length >= 2 ? parts[0] + ' ' + parts[1] : r.Subject_Course.trim();
    return {
      key,
      BUILDING: r.BUILDING.trim(),
      ROOM:     r.ROOM.trim(),
      DAYS:     r.DAYS.map(d => d.charAt(0)).join(''),
      Time:     `${r.Start_Time} - ${r.End_Time}`
    };
  });
  const uniqueKeys = Array.from(new Set(heatmapData.map(d => d.key))).sort();
  const choiceItems = uniqueKeys.map(k => ({ value: k, label: k }));
  choiceInstance.setChoices(choiceItems, 'value', 'label', true);
  updateAllHeatmapViews();
}
function updateAllHeatmapViews() {
  const selected = choiceInstance.getValue(true);
  const tableRows = heatmapData
    .filter(r => {
      if (selected.length && !selected.includes(r.key)) return false;
      const bld = r.BUILDING.toUpperCase();
      const rm = r.ROOM.toUpperCase();
      if (!bld || !rm || bld === 'N/A' || rm === 'N/A' || bld === 'ONLINE') return false;
      const m = r.Time.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!m) return false;
      const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
      return hr >= 6 && hr <= 22;
    })
    .map(r => [r.key, r.BUILDING, r.ROOM, r.DAYS, r.Time]);
  dataTableInstance.clear().rows.add(tableRows).draw();
}
function updateHeatmap() {
  const filtered = dataTableInstance.rows({ search: 'applied' }).data().toArray();
  const counts = {};
  daysOfWeek.forEach(d => (counts[d] = hours.map(() => 0)));
  filtered.forEach(([course, bld, rm, daysStr, timeStr]) => {
    const dayCodes = daysStr.split('');
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/);
    if (!m) return;
    const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
    dayCodes.forEach(dc => {
      const dayName = dayMap[dc];
      const idx = hours.indexOf(hr);
      if (dayName && idx >= 0) counts[dayName][idx]++;
    });
  });
  const maxVal = Math.max(...Object.values(counts).flat());
  let html = `<table class="heatmap"><thead><tr><th>Day/Time</th>`;
  hours.forEach(h => {
    const ap = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    html += `<th>${hh} ${ap}</th>`;
  });
  html += '</tr></thead><tbody>';
  daysOfWeek.forEach(d => {
    html += `<tr><th>${d}</th>`;
    counts[d].forEach(c => {
      const opacity = maxVal ? c / maxVal : 0;
      html += `<td style="background: rgba(0,100,200,${opacity});">${c}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('heatmapContainer').innerHTML = html;
}
function generateConflictReport(rows) {
  const conflicts = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const r1 = rows[i], r2 = rows[j];
      if (r1.ROOM !== r2.ROOM) continue;
      const [s1, e1] = [new Date(r1.Start_Date), new Date(r1.End_Date)];
      const [s2, e2] = [new Date(r2.Start_Date), new Date(r2.End_Date)];
      if (s1 > e2 || s2 > e1) continue;
      const days1 = r1.DAYS, days2 = r2.DAYS;
      const commonDays = days1.filter(d => days2.includes(d));
      if (commonDays.length === 0) continue;
      const [st1, en1] = [timeToMins(r1.Start_Time), timeToMins(r1.End_Time)];
      const [st2, en2] = [timeToMins(r2.Start_Time), timeToMins(r2.End_Time)];
      if (st1 < en2 && st2 < en1) {
        conflicts.push({ r1, r2, commonDays });
      }
    }
  }
  const container = document.getElementById('conflictResults');
  container.innerHTML = '';
  if (conflicts.length === 0) {
    container.textContent = 'No conflicts detected.';
    return;
  }
  conflicts.forEach(conf => {
    const p = document.createElement('p');
    p.innerHTML = `<strong>Room ${conf.r1.ROOM}</strong> conflict on ${conf.commonDays.join(', ')}:<br>
      • ${conf.r1.Subject_Course} (${conf.r1.Start_Time}–${conf.r1.End_Time}, ${conf.r1.Start_Date} to ${conf.r1.End_Date})<br>
      • ${conf.r2.Subject_Course} (${conf.r2.Start_Time}–${conf.r2.End_Time}, ${conf.r2.Start_Date} to ${conf.r2.End_Date})`;
    container.appendChild(p);
  });
}
function timeToMins(t) {
  const [time, mod] = t.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (mod === 'PM' && h < 12) h += 12;
  if (mod === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}
