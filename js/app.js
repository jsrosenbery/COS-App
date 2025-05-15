let currentData = [];
document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025', 'Fall 2025', 'Spring 2026'];
  const termTabs = document.getElementById('term-tabs');
  const uploadContainer = document.getElementById('upload-container');
  const table = document.getElementById('schedule-table');
  const availabilityBtn = document.getElementById('availability-btn');

  // Create term tabs
  terms.forEach((term, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    termTabs.appendChild(tab);
  });

  // Initial setup with default term
  setupUpload('Spring 2026');
  buildEmptyGrid();

  availabilityBtn.onclick = () => showAvailability();

  function selectTerm(term, tabElem) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    buildEmptyGrid();
    setupUpload(term);
  }

  function setupUpload(term) {
    uploadContainer.innerHTML = `<label>Upload CSV for ${term}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        parseCSVFile(file, data => {
          currentData = data;
          renderSchedule(data);
        });
      }
    });
  }

  function buildEmptyGrid() {
    table.innerHTML = '';
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    ['Monday','Tuesday','Wednesday','Thursday','Friday'].forEach(day => {
      header.insertCell().outerHTML = `<th>${day}</th>`;
    });
    const start = 6*60, end = 22*60;
    for (let t = start; t <= end; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t%60;
      const timeStr = ('0'+hh).slice(-2) + ':' + ('0'+mm).slice(-2);
      row.insertCell().outerHTML = `<th>${timeStr}</th>`;
      for (let i=0; i<5; i++) row.insertCell().textContent = '';
    }
  }

  function renderSchedule(data) {
    buildEmptyGrid();
    data.forEach(item => {
      item.Days.forEach(day => {
        const dayIndex = ['Monday','Tuesday','Wednesday','Thursday','Friday'].indexOf(day);
        if (dayIndex < 0) return;
        const [sh, sm] = item.Start_Time.split(':').map(Number);
        const [eh, em] = item.End_Time.split(':').map(Number);
        const startMin = sh*60 + sm, endMin = eh*60 + em;
        const rowStart = Math.floor((startMin - 6*60)/30) + 1;
        const rowSpan = Math.ceil((endMin - startMin)/30);
        const row = table.rows[rowStart];
        if (!row) return;
        const cell = document.createElement('td');
        cell.rowSpan = rowSpan;
        cell.className = 'class-block';
        cell.innerHTML = `<strong>${item.Subject_Course} (${item.CRN})</strong><br>${item.Building}-${item.Room}`;
        row.replaceChild(cell, row.cells[dayIndex+1]);
        for (let i=1; i<rowSpan; i++) {
          table.rows[rowStart+i].deleteCell(dayIndex+1);
        }
      });
    });
  }

  function showAvailability() {
    if (!currentData.length) return alert('Upload schedule first.');
    const day = prompt('Enter day (e.g. Monday):');
    const start = prompt('Start time (HH:MM):');
    const end = prompt('End time (HH:MM):');
    const startMin = parseInt(start.split(':')[0])*60 + parseInt(start.split(':')[1]);
    const endMin = parseInt(end.split(':')[0])*60 + parseInt(end.split(':')[1]);
    const rooms = [...new Set(currentData.map(i => `${i.Building}-${i.Room}`))];
    const occupied = new Set();
    currentData.forEach(i => {
      if (i.Days.includes(day)) {
        const [sh, sm] = i.Start_Time.split(':').map(Number);
        const [eh, em] = i.End_Time.split(':').map(Number);
        const s = sh*60+sm, e = eh*60+em;
        if (!(e <= startMin || s >= endMin)) occupied.add(`${i.Building}-${i.Room}`);
      }
    });
    const available = rooms.filter(r => !occupied.has(r));
    alert(`Available rooms on ${day} ${start}-${end}:\n` + available.join(', '));
  }
});
