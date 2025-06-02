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
  const heatmapTool  = document.getElementById('heatmap-tool');

  // Build semester tabs
  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  // Add Heatmap tab
  const heatmapTab = document.createElement('div');
  heatmapTab.className = 'tab';
  heatmapTab.textContent = 'Heatmap';
  heatmapTab.onclick = () => selectHeatmap(heatmapTab);
  tabs.appendChild(heatmapTab);

  // Default select the 3rd term
  selectTerm(terms[2], tabs.children[2]);

  // Wire availability buttons
  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // Initialize Heatmap tool
  initHeatmapTool();

  // ───── Tab Handlers ──────────────────────────────────────
  function selectTerm(term, tabElem) {
    currentTerm = term;
    // Activate tab visuals
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');

    // Show upload/schedule UI, hide heatmap
    uploadDiv.style.display = 'block';
    tsDiv.style.display = 'block';
    roomDiv.style.display = 'block';
    document.getElementById('availability-ui').style.display = 'block';
    document.getElementById('schedule-container').style.display = 'block';
    heatmapTool.style.display = 'none';

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
    } else {
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
    }
  }

  function selectHeatmap(tabElem) {
    // Activate tab visuals
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');

    // Hide upload/schedule UI, show heatmap
    uploadDiv.style.display = 'none';
    tsDiv.style.display = 'none';
    roomDiv.style.display = 'none';
    document.getElementById('availability-ui').style.display = 'none';
    document.getElementById('schedule-container').style.display = 'none';
    heatmapTool.style.display = 'block';
  }

  // ───── Scheduler Functions ─────────────────────────

  function setupUpload() {
    roomDiv.innerHTML = '';
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
        // Save per-term
        localStorage.setItem(
          'cos_schedule_' + currentTerm,
          JSON.stringify({ data: currentData, timestamp: tsDiv.textContent })
        );
        // Also feed heatmap data for consistency
        feedHeatmapTool(currentData);
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
      const evs = data
        .filter(i => i.Days.includes(day))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);

      const cols = [];
      evs.forEach(ev => {
        let placed = false;
        for (let c=0; c<cols.length; c++) {
          if (cols[c][cols[c].length-1].endMin <= ev.startMin) {
            cols[c].push(ev); ev.col = c; placed = true; break;
          }
        }
        if (!placed) { ev.col = cols.length; cols.push([ev]); }
      });
      const colCount = cols.length || 1;

      cols.flat().forEach(ev => {
        const offset = ev.startMin - 360;
        const rowIndex = Math.floor(offset/30) + 1;
        const rem = offset % 30;
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

  // Availability handler
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

    const avail = rooms.filter(r => {
      const [bld, rm] = r.split('-');
      const conflicts = currentData.filter(i => 
        i.Building === bld && i.Room === rm && i.Days.split('').some(d => days.includes(d)) && 
        !(parseTime(i.End_Time) <= sMin || parseTime(i.Start_Time) >= eMin)
      );
      return conflicts.length === 0;
    });
    resultsDiv.textContent = avail.length ? avail.join(', ') : 'No rooms available.';
  }

  // Helper for parsing time strings "HH:MMAM/PM"
  function parseTime(t) {
    const [time, ap] = [t.slice(0, t.length - 2), t.slice(-2)];
    let [h,m] = time.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h*60 + m;
  }
  function format12(t) {
    const [time, ap] = [t.slice(0, t.length - 2), t.slice(-2)];
    let [h,m] = time.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const hh = ((h+11)%12)+1; return `${hh}:${('0'+m).slice(-2)}${h < 12 ? 'AM' : 'PM'}`;
  }

  // ───── Heatmap & Table Integration ─────────────────────
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
  const hours = Array.from({length:17}, (_, i) => i + 6); // 6 AM–22 (10 PM)
  let rawData = [];
  let dataTableInstance;
  let choiceInstance;

  function initHeatmapTool() {
    choiceInstance = new Choices('#courseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course',
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
    $('#courseSelect').on('change', updateAllHeatmapViews);
    $('#textSearch').on('input', function() {
      dataTableInstance.search(this.value).draw();
    });
  }

  function feedHeatmapTool(parsedRows) {
    rawData = parsedRows.map(r => {
      const subjCourse = (r.Subject_Course||'').trim().split(/\s+/);
      const key = subjCourse.length >= 2 ? (subjCourse[0] + ' ' + subjCourse[1]) : (r.Subject_Course||'').trim();
      return {
        key,
        BUILDING: (r.Building || '').trim(),
        ROOM: (r.Room || '').trim(),
        DAYS: (r.Days || '').trim(),
        Time: (r.Start_Time + ' - ' + r.End_Time) || ''.trim(),
      };
    });
    const uniqueKeys = Array.from(new Set(rawData.map(r => r.key).filter(k => k))).sort();
    const choiceItems = uniqueKeys.map(k => ({ value: k, label: k }));
    choiceInstance.setChoices(choiceItems, 'value', 'label', true);
    updateAllHeatmapViews();
  }

  function updateAllHeatmapViews() {
    const selectedCourses = choiceInstance.getValue(true);
    const tableRows = rawData
      .filter(r => {
        if (selectedCourses.length && !selectedCourses.includes(r.key)) {
          return false;
        }
        const bld = (r.BUILDING||'').toUpperCase();
        const rm = (r.ROOM||'').toUpperCase();
        if (!bld || !rm || bld === 'N/A' || rm === 'N/A' || bld === 'ONLINE') {
          return false;
        }
        const m = (r.Time || '').split('-')[0].trim().match(/(\d+):(\d+)\s*(AM|PM)/);
        if (!m) return false;
        const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
        return hr >= 6 && hr <= 22;
      })
      .map(r => [ r.key, r.BUILDING, r.ROOM, r.DAYS, r.Time ]);
    dataTableInstance.clear().rows.add(tableRows).draw();
  }

  function updateHeatmap() {
    const filteredData = dataTableInstance.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    days.forEach(d => counts[d] = hours.map(() => 0));
    filteredData.forEach(([course, bld, rm, daysStr, timeStr]) => {
      const dayCodes = (daysStr || '').split('');
      const m = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!m) return;
      const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
      dayCodes.forEach(dc => {
        const weekday = dayMap[dc];
        const hIndex = hours.indexOf(hr);
        if (weekday && hIndex >= 0) {
          counts[weekday][hIndex]++;
        }
      });
    });
    const maxCount = Math.max(...Object.values(counts).flat());
    let html = `<table class="heatmap" style="border-collapse:collapse; margin-top:20px; width:100%;">`;
    html += `<thead><tr><th style="background:#eee; border:1px solid #ccc; padding:4px;">Day/Time</th>`;
    hours.forEach(h => {
      const ap = h < 12 ? 'AM' : 'PM';
      const hh = h % 12 || 12;
      html += `<th style="background:#eee; border:1px solid #ccc; padding:4px;">${hh} ${ap}</th>`;
    });
    html += `</tr></thead><tbody>`;
    days.forEach(d => {
      html += `<tr><th style="background:#eee; border:1px solid #ccc; padding:4px; text-align:left;">${d}</th>`;
      counts[d].forEach(c => {
        const opacity = maxCount ? (c / maxCount) : 0;
        html += `<td style="border:1px solid #ccc; padding:4px; background:rgba(0,100,200,${opacity});">${c}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    $('#heatmapContainer').html(html);
  }

});
