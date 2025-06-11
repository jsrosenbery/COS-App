// COS-App js/app.js

// ---- Global Heatmap & Chart Variables ----
let hmRaw = [];
let hmTable;
let hmChoices;
let campusChoices;
let lineCourseChoices, lineCampusChoices;
let lineChartInstance;

const hmDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const hmHours = Array.from({length:17}, (_, i) => i + 6); // 6–22

// --- DOMContentLoaded Main ---
document.addEventListener('DOMContentLoaded', () => {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = [...hmDays];
  let currentData = [];
  let currentTerm = '';

  // Cache DOM refs
  const tabs         = document.getElementById('term-tabs');
  const uploadDiv    = document.getElementById('upload-container');
  const tsDiv        = document.getElementById('upload-timestamp');
  const roomDiv      = document.getElementById('room-filter');
  const startInput   = document.getElementById('avail-start');
  const endInput     = document.getElementById('avail-end');
  const checkBtn     = document.getElementById('avail-check-btn');
  const clearBtn     = document.getElementById('avail-clear-btn');
  const resultsDiv   = document.getElementById('avail-results');
  const table        = document.getElementById('schedule-table');
  const container    = document.getElementById('schedule-container');

  // ---- Heatmap initialization FIRST ----
  initHeatmap();
  initCampusChoices();
  initLineChartChoices();

  // Build semester tabs
  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  // Default select
  selectTerm(terms[2], tabs.children[2]);

  // Wire availability buttons
  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // ---- View Switching (heatmap/calendar/linechart) ----
  document.getElementById('viewSelect').addEventListener('change', function(){
    document.getElementById('heatmap-tool').style.display = (this.value === 'heatmap') ? 'block' : 'none';
    document.getElementById('schedule-container').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('availability-ui').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('room-filter').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('upload-container').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('upload-timestamp').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('linechart-tool').style.display = (this.value === 'linechart') ? 'block' : 'none';
    if (this.value === 'linechart') {
      renderLineChart();
    }
  });

  // ---- Line Chart Filter Events ----
  document.getElementById('lineCourseSelect').addEventListener('change', renderLineChart);
  document.getElementById('lineCampusSelect').addEventListener('change', renderLineChart);

  // --- Helpers and App Logic Below ---

  function selectTerm(term, tabElem) {
    currentTerm = term;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');

    clearSchedule();
    setupUpload();

    const key = 'cos_schedule_' + term;
    const saved = localStorage.getItem(key);
    if (saved) {
      const { data, timestamp } = JSON.parse(saved);
      currentData = data;
      tsDiv.textContent = timestamp;
      buildRoomDropdown();
      renderSchedule();
      feedHeatmapTool(currentData);
    } else {
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
    }
  }

  function setupUpload() {
    roomDiv.innerHTML = '';
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
        feedHeatmapTool(currentData);
        // Save per-term
        localStorage.setItem(
          'cos_schedule_' + currentTerm,
          JSON.stringify({ data: currentData, timestamp: tsDiv.textContent })
        );
      });
    };
  }

  function buildRoomDropdown() {
    const combos = [...new Set(currentData.map(i => `${i.Building}-${i.Room}`))].sort();
    roomDiv.innerHTML = `
      <label>Filter Bldg-Room:
        <select id="room-select">
          <option>All</option>
          ${combos.map(r => `<option>${r}</option>`).join('')}
        </select>
      </label>`;
    document.getElementById('room-select').onchange = renderSchedule;
  }

  function clearSchedule() {
    table.innerHTML = '';
    container.querySelectorAll('.class-block').forEach(e => e.remove());
    // Header row
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    daysOfWeek.forEach(d => header.insertCell().outerHTML = `<th>${d}</th>`);
    // Time slots
    for (let t = 360; t <= 22*60; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t%60;
      const h12 = ((hh+11)%12)+1, ap = hh<12?'AM':'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      daysOfWeek.forEach(() => row.insertCell());
    }
  }

  function renderSchedule() {
    clearSchedule();
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building}-${i.Room}` === filt);
    const rect = container.getBoundingClientRect();

    daysOfWeek.forEach((day, dIdx) => {
      // collect & sort events
      let evs = data
        .filter(i => i.Days.includes(day))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);

      // Deduplicate by: CRN, Start_Time, End_Time, Days (as string), Building, Room
      const seen = new Set();
      evs = evs.filter(ev => {
        const key = [
          ev.CRN,
          ev.Start_Time,
          ev.End_Time,
          Array.isArray(ev.Days) ? ev.Days.join(',') : ev.Days,
          ev.Building,
          ev.Room
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // overlap columns
      const cols = [];
      evs.forEach(ev => {
        let placed = false;
        for (let c=0; c<cols.length; c++) {
          if (cols[c][cols[c].length-1].endMin <= ev.startMin) {
            cols[c].push(ev); ev.col = c; placed = true; break;
          }
        }
        if (!placed) {
          ev.col = cols.length; cols.push([ev]);
        }
      });
      const colCount = cols.length || 1;

      // render
      cols.flat().forEach(ev => {
        const offset = ev.startMin - 360;
        const rowIndex = Math.floor(offset/30) + 1;
        const rem = offset % 30;
        // guard out-of-bounds
        if (rowIndex < 1 || rowIndex >= table.rows.length) return;

        const cell = table.rows[rowIndex].cells[dIdx+1];
        const cr   = cell.getBoundingClientRect();
        const topPx    = cr.top - rect.top + (rem/30)*cr.height;
        const leftPx   = cr.left - rect.left + ev.col*(cr.width/colCount);
        const widthPx  = cr.width/colCount;
        const heightPx = ((ev.endMin-ev.startMin)/30)*cr.height;

        const b = document.createElement('div');
        b.className = 'class-block';
        b.style.top    = `${topPx}px`;
        b.style.left   = `${leftPx}px`;
        b.style.width  = `${widthPx}px`;
        b.style.height = `${heightPx}px`;
        b.innerHTML = `
          <span>${ev.Subject_Course}</span><br>
          <span>${ev.CRN}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span>`;
        container.appendChild(b);
      });
    });
  }

  // ───── Availability Handler ───────────────────────
  function handleAvailability() {
    resultsDiv.textContent = '';
    const days = Array.from(
      document.querySelectorAll('#availability-ui .days input:checked')
    ).map(cb => cb.value);
    const start = startInput.value, end = endInput.value;
    if (!days.length || !start || !end) {
      resultsDiv.textContent = 'Please select at least one day and both start/end times.';
      return;
    }
    const toMin = t => {
      const [h,m] = t.split(':').map(Number);
      return h*60 + m;
    };
    const sMin = toMin(start), eMin = toMin(end);
    const rooms = [...new Set(currentData.map(i => `${i.Building}-${i.Room}`))];
    const occ   = new Set();
    currentData.forEach(i => {
      if (i.Days.some(d => days.includes(d))) {
        const si = parseTime(i.Start_Time), ei = parseTime(i.End_Time);
        if (!(ei <= sMin || si >= eMin)) {
          occ.add(`${i.Building}-${i.Room}`);
        }
      }
    });
    const avail = rooms.filter(r => !occ.has(r));
    if (avail.length) {
      resultsDiv.innerHTML = '<ul>' + avail.map(r => `<li>${r}</li>`).join('') + '</ul>';
    } else {
      resultsDiv.textContent = 'No rooms available.';
    }
  }

  function parseTime(t) {
    const [h,m] = t.split(':').map(Number);
    return h*60 + m;
  }
  function format12(t) {
    let [h,m] = t.split(':').map(Number);
    const ap = h<12 ? 'AM':'PM';
    h = ((h+11)%12)+1;
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }

  // ───── Heatmap & Table Logic ─────
  function initHeatmap() {
    hmChoices = new Choices('#courseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course',
    });
    hmTable = $('#dataTable').DataTable({
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
    hmTable.on('search.dt', updateHeatmap);
  }

  function initCampusChoices() {
    campusChoices = new Choices('#campusSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by campus',
    });
  }

  function initLineChartChoices() {
    lineCourseChoices = new Choices('#lineCourseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course',
    });
    lineCampusChoices = new Choices('#lineCampusSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by campus',
    });
  }

  function feedHeatmapTool(dataArray) {
    hmRaw = dataArray.map(r => {
      const parts = (r.Subject_Course || '').trim().split(/\s+/);
      const key = parts.length >=2 ? (parts[0] + ' ' + parts[1]) : (r.Subject_Course || '').trim();
      return {
        key,
        Building: r.Building || '',
        Room: r.Room || '',
        Days: r.Days || [],
        Start_Time: r.Start_Time || '',
        End_Time: r.End_Time || '',
        Campus: r.Campus || r.CAMPUS || '',
      };
    });
    const uniqueKeys = Array.from(new Set(hmRaw.map(r => r.key).filter(k => k))).sort();
    const items = uniqueKeys.map(k => ({ value: k, label: k }));
    if (hmChoices) {
      hmChoices.setChoices(items, 'value', 'label', true);
    }
    // Populate campus multi-select (use both Campus and CAMPUS)
    const campuses = Array.from(new Set(
      hmRaw.map(r => r.Campus || r.CAMPUS).filter(Boolean)
    )).sort();
    const campusItems = campuses.map(c => ({ value: c, label: c }));
    if (campusChoices) {
      campusChoices.setChoices(campusItems, 'value', 'label', true);
    }
    // Also initialize line chart choices
    if (lineCourseChoices) {
      lineCourseChoices.setChoices(items, 'value', 'label', true);
    }
    if (lineCampusChoices) {
      lineCampusChoices.setChoices(campusItems, 'value', 'label', true);
    }
    updateAllHeatmap();
    renderLineChart(); // New: render line chart on data feed
  }

  function updateAllHeatmap() {
    const selected = hmChoices.getValue(true);
    const selectedCampuses = campusChoices ? campusChoices.getValue(true) : [];
    const rows = hmRaw.filter(r => {
      if(selected.length && !selected.includes(r.key)) return false;
      if(selectedCampuses.length && !selectedCampuses.includes(r.Campus || r.CAMPUS)) return false;
      if(!r.Building || !r.Room) return false;
      const b = r.Building.toUpperCase(), ro = r.Room.toUpperCase();
      if(b==='N/A'||ro==='N/A'||b==='ONLINE') return false;
      return true;
    }).map(r => [r.key, r.Building, r.Room, r.Days.join(','), r.Start_Time + '-' + r.End_Time]);
    hmTable.clear().rows.add(rows).draw();
  }

  function updateHeatmap() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d => counts[d] = hmHours.map(() => 0));
    filtered.forEach(row => {
      const [ course, bld, room, daysStr, timeStr ] = row;
      const dayList = daysStr.split(',');
      const timeParts = timeStr.split('-');
      const st = timeParts[0].trim();
      const m = st.match(/(\d{2}):(\d{2})/);
      if(!m) return;
      const hr = parseInt(m[1],10);
      dayList.forEach(d => {
        const hIndex = hmHours.indexOf(hr);
        if(hIndex>=0 && counts[d]) counts[d][hIndex]++;
      });
    });
    const maxC = Math.max(...Object.values(counts).flat());
    let html = '<table class="heatmap" style="border-collapse:collapse; margin-top:20px; width:100%;">';
    html += '<thead><tr><th style="background:#eee;border:1px solid #ccc;padding:4px;">Day/Time</th>';
    hmHours.forEach(h=>{ const ap=h<12?'AM':'PM'; const hh=h%12||12; html+=`<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`; });
    html+='</tr></thead><tbody>';
    hmDays.forEach(d=>{ html+=`<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`; counts[d].forEach(c=>{ const op=maxC?c/maxC:0; html+=`<td style="border:1px solid #ccc;padding:4px;background:rgba(0,100,200,${op});">${c}</td>`; }); html+='</tr>'; });
    html+='</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  // --- LINE CHART LOGIC: OCCUPANCY PER HOUR, PER DAY ---
  function renderLineChart() {
    // Get selected filters
    const selectedCourses = lineCourseChoices ? lineCourseChoices.getValue(true) : [];
    const selectedCampuses = lineCampusChoices ? lineCampusChoices.getValue(true) : [];

    // Filter data
    const filtered = hmRaw.filter(r => {
      if(selectedCourses.length && !selectedCourses.includes(r.key)) return false;
      const campusVal = r.Campus || r.CAMPUS;
      if(selectedCampuses.length && !selectedCampuses.includes(campusVal)) return false;
      if (!r.Days.length || !r.Start_Time || !r.End_Time) return false;
      return true;
    });

    // Chart axes and occupancy buckets
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const hours = Array.from({length:17}, (_,i)=>i+6); // 6–22
    let counts = {};
    daysOfWeek.forEach(d => hours.forEach(h => counts[d+'-'+h] = 0));

    // Robust time parsing for AM/PM and 24-hr
    function parseHour(t) {
      if (!t) return null;
      t = t.trim();
      let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!m) return null;
      let h = parseInt(m[1],10);
      const min = parseInt(m[2],10);
      const ampm = m[3] ? m[3].toUpperCase() : null;
      if (ampm === "AM") {
        if (h === 12) h = 0;
      } else if (ampm === "PM") {
        if (h !== 12) h += 12;
      }
      // If no AM/PM, trust as 24-hour
      return h + min/60;
    }

    // Fill occupancy counts per hour per day
    filtered.forEach(rec => {
      let recDays = Array.isArray(rec.Days) ? rec.Days : (typeof rec.Days === "string" ? rec.Days.split(',') : []);
      if (recDays.length === 1 && recDays[0].length > 1 && recDays[0].length <= 7 && !daysOfWeek.includes(recDays[0])) {
        const abbrevDayMap = { 'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday' };
        recDays = recDays[0].split('').map(abbr => abbrevDayMap[abbr] || abbr);
      }
      const startHour = parseHour(rec.Start_Time);
      const endHour = parseHour(rec.End_Time);
      if (startHour == null || endHour == null) return;
      recDays.forEach(day => {
        if (!day || !daysOfWeek.includes(day)) return;
        hours.forEach(h => {
          if (h >= Math.floor(startHour) && h < endHour) {
            counts[day+'-'+h] += 1;
          }
        });
      });
    });

    // Chart.js datasets: each day is a line, X is hour, Y is occupancy
    const ctx = document.getElementById('lineChartCanvas').getContext('2d');
    const labels = hours.map(h => `${h % 12 === 0 ? 12 : h % 12} ${(h < 12 ? 'AM' : 'PM')}`);
    const colorList = [
      "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2"
    ];
    const datasets = daysOfWeek.map((day, idx) => ({
      label: day,
      data: hours.map(h => counts[day+'-'+h]),
      fill: false,
      borderColor: colorList[idx % colorList.length],
      backgroundColor: colorList[idx % colorList.length],
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2
    }));

    // Draw or update the chart
    if (lineChartInstance) {
      lineChartInstance.data.labels = labels;
      lineChartInstance.data.datasets = datasets;
      lineChartInstance.update();
    } else {
      lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            x: { title: { display: true, text: 'Time of Day' } },
            y: { title: { display: true, text: 'Concurrent Courses' }, beginAtZero: true }
          }
        }
      });
    }
  }
});
