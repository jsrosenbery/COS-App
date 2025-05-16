document.addEventListener('DOMContentLoaded', () => {
  const terms = [
    'Summer 2025','Fall 2025','Spring 2026',
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028'
  ];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [];
  let currentTerm = '';

  // Cached DOM refs
  const tabs       = document.getElementById('term-tabs');
  const uploadDiv  = document.getElementById('upload-container');
  const tsDiv      = document.getElementById('upload-timestamp');
  const roomDiv    = document.getElementById('room-filter');
  const startSel   = document.getElementById('avail-start');
  const endSel     = document.getElementById('avail-end');
  const checkBtn   = document.getElementById('avail-check-btn');
  const resultsDiv = document.getElementById('avail-results');
  const table      = document.getElementById('schedule-table');
  const container  = document.getElementById('schedule-container');

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

  // ───── Populate the 5-minute time dropdowns ─────
  if (startSel && endSel) {
    for (let m = 360; m <= 22*60; m += 5) {
      const h    = Math.floor(m/60);
      const mm   = m % 60;
      const ap   = h < 12 ? 'AM' : 'PM';
      const h12  = ((h + 11) % 12) + 1;
      const label= `${h12}:${('0'+mm).slice(-2)} ${ap}`;
      startSel.add(new Option(label, label));
      endSel  .add(new Option(label, label));
    }
  }

  // Wire up availability button
  checkBtn.onclick = handleAvailability;

  // ───── Helper Functions ───────────────────────

  function selectTerm(term, tabElem) {
    currentTerm = term;
    // Highlight active tab
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    // Reset & upload UI
    clearSchedule();
    setupUpload();
    // Load saved for this term
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
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
        // Save this term
        const key = 'cos_schedule_' + currentTerm;
        localStorage.setItem(key, JSON.stringify({
          data: currentData,
          timestamp: tsDiv.textContent
        }));
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
    // Create header
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    daysOfWeek.forEach(d => header.insertCell().outerHTML = `<th>${d}</th>`);
    // Rows 6:00–22:00
    for (let t = 360; t <= 22*60; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t % 60;
      const h12 = ((hh + 11) % 12) + 1, ap = hh < 12 ? 'AM' : 'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      daysOfWeek.forEach(() => row.insertCell());
    }
  }

  function renderSchedule() {
    clearSchedule();
    const filterVal = document.getElementById('room-select')?.value || 'All';
    const data = filterVal === 'All'
      ? currentData
      : currentData.filter(i => `${i.Building}-${i.Room}` === filterVal);
    const rect = container.getBoundingClientRect();

    daysOfWeek.forEach((day, dIdx) => {
      // Collect events
      const events = data
        .filter(i => i.Days.includes(day))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);

      // Overlap packing
      const cols = [];
      events.forEach(ev => {
        let placed = false;
        for (let c = 0; c < cols.length; c++) {
          if (cols[c][cols[c].length-1].endMin <= ev.startMin) {
            cols[c].push(ev);
            ev.col = c;
            placed = true;
            break;
          }
        }
        if (!placed) {
          ev.col = cols.length;
          cols.push([ev]);
        }
      });
      const colCount = cols.length || 1;

      // Render blocks
      cols.flat().forEach(ev => {
        const minutesFromStart = ev.startMin - 360;
        const rowIndex = Math.floor(minutesFromStart / 30) + 1;
        const remainder  = minutesFromStart % 30;
        const cell       = table.rows[rowIndex].cells[dIdx+1];
        const cellRect   = cell.getBoundingClientRect();
        const topPx      = cellRect.top - rect.top + (remainder/30)*cellRect.height;
        const leftPx     = cellRect.left - rect.left + ev.col*(cellRect.width/colCount);
        const widthPx    = cellRect.width/colCount;
        const heightPx   = ((ev.endMin-ev.startMin)/30)*cellRect.height;

        const block = document.createElement('div');
        block.className = 'class-block';
        block.style.top    = `${topPx}px`;
        block.style.left   = `${leftPx}px`;
        block.style.width  = `${widthPx}px`;
        block.style.height = `${heightPx}px`;
        block.innerHTML = `
          <span>${ev.Subject_Course}</span><br>
          <span>${ev.CRN}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span>
        `;
        container.appendChild(block);
      });
    });
  }

  function handleAvailability() {
    resultsDiv.textContent = '';
    const days = [...document.querySelectorAll('.availability-ui input:checked')].map(cb=>cb.value);
    const s    = startSel.value, e = endSel.value;
    if (!days.length || !s || !e) {
      resultsDiv.textContent = 'Please select days and both start/end times.';
      return;
    }
    const toMin = t => {
      const [time, ap] = t.split(' ');
      let [h,m] = time.split(':').map(Number);
      if (ap==='PM'&&h<12) h+=12;
      if (ap==='AM'&&h===12)h=0;
      return h*60+m;
    };
    const sMin = toMin(s), eMin = toMin(e);
    const rooms = [...new Set(currentData.map(i=>i.Building+'-'+i.Room))];
    const occ   = new Set();
    currentData.forEach(i => {
      if (i.Days.some(d=>days.includes(d))) {
        const si = parseTime(i.Start_Time), ei = parseTime(i.End_Time);
        if (!(ei<=sMin||si>=eMin)) occ.add(i.Building+'-'+i.Room);
      }
    });
    const avail = rooms.filter(r => !occ.has(r));
    if (avail.length) {
      resultsDiv.innerHTML = '<ul>' + avail.map(r=>`<li>${r}</li>`).join('') + '</ul>';
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
    const ap  = h<12?'AM':'PM';
    h = ((h+11)%12)+1;
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }
});
