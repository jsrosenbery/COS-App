document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  let currentData = [];
  const container = document.getElementById('schedule-container');
  const table = document.getElementById('schedule-table');
  const tabs = document.getElementById('term-tabs');
  const uploadDiv = document.getElementById('upload-container');
  const roomDiv = document.getElementById('room-filter');

  // create tabs
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
    document.getElementById('file-input').addEventListener('change', e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
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
    document.getElementById('room-select').onchange = renderSchedule;
  }

  function clearSchedule() {
    table.innerHTML = '';
    container.querySelectorAll('.class-block').forEach(e => e.remove());
    // build background grid
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    ['Monday','Tuesday','Wednesday','Thursday','Friday'].forEach(d => {
      header.insertCell().outerHTML = `<th>${d}</th>`;
    });
    for (let t = 360; t <= 1320; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t % 60;
      const h12 = ((hh + 11) % 12 + 1);
      const ampm = hh < 12 ? 'AM' : 'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ampm}</th>`;
      for (let i = 0; i < 5; i++) {
        row.insertCell();
      }
    }
  }

  function renderSchedule() {
    clearSchedule();
    // overlay blocks
    const filtered = (document.getElementById('room-select') ?
      currentData.filter(i => document.getElementById('room-select').value === 'All' ||
        `${i.Building}-${i.Room}` === document.getElementById('room-select').value)
      : currentData);
    const eventsByDay = {};
    ['Monday','Tuesday','Wednesday','Thursday','Friday'].forEach(day => {
      eventsByDay[day] = filtered
        .filter(i => i.Days.includes(day))
        .map(i => Object.assign({}, i, {
          startMin: parseTime(i.Start_Time),
          endMin: parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);
    });

    Object.keys(eventsByDay).forEach((day, dIdx) => {
      const evs = eventsByDay[day];
      const columns = [];
      evs.forEach(ev => {
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
      const totalCols = columns.length;
      columns.flat().forEach(ev => {
        const block = document.createElement('div');
        block.className = 'class-block';
        block.innerHTML = `<strong>${ev.Subject_Course} - ${ev.CRN}</strong><br>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}`;
        // position
        const topPct = ((ev.startMin - 360) / 960) * 100;
        const heightPct = ((ev.endMin - ev.startMin) / 960) * 100;
        const leftPct = (dIdx / 5) * 100 + (ev.col * (100 / 5 / totalCols));
        const widthPct = 100 / 5 / totalCols;
        block.style.top = topPct + '%';
        block.style.height = heightPct + '%';
        block.style.left = leftPct + '%';
        block.style.width = widthPct + '%';
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
