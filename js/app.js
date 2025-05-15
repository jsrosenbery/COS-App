let currentData = [];
let roomList = [];
document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const tabs = document.getElementById('term-tabs');
  const uploadDiv = document.getElementById('upload-container');
  const roomDiv = document.getElementById('room-filter');
  const table = document.getElementById('schedule-table');
  const availBtn = document.getElementById('availability-btn');

  terms.forEach((term, idx) => {
    const d = document.createElement('div');
    d.className = 'tab' + (idx===2?' active':'');
    d.textContent = term;
    d.onclick = () => selectTerm(d);
    tabs.appendChild(d);
  });

  selectTerm();

  availBtn.onclick = () => alert('Room availability coming soon');

  function selectTerm() {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    setupUpload();
    buildRoomDropdown();
    buildEmptyGrid();
  }

  function setupUpload() {
    uploadDiv.innerHTML = '<label>Upload CSV: <input type="file" id="file-input" accept=".csv"></label>';
    document.getElementById('file-input').addEventListener('change', e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        buildRoomList();
        populateRoomDropdown();
        renderSchedule(data);
      });
    });
  }

  function buildRoomList() {
    const combos = currentData.map(i => `${i.Building}-${i.Room}`);
    roomList = Array.from(new Set(combos)).sort();
  }

  function buildRoomDropdown() {
    roomDiv.innerHTML = '<label>Filter Bldg-Room: <select id="room-select"><option>All</option></select></label>';
    document.getElementById('room-select').addEventListener('change', () => {
      const sel = document.getElementById('room-select').value;
      renderSchedule(currentData.filter(i => sel==='All' || `${i.Building}-${i.Room}`===sel));
    });
  }

  function populateRoomDropdown() {
    const sel = document.getElementById('room-select');
    sel.innerHTML = '<option>All</option>' + roomList.map(r=>`<option>${r}</option>`).join('');
  }

  function buildEmptyGrid() {
    table.innerHTML = '';
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    ['Monday','Tuesday','Wednesday','Thursday','Friday'].forEach(h=>header.insertCell().outerHTML=`<th>${h}</th>`);
    for (let t=360; t<=1320; t+=30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm=t%60;
      const h12 = ((hh+11)%12+1), ampm=hh<12?'AM':'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ampm}</th>`;
      for (let i=0;i<5;i++) row.insertCell().textContent='';
    }
  }

  function renderSchedule(data) {
    buildEmptyGrid();
    data.forEach(item => {
      item.Days.forEach(day => {
        const idx = ['Monday','Tuesday','Wednesday','Thursday','Friday'].indexOf(day);
        if (idx<0) return;
        const [sh,sm]=item.Start_Time.split(':').map(Number);
        const [eh,em]=item.End_Time.split(':').map(Number);
        const startMin = sh*60+sm, endMin = eh*60+em;
        const rowStart = Math.floor((startMin-360)/30)+1;
        const span = Math.ceil((endMin-startMin)/30);
        const row = table.rows[rowStart];
        if (!row) return;
        const cell = row.cells[idx+1];
        const block = document.createElement('div');
        block.className='class-block';
        block.innerHTML=`<strong>${item.Subject_Course} - ${item.CRN}</strong><br>${format12(item.Start_Time)} - ${format12(item.End_Time)}`;
        cell.style.position='relative';
        block.style.position='absolute';
        block.style.top='0';
        block.style.width='100%';
        block.style.height=`${span * 100}%`;
        cell.appendChild(block);
      });
    });
  }

  function format12(t24) {
    let [h,m]=t24.split(':').map(Number);
    const ap = h<12?'AM':'PM';
    h = ((h+11)%12+1);
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }
});
