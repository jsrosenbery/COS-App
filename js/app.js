document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [];

  const tabs = document.getElementById('term-tabs');
  const uploadDiv = document.getElementById('upload-container');
  const tsDiv = document.getElementById('upload-timestamp');
  const roomDiv = document.getElementById('room-filter');
  const table = document.getElementById('schedule-table');
  const container = document.getElementById('schedule-container');
  const availabilityBtn = document.getElementById('availability-btn');

  // Create tabs
  terms.forEach((term, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx === 2 ? ' active' : '');
    tab.textContent = term;
    tab.addEventListener('click', () => selectTerm(term, tab));
    tabs.appendChild(tab);
  });

  // Initial load
  selectTerm(terms[2], tabs.children[2]);

  // Bind availability
  availabilityBtn.addEventListener('click', showAvailability);

  function selectTerm(term, tabElem) {
    // Activate tab
    Array.from(tabs.children).forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    // Reset
    setupUpload();
    clearSchedule();
    tsDiv.textContent = '';
  }

  function setupUpload() {
    uploadDiv.innerHTML = '<label>Upload CSV: <input type="file" id="file-input" accept=".csv"></label>';
    document.getElementById('file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      parseCSVFile(file, data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
      });
    });
  }

  function buildRoomDropdown() {
    const combos = Array.from(new Set(currentData.map(i => i.Building + '-' + i.Room))).sort();
    roomDiv.innerHTML = '<label>Filter Bldg-Room: <select id="room-select"><option>All</option>' +
      combos.map(r => `<option>${r}</option>`).join('') +
      '</select></label>';
    document.getElementById('room-select').addEventListener('change', renderSchedule);
  }

  function clearSchedule() {
    table.innerHTML = '';
    container.querySelectorAll('.class-block').forEach(el => el.remove());
    // Header
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    daysOfWeek.forEach(d => header.insertCell().outerHTML = `<th>${d}</th>`);
    // Rows 6:00 to 22:00
    for (let t = 360; t <= 22*60; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t % 60;
      const h12 = ((hh+11)%12+1), ap = hh<12?'AM':'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      for (let i = 0; i < daysOfWeek.length; i++) {
        row.insertCell();
      }
    }
  }

  
function renderSchedule() {
  clearSchedule();
  const filter = document.getElementById('room-select')?.value || 'All';
  const data = filter === 'All' ? currentData : currentData.filter(i => `${i.Building}-${i.Room}` === filter);
  const containerRect = container.getBoundingClientRect();

  daysOfWeek.forEach((day, dIdx) => {
    const events = data
      .filter(i => i.Days.includes(day))
      .map(i => ({
        ...i,
        startMin: parseTime(i.Start_Time),
        endMin: parseTime(i.End_Time)
      }))
      .sort((a, b) => a.startMin - b.startMin);

    // Overlapping columns
    const columns = [];
    events.forEach(ev => {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c][columns[c].length - 1].endMin <= ev.startMin) {
          columns[c].push(ev);
          ev.col = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev.col = columns.length;
        columns.push([ev]);
      }
    });
    const colCount = columns.length || 1;

    columns.flat().forEach(ev => {
      // calculate exact offset
      const minutesFromStart = ev.startMin - 360;
      const rowIndex = Math.floor(minutesFromStart / 30) + 1;
      const remainder = minutesFromStart % 30;
      const cell = table.rows[rowIndex].cells[dIdx + 1];
      const cellRect = cell.getBoundingClientRect();
      const topPx = cellRect.top - containerRect.top + (remainder / 30) * cellRect.height;
      const leftPx = cellRect.left - containerRect.left + ev.col * (cellRect.width / colCount);
      const widthPx = cellRect.width / colCount;
      const heightPx = ((ev.endMin - ev.startMin) / 30) * cellRect.height;

      const block = document.createElement('div');
      block.className = 'class-block';
      block.style.top = topPx + 'px';
      block.style.left = leftPx + 'px';
      block.style.width = widthPx + 'px';
      block.style.height = heightPx + 'px';
      block.innerHTML = `
        <div style="text-align:center;">
          <span>${ev.Subject_Course}</span><br>
          <span>${ev.CRN}</span><br>
          <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span>
        </div>`;
      container.appendChild(block);
    });
  });
}
);
