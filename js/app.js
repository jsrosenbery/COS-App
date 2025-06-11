// COS-App js/app.js

let hmRaw = [];
let hmTable;
let hmChoices;
let campusChoices;
let lineCourseChoices, lineCampusChoices;
let lineChartInstance;

const hmDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

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

// NEW: Format date as MM/DD
function formatDateRange(start, end) {
  function getMMDD(dateStr) {
    if (!dateStr) return '';
    let m, d;
    // Handle YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateStr)) {
      [ , m, d ] = dateStr.match(/^\d{4}[-/](\d{1,2})[-/](\d{1,2})$/) || [];
    }
    // Handle MM/DD/YYYY or M/D/YYYY
    else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(dateStr)) {
      [ , m, d ] = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/]\d{2,4}$/) || [];
    }
    if (m && d) {
      return `${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
    }
    return dateStr; // fallback
  }
  const s = getMMDD(start);
  const e = getMMDD(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return s;
  if (e) return e;
  return '';
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

  initHeatmap();
  initLineChartChoices();

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

  document.getElementById('lineCourseSelect').addEventListener('change', renderLineChart);
  document.getElementById('lineCampusSelect').addEventListener('change', renderLineChart);

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
          ev.Building,
          ev.Room
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
        const b = document.createElement('div');
        b.className = 'class-block';
        b.style.top    = `${topPx}px`;
        b.style.left   = `${leftPx}px`;
        b.style.width  = `${widthPx}px`;
        b.style.height = `${heightPx}px`;
        b.innerHTML = `
          <span>${ev.Subject_Course}</span><br>
          <span>${ev.CRN}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span><br>
          <span style="font-size:0.9em; color:#555;">${formatDateRange(ev.Start_Date, ev.End_Date)}</span>
        `;
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
    campusChoices = new Choices('#campusSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by campus',
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
    lineCampusChoices = new Choices('#lineCampusSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by campus',
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
      if (typeof daysVal === 'string') {
        daysVal = daysVal.split(',').map(s => s.trim());
      }
      return {
        key,
        Building: r.Building || '',
        Room: r.Room || '',
        Days: daysVal || [],
        Start_Time: r.Start_Time || '',
        End_Time: r.End_Time || '',
        CAMPUS: r.CAMPUS || '',
        Start_Date: r.Start_Date || '',
        End_Date: r.End_Date || ''
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
    // --- Campus options ---
    const campuses = Array.from(new Set(
      dataArray
        .map(r => (r.CAMPUS || '').trim())
        .filter(c => c && c.toLowerCase() !== 'n/a' && c.toLowerCase() !== 'online')
    )).sort();
    const campusItems = campuses.map(c => ({ value: c, label: c }));
    if (campusChoices) {
      campusChoices.setChoices(campusItems, 'value', 'label', true);
    }
    if (lineCampusChoices) {
      lineCampusChoices.setChoices(campusItems, 'value', 'label', true);
    }
    updateAllHeatmap();
    renderLineChart();
  }

  function updateAllHeatmap() {
    const selected = hmChoices.getValue(true);
    const selectedCampuses = campusChoices ? campusChoices.getValue(true) : [];
    const rows = hmRaw.filter(r => {
      if(selected.length && !selected.includes(r.key)) return false;
      if(selectedCampuses.length && !selectedCampuses.includes(r.CAMPUS || '')) return false;
      if(!r.Building || !r.Room) return false;
      const b = r.Building.toUpperCase(), ro = r.Room.toUpperCase();
      if(b==='N/A'||ro==='N/A'||b==='ONLINE') return false;
      return true;
    }).map(r => [r.key, r.Building, r.Room, r.Days.join(','), r.Start_Time + '-' + r.End_Time]);
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
    hours.forEach(h=>{ const ap=h<12?'AM':'PM'; const hh=h%12||12; html+=`<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`; });
    html+='</tr></thead><tbody>';
    hmDays.forEach(d=>{ html+=`<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`; counts[d].forEach(c=>{ const op=maxC?c/maxC:0; html+=`<td style="border:1px solid #ccc;padding:4px;background:rgba(0,100,200,${op});">${c}</td>`; }); html+='</tr>'; });
    html+='</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  function renderLineChart() {
    const chartDiv = document.getElementById('lineChartCanvas');
    if (lineChartInstance) {
      lineChartInstance.destroy();
      lineChartInstance = null;
    }
    const selectedCourses = lineCourseChoices ? lineCourseChoices.getValue(true) : [];
    const selectedCampuses = lineCampusChoices ? lineCampusChoices.getValue(true) : [];
    const filtered = hmRaw.filter(r => {
      if(selectedCourses.length && !selectedCourses.includes(r.key)) return false;
      const campusVal = r.CAMPUS || '';
      if(selectedCampuses.length && !selectedCampuses.includes(campusVal)) return false;
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
});
