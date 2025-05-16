document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [], currentTerm = '';

  const tabs = document.getElementById('term-tabs');
  const uploadDiv = document.getElementById('upload-container');
  const tsDiv = document.getElementById('upload-timestamp');
  const roomDiv = document.getElementById('room-filter');
  const startSel = document.getElementById('avail-start');
  const endSel = document.getElementById('avail-end');
  const checkBtn = document.getElementById('avail-check-btn');
  const table = document.getElementById('schedule-table');
  const container = document.getElementById('schedule-container');

  // Create term tabs
  terms.forEach((term,idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx===2?' active':'');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term,tab);
    tabs.appendChild(tab);
  });
  selectTerm(terms[2], tabs.children[2]);

  // Populate availability times
  for(let m=360;m<=22*60;m+=5){
    const h=Math.floor(m/60), mm=m%60;
    const ap=h<12?'AM':'PM';
    const h12=(h+11)%12+1;
    const label=`${h12}:${('0'+mm).slice(-2)} ${ap}`;
    startSel.innerHTML+=`<option>${label}</option>`;
    endSel.innerHTML+=`<option>${label}</option>`;
  }

  checkBtn.onclick = () => {
    const days = Array.from(document.querySelectorAll('#availability-ui input:checked')).map(cb=>cb.value);
    const start=startSel.value, end=endSel.value;
    if(!days.length||!start||!end){ alert('Select days and times.'); return; }
    const toMin = s => { const [time,ap]=s.split(' '); let [h,m]=time.split(':').map(Number); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h*60+m; };
    const sMin=toMin(start), eMin=toMin(end);
    const rooms=[...new Set(currentData.map(i=>`${i.Building}-${i.Room}`))];
    const occ=new Set();
    currentData.forEach(i=>{
      if(i.Days.some(d=>days.includes(d))){
        const si=parseTime(i.Start_Time), ei=parseTime(i.End_Time);
        if(!(ei<=sMin||si>=eMin)) occ.add(`${i.Building}-${i.Room}`);
      }
    });
    const avail=rooms.filter(r=>!occ.has(r));
    alert('Available rooms:\n'+(avail.length?avail.join(', '):'None'));
  };

  function selectTerm(term,tabElem){
    Array.from(tabs.children).forEach(t=>t.classList.remove('active'));
    tabElem.classList.add('active');
    currentTerm=term; tsDiv.textContent=''; currentData=[];
    setupUpload(); clearSchedule();
  }

  function setupUpload(){
    roomDiv.innerHTML='';
    uploadDiv.innerHTML=`<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e=>{
      parseCSVFile(e.target.files[0], data=>{
        currentData=data; tsDiv.textContent='Last upload: '+new Date().toLocaleString();
        buildRoomDropdown(); renderSchedule();
      });
    };
  }

  function buildRoomDropdown(){
    const combos=[...new Set(currentData.map(i=>`${i.Building}-${i.Room}`))].sort();
    roomDiv.innerHTML=`<label>Filter Bldg-Room: <select id="room-select"><option>All</option>${combos.map(r=>`<option>${r}</option>`).join('')}</select></label>`;
    document.getElementById('room-select').onchange=renderSchedule;
  }

  function clearSchedule(){
    table.innerHTML='';
    container.querySelectorAll('.class-block').forEach(e=>e.remove());
    const header=table.insertRow();
    header.insertCell().outerHTML='<th>Time</th>';
    daysOfWeek.forEach(d=>header.insertCell().outerHTML=`<th>${d}</th>`);
    for(let t=360;t<=22*60;t+=30){
      const row=table.insertRow();
      const hh=Math.floor(t/60),mm=t%60;
      const h12=(hh+11)%12+1, ap=hh<12?'AM':'PM';
      row.insertCell().outerHTML=`<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      for(let i=0;i<daysOfWeek.length;i++) row.insertCell();
    }
  }

  function renderSchedule(){
    clearSchedule();
    const filter=document.getElementById('room-select')?.value||'All';
    const data=filter==='All'?currentData:currentData.filter(i=>`${i.Building}-${i.Room}`===filter);
    const containerRect=container.getBoundingClientRect();
    daysOfWeek.forEach((day,dIdx)=>{
      const events=data.filter(i=>i.Days.includes(day)).map(i=>({...i,startMin:parseTime(i.Start_Time),endMin:parseTime(i.End_Time)})).sort((a,b)=>a.startMin-b.startMin);
      const columns=[];
      events.forEach(ev=>{
        let placed=false;
        for(let c=0;c<columns.length;c++){
          if(columns[c][columns[c].length-1].endMin<=ev.startMin){columns[c].push(ev);ev.col=c;placed=true;break;}
        }
        if(!placed){ev.col=columns.length;columns.push([ev]);}
      });
      const colCount=columns.length||1;
      columns.flat().forEach(ev=>{
        const rowIndex=Math.floor((ev.startMin-360)/30)+1;
        const cell=table.rows[rowIndex].cells[dIdx+1];
        const cellRect=cell.getBoundingClientRect();
        const topPx=cellRect.top-containerRect.top;
        const leftPx=cellRect.left-containerRect.left;
        const widthPx=cellRect.width/colCount;
        const heightPx=((ev.endMin-ev.startMin)/30)*cellRect.height;
        const block=document.createElement('div');
        block.className='class-block';
        block.style.top=topPx+'px';
        block.style.left=(leftPx+ev.col*widthPx)+'px';
        block.style.width=widthPx+'px';
        block.style.height=heightPx+'px';
        block.innerHTML=`<span>${ev.Subject_Course}</span><br><span>${ev.CRN}</span><br><span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span>`;
        container.appendChild(block);
      });
    });
  }

  function parseTime(t){const [h,m]=t.split(':').map(Number);return h*60+m;}
  function format12(t){let [h,m]=t.split(':').map(Number);const ap=h<12?'AM':'PM';h=(h+11)%12+1;return`${h}:${('0'+m).slice(-2)}${ap}`;}
});
