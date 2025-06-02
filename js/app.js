// app.js

let parsedRows = [];
let weekStartDate = null;

function parseDate(str) {
  const parts = str.split('/');
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  return new Date(y, m - 1, d);
}

function startOfWeek(date) {
  const dow = date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow);
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function formatDateEEE_MMdd(date) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const day = days[date.getDay()];
  return day + ' ' + String(mm).padStart(2,'0') + '/' + String(dd).padStart(2,'0');
}

function formatDateyyyy_MM_dd(date) {
  const mm = String(date.getMonth() + 1).padStart(2,'0');
  const dd = String(date.getDate()).padStart(2,'0');
  const y = date.getFullYear();
  return y + '-' + mm + '-' + dd;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('csvInput').addEventListener('change', handleFileUpload);
});

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  parseCSVFile(file, rows => {
    parsedRows = rows.map(r => ({
      ...r,
      startDate: parseDate(r.Start_Date),
      endDate: parseDate(r.End_Date)
    }));
    if (parsedRows.length === 0) return;
    const earliest = parsedRows.reduce((min, r) => r.startDate < min ? r.startDate : min, parsedRows[0].startDate);
    weekStartDate = startOfWeek(earliest);
    renderCalendar();
    document.getElementById('upload-timestamp').textContent = 'Loaded: ' + new Date().toLocaleString();
  });
}

function renderCalendar() {
  const table = document.getElementById('schedule-table');
  table.innerHTML = '';
  const thead = table.createTHead();
  const hr = thead.insertRow();
  hr.insertCell().textContent = '';
  for (let i = 0; i < 7; i++) {
    const dt = addDays(weekStartDate, i);
    const cell = hr.insertCell();
    cell.textContent = formatDateEEE_MMdd(dt);
  }
  const tbody = table.createTBody();
  for (let h = 6; h <= 22; h++) {
    const row = tbody.insertRow();
    const labelCell = row.insertCell();
    const ampm = h < 12 ? 'AM' : 'PM';
    const disp = h % 12 === 0 ? 12 : h % 12;
    labelCell.textContent = disp + ' ' + ampm;
    for (let d = 0; d < 7; d++) {
      const cell = row.insertCell();
      const dt = addDays(weekStartDate, d);
      cell.dataset.date = formatDateyyyy_MM_dd(dt);
      cell.dataset.hour = h;
      cell.classList.add('time-cell');
    }
  }
  parsedRows.forEach(r => {
    r.DAYS.forEach(dow => {
      const dayIndex = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dow);
      if (dayIndex < 0) return;
      const dt = addDays(weekStartDate, dayIndex);
      if (dt < r.startDate || dt > r.endDate) return;
      const timeParts = r.Start_Time.split(':');
      let hour = parseInt(timeParts[0], 10);
      if (r.Start_Time.includes('PM') && !r.Start_Time.startsWith('12')) hour += 12;
      const rowIndex = hour - 6;
      if (rowIndex < 0 || rowIndex > 16) return;
      const cell = document.querySelector('#schedule-table tbody').rows[rowIndex].cells[dayIndex + 1];
      if (cell) {
        const div = document.createElement('div');
        div.classList.add('event-block');
        div.textContent = r.Subject_Course;
        cell.appendChild(div);
      }
    });
  });
  document.getElementById('week-label').textContent = 'Week of ' + formatDateEEE_MMdd(weekStartDate);
}
