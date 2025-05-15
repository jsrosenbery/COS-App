document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Spring 2026'];
  const termTabs = document.getElementById('term-tabs');
  const uploadContainer = document.getElementById('upload-container');
  const table = document.getElementById('schedule-table');

  terms.forEach((term, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx === 0 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    termTabs.appendChild(tab);
  });

  // Initial setup
  setupUpload();
  buildEmptyGrid();

  document.getElementById('availability-btn').onclick = () => {
    alert('Room availability feature coming soon!');
  };

  function selectTerm(term, tabElem) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    buildEmptyGrid();
    setupUpload();
  }

  function setupUpload() {
    uploadContainer.innerHTML = '<input type="file" id="file-input" accept=".csv">';
    document.getElementById('file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        parseCSVFile(file, data => renderSchedule(data));
      }
    });
  }

  function buildEmptyGrid() {
    // clear table
    table.innerHTML = '';
    // header row
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    ['Monday','Tuesday','Wednesday','Thursday','Friday'].forEach(day => {
      header.insertCell().outerHTML = `<th>${day}</th>`;
    });
    // time rows (6:00 to 22:00, 30-min increments)
    const start = 6*60, end = 22*60;
    for (let t = start; t <= end; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t%60;
      const timeStr = ('0'+hh).slice(-2) + ':' + ('0'+mm).slice(-2);
      row.insertCell().outerHTML = `<th>${timeStr}</th>`;
      for (let i=0; i<5; i++) {
        row.insertCell().textContent = '';
      }
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
        const startMinutes = sh*60 + sm;
        const endMinutes = eh*60 + em;
        const rowStart = Math.floor((startMinutes - 6*60)/30) + 1;
        const rowSpan = Math.ceil((endMinutes - startMinutes)/30);
        const targetRow = table.rows[rowStart];
        if (!targetRow) return;
        const cell = document.createElement('td');
        cell.rowSpan = rowSpan;
        cell.className = 'class-block';
        cell.innerHTML = `<strong>${item.Subject_Course} (${item.CRN})</strong><br>
                          ${item.Start_Time}-${item.End_Time}<br>
                          ${item.Building}-${item.Room}`;
        // remove placeholder cells that will be covered by rowspan
        table.rows[rowStart].replaceChild(cell, table.rows[rowStart].cells[dayIndex+1]);
        for (let i = 1; i < rowSpan; i++) {
          const r = table.rows[rowStart + i];
          if (r) r.deleteCell(dayIndex+1);
        }
      });
    });
  }
});
