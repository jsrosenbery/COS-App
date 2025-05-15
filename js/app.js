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
  
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

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
      
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

});
    
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

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
    const data = filter === 'All' ? currentData : currentData.filter(i => (i.Building + '-' + i.Room) === filter);
    daysOfWeek.forEach((day, dIdx) => {
      // Filter events for day
      const events = data.filter(i => i.Days.includes(day))
        .map(i => ({ ...i, startMin: parseTime(i.Start_Time), endMin: parseTime(i.End_Time) }))
        .sort((a, b) => a.startMin - b.startMin);
      // Column logic
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
      
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

});
      const colCount = columns.length || 1;
      columns.flat().forEach(ev => {
        const top = ((ev.startMin - 360) / (22*60 - 360)) * 100;
        const height = ((ev.endMin - ev.startMin) / (22*60 - 360)) * 100;
        const left = ((dIdx + 1) / (daysOfWeek.length + 1) * 100) + (ev.col * (100 / (daysOfWeek.length + 1) / colCount));
        const width = (100 / (daysOfWeek.length + 1) / colCount);
        const block = document.createElement('div');
        block.className = 'class-block';
        block.style.top = top + '%';
        block.style.left = left + '%';
        block.style.width = width + '%';
        block.style.height = height + '%';
        block.innerHTML = `<div style="text-align:center;">
<span>${ev.Subject_Course}</span><br>
<span>${ev.CRN}</span><br>
<span>${format12(ev.Start_Time).toLowerCase()} - ${format12(ev.End_Time).toLowerCase()}</span>
</div>`;
        container.appendChild(block);
      
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

});
    
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

});
  }

  function showAvailability() {
    if (!currentData.length) { alert('Upload schedule first'); return; }
    const day = prompt('Day (e.g. Monday):'); if (!day) return;
    const start = prompt('Start time (e.g. 10:00AM):'); if (!start) return;
    const end = prompt('End time (e.g. 12:00PM):'); if (!end) return;
    const toMin = s => { const ap=s.slice(-2).toUpperCase(); let [h,m]=s.slice(0,-2).split(':').map(Number); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h*60+m; };
    const sMin=toMin(start), eMin=toMin(end);
    const rooms = Array.from(new Set(currentData.map(i => i.Building + '-' + i.Room)));
    const occ = new Set();
    currentData.forEach(i => {
      if (i.Days.includes(day)) {
        const si=parseTime(i.Start_Time), ei=parseTime(i.End_Time);
        if (!(ei <= sMin || si >= eMin)) occ.add(i.Building + '-' + i.Room);
      }
    
document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

});
    const avail = rooms.filter(r => !occ.has(r));
    alert('Available rooms on ' + day + ' ' + start + '-' + end + ':\n' + (avail.length?avail.join(', '):'None'));
  }

  function parseTime(t) { const [h,m]=t.split(':').map(Number); return h*60 + m; }
  function format12(t) { let [h,m]=t.split(':').map(Number); const ap=h<12?'AM':'PM'; h=((h+11)%12)+1; return `${h}:${('0'+m).slice(-2)}${ap}`; }

document.getElementById('availability-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'block';
};

// Close modal logic
document.querySelector('.close-btn').onclick = () => {
  document.getElementById('availability-modal').style.display = 'none';
};
window.onclick = event => {
  if (event.target == document.getElementById('availability-modal')) {
    document.getElementById('availability-modal').style.display = 'none';
  }
};

// Populate time selects
function populateTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  for(let m=360;m<=1320;m+=5) {
    const h=Math.floor(m/60),min=m%60;
    const ap=h<12?'AM':'PM',h12=(h+11)%12+1;
    const time=`${('0'+h12).slice(-2)}:${('0'+min).slice(-2)}${ap}`;
    startSelect.innerHTML+=`<option>${time}</option>`;
    endSelect.innerHTML+=`<option>${time}</option>`;
  }
}
populateTimeSelects();

// Check availability
document.getElementById('check-availability-btn').onclick = () => {
  const selectedDays = [...document.querySelectorAll('#day-checkboxes input:checked')].map(cb=>cb.value);
  const start=document.getElementById('start-time').value;
  const end=document.getElementById('end-time').value;
  if(!selectedDays.length||!start||!end){alert('Please select days and times');return;}
  const sMin=toMin(start),eMin=toMin(end);
  const rooms=Array.from(new Set(currentData.map(i=>i.Building+'-'+i.Room)));
  const occ=new Set();
  currentData.forEach(i=>{
    selectedDays.forEach(day=>{
      if(i.Days.includes(day)){
        const si=parseTime(i.Start_Time),ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin))occ.add(i.Building+'-'+i.Room);
      }
    });
  });
  const avail=rooms.filter(r=>!occ.has(r));
  alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
};

function toMin(t) {
  const [time,ap]=[t.slice(0,-2),t.slice(-2)];
  let [h,m]=time.split(':').map(Number);
  if(ap=='PM'&&h<12)h+=12;if(ap=='AM'&&h==12)h=0;
  return h*60+m;
}

});
