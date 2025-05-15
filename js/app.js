let currentData = [];
let rooms = [];
document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const tabContainer = document.getElementById('term-tabs');
  const uploadContainer = document.getElementById('upload-container');
  const roomFilter = document.getElementById('room-filter');
  const table = document.getElementById('schedule-table');
  const availabilityBtn = document.getElementById('availability-btn');

  terms.forEach((term,idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx===2?' active':'');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabContainer.appendChild(tab);
  });

  setupUpload();
  buildRoomDropdown();
  buildEmptyGrid();

  availabilityBtn.onclick = () => showAvailability();

  function selectTerm(term, tab) {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    setupUpload();
    buildEmptyGrid();
  }

  function setupUpload() {
    uploadContainer.innerHTML = '<label>Upload CSV: <input type="file" id="file-input" accept=".csv"></label>';
    document.getElementById('file-input').addEventListener('change', e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        collectRooms(data);
        populateRoomDropdown();
        renderSchedule(data);
      });
    });
  }

  function collectRooms(data) {
    rooms = Array.from(new Set(data.map(i=>i.Room))).sort();
  }

  function buildRoomDropdown() {
    roomFilter.innerHTML = '<label>Filter by Room: <select id="room-select"><option>All</option></select></label>';
    document.getElementById('room-select').addEventListener('change', () => {
      const sel = document.getElementById('room-select').value;
      renderSchedule(currentData.filter(i => sel==='All' || i.Room===sel));
    });
  }

  function populateRoomDropdown() {
    const sel = document.getElementById('room-select');
    sel.innerHTML = '<option>All</option>' + rooms.map(r=>`<option>${r}</option>`).join('');
  }

  function buildEmptyGrid() {
    table.innerHTML = '';
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    ['Monday','Tuesday','Wednesday','Thursday','Friday'].forEach(d=>header.insertCell().outerHTML=`<th>${d}</th>`);
    const start=6*60,end=22*60;
    for(let t=start; t<=end; t+=30) {
      const row = table.insertRow();
      const hh = t/60|0, mm=t%60;
      const ap = hh<12?'AM':'PM', h12 = ((hh+11)%12+1);
      row.insertCell().outerHTML=`<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      for(let i=0;i<5;i++) row.insertCell().textContent='';
    }
  }

  function renderSchedule(data) {
    buildEmptyGrid();
    data.forEach(item => {
      item.Days.forEach(day => {
        const dIdx=['Monday','Tuesday','Wednesday','Thursday','Friday'].indexOf(day);
        if(dIdx<0) return;
        const [sh,sm]=item.Start_Time.split(':').map(Number);
        const [eh,em]=item.End_Time.split(':').map(Number);
        const startMin=sh*60+sm, endMin=eh*60+em;
        const rowStart=(Math.floor((startMin-6*60)/30)+1);
        const rowSpan=Math.ceil((endMin-startMin)/30);
        const row=table.rows[rowStart];
        if(!row) return;
        const cell=row.cells[dIdx+1];
        const div=document.createElement('div');
        div.className='class-block';
        // time only inside block
        div.innerHTML=`<strong>${item.Subject_Course} (${item.CRN})</strong><br>${format12(item.Start_Time)} - ${format12(item.End_Time)}`;
        div.style.gridRow=`span ${rowSpan}`;
        if(cell.children.length) {
          // overlapping: share width
          cell.style.display='flex';
          div.style.flex='1';
        }
        cell.appendChild(div);
      });
    });
  }

  function format12(t24) {
    let [h,m]=t24.split(':').map(Number);
    const ap=h<12?'AM':'PM';
    h=((h+11)%12+1);
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }

  function showAvailability() {
    if(!currentData.length) return alert('Upload schedule first.');
    const day=prompt('Day (e.g. Monday):');
    const start=prompt('Start (HH:MMAM/PM):');
    const end=prompt('End (HH:MMAM/PM):');
    const toMin=s=>{const m=(s.slice(-2)); let [h,mm]=s.slice(0,-2).split(':').map(Number); if(m==='PM'&&h<12)h+=12; if(m==='AM'&&h===12)h=0; return h*60+mm;};
    const sMin=toMin(start), eMin=toMin(end);
    const roomsAll = Array.from(new Set(currentData.map(i=>i.Room)));
    const occupied=new Set();
    currentData.forEach(i=>{
      if(i.Days.includes(day)) {
        const si=toMin(format12To24(i.Start_Time)), ei=toMin(format12To24(i.End_Time));
        if(!(ei<=sMin||si>=eMin)) occupied.add(i.Room);
      }
    });
    const avail = roomsAll.filter(r=>!occupied.has(r));
    alert(`Available rooms on ${day} ${start}-${end}:\n` + avail.join(', '));
  }

  function format12To24(t12) {
    let [h,rest]=t12.split(':'); const ap=rest.slice(-2); let m=rest.slice(0,-2);
    h=Number(h); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;
    return ('0'+h).slice(-2)+':'+m;
  }
});
