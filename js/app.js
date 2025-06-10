// js/app.js
document.addEventListener('DOMContentLoaded', () => {
  // ───── Configuration & State ────────────────────
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [];
  let currentTerm = '';

  // ───── DOM References ───────────────────────────
  const tabs       = document.getElementById('term-tabs');
  const uploadDiv  = document.getElementById('upload-container');
  const tsDiv      = document.getElementById('upload-timestamp');
  const roomDiv    = document.getElementById('room-filter');
  const startInput = document.getElementById('avail-start');
  const endInput   = document.getElementById('avail-end');
  const checkBtn   = document.getElementById('avail-check-btn');
  const clearBtn   = document.getElementById('avail-clear-btn');
  const resultsDiv = document.getElementById('avail-results');
  const container  = document.getElementById('schedule-container');
  const table      = document.getElementById('schedule-table');

  // ───── Heatmap State ────────────────────────────
  const hmDays   = [...daysOfWeek];
  const hmHours  = Array.from({length:17}, (_,i) => i + 6); // 6–22
  let hmRaw      = [];
  let hmTable, hmChoices, chartInstance = null;

  // Initialize the heatmap tool (DataTable + Choices)
  initHeatmap();

  // ───── Build Semester Tabs ──────────────────────
  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i===2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  // Default to Spring 2026
  selectTerm(terms[2], tabs.children[2]);

  // ───── Availability Controls ────────────────────
  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    // clear days checkboxes, time inputs, results
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // ───── View Switcher ────────────────────────────
  document.getElementById('viewSelect').addEventListener('change', e => {
    const view = e.target.value;
    // Calendar view elements
    container.style.display       = view==='calendar' ? 'block' : 'none';
    document.getElementById('availability-ui').style.display = view==='calendar' ? 'block' : 'none';
    roomDiv.style.display         = view==='calendar' ? 'block' : 'none';
    uploadDiv.style.display       = view==='calendar' ? 'block' : 'none';
    tsDiv.style.display           = view==='calendar' ? 'block' : 'none';
    // Heatmap view
    document.getElementById('heatmap-tool').style.display = view==='heatmap'? 'block':'none';
    if (view==='heatmap') updateAllHeatmap();
  });

  // ───── CSV Upload + Persistence ─────────────────
  setupUpload();

  // ─────── Functions ──────────────────────────────

  function selectTerm(term, tabElem) {
    currentTerm = term;
    // Highlight active tab
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    // Clear any existing schedule blocks
    clearSchedule();
    // Re-render upload controls
    setupUpload();

    // Try to load from localStorage
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
      // No saved data yet
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
      clearSchedule();
      feedHeatmapTool([]); // clear heatmap
    }
  }

  function setupUpload() {
    uploadDiv.innerHTML = `
      <label>
        Upload CSV for ${currentTerm}:
        <input type="file" id="file-input" accept=".csv">
      </label>
    `;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        const ts = new Date().toLocaleString();
        tsDiv.textContent = `Last upload: ${ts}`;
        buildRoomDropdown();
        renderSchedule();
        feedHeatmapTool(currentData);
        // Persist
        localStorage.setItem(
          'cos_schedule_' + currentTerm,
          JSON.stringify({ data: currentData, timestamp: tsDiv.textContent })
        );
      });
    };
  }

  function buildRoomDropdown() {
    const combos = Array.from(
      new Set(currentData.map(i => `${i.Building}-${i.Room}`))
    ).sort();
    roomDiv.innerHTML = `
      <label>
        Filter Bldg-Room:
        <select id="room-select">
          <option>All</option>
          ${combos.map(r=>`<option>${r}</option>`).join('')}
        </select>
      </label>
    `;
    document.getElementById('room-select').onchange = () => renderSchedule();
  }

  function renderSchedule() {
    clearSchedule();
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt==='All'
      ? currentData
      : currentData.filter(i => `${i.Building}-${i.Room}` === filt);

    const rect = container.getBoundingClientRect();

    daysOfWeek.forEach((day, dIdx) => {
      // Gather events for this day
      let evs = data
        .filter(i => i.Days.includes(day))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);

      // Column stacking for overlaps
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

      // Render blocks
      evs.forEach(ev => {
        const colIndex = cols.findIndex(c=>c.includes(ev));
        const cellRow  = Math.floor((ev.startMin - 360)/30) + 1; // row in table
        const cell     = table.rows[cellRow]?.cells[dIdx+1];
        if (!cell) return;
        const cr = cell.getBoundingClientRect();
        const topPx = cr.top - rect.top + ((ev.startMin - 360) % 30)/30 * cr.height;
        const leftPx   = cr.left - rect.left + colIndex*(cr.width/cols.length);
        const widthPx  = cr.width/cols.length;
        const heightPx = ((ev.endMin - ev.startMin)/30)*cr.height;

        const block = document.createElement('div');
        block.className = 'class-block';
        block.style.top    = `${topPx}px`;
        block.style.left   = `${leftPx}px`;
        block.style.width  = `${widthPx}px`;
        block.style.height = `${heightPx}px`;
        block.textContent  = ev.Subject_Course;
        container.appendChild(block);
      });
    });
  }

  function clearSchedule() {
    document.querySelectorAll('.class-block').forEach(el => el.remove());
  }

  function handleAvailability() {
    const days = Array.from(
      document.querySelectorAll('#availability-ui .days input:checked')
    ).map(cb => cb.value);
    if (!startInput.value || !endInput.value || !days.length) {
      alert('Select days and both start/end times.');
      return;
    }
    const sMin = parseTime(startInput.value), eMin = parseTime(endInput.value);
    const occ   = new Set();
    currentData.forEach(i => {
      if (i.Days.some(d=>days.includes(d))) {
        const st = parseTime(i.Start_Time), et = parseTime(i.End_Time);
        if (!(et <= sMin || st >= eMin)) {
          occ.add(`${i.Building}-${i.Room}`);
        }
      }
    });
    const allRooms = Array.from(new Set(currentData.map(i=>`${i.Building}-${i.Room}`)));
    const avail    = allRooms.filter(r=>!occ.has(r));
    resultsDiv.innerHTML = avail.length
      ? '<ul>' + avail.map(r=>`<li>${r}</li>`).join('') + '</ul>'
      : 'No rooms available.';
  }

  function parseTime(t) {
    const [h,m] = t.split(':').map(Number);
    return h*60 + m;
  }

  // ───── Heatmap & Chart.js Integration ───────────

  function initHeatmap() {
    hmChoices = new Choices('#courseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course'
    });
    hmTable = $('#dataTable').DataTable({
      data: [],
      columns: [
        {title:'Course'},
        {title:'Building'},
        {title:'Room'},
        {title:'Days'},
        {title:'Time'}
      ],
      destroy: true,
      searching: true
    });
    // Redraw both heatmap & chart on any filter/search change
    hmTable.on('search.dt', () => {
      updateHeatmap();
      renderChart();
    });
  }

  function feedHeatmapTool(dataArray) {
    hmRaw = dataArray.map(r => {
      const parts = (r.Subject_Course||'').trim().split(/\s+/);
      const key   = parts.length>=2 ? parts[0]+' '+parts[1] : (r.Subject_Course||'').trim();
      return {
        key,
        Building:   r.Building||'',
        Room:       r.Room||'',
        Days:       r.Days||[],
        Start_Time: r.Start_Time||'',
        End_Time:   r.End_Time||''
      };
    });
    const uniq = Array.from(new Set(hmRaw.map(r=>r.key))).sort();
    hmChoices.setChoices(uniq.map(k=>({value:k,label:k})), 'value','label', true);
    updateAllHeatmap();
  }

  function updateAllHeatmap() {
    const sel = hmChoices.getValue(true);
    const rows = hmRaw
      .filter(r => {
        if (sel.length && !sel.includes(r.key)) return false;
        const B = (r.Building||'').toUpperCase();
        const R = (r.Room||'').toUpperCase();
        if (!r.Building||!r.Room||B==='N/A'||R==='N/A'||B==='ONLINE') return false;
        return true;
      })
      .map(r => [
        r.key,
        r.Building,
        r.Room,
        r.Days.join(','),
        r.Start_Time+'-'+r.End_Time
      ]);
    hmTable.clear().rows.add(rows).draw();
    updateHeatmap();
    renderChart();
  }

  function updateHeatmap() {
    const data = hmTable.rows({ search:'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d => counts[d] = hmHours.map(() => 0));
    data.forEach(row => {
      const [ , , , daysStr, timeStr ] = row;
      const [st] = timeStr.split('-').map(t=>t.trim());
      const m = st.match(/(\d{2}):/);
      if (!m) return;
      const h0 = parseInt(m[1],10);
      daysStr.split(',').forEach(d => {
        const idx = hmHours.indexOf(h0);
        if (idx>=0) counts[d][idx]++;
      });
    });
    const maxC = Math.max(...Object.values(counts).flat());
    // build HTML...
    let html = '<table class="heatmap" style="border-collapse:collapse;margin-top:20px;width:100%;">';
    html += '<thead><tr><th style="background:#eee;border:1px solid #ccc;padding:4px;">Day/Time</th>';
    hmHours.forEach(h=>{
      const ap = h<12?'AM':'PM', hh = h%12||12;
      html += `<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`;
    });
    html += '</tr></thead><tbody>';
    hmDays.forEach(d=>{
      html += `<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`;
      counts[d].forEach(c => {
        const op = maxC? (c/maxC).toFixed(2) : 0;
        html += `<td style="border:1px solid #ccc;padding:4px;background:rgba(0,100,200,${op});">${c}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  function renderChart() {
    const data = hmTable.rows({ search:'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d=>counts[d]=hmHours.map(()=>0));
    data.forEach(row=>{
      const [ , , , daysStr, timeStr ] = row;
      const [start, end] = timeStr.split('-').map(t=>t.trim());
      const m = start.match(/(\d{2}):/);
      if (!m) return;
      const h0 = parseInt(m[1],10);
      daysStr.split(',').forEach(d=>{
        const idx = hmHours.indexOf(h0);
        if (idx>=0) counts[d][idx]++;
      });
    });
    const ctx = document.getElementById('occupancyChart').getContext('2d');
    const labels = hmHours.map(h=>`${h%12||12} ${h<12?'AM':'PM'}`);
    const datasets = hmDays.map(day=>({
      label: day,
      data: counts[day],
      fill: false,
      tension: 0.3
    }));
    if (chartInstance) {
      chartInstance.data.labels   = labels;
      chartInstance.data.datasets = datasets;
      chartInstance.update();
    } else {
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          scales: {
            x: { title: { display:true, text:'Time of Day' } },
            y: { title: { display:true, text:'Concurrent Courses' }, beginAtZero:true }
          },
          plugins: { legend: { position:'bottom' }}
        }
      });
    }
  }
});
