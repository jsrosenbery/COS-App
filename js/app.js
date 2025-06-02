
document.addEventListener('DOMContentLoaded', () => {
  // Original variables
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
  const container    = document.getElementById('schedule-container');

  // ───── Build Term Tabs ─────────────────────────────
  terms.forEach(term => {
    const tab = document.createElement('button');
    tab.textContent = term;
    tab.className = 'tab';
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });

  // ───── Setup Upload UI ─────────────────────────────
  function setupUpload() {
    roomDiv.innerHTML = '';
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
        // Feed data to heatmap
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
          ${combos.map(c => `<option>${c}</option>`).join('')}
        </select>
      </label>
    `;
    document.getElementById('room-select').onchange = renderSchedule;
  }

  // ───── Scheduler Functions ─────────────────────────
  function selectTerm(term, tabElem) {
    currentTerm = term;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');

    setupUpload();

    const key = 'cos_schedule_' + term;
    const saved = localStorage.getItem(key);
    if (saved) {
      const { data, timestamp } = JSON.parse(saved);
      currentData = data;
      tsDiv.textContent = timestamp;
      buildRoomDropdown();
      renderSchedule();
      // Also feed to heatmap on load
      feedHeatmapTool(currentData);
    } else {
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
    }
  }

  function clearSchedule() {
    const table = document.getElementById('schedule-table');
    table.innerHTML = '';
    container.querySelectorAll('.class-block').forEach(e => e.remove());
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    daysOfWeek.forEach(d => header.insertCell().outerHTML = `<th>${d}</th>`);
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
    data.forEach(ev => {
      ev.Days.forEach((day) => {
        const dIdx = daysOfWeek.indexOf(day);
        const rowIndex = Math.floor(ev.Start_Time/30) + 1;
        if (dIdx < 0 || rowIndex < 1) return;
        const cell = document.getElementById('schedule-table').rows[rowIndex].cells[dIdx+1];
        const cr   = cell.getBoundingClientRect();
        const topPx    = cr.top - rect.top + ((ev.Start_Time % 60)/30)*cr.height;
        const leftPx   = cr.left - rect.left;
        const widthPx  = cr.width;
        const heightPx = ((ev.End_Time - ev.Start_Time)/30)*cr.height;
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
    ).map(d => d.value);
    const startMin = parseTime(startInput.value || '00:00');
    const endMin   = parseTime(endInput.value   || '23:59');
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building}-${i.Room}` === filt);
    const available = [...new Set(
      data
        .filter(i => i.Days.some(d => days.includes(d)))
        .filter(i => !(i.Start_Time < endMin && i.End_Time > startMin))
        .map(i => `${i.Building}-${i.Room}`)
    )];
    resultsDiv.innerHTML = available.length
      ? available.join('<br>')
      : 'No available rooms.';
  }

  // Attach availability events
  checkBtn.onclick  = handleAvailability;
  clearBtn.onclick  = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // ───── Helpers ────────────────────────────────────
  function parseTime(t) {
    const [h,m] = t.split(':').map(Number);
    return h*60 + m;
  }
  function format12(t) {
    let h = Math.floor(t/60), m = t%60;
    const ap = h<12 ? 'AM':'PM';
    h = ((h+11)%12)+1;
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }

  // ───── Heatmap & Table logic ─────────────────────
  const hmDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const hoursArr = Array.from({length:17}, (_, i) => i + 6);
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
  }

  function feedHeatmapTool(parsedRows) {
    rawData = parsedRows.map(r => {
      const subjCourse = (r.Subject_Course||'').trim().split(/\s+/);
      const key = subjCourse.length >= 2 ? (subjCourse[0] + ' ' + subjCourse[1]) : (r.Subject_Course||'').trim();
      return {
        key,
        Building: r.Building,
        Room: r.Room,
        Days: r.Days,        // array of full day names
        Start_Time: r.Start_Time, // minutes from midnight
        End_Time: r.End_Time
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
        const bld = (r.Building||'').toUpperCase();
        const rm = (r.Room||'').toUpperCase();
        if (!bld || !rm || bld === 'N/A' || rm === 'N/A' || bld === 'ONLINE') {
          return false;
        }
        const hr = Math.floor(r.Start_Time/60);
        return hr >= 6 && hr <= 22;
      })
      .map(r => [ r.key, r.Building, r.Room, r.Days.join(','), format12(r.Start_Time) + ' - ' + format12(r.End_Time) ]);
    dataTableInstance.clear().rows.add(tableRows).draw();
  }

  function updateHeatmap() {
    const filteredData = dataTableInstance.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d => counts[d] = hoursArr.map(() => 0));
    filteredData.forEach(([course, bld, rm, daysStr, timeStr]) => {
      const daysArr = daysStr.split(',');
      const startMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!startMatch) return;
      let hr = parseInt(startMatch[1]) % 12 + (startMatch[3]==='PM'?12:0);
      daysArr.forEach(day => {
        const hIndex = hoursArr.indexOf(hr);
        if (hIndex >= 0 && counts[day]) {
          counts[day][hIndex]++;
        }
      });
    });
    const maxCount = Math.max(...Object.values(counts).flat());
    let html = `<table class="heatmap" style="border-collapse:collapse; margin-top:20px; width:100%;">`;
    html += `<thead><tr><th style="background:#eee; border:1px solid #ccc; padding:4px;">Day/Time</th>`;
    hoursArr.forEach(h => {
      const ap = h < 12 ? 'AM' : 'PM';
      const hh = h % 12 || 12;
      html += `<th style="background:#eee; border:1px solid #ccc; padding:4px;">${hh} ${ap}</th>`;
    });
    html += `</tr></thead><tbody>`;
    hmDays.forEach(d => {
      html += `<tr><th style="background:#eee; border:1px solid #ccc; padding:4px; text-align:left;">${d}</th>`;
      counts[d].forEach(c => {
        const opacity = maxCount ? (c / maxCount) : 0;
        html += `<td style="border:1px solid #ccc; padding:4px; background:rgba(0,100,200,${opacity});">${c}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  function initHeatmapTool() {
    initHeatmapTool(); // initialize choices and DataTable
  }

  function initViewToggle() {
    document.getElementById('viewSelect').onchange = function() {
      if (this.value === 'heatmap') {
        document.getElementById('schedule-container').style.display = 'none';
        document.getElementById('availability-ui').style.display = 'none';
        document.getElementById('room-filter').style.display = 'none';
        document.getElementById('upload-container').style.display = 'none';
        document.getElementById('upload-timestamp').style.display = 'none';
        document.getElementById('heatmap-tool').style.display = 'block';
      } else {
        document.getElementById('heatmap-tool').style.display = 'none';
        document.getElementById('schedule-container').style.display = '';
        document.getElementById('availability-ui').style.display = '';
        document.getElementById('room-filter').style.display = '';
        document.getElementById('upload-container').style.display = '';
        document.getElementById('upload-timestamp').style.display = '';
      }
    };
  }

  // Initialize heatmap
  initHeatmapTool();
  initViewToggle();

  document.getElementById('courseSelect').onchange = updateAllHeatmapViews;
  document.getElementById('textSearch').oninput = function() {
    dataTableInstance.search(this.value).draw();
  };
});
