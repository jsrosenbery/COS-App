document.addEventListener('DOMContentLoaded', () => {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [];
  let currentTerm = '';

  // DOM refs
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

  // Heatmap variables
  const hmDays = daysOfWeek.slice();
  const hmHours = Array.from({length:17}, (_, i) => i + 6); // 6–22
  let hmRaw = [];
  let hmTable;
  let hmChoices;

  // Map days-of-week to your CSV codes (standard: S=Saturday, U=Sunday)
  const dayLetter = {
    "Sunday": "U",
    "Monday": "M",
    "Tuesday": "T",
    "Wednesday": "W",
    "Thursday": "R",
    "Friday": "F",
    "Saturday": "S"
  };

  // ---- Heatmap initialization ----
  initHeatmap();

  // Build semester tabs
  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  selectTerm(terms[2], tabs.children[2]);

  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // ---- Date utilities ----
  function getDateField(ev, keys) {
    for (const k of keys) {
      if (ev[k] && String(ev[k]).trim()) return String(ev[k]).trim();
    }
    const lowerKeys = Object.keys(ev).reduce((acc, key) => { acc[key.toLowerCase()] = key; return acc; }, {});
    for (const k of keys) {
      if (lowerKeys[k.toLowerCase()] && ev[lowerKeys[k.toLowerCase()]] && String(ev[lowerKeys[k.toLowerCase()]]).trim()) {
        return String(ev[lowerKeys[k.toLowerCase()]]).trim();
      }
    }
    return '';
  }
  function toMMDD(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parseInt(parts[1],10)}/${parseInt(parts[2],10)}`;
    }
    if (parts.length === 3) {
      return `${parseInt(parts[0],10)}/${parseInt(parts[1],10)}`;
    }
    return dateStr;
  }

  // ---- Robust Days Parser ----
  function parseDays(daysField) {
    if (Array.isArray(daysField)) daysField = daysField.join('');
    daysField = String(daysField).toUpperCase().replace(/\s/g, '');
    const result = [];
    for (let i = 0; i < daysField.length; i++) {
      // Handle 'TH' or 'TU' if your data uses those; adapt as needed
      if (daysField[i] === "T" && daysField[i+1] === "H") {
        result.push("R"); // Thursday
        i++;
      } else if (daysField[i] === "T" && daysField[i+1] === "U") {
        result.push("U"); // Sunday (if your data uses TU for Sunday; else adjust/remove)
        i++;
      } else {
        result.push(daysField[i]);
      }
    }
    return result;
  }

  // ---- Scheduler Functions ----
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
        localStorage.setItem(
          'cos_schedule_' + currentTerm,
          JSON.stringify({ data: currentData, timestamp: tsDiv.textContent })
        );
      });
    };
  }

  function buildRoomDropdown() {
    const combos = [...new Set(currentData.map(i => `${i.BUILDING || i.Building}-${i.ROOM || i.Room}`))].sort();
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
      : currentData.filter(i => `${i.BUILDING || i.Building}-${i.ROOM || i.Room}` === filt);
    const rect = container.getBoundingClientRect();

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
      const code = dayLetter[day];

      let evs = data
        .filter(i => {
          const days = parseDays(i.DAYS || i.Days || '');
          return days.includes(code);
        })
        .map(i => {
          let start = "", end = "";
          if (i.Time) {
            const spl = i.Time.split('-');
            start = spl[0].trim();
            end = spl[1].trim();
          } else {
            start = i.Start_Time;
            end = i.End_Time;
          }
          return {
            ...i,
            startMin: parseTime(start),
            endMin:   parseTime(end),
            _parsedStart: start,
            _parsedEnd: end
          }
        })
        .sort((a,b) => a.startMin - b.startMin);

      const seen = new Set();
      evs = evs.filter(ev => {
        const key = [
          ev.CRN,
          ev.Time || `${ev._parsedStart}-${ev._parsedEnd}`,
          ev.DAYS || ev.Days || '',
          ev.BUILDING || ev.Building,
          ev.ROOM || ev.Room
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

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

        // Try all possible field names for date span
        const startRaw = getDateField(ev, [
          "Start_Date", "start_date", "StartDate", "startdate", "Start Date", "Ptrm Start", "Ptrm_Start", "Ptrm Start Date"
        ]);
        const endRaw   = getDateField(ev, [
          "End_Date", "end_date", "EndDate", "enddate", "End Date", "Ptrm End", "Ptrm_End", "Ptrm End Date"
        ]);
        const startMMDD = toMMDD(startRaw);
        const endMMDD   = toMMDD(endRaw);
        const dateSpan = (startMMDD && endMMDD) ? `${startMMDD} - ${endMMDD}` : '';

        const b = document.createElement('div');
        b.className = 'class-block';
        b.style.top    = `${topPx}px`;
        b.style.left   = `${leftPx}px`;
        b.style.width  = `${widthPx}px`;
        b.style.height = `${heightPx}px`;

        b.innerHTML = `
          <span>${ev.Subject_Course || ev['Subject_Course']}</span><br>
          <span>${ev.CRN}</span><br>
          <span>${format12(ev._parsedStart)} - ${format12(ev._parsedEnd)}</span><br>
          <span style="font-size:11px;color:#224;">
            ${dateSpan}
          </span>
        `;

        b.onmouseenter = function(e) {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `
            <strong>${ev.Subject_Course || ''}</strong><br>
            <b>CRN:</b> ${ev.CRN || ''}<br>
            <b>Instructor:</b> ${ev.Instructor || ev.Professor || ''}<br>
            <b>Building/Room:</b> ${(ev.BUILDING || ev.Building || '')} / ${(ev.ROOM || ev.Room || '')}<br>
            <b>Days:</b> ${ev.DAYS || ev.Days || ''}<br>
            <b>Time:</b> ${format12(ev._parsedStart)} - ${format12(ev._parsedEnd)}<br>
            <b>Date Span:</b> ${dateSpan}<br>
            ${ev.Notes ? `<b>Notes:</b> ${ev.Notes}<br>` : ''}
          `;
        };
        b.onmousemove = function(e) {
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
    const rooms = [...new Set(currentData.map(i => `${i.BUILDING || i.Building}-${i.ROOM || i.Room}`))];
    const occ   = new Set();
    currentData.forEach(i => {
      const daysField = parseDays(i.DAYS || i.Days || '');
      if (days.some(d => daysField.includes(d))) {
        const si = parseTime(i.Time ? i.Time.split('-')[0].trim() : i.Start_Time);
        const ei = parseTime(i.Time ? i.Time.split('-')[1].trim() : i.End_Time);
        if (!(ei <= sMin || si >= eMin)) {
          occ.add(`${i.BUILDING || i.Building}-${i.ROOM || i.Room}`);
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

  // ---- Helpers ----
  function parseTime(t) {
    if (!t) return 0;
    t = t.replace(/\s/g,'');
    const m = t.match(/^(\d{1,2}):(\d{2})(AM|PM)?$/i);
    if (!m) return 0;
    let h = parseInt(m[1],10), mnts = parseInt(m[2],10);
    let ap = (m[3]||'AM').toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h*60 + mnts;
  }
  function format12(t) {
    if (!t) return '';
    t = t.replace(/\s/g,'');
    const m = t.match(/^(\d{1,2}):(\d{2})(AM|PM)?$/i);
    if (!m) return t;
    let h = parseInt(m[1],10), mnts = parseInt(m[2],10);
    let ap = m[3] ? m[3].toUpperCase() : (h < 12 ? 'AM':'PM');
    let h12 = ((h+11)%12)+1;
    return `${h12}:${('0'+mnts).slice(-2)}${ap}`;
  }

  // ---- Heatmap & Table Logic ----
  function initHeatmap() {
    if (window.Choices) {
      hmChoices = new Choices('#courseSelect', {
        removeItemButton: true,
        searchEnabled: true,
        placeholderValue: 'Filter by discipline/course',
      });
    }
    if (window.jQuery && window.jQuery.fn.DataTable) {
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
  }

  function feedHeatmapTool(dataArray) {
    hmRaw = dataArray.map(r => {
      const parts = (r.Subject_Course || '').trim().split(/\s+/);
      const key = parts.length >=2 ? (parts[0] + ' ' + parts[1]) : (r.Subject_Course || '').trim();
      return {
        key,
        Building: r.BUILDING || r.Building || '',
        Room: r.ROOM || r.Room || '',
        Days: r.DAYS || r.Days || [],
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
    if (!hmChoices || !hmTable) return;
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
    if (!hmTable) return;
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    hmDays.forEach(d => counts[d] = hmHours.map(() => 0));
    filtered.forEach(row => {
      const [ course, bld, room, daysStr, timeStr ] = row;
      const dayList = parseDays(daysStr);
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

  document.getElementById('viewSelect')?.addEventListener('change', function(){
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
});
