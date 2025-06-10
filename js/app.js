document.addEventListener('DOMContentLoaded', () => {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
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

  // ---- Modern Heatmap & Chart Variables ----
  let rawData = [], dataTable, chartInstance;

  // ---- Heatmap initialization ----
  // (No legacy heatmap Choices/DataTables here -- replaced by new logic)

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
    // clear selections
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // ───── Scheduler Functions ─────────────────────────

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
      // FEED MODERN HEATMAP
      feedModernHeatmap(currentData);
    } else {
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
      // FEED MODERN HEATMAP
      feedModernHeatmap([]);
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
        // FEED MODERN HEATMAP
        feedModernHeatmap(currentData);
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

  // ----- DEDUPLICATION LOGIC ADDED HERE -----
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

  // ───── Helpers ────────────────────────────────────
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

  // ───── MODERN HEATMAP & OCCUPANCY CHART LOGIC ─────

  function initModernHeatmapUI() {
    initTable();
    $('#courseSelect').multipleSelect({ filter: true, placeholder: 'Filter by course', width: '250px' }).on('change', updateTable);
    $('#campusSelect').multipleSelect({ filter: true, placeholder: 'Filter by campus', width: '200px' }).on('change', updateTable);
    $('#fileInput').on('change', e => loadFile(e.target.files[0]));
    $('#textSearch').on('input', updateTable);
  }

  function initTable() {
    dataTable = $('#dataTable').DataTable({
      data: [],
      columns: [
        { title: 'Course', data: 0 },
        { title: 'Building', data: 1 },
        { title: 'Room', data: 2 },
        { title: 'Campus', data: 3 },
        { title: 'Days', data: 4 },
        { title: 'Time', data: 5 }
      ],
      destroy: true,
      searching: true
    });
    dataTable.on('draw', () => {
      const count = dataTable.rows({ filter: 'applied' }).data().length;
      $('#message').text(`Displaying ${count} rows.`);
      renderHeatmap();
      renderChart();
    });
  }

  // Feeds the modern heatmap from scheduler data
  function feedModernHeatmap(dataArray) {
    // Convert scheduler-style data to heatmap rawData format
    // Accepts array of objects with Building, Room, Campus, Days, Start_Time, End_Time, etc.
    rawData = dataArray.map(r => {
      const [Disc, Crs] = (r.Subject_Course||'').trim().split(/\s+/);
      return {
        ...r,
        key: `${Disc} ${Crs}`.trim(),
        BUILDING: r.Building || r.BUILDING || '',
        ROOM: r.Room || r.ROOM || '',
        Campus: r.Campus || r.CAMPUS || '',
        DAYS: Array.isArray(r.Days) ? r.Days.map(d => d[0]).join('') : (r.Days || r.DAYS || ''),
        Time: (r.Start_Time && r.End_Time) ? `${r.Start_Time}-${r.End_Time}` : (r.Time || r.TIME || '')
      };
    });
    populateFilters();
    updateTable();
  }

  function parseCSVFile(file, cb) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => cb(results.data)
    });
  }

  function loadFile(file) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: results => {
        rawData = results.data.map(r => {
          const [Disc, Crs] = (r.Subject_Course||'').trim().split(/\s+/);
          return { ...r, key: `${Disc} ${Crs}`.trim() };
        });
        populateFilters();
        updateTable();
      }
    });
  }

  function populateFilters() {
    const courses = [...new Set(rawData.map(r => r.key).filter(k => k))].sort();
    const $course = $('#courseSelect').empty();
    courses.forEach(c => $course.append(`<option value="${c}">${c}</option>`));
    $('#courseSelect').multipleSelect('refresh');

    const campuses = [...new Set(rawData.map(r => r.Campus || r.CAMPUS).filter(c => c))].sort();
    const $campus = $('#campusSelect').empty();
    campuses.forEach(c => $campus.append(`<option value="${c}">${c}</option>`));
    $('#campusSelect').multipleSelect('refresh');
  }

  function updateTable() {
    const selectedCourses = $('#courseSelect').multipleSelect('getSelects');
    const selectedCampuses = $('#campusSelect').multipleSelect('getSelects');
    const filterText = $('#textSearch').val().toLowerCase();

    const rows = rawData.filter(r => {
      if (selectedCourses.length && !selectedCourses.includes(r.key)) return false;
      const campusVal = r.Campus || r.CAMPUS;
      if (selectedCampuses.length && !selectedCampuses.includes(campusVal)) return false;
      if (filterText && !((r.Subject_Course||'') + ' ' + (r.COURSE_TITLE||'')).toLowerCase().includes(filterText)) return false;
      const b = (r.BUILDING||r.Building||'').trim().toUpperCase();
      const rm = (r.ROOM||r.Room||'').trim().toUpperCase();
      if (!b || !rm || b==='N/A' || rm==='N/A' || b==='ONLINE') return false;
      return true;
    }).map(r => [
      r.key,
      r.BUILDING || r.Building || '',
      r.ROOM || r.Room || '',
      r.Campus || r.CAMPUS || '',
      r.DAYS || r.Days || '',
      r.Time || r.TIME || ''
    ]);

    dataTable.clear().rows.add(rows).draw();
  }

  function renderHeatmap() {
    const data = dataTable.rows({ filter: 'applied' }).data().toArray();
    const daysMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const hours = Array.from({length:17}, (_,i)=>i+6);
    let counts = {}, maxCount = 0;
    data.forEach(row => {
      const daysStr = row[4];
      const timeStr = row[5];
      daysStr.split('').forEach(ch => {
        const day = daysMap[ch];
        if (!day) return;
        const m = timeStr.split('-')[0].trim().match(/(\d+):(\d+)\s*(AM|PM)/);
        if (m) {
          let h = parseInt(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0);
          if (h >= 6 && h <= 22) {
            const key = day + '-' + h;
            counts[key] = (counts[key] || 0) + 1;
            maxCount = Math.max(maxCount, counts[key]);
          }
        }
      });
    });

    let html = '<table class="heatmap"><tr><th>Day/Hour</th>';
    hours.forEach(h => html += `<th>${h % 12 === 0 ? 12 : h % 12} ${(h<12?'AM':'PM')}</th>`);
    html += '</tr>';
    daysOfWeek.forEach(day => {
      html += `<tr><th>${day}</th>`;
      hours.forEach(h => {
        const c = counts[day + '-' + h] || 0;
        const alpha = maxCount > 0 ? (c / maxCount) * 0.8 + 0.2 : 0;
        html += `<td style="background-color:rgba(255,165,0,${alpha});">${c>0?c:''}</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  function renderChart() {
    const data = dataTable.rows({ filter: 'applied' }).data().toArray();
    const daysMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const hours = Array.from({length:17}, (_,i)=>i+6);
    let counts = {};
    daysOfWeek.forEach(d => hours.forEach(h => counts[d+'-'+h] = 0));
    data.forEach(row => {
      const daysStr = row[4];
      const timeRange = row[5].split('-').map(t => t.trim());
      const parseHour = t => {
        const m = t.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (!m) return null;
        let h = parseInt(m[1]) % 12 + (m[3]==='PM'?12:0);
        return h;
      };
      const start = parseHour(timeRange[0]);
      const end = parseHour(timeRange[1]);
      daysStr.split('').forEach(ch => {
        const day = daysMap[ch];
        if (!day || start===null || end===null) return;
        hours.forEach(h => {
          if (h >= start && h < end) counts[day+'-'+h] += 1;
        });
      });
    });
    const ctx = document.getElementById('occupancyChart').getContext('2d');
    const labels = hours.map(h => `${h%12===0?12:h%12} ${(h<12?'AM':'PM')}`);
    const datasets = daysOfWeek.map((day, idx) => ({
      label: day,
      data: hours.map(h => counts[day+'-'+h]),
      fill: false,
      tension: 0.3
    }));
    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets = datasets;
      chartInstance.update();
    } else {
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          scales: {
            x: { title: { display: true, text: 'Time of Day' } },
            y: { title: { display: true, text: 'Concurrent Courses' }, beginAtZero: true }
          },
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  }

  // ---- Initialize modern heatmap UI if controls exist
  if (document.getElementById('courseSelect')) {
    initModernHeatmapUI();
  }
});
