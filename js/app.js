// app.js
// Main application logic: calendar rendering, availability checks, and heatmap integration

import { termDefinitions } from './termDefinitions.js';

// Utility functions for date parsing (using date-fns)
const { parse, format, addDays, startOfWeek, addWeeks, subWeeks } = dateFns;

let currentTerm = '';
let parsedRowsPerTerm = {}; // { termKey: [parsedRow, ...] }
let allEvents = [];         // expanded daily events for current term
let currentSunday = null;

// Initialize UI on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTermTabs();
  initViewToggle();
  initAvailability();
  initHeatmapTool();
  // Default to first term
  const firstTerm = Object.keys(termDefinitions)[0];
  if (firstTerm) {
    selectTerm(firstTerm);
  }
});

/** 1. Term Tabs Setup **/
function initTermTabs() {
  const tabsContainer = document.getElementById('term-tabs');
  tabsContainer.innerHTML = '';
  Object.keys(termDefinitions).forEach(termKey => {
    const btn = document.createElement('button');
    btn.textContent = readableTermName(termKey);
    btn.dataset.term = termKey;
    btn.addEventListener('click', () => selectTerm(termKey));
    tabsContainer.appendChild(btn);
  });
}

function readableTermName(key) {
  // Convert 'SU25' → 'Summer 2025', etc.
  const season = key.slice(0, 2);
  const year = '20' + key.slice(2);
  let name = '';
  switch (season) {
    case 'SU': name = 'Summer ' + year; break;
    case 'FA': name = 'Fall ' + year; break;
    case 'SP': name = 'Spring ' + year; break;
    default: name = key;
  }
  return name;
}

// User selects a term tab
function selectTerm(termKey) {
  currentTerm = termKey;
  // Highlight active tab
  document.querySelectorAll('#term-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.term === termKey);
  });

  // Load data for term (if previously parsed) or prompt upload
  if (parsedRowsPerTerm[termKey]) {
    allEvents = buildEvents(parsedRowsPerTerm[termKey], termKey);
    currentSunday = getTermStartSunday(termKey);
    renderWeeklyGrid();
    feedHeatmapTool(parsedRowsPerTerm[termKey]);
  } else {
    // Clear calendar and show message to upload
    document.getElementById('schedule-table').innerHTML = '';
    document.getElementById('currentWeekLabel').textContent = '';
    allEvents = [];
  }
}

/** 2. Helper: Compute term start Sunday **/
function getTermStartSunday(termKey) {
  const termObj = termDefinitions[termKey];
  const termStartDate = parse(termObj.start, 'yyyy-MM-dd', new Date());
  return startOfWeek(termStartDate, { weekStartsOn: 0 });
}

/** 3. Expand parsed rows into daily events **/
function buildEvents(rows, termKey) {
  const termObj = termDefinitions[termKey];
  const termStart = parse(termObj.start, 'yyyy-MM-dd', new Date());
  const termEnd = parse(termObj.end, 'yyyy-MM-dd', new Date());
  const holidays = termObj.holidays.map(d => parse(d, 'yyyy-MM-dd', new Date()));

  return rows.flatMap(row => {
    const rowStart = parse(row.Start_Date, 'MM/dd/yyyy', new Date());
    const rowEnd = parse(row.End_Date, 'MM/dd/yyyy', new Date());
    const activeStart = rowStart > termStart ? rowStart : termStart;
    const activeEnd = rowEnd < termEnd ? rowEnd : termEnd;
    const events = [];
    let cursor = activeStart;
    while (cursor <= activeEnd) {
      const dayName = format(cursor, 'EEEE');
      const isHoliday = holidays.some(h => format(h, 'yyyy-MM-dd') === format(cursor, 'yyyy-MM-dd'));
      if (row.DAYS.includes(dayName) && !isHoliday) {
        events.push({
          date: format(cursor, 'yyyy-MM-dd'),
          dayName,
          startTime: row.Start_Time,
          endTime: row.End_Time,
          course: row.Subject_Course,
          building: row.BUILDING,
          room: row.ROOM,
          instructor: row.Instructor
        });
      }
      cursor = addDays(cursor, 1);
    }
    return events;
  });
}

/** 4. Render Weekly Calendar Grid **/
function renderWeeklyGrid() {
  const table = document.getElementById('schedule-table');
  table.innerHTML = ''; // clear previous

  // Build header row with dates Sun → Sat
  const header = table.createTHead();
  const headerRow = header.insertRow();
  headerRow.insertCell().textContent = ''; // empty top-left
  for (let i = 0; i < 7; i++) {
    const date = addDays(currentSunday, i);
    const cell = headerRow.insertCell();
    const dateStr = format(date, 'EEE MM/dd');
    const isHoliday =
      termDefinitions[currentTerm].holidays.includes(format(date, 'yyyy-MM-dd'));
    cell.textContent = dateStr;
    if (isHoliday) cell.classList.add('holiday-header');
  }

  // Build body timeslots (6 AM → 10 PM)
  const tbody = table.createTBody();
  for (let hour = 6; hour <= 22; hour++) {
    const row = tbody.insertRow();
    // Time label cell
    const labelCell = row.insertCell();
    const ampm = hour < 12 ? 'AM' : 'PM';
    const hh = hour % 12 === 0 ? 12 : hour % 12;
    labelCell.textContent = `${hh} ${ampm}`;
    // One cell per day
    for (let d = 0; d < 7; d++) {
      const cell = row.insertCell();
      cell.dataset.date = format(addDays(currentSunday, d), 'yyyy-MM-dd');
      cell.dataset.hour = hour;
      cell.classList.add('time-cell');
      if (termDefinitions[currentTerm].holidays.includes(cell.dataset.date)) {
        cell.classList.add('holiday-cell');
      }
    }
  }

  // Place events
  allEvents.forEach(ev => {
    // Compute which column (0–6) and row (hour index)
    const eventDate = parse(ev.date, 'yyyy-MM-dd', new Date());
    const dayIdx = eventDate.getDay(); // 0=Sunday, …,6=Saturday
    const [startH] = ev.startTime.split(' ');
    const startHour = parseInt(startH.split(':')[0], 10) + (ev.startTime.includes('PM') && !startH.startsWith('12') ? 12 : 0);
    const rowIndex = startHour - 6; // because row 0 is 6 AM

    // Get the specific cell
    const cell = document.querySelector(
      `#schedule-table tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${dayIdx + 2})`
    );
    if (!cell || cell.classList.contains('holiday-cell')) return; // skip if holiday

    // Create event block
    const div = document.createElement('div');
    div.classList.add('event-block');
    div.textContent = ev.course;
    div.title = \`\${ev.course} | \${ev.building} \${ev.room} | \${ev.startTime}–\${ev.endTime}\`;
    cell.appendChild(div);
  });

  // Update current week label
  document.getElementById('currentWeekLabel').textContent = \`Week of \${format(currentSunday, 'MM/dd/yyyy')}\`;

  // Bind Prev/Next
  document.getElementById('prevWeek').onclick = () => {
    currentSunday = subWeeks(currentSunday, 1);
    renderWeeklyGrid();
  };
  document.getElementById('nextWeek').onclick = () => {
    currentSunday = addWeeks(currentSunday, 1);
    renderWeeklyGrid();
  };
}

/** 5. View Toggle (Calendar ↔ Heatmap) **/
function initViewToggle() {
  document.getElementById('viewSelect').addEventListener('change', e => {
    const v = e.target.value;
    const cal = document.getElementById('schedule-container');
    const avail = document.getElementById('availability-ui');
    const heat = document.getElementById('heatmap-tool');
    if (v === 'heatmap') {
      cal.style.display = 'none';
      avail.style.display = 'none';
      document.getElementById('upload-container').style.display = 'none';
      document.getElementById('upload-timestamp').style.display = 'none';
      document.getElementById('room-filter').style.display = 'none';
      heat.style.display = 'block';
    } else {
      heat.style.display = 'none';
      cal.style.display = 'block';
      avail.style.display = 'block';
      document.getElementById('upload-container').style.display = 'block';
      document.getElementById('upload-timestamp').style.display = 'block';
      document.getElementById('room-filter').style.display = 'block';
    }
  });
}

/** 6. Availability Check (unchanged aside from alphabetical sort) **/
function initAvailability() {
  document.getElementById('avail-check-btn').addEventListener('click', () => {
    const selectedDays = Array.from(
      document.querySelectorAll('#availability-ui input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    const startTime = document.getElementById('avail-start').value;
    const endTime = document.getElementById('avail-end').value;
    // Filter allEvents by selectedDays/time
    const rooms = new Set();
    allEvents.forEach(ev => {
      if (
        selectedDays.includes(ev.dayName) &&
        ev.startTime <= endTime &&
        ev.endTime >= startTime
      ) {
        rooms.add(ev.room);
      }
    });
    // Now get all rooms used in term to find free ones
    const allRooms = new Set(parsedRowsPerTerm[currentTerm].map(r => r.ROOM));
    const available = Array.from([...allRooms].filter(r => !rooms.has(r))).sort();
    // Display
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

/** 7. Heatmap & Table Integration **/
const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM–10 PM
let heatmapData = [];
let dataTableInstance;
let choiceInstance;

function initHeatmapTool() {
  // Initialize Choices.js multi-select
  choiceInstance = new Choices('#courseSelect', {
    removeItemButton: true,
    searchEnabled: true,
    placeholderValue: 'Filter by discipline/course'
  });
  // Initialize DataTable
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
  // Build heatmapData from parsed rows
  heatmapData = rows.map(r => {
    const parts = r.Subject_Course.trim().split(/\s+/);
    const key = parts.length >= 2 ? parts[0] + ' ' + parts[1] : r.Subject_Course.trim();
    return {
      key,
      BUILDING: r.BUILDING.trim(),
      ROOM:     r.ROOM.trim(),
      DAYS:     r.DAYS.join(''),
      Time:     \`\${r.Start_Time} - \${r.End_Time}\`
    };
  });
  // Populate multi-select choices
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
  // Count matrix
  const counts = {};
  daysOfWeek.forEach(d => (counts[d] = hours.map(() => 0)));
  filtered.forEach(([course, bld, rm, daysStr, timeStr]) => {
    const dayCodes = daysStr.split('');
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/);
    if (!m) return;
    const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
    dayCodes.forEach(dc => {
      const dayMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
      const dayName = dayMap[dc];
      const idx = hours.indexOf(hr);
      if (dayName && idx >= 0) counts[dayName][idx]++;
    });
  });
  const maxVal = Math.max(...Object.values(counts).flat());
  let html = \`<table class="heatmap"><thead><tr><th>Day/Time</th>\`;
  hours.forEach(h => {
    const ap = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    html += \`<th>\${hh} \${ap}</th>\`;
  });
  html += '</tr></thead><tbody>';
  daysOfWeek.forEach(d => {
    html += \`<tr><th>\${d}</th>\`;
    counts[d].forEach(c => {
      const opacity = maxVal ? c / maxVal : 0;
      html += \`<td style="background: rgba(0,100,200,\${opacity});">\${c}</td>\`;
    });
    html += '</tr>\`;
  });
  html += '</tbody></table>';
  document.getElementById('heatmapContainer').innerHTML = html;
}

/** 8. CSV Upload Handling **/
function initCSVUpload() {
  // Using a simple <input type="file"> in upload-container for each term
  const uploadDiv = document.getElementById('upload-container');
  uploadDiv.innerHTML = '<input type="file" id="csvInput" accept=".csv" />';
  document.getElementById('csvInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    parseCSVFile(file, parsed => {
      parsedRowsPerTerm[currentTerm] = parsed;
      allEvents = buildEvents(parsed, currentTerm);
      currentSunday = getTermStartSunday(currentTerm);
      renderWeeklyGrid();
      feedHeatmapTool(parsed);
      document.getElementById('upload-timestamp').textContent = 'Last uploaded: ' + new Date().toLocaleString();
    });
  });
}
