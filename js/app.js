document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [];
  const container = document.getElementById('schedule-container');
  const table = document.getElementById('schedule-table');
  const tabs = document.getElementById('term-tabs');
  const uploadDiv = document.getElementById('upload-container');
  const roomDiv = document.getElementById('room-filter');

  terms.forEach((term, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx === 2 ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  selectTerm(terms[2], tabs.children[2]);

  function selectTerm(term, tabElem) {
    Array.from(tabs.children).forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    setupUpload();
    clearSchedule();
  }

  function setupUpload() {
    uploadDiv.innerHTML = '<label>Upload CSV: <input type="file" id="file-input" accept=".csv"></label>';
    roomDiv.innerHTML = '';
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data.map(item => ({
          ...item,
          Building: item.Building,
          Room: item.Room
        }));
        buildRoomDropdown();
        renderSchedule();
      });
    };
  }

  function buildRoomDropdown() {
    const combos = Array.from(new Set(currentData.map(i => i.Building + '-' + i.Room))).sort();
    roomDiv.innerHTML = '<label>Filter Bldg-Room: <select id="room-select"><option>All</option>' +
      combos.map(r => `<option>${r}</option>`).join('') +
      '</select></label>';
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
      const hh = Math.floor(t/60), mm = t % 60;
      const h12 = ((hh + 11) % 12 + 1), ampm = hh < 12 ? 'AM' : 'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ampm}</th>`;
      for (let i = 0; i < daysOfWeek.length; i++) {
        row.insertCell();
      }
    }
  }

  function renderSchedule() {
    clearSchedule();
    const filterVal = document.getElementById('room-select')?.value;
    const data = filterVal && filterVal !== 'All'
      ? currentData.filter(i => `${i.Building}-${i.Room}` === filterVal)
      : currentData;
    const containerRect = container.getBoundingClientRect();
    const totalHeight = containerRect.height;
    const totalCols = daysOfWeek.length;
    daysOfWeek.forEach((day, dIdx) => {
      const events = data.filter(i => i.Days.includes(day))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin: parseTime(i.End_Time)
        }))
        .sort((a, b) => a.startMin - b.startMin);
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
      columns.flat().forEach(ev => {
        const topPct = ((ev.startMin - 360) / (1320 - 360)) * 100;
        const heightPct = ((ev.endMin - ev.startMin) / (1320 - 360)) * 100;
        const dayWidthPct = 100 / (1 + totalCols);
        const leftPct = ((dIdx + 1) * dayWidthPct) + (ev.col * (dayWidthPct / columns.length));
        const widthPct = dayWidthPct / columns.length;
        const block = document.createElement('div');
        block.className = 'class-block';
        block.style.top = topPct + '%';
        block.style.left = leftPct + '%';
        block.style.width = widthPct + '%';
        block.style.height = heightPct + '%';
        block.innerHTML = `<div>
<span>${ev.Course_Code}</span><br>
<span>${ev.CRN}</span><br>
<span>${format12(ev.Start_Time).toLowerCase().replace(/m$/,'.m.') } - ${format12(ev.End_Time).toLowerCase().replace(/m$/,'.m.') }</span>
</div>`;
        container.appendChild(block);
      });
    });
  }

  function parseTime(t24) {
    const [h, m] = t24.split(':').map(Number);
    return h * 60 + m;
  }

  function format12(t24) {
    let [h, m] = t24.split(':').map(Number);
    const ap = h < 12 ? 'AM' : 'PM';
    h = ((h + 11) % 12) + 1;
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }
});
