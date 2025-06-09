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
  const hmDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const hmHours = Array.from({length:17}, (_, i) => i + 6); // 6–22
  const hmDayMap = {'Sunday':'Sunday','Monday':'Monday','Tuesday':'Tuesday','Wednesday':'Wednesday','Thursday':'Thursday','Friday':'Friday','Saturday':'Saturday'};
  let hmRaw = [];
  let hmTable;
  let hmChoices;

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

  // ----- SCHEDULE/GRID DEDUPLICATION & POPUP LOGIC -----
  function renderSchedule() {
    clearSchedule();
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building}-${i.Room}` === filt);
    const rect = container.getBoundingClientRect();

    // Tooltip div
    if (!document.getElementById('course-tooltip')) {
      const tooltip = document.createElement('div');
      tooltip.id = 'course-tooltip';
      tooltip.style.position = 'fixed';
      tooltip.style.zIndex = '9999';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.display = 'none';
      tooltip.style.background = 'rgba(255,255,240,0.98)';
      tooltip.style.border = '1px solid #aaa';
      tooltip.style.padding = '10px';
      tooltip.style.borderRadius = '5px';
      tooltip.style.boxShadow = '2px 2px 6px rgba(0,0,0,0.15)';
      tooltip.style.fontSize = '13px';
      document.body.appendChild(tooltip);
    }
    const tooltip = document.getElementById('course-tooltip');

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

        // Show Subject_Course, CRN, Times, and overall date span on the tile
        b.innerHTML = `
          <span>${ev.Subject_Course}</span><br>
          <span>${ev.CRN}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span><br>
          <span style="font-size:11px;color:#224;">
            ${ev.Meeting_Start || ev.MeetingStart || ev.Meeting_Date || ev.Start_Date || ev.StartDate || ''} 
            – 
            ${ev.Meeting_End || ev.MeetingEnd || ev.End_Date || ev.EndDate || ''}
          </span>
        `;

        // On hover, show all the info in a tooltip
        b.onmouseenter = function(e) {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `
            <strong>${ev.Subject_Course || ''}</strong><br>
            <b>CRN:</b> ${ev.CRN || ''}<br>
            <b>Instructor:</b> ${ev.Instructor || ev.Professor || ''}<br>
            <b>Building/Room:</b> ${ev.Building || ''} / ${ev.Room || ''}<br>
            <b>Days:</b> ${Array.isArray(ev.Days) ? ev.Days.join(', ') : ev.Days || ''}<br>
            <b>Time:</b> ${format12(ev.Start_Time)} - ${format12(ev.End_Time)}<br>
            <b>Date Span:</b> ${(ev.Meeting_Start || ev.MeetingStart || ev.Meeting_Date || ev.Start_Date || ev.StartDate || '')} – ${(ev.Meeting_End || ev.MeetingEnd || ev.End_Date || ev.EndDate || '')}<br>
            ${ev.Notes ? `<b>Notes:</b> ${ev.Notes}<br>` : ''}
          `;
        };
        b.onmousemove = function(e) {
          // Offset the tooltip a bit so it doesn't block the cursor
          tooltip.style.left = (e.clientX + 16) + 'px';
          tooltip.style.top = (e.clientY + 8) + 'px';
        };
        b.onmouseleave = function() {
          tooltip.style.display = 'none';
        };

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
        End_Time: r.End_Time || ''
      };
    });
    const uniqueKeys = Array.from(new Set(hmRaw.map(r => r.key).filter(k => k))).sort();
    const items = uniqueKeys.map(k => ({ value: k, label: k }));
    if (hmChoices) {
      hmChoices.setChoices(items, 'value', 'label', true);
    }
    updateAllHeatmap();
  }

  function updateAllHeatmap() {
    const selected = hmChoices.getValue(true);
    const rows = hmRaw.filter(r => {
      if(selected.length && !selected.includes(r.key)) return false;
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
