// COS-App js/app.js

let hmRaw = [];
let hmTable;
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

  // Initialize heatmap table (empty) and line-chart dropdowns
  initHeatmap();
  initLineChartChoices();

  // Build term tabs
  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  selectTerm(terms[2], tabs.children[2]);

  // Availability UI handlers
  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    resultsDiv.textContent = '';
  };

  // View selector (heatmap, calendar, linechart)
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

  // Term selection & loading from localStorage
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
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span>`;
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
    // On table search (text filter), redraw heatmap
    hmTable.on('search.dt', updateHeatmap);
  }

  function initFilters() {
    // Inject campus checkboxes
    const campusMenu = document.getElementById('campusMenu');
    campusMenu.querySelectorAll('label:not([for])').forEach(l=>l.remove());
    const campuses = Array.from(new Set(hmRaw.map(r=>r.CAMPUS).filter(c=>c)))
      .sort();
    campuses.forEach(c => {
      const lbl = document.createElement('label');
      lbl.innerHTML = `<input type="checkbox" class="campus-cb" value="${c}" checked> ${c}`;
      campusMenu.appendChild(lbl);
    });

    // Inject course checkboxes
    const courseMenu = document.getElementById('courseMenu');
    courseMenu.querySelectorAll('label:not([for])').forEach(l=>l.remove());
    const courses = Array.from(new Set(hmRaw.map(r=>r.key).filter(k=>k)))
      .sort();
    courses.forEach(k => {
      const lbl = document.createElement('label');
      lbl.innerHTML = `<input type="checkbox" class="course-cb" value="${k}" checked> ${k}`;
      courseMenu.appendChild(lbl);
    });

    // Toggle dropdown menus
    document.getElementById('campusFilterBtn').onclick = () =>
      campusMenu.classList.toggle('show');
    document.getElementById('courseFilterBtn').onclick = () =>
      courseMenu.classList.toggle('show');

    document.addEventListener('click', e => {
      if (!e.target.closest('#campusFilter')) campusMenu.classList.remove('show');
      if (!e.target.closest('#courseFilter')) courseMenu.classList.remove('show');
    });

    // Search within menus
    document.getElementById('campusSearch').oninput = () => {
      const term = document.getElementById('campusSearch').value.toLowerCase();
      campusMenu.querySelectorAll('label').forEach(lbl => {
        if (lbl.querySelector('input').id === 'campusSelectAll') return;
        lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'block' : 'none';
      });
    };
    document.getElementById('courseSearch').oninput = () => {
      const term = document.getElementById('courseSearch').value.toLowerCase();
      courseMenu.querySelectorAll('label').forEach(lbl => {
        if (lbl.querySelector('input').id === 'courseSelectAll') return;
        lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'block' : 'none';
      });
    };

    // “Select All” boxes
    document.getElementById('campusSelectAll').onchange = e => {
      campusMenu.querySelectorAll('.campus-cb')
        .forEach(cb => cb.checked = e.target.checked);
      updateAllHeatmap();
    };
    document.getElementById('courseSelectAll').onchange = e => {
      courseMenu.querySelectorAll('.course-cb')
        .forEach(cb => cb.checked = e.target.checked);
      updateAllHeatmap();
    };

    // Individual checkbox change
    campusMenu.onchange = e => {
      if (!e.target.classList.contains('campus-cb')) return;
      const all = [...campusMenu.querySelectorAll('.campus-cb')];
      document.getElementById('campusSelectAll').checked = all.every(cb=>cb.checked);
      updateAllHeatmap();
    };
    courseMenu.onchange = e => {
      if (!e.target.classList.contains('course-cb')) return;
      const all = [...courseMenu.querySelectorAll('.course-cb')];
      document.getElementById('courseSelectAll').checked = all.every(cb=>cb.checked);
      updateAllHeatmap();
    };
  }

  function feedHeatmapTool(dataArray) {
    // Prepare raw data
    hmRaw = dataArray.map(r => {
      const parts = (r.Subject_Course || '').trim().split(/\s+/);
      const key = parts.length >=2 ? (parts[0] + ' ' + parts[1]) : (r.Subject_Course || '').trim();
      let daysVal = r.Days;
      if (typeof daysVal === 'string') daysVal = daysVal.split(',').map(s=>s.trim());
      return {
        key,
        Building: r.Building || '',
        Room: r.Room || '',
        Days: daysVal || [],
        Start_Time: r.Start_Time || '',
        End_Time: r.End_Time || '',
        CAMPUS: r.CAMPUS || ''
      };
    }).filter(r => {
      const d = Array.isArray(r.Days) ? r.Days.join(',') : (r.Days||'');
      if (!d || /^(X,?)+$/.test(d.replace(/\s/g,''))) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });

    // Inject filters and initial draw
    initFilters();
    updateAllHeatmap();
  }

  function updateAllHeatmap() {
    const selectedCourses = Array.from(
      document.querySelectorAll('#courseMenu .course-cb:checked')
    ).map(cb=>cb.value);
    const selectedCampuses = Array.from(
      document.querySelectorAll('#campusMenu .campus-cb:checked')
    ).map(cb=>cb.value);

    const rows = hmRaw.filter(r => {
      if (selectedCourses.length && !selectedCourses.includes(r.key)) return false;
      if (selectedCampuses.length && !selectedCampuses.includes(r.CAMPUS)) return false;
      if (!r.Building || !r.Room) return false;
      const B = r.Building.toUpperCase(), R = r.Room.toUpperCase();
      if (B==='N/A'||R==='N/A'||B==='ONLINE') return false;
      return true;
    }).map(r => [
      r.key,
      r.Building,
      r.Room,
      r.Days.join(','),
      `${r.Start_Time}-${r.End_Time}`
    ]);

    hmTable.clear().rows.add(rows).draw();
  }

  function updateHeatmap() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const [minHour, maxHour] = getTimeRangeFromData(
      filtered.map(row => ({
        Start_Time: row[4]?.split('-')[0],
        End_Time: row[4]?.split('-')[1]
      }))
    );
    const hours = Array.from({length: maxHour - minHour}, (_,i)=>i + minHour);
    const counts = {};
    hmDays.forEach(d => counts[d] = hours.map(() => 0));
    filtered.forEach(row => {
      const [ , , , daysStr, timeStr ] = row;
      const dayList = daysStr.split(',');
      const [st,en] = timeStr.split('-').map(s=>s.trim());
      if (!st||!en||parseHour(st)===parseHour(en)) return;
      const hr = parseInt(st.match(/(\d{1,2}):/)[1],10);
      dayList.forEach(d => {
        const idx = hours.indexOf(hr);
        if (idx>=0) counts[d][idx]++;
      });
    });
    const maxC = Math.max(...Object.values(counts).flat());
    let html = '<table class="heatmap" style="border-collapse:collapse;width:100%;margin-top:20px;">';
    html += '<thead><tr><th style="background:#eee;border:1px solid #ccc;padding:4px;">Day/Time</th>';
    hours.forEach(h=>{
      const ap = h<12?'AM':'PM';
      const hh = h%12||12;
      html+=`<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`;
    });
    html+='</tr></thead><tbody>';
    hmDays.forEach(d=>{
      html+=`<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`;
      counts[d].forEach(c=>{
        const opacity = maxC? c/maxC : 0;
        html+=`<td style="border:1px solid #ccc;padding:4px;background:rgba(0,100,200,${opacity});">${c}</td>`;
      });
      html+='</tr>';
    });
    html+='</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  function initLineChartChoices() {
    lineCourseChoices = new Choices('#lineCourseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by discipline/course',
      callbackOnCreateTemplates: (template) => ({
        choice: (classNames, data) => template(`
          <div class="${classNames.item} ${classNames.itemChoice}" data-id="${data.id}" data-value="${data.value}" role="option">
            <input type="checkbox" ${data.selected?'checked':''} tabindex="-1"/>
            <span>${data.label}</span>
          </div>
        `)
      })
    });
    lineCampusChoices = new Choices('#lineCampusSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by campus',
      callbackOnCreateTemplates: (template) => ({
        choice: (classNames, data) => template(`
          <div class="${classNames.item} ${classNames.itemChoice}" data-id="${data.id}" data-value="${data.value}" role="option">
            <input type="checkbox" ${data.selected?'checked':''} tabindex="-1"/>
            <span>${data.label}</span>
          </div>
        `)
      })
    });
  }

  function renderLineChart() {
    const chartDiv = document.getElementById('lineChartCanvas');
    if (lineChartInstance) {
      lineChartInstance.destroy();
      lineChartInstance = null;
    }
    const selectedCourses = lineCourseChoices.getValue(true);
    const selectedCampuses = lineCampusChoices.getValue(true);
    const filtered = hmRaw.filter(r => {
      if (selectedCourses.length && !selectedCourses.includes(r.key)) return false;
      if (selectedCampuses.length && !selectedCampuses.includes(r.CAMPUS)) return false;
      if (!r.Days.length || !r.Start_Time || !r.End_Time) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });
    const [minHour, maxHour] = getTimeRangeFromData(filtered);
    const hours = Array.from({length: maxHour - minHour}, (_,i)=>i + minHour);
    const counts = {};
    hmDays.forEach(d => hours.forEach(h => counts[`${d}-${h}`] = 0));
    filtered.forEach(rec => {
      let recDays = Array.isArray(rec.Days) ? rec.Days : (typeof rec.Days==='string'?rec.Days.split(','):[]);
      recDays.forEach(day => {
        hours.forEach(h => {
          const st = parseHour(rec.Start_Time), en = parseHour(rec.End_Time);
          if (h >= Math.floor(st) && h < en) counts[`${day}-${h}`]++;
        });
      });
    });
    const ctx = chartDiv.getContext('2d');
    const labels = hours.map(h=>`${h%12||12} ${(h<12?'AM':'PM')}`);
    const colorList = ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2"];
    const datasets = hmDays.map((day,idx)=>({
      label: day,
      data: hours.map(h=>counts[`${day}-${h}`]),
      fill: false,
      borderColor: colorList[idx%colorList.length],
      backgroundColor: colorList[idx%colorList.length],
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2
    }));
    const maxY = Math.max(...datasets.flatMap(ds=>ds.data));
    let tickCount = Math.max(3,Math.min(6,maxY));
    let stepSize = Math.ceil(maxY/(tickCount-1))||1;
    let yMax = stepSize*(tickCount-1);
    if (yMax < maxY) yMax += stepSize;
    lineChartInstance = new Chart(ctx,{
      type:'line',
      data:{labels,datasets},
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y}`}}},
        scales:{
          x:{title:{display:true,text:'Time of Day'},ticks:{font:{size:10}}},
          y:{min:0,max:yMax,beginAtZero:true,stepSize, title:{display:true,text:'Concurrent Courses'},ticks:{padding:2,font:{size:10},maxTicksLimit:tickCount}}
        }
      }
    });
  }
});
