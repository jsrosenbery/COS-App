// js/app.js
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

  // Heatmap variables: Declare before any function that uses them!
  const hmDays      = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const hmHours     = Array.from({length:17}, (_, i) => i + 6); // 6–22
  const hmDayMap    = {
    'Sunday':'Sunday','Monday':'Monday','Tuesday':'Tuesday',
    'Wednesday':'Wednesday','Thursday':'Thursday',
    'Friday':'Friday','Saturday':'Saturday'
  };
  let hmRaw        = [];
  let hmTable;
  let hmChoices;
  let chartInstance;

  // ---- Heatmap initialization FIRST ----
  initHeatmap();

  // Build semester tabs
  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  // Default select Spring 2026
  selectTerm(terms[2], tabs.children[2]);

  // Wire availability buttons
  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // View switcher
  document.getElementById('viewSelect').addEventListener('change', e => {
    const view = e.target.value;
    container.style.display        = view === 'calendar' ? 'block' : 'none';
    document.getElementById('heatmap-tool').style.display = view === 'heatmap'  ? 'block' : 'none';
    document.getElementById('availability-ui').style.display    = view === 'calendar' ? 'block' : 'none';
    document.getElementById('room-filter').style.display         = view === 'calendar' ? 'block' : 'none';
    document.getElementById('upload-container').style.display    = view === 'calendar' ? 'block' : 'none';
    document.getElementById('upload-timestamp').style.display    = view === 'calendar' ? 'block' : 'none';
    if (view === 'heatmap') updateAllHeatmap();
  });

  // Set up CSV upload
  setupUpload();

  // ---------------- Scheduler & Availability code ----------------

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
      </label>
    `;
    document.getElementById('room-select').onchange = () => renderSchedule();
  }

  function renderSchedule() {
    clearSchedule();
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building}-${i.Room}` === filt);
    const rect = container.getBoundingClientRect();

    daysOfWeek.forEach((day, dIdx) => {
      let evs = data
        .filter(i => i.Days.includes(day))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);

      // place overlapping events in separate columns
      const cols = [];
      evs.forEach(ev => {
        let placed = false;
        for (const col of cols) {
          if (!col.some(e => !(e.endMin <= ev.startMin || e.startMin >= ev.endMin))) {
            col.push(ev);
            placed = true;
            break;
          }
        }
        if (!placed) cols.push([ev]);
      });

      const colCount = Math.max(cols.length, 1);
      cols.flat().forEach(ev => {
        const offset = ev.startMin - 360;           // minutes after 6am
        const rowIndex = Math.floor(offset/30) + 1;  // which half-hour row
        const rem = offset % 30;
        if (rowIndex < 1 || rowIndex >= table.rows.length) return;

        const cell = table.rows[rowIndex].cells[dIdx+1];
        const cr   = cell.getBoundingClientRect();
        const topPx    = cr.top - rect.top + (rem/30)*cr.height;
        const leftPx   = cr.left - rect.left + (cr.width/colCount)*evsColIndex(cols, ev);
        const widthPx  = cr.width/colCount;
        const heightPx = ((ev.endMin-ev.startMin)/30)*cr.height;

        const block = document.createElement('div');
        block.className = 'event-block';
        block.style.top    = topPx + 'px';
        block.style.left   = leftPx + 'px';
        block.style.width  = widthPx + 'px';
        block.style.height = heightPx + 'px';
        block.textContent  = ev.Subject_Course;
        container.appendChild(block);
      });
    });
  }

  // helper to find column index for an event
  function evsColIndex(columns, event) {
    return columns.findIndex(col => col.includes(event));
  }

  function clearSchedule() {
    // clear all .event-block
    document.querySelectorAll('.event-block').forEach(el => el.remove());
  }

  function handleAvailability() {
    const days = Array.from(document.querySelectorAll('#availability-ui .days input:checked')).map(cb => cb.value);
    if (!startInput.value || !endInput.value || !days.length) {
      alert('Select days and both start/end times.');
      return;
    }
    const sMin = parseTime(startInput.value), eMin = parseTime(endInput.value);
    const occupied = new Set();
    currentData.forEach(i => {
      if (i.Days.some(d => days.includes(d))) {
        const st = parseTime(i.Start_Time), et = parseTime(i.End_Time);
        if (!(et <= sMin || st >= eMin)) {
          occupied.add(`${i.Building}-${i.Room}`);
        }
      }
    });
    const allRooms = [...new Set(currentData.map(i => `${i.Building}-${i.Room}`))];
    const avail = allRooms.filter(r => !occupied.has(r));
    resultsDiv.innerHTML = avail.length
      ? '<ul>' + avail.map(r=>`<li>${r}</li>`).join('') + '</ul>'
      : 'No rooms available.';
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
    // On table search/filter change, redraw both heatmap and occupancy chart
    hmTable.on('search.dt', () => {
      updateHeatmap();
      renderChart();
    });
  }

  function feedHeatmapTool(dataArray) {
    hmRaw = dataArray.map(r => {
      const parts = (r.Subject_Course || '').trim().split(/\s+/);
      const key = parts.length >= 2
        ? (parts[0] + ' ' + parts[1])
        : (r.Subject_Course || '').trim();
      return {
        key,
        Building:  r.Building || '',
        Room:      r.Room     || '',
        Days:      r.Days     || [],
        Start_Time: r.Start_Time || '',
        End_Time:   r.End_Time   || ''
      };
    });
    const uniqueKeys = Array.from(new Set(hmRaw.map(r=>r.key))).sort();
    hmChoices.setChoices(uniqueKeys.map(k=>({value:k,label:k})), 'value','label', true);
    updateAllHeatmap();
  }

  function updateAllHeatmap() {
    const selected = hmChoices.getValue(true);
    const rows = hmRaw
      .filter(r => {
        if (selected.length && !selected.includes(r.key)) return false;
        if (!r.Building || !r.Room) return false;
        const b = r.Building.toUpperCase(), ro = r.Room.toUpperCase();
        if (b==='N/A' || ro==='N/A' || b==='ONLINE') return false;
        return true;
      })
      .map(r => [r.key, r.Building, r.Room, r.Days.join(','), r.Start_Time + '-' + r.End_Time]);

    hmTable.clear().rows.add(rows).draw();
    // ensure initial heatmap & chart draw
    updateHeatmap();
    renderChart();
  }

  function updateHeatmap() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d => counts[d] = hmHours.map(() => 0));

    filtered.forEach(row => {
      const [ , , , daysStr, timeStr ] = row;
      const dayList = daysStr.split(',');
      const [ start, end ] = timeStr.split('-').map(t => t.trim());
      const parseHour = t => {
        const m = t.match(/(\d{2}):\d{2}/);
        return m ? parseInt(m[1],10) : null;
      };
      const h0 = parseHour(start), h1 = parseHour(end);
      if (h0 != null && h1 != null) {
        dayList.forEach(d => {
          for (let h = h0; h < h1; h++) {
            const idx = hmHours.indexOf(h);
            if (idx >= 0) counts[d][idx]++;
          }
        });
      }
    });

    const maxC = Math.max(...Object.values(counts).flat());
    let html = '<table class="heatmap" style="border-collapse:collapse;margin-top:20px;width:100%;">';
    html += '<thead><tr><th style="background:#eee;border:1px solid #ccc;padding:4px;">Day/Time</th>';
    hmHours.forEach(h => {
      const ap = h < 12 ? 'AM' : 'PM';
      const hh = h % 12 === 0 ? 12 : h % 12;
      html += `<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`;
    });
    html += '</tr></thead><tbody>';

    hmDays.forEach(d => {
      html += `<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`;
      counts[d].forEach(c => {
        const opacity = maxC ? (c/maxC).toFixed(2) : 0;
        html += `<td style="border:1px solid #ccc;padding:4px;background:rgba(0,100,200,${opacity});">${c}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  // Render occupancy line chart
  function renderChart() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d => counts[d] = hmHours.map(() => 0));

    filtered.forEach(row => {
      const [ , , , daysStr, timeStr ] = row;
      const dayList = daysStr.split(',');
      const [start, end] = timeStr.split('-').map(t => t.trim());
      const parseHour = t => {
        const m = t.match(/(\d{2}):(\\d{2})/);
        return m ? parseInt(m[1],10) : null;
      };
      const h0 = parseHour(start), h1 = parseHour(end);
      if (h0 != null && h1 != null) {
        dayList.forEach(d => {
          for (let h = h0; h < h1; h++) {
            const idx = hmHours.indexOf(h);
            if (idx >= 0) counts[d][idx]++;
          }
        });
      }
    });

    const ctx = document.getElementById('occupancyChart').getContext('2d');
    const labels = hmHours.map(h => `${h%12||12} ${h<12?'AM':'PM'}`);
    const datasets = hmDays.map(day => ({
      label: day,
      data: counts[day],
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

  // --- Heatmap view select logic
  document.getElementById('viewSelect').addEventListener('change', function(){
    if(this.value==='heatmap'){
      document.getElementById('schedule-container').style.display='none';
      document.getElementById('availability-ui').style.display='none';
      document.getElementById('room-filter').style.display='none';
      document.getElementById('upload-container').style.display='none';
      document.getElementById('upload-timestamp').style.display='none';
      document.getElementById('heatmap-tool').style.display='block';
    } else {
      document.getElementById('heatmap-tool').style.display='none';
      document.getElementById('schedule-container').style.display='';
      document.getElementById('availability-ui').style.display='';
      document.getElementById('room-filter').style.display='';
      document.getElementById('upload-container').style.display='';
      document.getElementById('upload-timestamp').style.display='';
    }
  });

  // Feed heatmap whenever schedule loads
  // After renderSchedule or data loading, call feedHeatmapTool(currentData)
});
