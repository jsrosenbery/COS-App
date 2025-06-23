// COS-App js/app.js

let hmRaw = [];
let hmTable;
let hmChoices;
let lineCourseChoices;
let lineChartInstance;
let fullCalendarInstance;

const hmDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// --- Official Term Start Dates ---
const termStartDates = {
  'Summer 2025': '2025-06-05',
  'Fall 2025': '2025-08-11',
  'Spring 2026': '2026-01-12',
  'Summer 2026': '2026-06-01',
  'Fall 2026': '2026-08-10',
  'Spring 2027': '2027-01-19',
  'Summer 2027': '2027-06-07',
  'Fall 2027': '2027-08-10',
  'Spring 2028': '2028-01-18'
};

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
  return h + min/60;
}

function getTimeRangeFromData(data) {
  let min = 24, max = 0;
  data.forEach(r => {
    const s = parseHour(r.Start_Time);
    const e = parseHour(r.End_Time);
    if (typeof s === "number" && s < min) min = Math.floor(s);
    if (typeof e === "number" && e > max) max = Math.ceil(e);
  });
  if (min >= max) { min = 6; max = 22; }
  if (max < 22) max = 22;
  if (min > 6) min = 6;
  return [min, max];
}

function extractField(r, keys) {
  for (const k of keys) {
    if (r[k] && typeof r[k] === 'string' && r[k].trim()) return r[k].trim();
    if (r[k.toLowerCase()] && typeof r[k.toLowerCase()] === 'string' && r[k.toLowerCase()].trim()) return r[k.toLowerCase()].trim();
    if (r[k.toUpperCase()] && typeof r[k.toUpperCase()] === 'string' && r[k.toUpperCase()].trim()) return r[k.toUpperCase()].trim();
    if (r[k.replace(/\s+/g, '_')] && typeof r[k.replace(/\s+/g, '_')] === 'string' && r[k.replace(/\s+/g, '_')].trim()) return r[k.replace(/\s+/g, '_')].trim();
    if (r[k.replace(/\s+/g, '_').toLowerCase()] && typeof r[k.replace(/\s+/g, '_').toLowerCase()] === 'string' && r[k.replace(/\s+/g, '_').toLowerCase()].trim()) return r[k.replace(/\s+/g, '_').toLowerCase()].trim();
    if (r[k.replace(/\s+/g, '_').toUpperCase()] && typeof r[k.replace(/\s+/g, '_').toUpperCase()] === 'string' && r[k.replace(/\s+/g, '_').toUpperCase()].trim()) return r[k.replace(/\s+/g, '_').toUpperCase()].trim();
  }
  return '';
}

function getUniqueCampuses(data) {
  const campuses = new Set();
  data.forEach(r => {
    const campus = extractField(r, ['Campus', 'campus', 'CAMPUS']);
    if (campus) campuses.add(campus);
  });
  return Array.from(campuses).sort();
}

function getUniqueRooms(data) {
  // Returns array of "Bldg-Room" combos, sorted, excluding blanks
  return [...new Set(
    data.map(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}`)
  )].filter(r => r && r !== '-' && !/^N\/A/i.test(r) && !/ONLINE/i.test(r)).sort();
}

function normalizeRow(r) {
  // Convert DAYS like "MW" to ["Monday","Wednesday"]
  const daysMap = {M:"Monday",T:"Tuesday",W:"Wednesday",R:"Thursday",F:"Friday",U:"Sunday",S:"Saturday"};
  let daysArr = [];
  if (typeof r.DAYS === "string") {
    daysArr = r.DAYS.split('').map(d => daysMap[d] || d);
  } else if (Array.isArray(r.Days)) {
    daysArr = r.Days;
  }
  // Parse Time to Start_Time and End_Time
  let start24 = "00:00", end24 = "00:00";
  if (typeof r.Time === "string") {
    const parts = r.Time.split('-').map(s => s.trim());
    const to24 = (t) => {
      const m = t.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
      if (m) {
        let h = parseInt(m[1],10);
        let min = m[2] ? parseInt(m[2],10) : 0;
        const ap = m[3].toUpperCase();
        if (ap === 'PM' && h < 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return (h<10? '0'+h : h) + ':' + (min<10? '0'+min : min);
      }
      return '00:00';
    };
    if (parts.length === 2) {
      start24 = to24(parts[0]);
      end24 = to24(parts[1]);
    }
  } else if (typeof r.Start_Time === "string" && typeof r.End_Time === "string") {
    start24 = r.Start_Time;
    end24 = r.End_Time;
  }

  return {
    Subject_Course: r.Subject_Course || "",
    CRN: r.CRN || "",
    Title: r.Title || "",
    Building: r.BUILDING || r.Building || "",
    Room: r.ROOM || r.Room || "",
    Days: daysArr,
    Start_Time: start24,
    End_Time: end24,
    Start_Date: r.Start_Date || "",
    End_Date: r.End_Date || "",
    Instructor: r.Instructor || "",
    Campus: r.CAMPUS || r.Campus || "",
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = [...hmDays];
  let currentData = [];
  let currentTerm = '';

  const BACKEND_BASE_URL = "https://app-backend-pp98.onrender.com";

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
  const calendarContainer = document.getElementById('calendar-container');
  const calendarEl = document.getElementById('calendar');

  let snapshotRoomFilter = null;
  let calendarRoomFilter = null;

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

  document.getElementById('viewSelect').addEventListener('change', function(){
    const view = this.value;
    document.getElementById('heatmap-tool').style.display = (view === 'heatmap') ? 'block' : 'none';
    document.getElementById('schedule-container').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('availability-ui').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('room-filter').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('upload-container').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('upload-timestamp').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('linechart-tool').style.display = (view === 'linechart') ? 'block' : 'none';
    document.getElementById('calendar-container').style.display = (view === 'fullcalendar') ? 'block' : 'none';
    document.getElementById('calendar-room-filter').style.display = (view === 'fullcalendar') ? 'block' : 'none';
    if (view === 'linechart') {
      renderLineChart();
    }
    if (view === 'fullcalendar') {
      renderFullCalendar();
    }
  });

  document.getElementById('lineCourseSelect').addEventListener('change', renderLineChart);

  // -- NEW: Add fullcalendar room dropdown at DOM load time --
  const calendarRoomFilterDiv = document.createElement('div');
  calendarRoomFilterDiv.id = 'calendar-room-filter';
  calendarRoomFilterDiv.style.display = 'none';
  calendarRoomFilterDiv.style.margin = '10px 0';
  calendarRoomFilterDiv.innerHTML = `<label>Filter Bldg-Room:
    <select id="calendar-room-select"></select>
  </label>`;
  calendarContainer.parentNode.insertBefore(calendarRoomFilterDiv, calendarContainer);

  document.getElementById('calendar-room-select').addEventListener('change', renderFullCalendar);

  // --- Backend fetch instead of localStorage ---
  function loadScheduleFromBackend(term) {
    fetch(`${BACKEND_BASE_URL}/api/schedule/${encodeURIComponent(term)}`)
      .then(res => res.json())
      .then(({ data, lastUpdated }) => {
        // PATCH: Normalize backend data fields to frontend expectations
        currentData = (data || []).map(normalizeRow);
        tsDiv.textContent = lastUpdated ? `Last upload: ${new Date(lastUpdated).toLocaleString()}` : '';
        buildRoomDropdowns();
        renderSchedule();
        feedHeatmapTool(currentData);
        if (document.getElementById('viewSelect').value === 'fullcalendar') {
          renderFullCalendar();
        }
      });
  }

  // --- POST CSV to backend, not localStorage ---
  function uploadScheduleToBackend(term, csvString) {
    fetch(`${BACKEND_BASE_URL}/api/schedule/${encodeURIComponent(term)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvString, password: 'Upload2025' }) // <-- CHANGED TO Upload2025
    })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then(() => {
        alert('Upload successful!');
        loadScheduleFromBackend(term);
      })
      .catch(err => alert('Upload failed: ' + err.message));
  }

  function selectTerm(term, tabElem) {
    currentTerm = term;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    clearSchedule();
    setupUpload();
    loadScheduleFromBackend(term);
  }

  function setupUpload() {
    roomDiv.innerHTML = '';
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e => {
      // --- PASSWORD PROTECTION: ask for password before parsing ---
      const password = prompt('Enter upload password:');
      if (password !== 'Upload2025') { // <-- CHANGED TO Upload2025
        alert('Incorrect password. Upload cancelled.');
        e.target.value = ''; // reset file input
        return;
      }
      // --- End password protection ---
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = function(ev) {
        const csvString = ev.target.result;
        uploadScheduleToBackend(currentTerm, csvString); // reloads after upload
      };
      reader.readAsText(file);
    };
  }

  function buildRoomDropdowns() {
    // For snapshot
    const combos = getUniqueRooms(currentData);
    if (roomDiv) {
      roomDiv.innerHTML = `
        <label>Filter Bldg-Room:
          <select id="room-select">
            <option>All</option>
            ${combos.map(r => `<option>${r}</option>`).join('')}
          </select>
        </label>`;
      snapshotRoomFilter = document.getElementById('room-select');
      snapshotRoomFilter.onchange = renderSchedule;
    }

    // For fullcalendar
    const calendarRoomSelect = document.getElementById('calendar-room-select');
    if (calendarRoomSelect) {
      calendarRoomSelect.innerHTML = `
        <option>All</option>
        ${combos.map(r => `<option>${r}</option>`).join('')}
      `;
      calendarRoomFilter = calendarRoomSelect;
      calendarRoomFilter.onchange = renderFullCalendar;
    }
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
    const filt = snapshotRoomFilter?.value || 'All';
    const data = filt === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}` === filt);
    const rect = container.getBoundingClientRect();
    daysOfWeek.forEach((day, dIdx) => {
      let evs = data
        .filter(i => Array.isArray(i.Days) ? i.Days.includes(day) : false)
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

      evs.forEach((ev, i) => {
        ev.overlaps = evs.filter(other =>
          !(other.endMin <= ev.startMin || other.startMin >= ev.endMin)
        );
        ev.overlaps.sort((a, b) => a.startMin - b.startMin);
      });

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

        const title = extractField(ev, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
        const instructor = extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
        const startDate = extractField(ev, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
        const endDate = extractField(ev, ['End_Date', 'End Date', 'End', 'end_date', 'end']);

        b.innerHTML = `
          <span style="font-weight:bold;">${ev.Subject_Course || ''}</span><br>
          <span>CRN: ${ev.CRN || ''}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span><br>
          <span>${instructor}</span>
        `;

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
      if (Array.isArray(i.Days) && i.Days.some(d => days.includes(d))) {
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

  function initHeatmap() {
    hmChoices = new Choices('#courseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course',
      callbackOnCreateTemplates: function(template) {
        return {
          choice: (classNames, data) => {
            return template(`
              <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled 
                ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="" data-choice 
                data-id="${data.id}" data-value="${data.value}" ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'} 
                role="option">
                <input type="checkbox" ${data.selected ? 'checked' : ''} tabindex="-1"/>
                <span>${data.label}</span>
              </div>
            `);
          }
        }
      }
    });
    if(hmTable) {
      hmTable.destroy();
      $('#dataTable').empty();
    }
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

  function initLineChartChoices() {
    lineCourseChoices = new Choices('#lineCourseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course',
      callbackOnCreateTemplates: function(template) {
        return {
          choice: (classNames, data) => {
            return template(`
              <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled 
                ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="" data-choice 
                data-id="${data.id}" data-value="${data.value}" ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'} 
                role="option">
                <input type="checkbox" ${data.selected ? 'checked' : ''} tabindex="-1"/>
                <span>${data.label}</span>
              </div>
            `);
          }
        }
      }
    });
  }

  function feedHeatmapTool(dataArray) {
    hmRaw = dataArray.map(r => {
      const parts = (r.Subject_Course || '').trim().split(/\s+/);
      const key = parts.length >=2 ? (parts[0] + ' ' + parts[1]) : (r.Subject_Course || '').trim();
      let daysVal = r.Days;
      if (typeof daysVal === 'string') daysVal = daysVal.split(',').map(s => s.trim());

      const instructor = extractField(r, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
      const startDate = extractField(r, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
      const endDate = extractField(r, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
      const title = extractField(r, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);

      const building = r.Building || r.BUILDING || '';
      const room = r.Room || r.ROOM || '';

      let startTime = r.Start_Time || '';
      let endTime = r.End_Time || '';
      if ((!startTime || !endTime) && r.Time) {
        let parts = r.Time.split('-');
        if (parts.length === 2) {
          startTime = startTime || parts[0].trim();
          endTime = endTime || parts[1].trim();
        }
      }

      return {
        key,
        Subject_Course: r.Subject_Course || '',
        CRN: r.CRN || '',
        Building: building,
        Room: room,
        Days: daysVal || [],
        Start_Time: startTime,
        End_Time: endTime,
        Title: title,
        Start_Date: startDate,
        End_Date: endDate,
        Instructor: instructor,
        Campus: extractField(r, ['Campus', 'campus', 'CAMPUS'])
      };
    }).filter(r => {
      let dayField = r.Days;
      if (Array.isArray(dayField)) dayField = dayField.join(',');
      if (typeof dayField !== 'string') dayField = '';
      const cleaned = dayField.replace(/\s/g, '');
      if (cleaned === 'X' || cleaned === 'XX') return false;
      if (/^(X,)+X$/.test(cleaned)) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });

    const campuses = getUniqueCampuses(hmRaw);
    const heatmapCampusSelect = document.getElementById('heatmap-campus-select');
    const linechartCampusSelect = document.getElementById('linechart-campus-select');
    [heatmapCampusSelect, linechartCampusSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">All</option>' +
        campuses.map(c => `<option value="${c}">${c}</option>`).join('');
    });

    const uniqueKeys = Array.from(new Set(hmRaw.map(r => r.key).filter(k => k))).sort();
    const items = uniqueKeys.map(k => ({
      value: k,
      label: k
    }));
    if (hmChoices) {
      hmChoices.setChoices(items, 'value', 'label', true);
    }
    if (lineCourseChoices) {
      lineCourseChoices.setChoices(items, 'value', 'label', true);
    }
    updateAllHeatmap();
    renderLineChart();
  }

  function updateAllHeatmap() {
    const selectedCampus = document.getElementById('heatmap-campus-select')?.value || '';
    let filteredCampus = selectedCampus
      ? hmRaw.filter(r => extractField(r, ['Campus', 'campus', 'CAMPUS']) === selectedCampus)
      : hmRaw;

    const selected = hmChoices.getValue(true);
    const rows = filteredCampus.filter(r => {
      if(selected.length && !selected.includes(r.key)) return false;
      if(!r.Building || !r.Room) return false;
      const b = r.Building.toUpperCase(), ro = r.Room.toUpperCase();
      if(b==='N/A'||ro==='N/A'||b==='ONLINE') return false;
      return true;
    }).map(r => [r.key, r.Building, r.Room, Array.isArray(r.Days) ? r.Days.join(',') : '', r.Start_Time + '-' + r.End_Time]);
    hmTable.clear().rows.add(rows).draw();
  }

  function updateHeatmap() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const [minHour, maxHour] = getTimeRangeFromData(filtered.map(row => ({
      Start_Time: row[4]?.split('-')[0],
      End_Time: row[4]?.split('-')[1]
    })));
    const hours = Array.from({length: maxHour - minHour}, (_,i)=>i + minHour);
    const counts = {};
    hmDays.forEach(d => counts[d] = hours.map(() => 0));
    filtered.forEach(row => {
      const [ course, bld, room, daysStr, timeStr ] = row;
      const dayList = daysStr.split(',');
      const timeParts = timeStr.split('-');
      const st = timeParts[0]?.trim();
      const en = timeParts[1]?.trim();
      if (!st || !en) return;
      if (parseHour(st) === parseHour(en)) return;
      const m = st.match(/(\d{2}):(\d{2})/);
      if(!m) return;
      const hr = parseInt(m[1],10);
      dayList.forEach(d => {
        const hIndex = hours.indexOf(hr);
        if(hIndex>=0 && counts[d]) counts[d][hIndex]++;
      });
    });
    const maxC = Math.max(...Object.values(counts).flat());
    let html = '<table class="heatmap" style="border-collapse:collapse; margin-top:20px; width:100%;">';
    html += '<thead><tr><th style="background:#eee;border:1px solid #ccc;padding:4px;">Day/Time</th>';
    hours.forEach(h=>{ 
      const ap=h<12?'AM':'PM'; 
      const hh=h%12||12; 
      html+=`<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`; 
    });
    html+='</tr></thead><tbody>';
    hmDays.forEach(d=>{
      html+=`<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`;
      counts[d].forEach(c=>{
        const op=maxC?c/maxC:0;
        const color = `rgba(255,102,0,${op*0.7+0.02})`;
        html+=`<td style="border:1px solid #ccc; background:${color}; color:#222; text-align:center;">${c||''}</td>`;
      });
      html+='</tr>';
    });
    html+='</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  function renderLineChart() {
    const selectedCampus = document.getElementById('linechart-campus-select')?.value || '';
    let filteredCampus = selectedCampus
      ? hmRaw.filter(r => extractField(r, ['Campus', 'campus', 'CAMPUS']) === selectedCampus)
      : hmRaw;

    const chartDiv = document.getElementById('lineChartCanvas');
    if (lineChartInstance) {
      lineChartInstance.destroy();
      lineChartInstance = null;
    }
    const selectedCourses = lineCourseChoices ? lineCourseChoices.getValue(true) : [];
    const filtered = filteredCampus.filter(r => {
      if(selectedCourses.length && !selectedCourses.includes(r.key)) return false;
      if (!r.Days.length || !r.Start_Time || !r.End_Time) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });
    const [minHour, maxHour] = getTimeRangeFromData(filtered);
    const hours = Array.from({length: maxHour - minHour}, (_,i)=>i + minHour);
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    let counts = {};
    daysOfWeek.forEach(d => hours.forEach(h => counts[d+'-'+h] = 0));
    filtered.forEach(rec => {
      let recDays = Array.isArray(rec.Days) ? rec.Days : (typeof rec.Days === "string" ? rec.Days.split(',') : []);
      if (recDays.length === 1 && recDays[0].length > 1 && recDays[0].length <= 7 && !daysOfWeek.includes(recDays[0])) {
        const abbrevDayMap = { 'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday' };
        recDays = recDays[0].split('').map(abbr => abbrevDayMap[abbr] || abbr);
      }
      const startHour = parseHour(rec.Start_Time);
      const endHour = parseHour(rec.End_Time);
      if (startHour == null || endHour == null) return;
      if (startHour === endHour) return;
      recDays.forEach(day => {
        if (!day || !daysOfWeek.includes(day)) return;
        hours.forEach(h => {
          if (h >= Math.floor(startHour) && h < endHour) {
            counts[day+'-'+h] += 1;
          }
        });
      });
    });
    const ctx = chartDiv.getContext('2d');
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
      pointRadius: 2,
      borderWidth: 2
    }));
    let maxY = 0;
    datasets.forEach(ds => ds.data.forEach(v => { if (v > maxY) maxY = v; }));
    let tickCount = Math.max(3, Math.min(6, maxY));
    let stepSize = 1;
    let yMax = 1;
    if (maxY <= 3) {
      tickCount = 3;
      yMax = 3;
      stepSize = 1;
    } else {
      stepSize = Math.ceil(maxY / (tickCount - 1));
      yMax = stepSize * (tickCount - 1);
      if (yMax < maxY) {
        yMax += stepSize;
      }
    }
    lineChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`
            }
          }
        },
        layout: { padding: 0 },
        scales: {
          x: { title: { display: true, text: 'Time of Day' }, ticks: { font: { size: 10 } } },
          y: {
            min: 0,
            max: yMax,
            title: { display: true, text: 'Concurrent Courses' },
            beginAtZero: true,
            ticks: {
              stepSize: stepSize,
              maxTicksLimit: tickCount,
              padding: 2,
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  // --- FullCalendar weekly view with room filter and date span ---
  function renderFullCalendar() {
    if (!calendarEl) return;
    // Prepare events
    const daysMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    let data = currentData;
    const filt = calendarRoomFilter?.value || 'All';
    if (filt && filt !== 'All') {
      data = data.filter(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}` === filt);
    }
    const events = [];
    (data || []).forEach(ev => {
      let daysArr = Array.isArray(ev.Days) ? ev.Days : (typeof ev.Days === "string" ? ev.Days.split(',') : []);
      daysArr = daysArr.map(d => d.trim()).filter(d => daysMap.hasOwnProperty(d));
      if (!daysArr.length) return;
      // Get date span
      let startDate = extractField(ev, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
      let endDate = extractField(ev, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
      if (!startDate || !endDate) return;
      // Normalize date format to YYYY-MM-DD
      startDate = (startDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
      endDate = (endDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
      // If still not ISO, try to parse anyway
      let start = new Date(startDate);
      let end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      // Make end exclusive for FullCalendar
      end.setDate(end.getDate() + 1);
      // Compose event with extra info for popup
      const title = extractField(ev, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
      const instructor = extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
      const subject_course = ev.Subject_Course || '';
      const crn = ev.CRN || '';
      const bldg_room = `${ev.Building || ''}-${ev.Room || ''}`;
      const displayTime = `${format12(ev.Start_Time)} - ${format12(ev.End_Time)}`;
      const startDateDisplay = startDate || 'N/A';
      const endDateDisplay = endDate || 'N/A';

      events.push({
        title: `${subject_course} CRN: ${crn}\n${bldg_room}`,
        startTime: ev.Start_Time,
        endTime: ev.End_Time,
        daysOfWeek: daysArr.map(d => daysMap[d]),
        startRecur: start.toISOString().slice(0,10),
        endRecur: end.toISOString().slice(0,10),
        extendedProps: {
          subject_course,
          crn,
          bldg_room,
          displayTime,
          instructor,
          title,
          dateRange: `${startDateDisplay} - ${endDateDisplay}`
        }
      });
    });
    // Snap to official term start date if available, else fallback to today
    const initialDate = termStartDates[currentTerm] || new Date().toISOString().slice(0, 10);
    if (calendarEl._fullCalendar) {
      calendarEl._fullCalendar.destroy();
      calendarEl.innerHTML = '';
    }
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      allDaySlot: false,
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      events: events,
      height: 700,
      initialDate: initialDate,
      eventDidMount: function(info) {
        // Show popup tile like snapshot grid
        info.el.addEventListener('mouseenter', function(e) {
          const props = info.event.extendedProps;
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.innerHTML = `
<b>${props.subject_course || ''}</b><br>
${props.title ? `<span>${props.title}</span><br>` : ''}
CRN: ${props.crn || ''}<br>
Time: ${props.displayTime}<br>
Date Range: ${props.dateRange}<br>
Instructor: ${props.instructor || 'N/A'}
          `.trim();
          tooltip.style.display = 'block';
          tooltip.style.left = (e.pageX + 12) + 'px';
          tooltip.style.top  = (e.pageY + 12) + 'px';
        });
        info.el.addEventListener('mouseleave', function() {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.display = 'none';
        });
        info.el.addEventListener('mousemove', function(e) {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.left = (e.pageX + 12) + 'px';
          tooltip.style.top  = (e.pageY + 12) + 'px';
        });
      }
    });
    fullCalendarInstance.render();
    calendarEl._fullCalendar = fullCalendarInstance;
  }
});
