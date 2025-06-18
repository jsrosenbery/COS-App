// Utility: get unique campuses from data
function getUniqueCampuses(data) {
  const campuses = new Set();
  data.forEach(r => {
    const campus = extractField(r, ['Campus', 'campus', 'CAMPUS']);
    if (campus) campuses.add(campus);
  });
  return Array.from(campuses).sort();
}

document.addEventListener('DOMContentLoaded', () => {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = [
    'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'
  ];
  let currentData = [];
  let currentTerm = '';

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
  const weekContainer = document.getElementById('week-calendar-container');
  const weekTable = document.getElementById('week-calendar-table');
  const weekLabel = document.getElementById('week-label');
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');
  const todayWeekBtn = document.getElementById('today-week-btn');

  let selectedWeekStart = getStartOfWeek(new Date());

  initHeatmap();
  initLineChartChoices();

  document.getElementById('courseSelect').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-campus-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('linechart-campus-select').addEventListener('change', renderLineChart);

  document.getElementById('heatmap-clear-btn').onclick = () => {
    if (hmChoices) hmChoices.removeActiveItems();
    if (document.getElementById('textSearch')) {
      document.getElementById('textSearch').value = '';
      hmTable.search('').draw();
    }
    updateAllHeatmap();
  };
  document.getElementById('linechart-clear-btn').onclick = () => {
    if (lineCourseChoices) lineCourseChoices.removeActiveItems();
    renderLineChart();
  };

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

  document.getElementById('viewSelect').addEventListener('change', function() {
    document.getElementById('heatmap-tool').style.display = (this.value === 'heatmap') ? 'block' : 'none';
    document.getElementById('schedule-container').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('availability-ui').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('room-filter').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('upload-container').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('upload-timestamp').style.display = (this.value === 'calendar') ? '' : 'none';
    document.getElementById('linechart-tool').style.display = (this.value === 'linechart') ? 'block' : 'none';
    weekContainer.style.display = (this.value === 'week') ? '' : 'none';
    if (this.value === 'linechart') {
      renderLineChart();
    }
    if (this.value === 'week') {
      renderWeekCalendar();
    }
  });

  document.getElementById('lineCourseSelect').addEventListener('change', renderLineChart);

  prevWeekBtn.onclick = () => {
    selectedWeekStart.setDate(selectedWeekStart.getDate() - 7);
    renderWeekCalendar();
  };
  nextWeekBtn.onclick = () => {
    selectedWeekStart.setDate(selectedWeekStart.getDate() + 7);
    renderWeekCalendar();
  };
  todayWeekBtn.onclick = () => {
    selectedWeekStart = getStartOfWeek(new Date());
    renderWeekCalendar();
  };

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
      renderWeekCalendar();
    } else {
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
      renderWeekCalendar();
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
        renderWeekCalendar();
        localStorage.setItem(
          'cos_schedule_' + currentTerm,
          JSON.stringify({ data: currentData, timestamp: tsDiv.textContent })
        );
      });
    };
  }

  function buildRoomDropdown() {
    const combos = [...new Set(currentData.map(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}`))].sort();
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

  // Overlap-aware tile sizing logic
  function renderSchedule() {
    clearSchedule();
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}` === filt);
    const rect = container.getBoundingClientRect();
    daysOfWeek.forEach((day, dIdx) => {
      let evs = data
        .filter(i => i.Days.includes(day))
        .filter(i => parseHour(i.Start_Time) !== parseHour(i.End_Time))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);
      const seen = new Set();
      evs = evs.filter(ev => {
        const key = [
          ev.CRN,
          ev.Start_Time,
          ev.End_Time,
          Array.isArray(ev.Days) ? ev.Days.join(',') : ev.Days,
          ev.Building || ev.BUILDING,
          ev.Room || ev.ROOM
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // For each event, determine its overlap group
      evs.forEach((ev, i) => {
        ev.overlaps = evs.filter(other =>
          !(other.endMin <= ev.startMin || other.startMin >= ev.endMin)
        );
        ev.overlaps.sort((a, b) => a.startMin - b.startMin);
      });

      // Assign a column index within each overlap group
      evs.forEach(ev => {
        let columns = [];
        ev.overlaps.forEach(overlapEv => {
          let placed = false;
          for (let c = 0; c < columns.length; c++) {
            if (columns[c][columns[c].length-1].endMin <= overlapEv.startMin) {
              columns[c].push(overlapEv);
              placed = true;
              break;
            }
          }
          if (!placed) columns.push([overlapEv]);
        });
        for (let c = 0; c < columns.length; c++) {
          if (columns[c].includes(ev)) {
            ev.colIndex = c;
            ev.colCount = columns.length;
            break;
          }
        }
      });

      evs.forEach(ev => {
        const offset = ev.startMin - 360;
        const rowIndex = Math.floor(offset/30) + 1;
        const rem = offset % 30;
        if (rowIndex < 1 || rowIndex >= table.rows.length) return;
        const cell = table.rows[rowIndex].cells[dIdx+1];
        const cr   = cell.getBoundingClientRect();
        const topPx    = cr.top - rect.top + (rem/30)*cr.height;
        const leftPx   = cr.left - rect.left + (ev.colCount === 1 ? 0 : ev.colIndex*(cr.width/ev.colCount));
        const widthPx  = (ev.colCount === 1) ? cr.width : cr.width / ev.colCount;
        const heightPx = ((ev.endMin-ev.startMin)/30)*cr.height;
        const b = document.createElement('div');
        b.className = 'class-block';
        b.style.top    = `${topPx}px`;
        b.style.left   = `${leftPx}px`;
        b.style.width  = `${widthPx}px`;
        b.style.height = `${heightPx}px`;

        // Use robust field extraction for all possible case/snake variants
        const title = extractField(ev, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
        const instructor = extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
        const startDate = extractField(ev, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
        const endDate = extractField(ev, ['End_Date', 'End Date', 'End', 'end_date', 'end']);

        // Tile content: REMOVE title and dates from tile, keep on popup
        b.innerHTML = `
          <span style="font-weight:bold;">${ev.Subject_Course || ''}</span><br>
          <span>CRN: ${ev.CRN || ''}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span><br>
          <span>${instructor}</span>
        `;

        // Tooltip content (unchanged: still shows title and dates)
        const tooltipContent = `
<b>${ev.Subject_Course || ''}</b><br>
${title ? `<span>${title}</span><br>` : ''}
CRN: ${ev.CRN || ''}<br>
Time: ${format12(ev.Start_Time)} - ${format12(ev.End_Time)}<br>
Date Range: ${startDate || 'N/A'} - ${endDate || 'N/A'}<br>
Instructor: ${instructor || 'N/A'}
        `.trim();

        b.addEventListener('mouseenter', function(e) {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.innerHTML = tooltipContent;
          tooltip.style.display = 'block';
          // Position tooltip
          const rect = b.getBoundingClientRect();
          tooltip.style.left = (rect.right + window.scrollX + 8) + 'px';
          tooltip.style.top = (rect.top + window.scrollY - 10) + 'px';
        });
        b.addEventListener('mouseleave', function() {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.display = 'none';
        });
        b.addEventListener('mousemove', function(e) {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.left = (e.pageX + 12) + 'px';
          tooltip.style.top = (e.pageY + 12) + 'px';
        });

        container.appendChild(b);
      });
    });
  }

  // WEEK VIEW CALENDAR
  function renderWeekCalendar() {
    // Prepare week grid: Sun-Sat, 7am-10pm (7:00-22:00), 30-min intervals
    const startHour = 7, endHour = 22;
    const intervals = (endHour - startHour) * 2; // 30-min blocks
    weekTable.innerHTML = "";
    // Header row
    const header = weekTable.insertRow();
    header.insertCell().outerHTML = '<th></th>';
    for (let d = 0; d < 7; ++d) {
      const dayDate = new Date(selectedWeekStart);
      dayDate.setDate(dayDate.getDate() + d);
      header.insertCell().outerHTML = `<th>${daysOfWeek[d]}<br><span style="font-size:0.9em;color:#666;">${dayDate.getMonth()+1}/${dayDate.getDate()}</span></th>`;
    }
    // Rows for time slots
    for (let i = 0; i < intervals; ++i) {
      const row = weekTable.insertRow();
      const mins = startHour * 60 + i * 30;
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      const h12 = ((hh+11)%12)+1, ap = hh < 12 ? 'AM':'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      for (let d = 0; d < 7; ++d) {
        const cell = row.insertCell();
        cell.style.position = "relative";
      }
    }
    // Show week label
    const weekEnd = new Date(selectedWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekLabel.textContent = `${selectedWeekStart.getMonth()+1}/${selectedWeekStart.getDate()}/${selectedWeekStart.getFullYear()} - ${weekEnd.getMonth()+1}/${weekEnd.getDate()}/${weekEnd.getFullYear()}`;

    // Render events for each day/time slot
    // For each event, check if it falls within the week (by date range)
    for (let i = 0; i < currentData.length; ++i) {
      const ev = currentData[i];
      let eventDays = ev.Days || [];
      if (!Array.isArray(eventDays)) eventDays = String(eventDays).split(',').map(x => x.trim());
      for (let d = 0; d < 7; ++d) {
        const dow = daysOfWeek[d];
        if (!eventDays.includes(dow)) continue;
        // Filter by date range if available, or just show
        let show = true;
        if (ev.Start_Date && ev.End_Date) {
          const startDate = new Date(ev.Start_Date);
          const endDate = new Date(ev.End_Date);
          const cellDate = new Date(selectedWeekStart);
          cellDate.setDate(cellDate.getDate() + d);
          show = cellDate >= startDate && cellDate <= endDate;
        }
        if (!show) continue;
        // Now, determine which cell(s) this event goes into
        const startMin = parseTime(ev.Start_Time);
        const endMin = parseTime(ev.End_Time);
        if (isNaN(startMin) || isNaN(endMin)) continue;
        // Only if event occurs during week grid hours
        if (endMin <= startHour*60 || startMin >= endHour*60) continue;
        // Clamp event to visible range
        const s = Math.max(0, Math.floor((startMin - startHour*60)/30));
        const e = Math.min(intervals, Math.ceil((endMin - startHour*60)/30));
        for (let slotIdx = s; slotIdx < e; ++slotIdx) {
          const cell = weekTable.rows[slotIdx+1]?.cells[d+1];
          if (!cell) continue;
          // Only render in the first slot (top of the event block)
          if (slotIdx === s) {
            const block = document.createElement('div');
            block.className = 'week-event-block';
            block.style.height = ((e-s)*40-4) + "px";
            block.innerHTML = `<span style="font-weight:bold;">${ev.Subject_Course || ''}</span><br>
              <span style="font-size:0.93em;">${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span><br>
              ${ev.Building || ev.BUILDING}-${ev.Room || ev.ROOM}<br>
              <span style="font-size:0.93em;">${extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']) || ''}</span>`;
            // Tooltip on mouseover
            block.addEventListener('mouseenter', function(e) {
              const tooltip = document.getElementById('class-block-tooltip');
              tooltip.innerHTML = `<b>${ev.Subject_Course || ''}</b><br>
                CRN: ${ev.CRN || ''}<br>
                Time: ${format12(ev.Start_Time)} - ${format12(ev.End_Time)}<br>
                ${ev.Building || ev.BUILDING}-${ev.Room || ev.ROOM}<br>
                Instructor: ${extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']) || 'N/A'}`;
              tooltip.style.display = 'block';
              const rect = block.getBoundingClientRect();
              tooltip.style.left = (rect.right + window.scrollX + 8) + 'px';
              tooltip.style.top = (rect.top + window.scrollY - 10) + 'px';
            });
            block.addEventListener('mouseleave', function() {
              const tooltip = document.getElementById('class-block-tooltip');
              tooltip.style.display = 'none';
            });
            block.addEventListener('mousemove', function(e) {
              const tooltip = document.getElementById('class-block-tooltip');
              tooltip.style.left = (e.pageX + 12) + 'px';
              tooltip.style.top = (e.pageY + 12) + 'px';
            });
            cell.appendChild(block);
          }
        }
      }
    }
  }

  // ROOM AVAILABILITY - alpha order fix
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
    const rooms = [...new Set(currentData.map(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}`))];
    const occ   = new Set();
    currentData.forEach(i => {
      if (i.Days.some(d => days.includes(d))) {
        const si = parseTime(i.Start_Time), ei = parseTime(i.End_Time);
        if (!(ei <= sMin || si >= eMin)) {
          occ.add(`${i.Building || i.BUILDING}-${i.Room || i.ROOM}`);
        }
      }
    });
    const avail = rooms.filter(r => !occ.has(r)).sort();
    if (avail.length) {
      resultsDiv.innerHTML = '<ul>' + avail.map(r => `<li>${r}</li>`).join('') + '</ul>';
    } else {
      resultsDiv.textContent = 'No rooms available.';
    }
  }

  // Utility helpers
  function getStartOfWeek(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  function parseTime(t) {
    if (!t) return NaN;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  function parseHour(t) {
    if (!t) return NaN;
    return Number(t.split(':')[0]);
  }
  function format12(t) {
    if (!t) return '';
    let [h, m] = t.split(':').map(Number);
    const ap = h < 12 ? 'AM' : 'PM';
    h = ((h + 11) % 12) + 1;
    return `${h}:${('0' + m).slice(-2)}${ap}`;
  }
  function extractField(obj, keys) {
    for (let k of keys) {
      if (obj[k] && typeof obj[k] === 'string') return obj[k];
    }
    return '';
  }

  // ... rest of your code for heatmap, line chart, etc ...
});
