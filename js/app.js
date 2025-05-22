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
    } else {
      currentData = [];
      tsDiv.textContent = '';
      roomDiv.innerHTML = '';
    }
  }

  function setupUpload() {
    roomDiv.innerHTML = '';
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type=\"file\" id=\"file-input\" accept=\".csv\"></label>`;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
        localStorage.setItem('cos_schedule_' + currentTerm, JSON.stringify({ data: currentData, timestamp: tsDiv.textContent }));
      });
    };
  }

  function buildRoomDropdown() {
    const combos = [...new Set(currentData.map(i => `${i.Building}-${i.Room}`))].sort();
    roomDiv.innerHTML = `<label>Filter Bldg-Room: <select id=\"room-select\"><option>All</option>${combos.map(r => `<option>${r}</option>`).join('')}</select></label>`;
    document.getElementById('room-select').onchange = renderSchedule;
  }

  function clearSchedule() {
    table.innerHTML = '';
    container.querySelectorAll('.class-block').forEach(e => e.remove());
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    daysOfWeek.forEach(d => header.insertCell().outerHTML = `<th>${d}</th>`);
    for (let t = 360; t <= 1320; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t%60;
      const h12 = ((hh+11)%12)+1, ap = hh<12 ? 'AM' : 'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      daysOfWeek.forEach(() => row.insertCell());
    }
  }

  function renderSchedule() {
    clearSchedule();
    const filt = document.getElementById('room-select')?.value || 'All';
    const data = filt === 'All' ? currentData : currentData.filter(i => `${i.Building}-${i.Room}` === filt);
    const rect = container.getBoundingClientRect();
    daysOfWeek.forEach((day, dIdx) => {
      const evs = data.filter(i => i.Days.includes(day))
        .map(i => ({ ...i, startMin: parseTime(i.Start_Time), endMin: parseTime(i.End_Time) }))
        .sort((a,b) => a.startMin - b.startMin);
      const cols = [];
      evs.forEach(ev => {
        let placed = false;
        for (let c=0; c<cols.length; c++) {
          if (cols[c][cols[c].length-1].endMin <= ev.startMin) { cols[c].push(ev); ev.col = c; placed = true; break; }
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
        const cr = cell.getBoundingClientRect();
        const topPx = cr.top - rect.top + (rem/30)*cr.height;
        const leftPx = cr.left - rect.left + ev.col*(cr.width/colCount);
        const widthPx = cr.width/colCount;
        const heightPx = ((ev.endMin-ev.startMin)/30)*cr.height;
        const b = document.createElement('div');
        b.className = 'class-block';
        Object.assign(b.style, { top: `${topPx}px`, left: `${leftPx}px`, width: `${widthPx}px`, height: `${heightPx}px` });
        b.innerHTML = `<span>${ev.Subject_Course}</span><br><span>${ev.CRN}</span><br><span>${format12(i.Start_Time)} - ${format12(i.End_Time)}</span>`;
        container.appendChild(b);
      });
    });
  }

  function handleAvailability() {
    resultsDiv.innerHTML = '';
    const days = Array.from(document.querySelectorAll('#availability-ui .days input:checked')).map(cb => cb.value);
    const start = startInput.value, end = endInput.value;
    if (!days.length || !start || !end) {
      resultsDiv.textContent = 'Please select at least one day and both start/end times.';
      return;
    }
    const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60 + m; };
    const sMin = toMin(start), eMin = toMin(end);
    const rooms = [...new Set(currentData.map(i => `${i.Building}-${i.Room}`))];
    const avail = rooms.filter(room => {
      const classes = currentData.filter(i => `${i.Building}-${i.Room}` === room && i.Days.some(d => days.includes(d)));
      if (!classes.length) return true;
      return classes.every(i => { const si = parseTime(i.Start_Time), ei = parseTime(i.End_Time); return ei <= sMin || si >= eMin; });
    }).sort((a,b) => a.localeCompare(b));
    if (avail.length) {
      resultsDiv.innerHTML = '<ul>' + avail.map(r => `<li>${r}</li>`).join('') + '</ul>';
    } else {
      // debug info for diagnosis
      resultsDiv.innerHTML = `<p>No rooms available.</p>` +
        `<p>Debug: Days=[${days.join(', ')}], Start=${start}, End=${end}, Rooms=${rooms.length}, Avail=${avail.length}</p>`;
    }
  }

  function parseTime(t) { const [h,m] = t.split(':').map(Number); return h*60 + m; }
  function format12(t) { let [h,m] = t.split(':').map(Number); const ap = h<12?'AM':'PM'; h = ((h+11)%12)+1; return `${h}:${('0'+m).slice(-2)}${ap}`; }
});
