// app.js
const { parse, format, addDays, startOfWeek } = dateFns;

let parsedRows = [];
let weekStartDate = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('csvInput').addEventListener('change', handleFileUpload);
});

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  parseCSVFile(file, rows => {
    parsedRows = rows.map(r => ({
      ...r,
      startDate: parse(r.Start_Date, 'MM/dd/yyyy', new Date()),
      endDate: parse(r.End_Date, 'MM/dd/yyyy', new Date())
    }));
    if (parsedRows.length === 0) return;
    // Determine earliest startDate
    const earliest = parsedRows.reduce((min, r) => r.startDate < min ? r.startDate : min, parsedRows[0].startDate);
    weekStartDate = startOfWeek(earliest, { weekStartsOn: 0 });
    renderCalendar();
    document.getElementById('upload-timestamp').textContent = 'Loaded: ' + new Date().toLocaleString();
  });
}

function renderCalendar() {
  const table = document.getElementById('schedule-table');
  table.innerHTML = '';
  // Header row
  const thead = table.createTHead();
  const hr = thead.insertRow();
  hr.insertCell().textContent = '';
  for (let i = 0; i < 7; i++) {
    const dt = addDays(weekStartDate, i);
    const cell = hr.insertCell();
    cell.textContent = format(dt, 'EEE MM/dd');
  }
  // Body rows for hours 6am-10pm
  const tbody = table.createTBody();
  for (let h = 6; h <= 22; h++) {
    const row = tbody.insertRow();
    const labelCell = row.insertCell();
    const ampm = h < 12 ? 'AM' : 'PM';
    const disp = h % 12 === 0 ? 12 : h % 12;
    labelCell.textContent = `${disp} ${ampm}`;
    for (let d = 0; d < 7; d++) {
      const cell = row.insertCell();
      cell.dataset.date = format(addDays(weekStartDate, d), 'yyyy-MM-dd');
      cell.dataset.hour = h;
      cell.classList.add('time-cell');
    }
  }
  // Place events
  parsedRows.forEach(r => {
    r.DAYS.forEach(dow => {
      const dayIndex = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dow);
      if (dayIndex < 0) return;
      const dt = addDays(weekStartDate, dayIndex);
      if (dt < r.startDate || dt > r.endDate) return;
      const startHour = parseInt(r.Start_Time.split(':')[0]) + (r.Start_Time.includes('PM') && !r.Start_Time.startsWith('12') ? 12 : 0);
      const rowIndex = startHour - 6;
      if (rowIndex < 0 || rowIndex > 16) return;
      const cell = document.querySelector(`#schedule-table tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${dayIndex + 2})`);
      if (cell) {
        const div = document.createElement('div');
        div.classList.add('event-block');
        div.textContent = r.Subject_Course;
        cell.appendChild(div);
      }
    });
  });
  // Week label
  document.getElementById('week-label').textContent = 'Week of ' + format(weekStartDate, 'MM/dd/yyyy');
}
