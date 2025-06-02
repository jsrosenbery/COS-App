// app.js
import { termDefinitions } from './termDefinitions.js';
const { parse, format, addDays, startOfWeek, addWeeks, subWeeks } = dateFns;

let currentTerm = '';
let parsedRowsPerTerm = {};
let allEvents = [];
let currentSunday = null;

document.addEventListener('DOMContentLoaded', () => {
  initTermTabs();
  initViewButtons();
  initAvailability();
  initHeatmapTool();
  setupUploadListener();
  const firstTerm = Object.keys(termDefinitions)[0];
  if (firstTerm) selectTerm(firstTerm);
});

// Term Tabs
function initTermTabs() {
  const tabs = document.getElementById('term-tabs');
  tabs.innerHTML = '';
  Object.keys(termDefinitions).forEach(term => {
    const btn = document.createElement('button');
    btn.textContent = readableName(term);
    btn.dataset.term = term;
    btn.addEventListener('click', () => selectTerm(term));
    tabs.appendChild(btn);
  });
}

function readableName(key) {
  const season = key.slice(0, 2);
  const year = '20' + key.slice(2);
  if (season === 'SU') return 'Summer ' + year;
  if (season === 'FA') return 'Fall ' + year;
  if (season === 'SP') return 'Spring ' + year;
  return key;
}

function selectTerm(term) {
  currentTerm = term;
  document.querySelectorAll('#term-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.term === term);
  });
  if (parsedRowsPerTerm[term]) {
    allEvents = buildEvents(parsedRowsPerTerm[term], term);
    currentSunday = getTermSunday(term);
    renderWeeklyGrid();
    feedHeatmapTool(parsedRowsPerTerm[term]);
    generateConflictReport(parsedRowsPerTerm[term]);
  } else {
    document.getElementById('schedule-table').innerHTML = '';
    document.getElementById('currentWeekLabel').textContent = '';
    allEvents = [];
  }
}

function getTermSunday(term) {
  const ts = parse(termDefinitions[term].start, 'yyyy-MM-dd', new Date());
  return startOfWeek(ts, { weekStartsOn: 0 });
}

// Build Events
function buildEvents(rows, term) {
  const t = termDefinitions[term];
  const termStart = parse(t.start, 'yyyy-MM-dd', new Date());
  const termEnd = parse(t.end, 'yyyy-MM-dd', new Date());
  const holidays = t.holidays.map(d => parse(d, 'yyyy-MM-dd', new Date()));
  return rows.flatMap(r => {
    const rs = parse(r.Start_Date, 'MM/dd/yyyy', new Date());
    const re = parse(r.End_Date, 'MM/dd/yyyy', new Date());
    const start = rs > termStart ? rs : termStart;
    const end = re < termEnd ? re : termEnd;
    const evs = [];
    let cur = start;
    while (cur <= end) {
      const dn = format(cur, 'EEEE');
      const isHol = holidays.some(h => format(h, 'yyyy-MM-dd') === format(cur, 'yyyy-MM-dd'));
      if (r.DAYS.includes(dn) && !isHol) {
        evs.push({
          date: format(cur, 'yyyy-MM-dd'),
          dayName: dn,
          startTime: r.Start_Time,
          endTime: r.End_Time,
          course: r.Subject_Course,
          building: r.BUILDING,
          room: r.ROOM,
          instructor: r.Instructor
        });
      }
      cur = addDays(cur, 1);
    }
    return evs;
  });
}

// Calendar Rendering
function renderWeeklyGrid() {
  const table = document.getElementById('schedule-table');
  table.innerHTML = '';
  const thead = table.createTHead();
  const hr = thead.insertRow();
  hr.insertCell().textContent = '';
  for (let i = 0; i < 7; i++) {
    const dt = addDays(currentSunday, i);
    const cell = hr.insertCell();
    const ds = format(dt, 'EEE MM/dd');
    if (termDefinitions[currentTerm].holidays.includes(format(dt, 'yyyy-MM-dd'))) cell.classList.add('holiday-header');
    cell.textContent = ds;
  }
  const tbody = table.createTBody();
  for (let h = 6; h <= 22; h++) {
    const row = tbody.insertRow();
    const label = row.insertCell();
    const ap = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    label.textContent = `${hh} ${ap}`;
    for (let d = 0; d < 7; d++) {
      const cell = row.insertCell();
      const dateStr = format(addDays(currentSunday, d), 'yyyy-MM-dd');
      cell.dataset.date = dateStr;
      cell.dataset.hour = h;
      cell.classList.add('time-cell');
      if (termDefinitions[currentTerm].holidays.includes(dateStr)) cell.classList.add('holiday-cell');
    }
  }
  allEvents.forEach(ev => {
    const ed = parse(ev.date, 'yyyy-MM-dd', new Date());
    const di = ed.getDay();
    const [st] = ev.startTime.split(' ');
    const sh = (parseInt(st.split(':')[0]) % 12) + (ev.startTime.includes('PM') && !st.startsWith('12') ? 12 : 0);
    const ri = sh - 6;
    const cell = document.querySelector(`#schedule-table tbody tr:nth-child(${ri+1}) td:nth-child(${di+2})`);
    if (cell && !cell.classList.contains('holiday-cell')) {
      const div = document.createElement('div');
      div.classList.add('event-block');
      div.textContent = ev.course;
      div.title = `${ev.course} | ${ev.building} ${ev.room} | ${ev.startTime}-${ev.endTime}`;
      cell.appendChild(div);
    }
  });
  document.getElementById('currentWeekLabel').textContent = `Week of ${format(currentSunday, 'MM/dd/yyyy')}`;
  document.getElementById('prevWeek').onclick = () => { currentSunday = subWeeks(currentSunday, 1); renderWeeklyGrid(); };
  document.getElementById('nextWeek').onclick = () => { currentSunday = addWeeks(currentSunday, 1); renderWeeklyGrid(); };
}

// View Buttons
function initViewButtons() {
  document.getElementById('btnCalendar').addEventListener('click', () => {
    document.getElementById('calendar-view').style.display = 'block';
    document.getElementById('heatmap-tool').style.display = 'none';
    document.getElementById('conflict-report').style.display = 'none';
    toggleActive('btnCalendar');
  });
  document.getElementById('btnHeatmap').addEventListener('click', () => {
    document.getElementById('calendar-view').style.display = 'none';
    document.getElementById('heatmap-tool').style.display = 'block';
    document.getElementById('conflict-report').style.display = 'none';
    toggleActive('btnHeatmap');
  });
  document.getElementById('btnConflicts').addEventListener('click', () => {
    document.getElementById('calendar-view').style.display = 'none';
    document.getElementById('heatmap-tool').style.display = 'none';
    document.getElementById('conflict-report').style.display = 'block';
    toggleActive('btnConflicts');
  });
}

function toggleActive(id) {
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.id === id);
  });
}

// CSV Upload Listener
function setupUploadListener() {
  document.getElementById('csvInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !currentTerm) return;
    parseCSVFile(file, parsed => {
      parsedRowsPerTerm[currentTerm] = parsed;
      allEvents = buildEvents(parsed, currentTerm);
      currentSunday = getTermSunday(currentTerm);
      renderWeeklyGrid();
      feedHeatmapTool(parsed);
      generateConflictReport(parsed);
      document.getElementById('upload-timestamp').textContent = 'Last uploaded: ' + new Date().toLocaleString();
    });
  });
}

// Availability
function initAvailability() {
  document.getElementById('avail-check-btn').addEventListener('click', () => {
    const sDays = Array.from(document.querySelectorAll('#availability-ui input[type="checkbox"]:checked')).map(cb => cb.value);
    const sTime = document.getElementById('avail-start').value;
    const eTime = document.getElementById('avail-end').value;
    const occ = new Set();
    Object.values(parsedRowsPerTerm).flat().forEach(ev => {
      if (ev.DAYS.some(d => sDays.includes(d)) && ev.Start_Time < eTime && ev.End_Time > sTime) occ.add(ev.ROOM);
    });
    const allRooms = Array.from(new Set(Object.values(parsedRowsPerTerm).flat().map(r => r.ROOM)));
    const avail = allRooms.filter(rm => !occ.has(rm)).sort();
    const res = document.getElementById('avail-results');
    res.innerHTML = '';
    if (avail.length === 0) res.textContent = 'No rooms available.'; else {
      const ul = document.createElement('ul');
      avail.forEach(rm => { const li = document.createElement('li'); li.textContent = rm; ul.appendChild(li); });
      res.appendChild(ul);
    }
  });
  document.getElementById('avail-clear-btn').addEventListener('click', () => {
    document.querySelectorAll('#availability-ui input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('avail-start').value = '';
    document.getElementById('avail-end').value = '';
    document.getElementById('avail-results').innerHTML = '';
  });
}

// Heatmap & Table
const dayMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const hrs = Array.from({length:17},(_,i)=>i+6);
let heatData = [];
let dtInstance;
let choiceInst;

function initHeatmapTool() {
  choiceInst = new Choices('#courseSelect',{removeItemButton:true,searchEnabled:true,placeholderValue:'Filter by discipline/course'});
  dtInstance = $('#dataTable').DataTable({data:[],columns:[{title:'Course'},{title:'Building'},{title:'Room'},{title:'Days'},{title:'Time'}],destroy:true,searching:true});
  dtInstance.on('search.dt', updateHeatmap);
}

function feedHeatmapTool(rows) {
  heatData = rows.map(r => {
    const parts = r.Subject_Course.trim().split(/\s+/);
    const key = parts.length>=2?parts[0]+' '+parts[1]:r.Subject_Course.trim();
    return {key,BUILDING:r.BUILDING.trim(),ROOM:r.ROOM.trim(),DAYS:r.DAYS.map(d=>d.charAt(0)).join(''),Time:`${r.Start_Time} - ${r.End_Time}`};
  });
  const keys = Array.from(new Set(heatData.map(d=>d.key))).sort(); const choices = keys.map(k=>({value:k,label:k}));
  choiceInst.setChoices(choices,'value','label',true);
  updateAllHeatmapViews();
}

function updateAllHeatmapViews() {
  const sel = choiceInst.getValue(true);
  const rows = heatData.filter(r => {
    if (sel.length && !sel.includes(r.key)) return false;
    const b = r.BUILDING.toUpperCase(), rm = r.ROOM.toUpperCase();
    if (!b || !rm || b==='N/A'||rm==='N/A'||b==='ONLINE') return false;
    const m = r.Time.match(/(\d+):(\d+)\s*(AM|PM)/); if (!m) return false;
    const h = (parseInt(m[1])%12) + (m[3]==='PM'?12:0);
    return h>=6 && h<=22;
  }).map(r => [r.key, r.BUILDING, r.ROOM, r.DAYS, r.Time]);
  dtInstance.clear().rows.add(rows).draw();
}

function updateHeatmap() {
  const fil = dtInstance.rows({search:'applied'}).data().toArray();
  const cnts = {}; days.forEach(d=>cnts[d]=hrs.map(()=>0));
  fil.forEach(([course,bld,rm,daysStr,timeStr]) => {
    const dcs = daysStr.split('');
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/); if (!m) return;
    const h = (parseInt(m[1])%12) + (m[3]==='PM'?12:0);
    dcs.forEach(dc => { const dn = dayMap[dc]; const idx = hrs.indexOf(h); if (dn && idx>=0) cnts[dn][idx]++; });
  });
  const maxv = Math.max(...Object.values(cnts).flat());
  let html = `<table class="heatmap"><thead><tr><th>Day/Time</th>`;
  hrs.forEach(h => { const ap = h<12?'AM':'PM'; const hh = h%12===0?12:h%12; html += `<th>${hh} ${ap}</th>`; });
  html += `</tr></thead><tbody>`;
  days.forEach(d => { html += `<tr><th>${d}</th>`; cnts[d].forEach(c => { const op = maxv?c/maxv:0; html += `<td style="background: rgba(0,100,200,${op});">${c}</td>`; }); html += `</tr>`; });
  html += `</tbody></table>`;
  document.getElementById('heatmapContainer').innerHTML = html;
}

// Conflict Detection
function generateConflictReport(rows) {
  const confs = [];
  for (let i=0; i<rows.length; i++) {
    for (let j=i+1; j<rows.length; j++) {
      const r1=rows[i], r2=rows[j];
      if (r1.ROOM !== r2.ROOM) continue;
      const [s1,e1] = [new Date(r1.Start_Date), new Date(r1.End_Date)];
      const [s2,e2] = [new Date(r2.Start_Date), new Date(r2.End_Date)];
      if (s1 > e2 || s2 > e1) continue;
      const cd = r1.DAYS.filter(d => r2.DAYS.includes(d));
      if (cd.length===0) continue;
      const [st1,en1] = [timeToMins(r1.Start_Time), timeToMins(r1.End_Time)];
      const [st2,en2] = [timeToMins(r2.Start_Time), timeToMins(r2.End_Time)];
      if (st1 < en2 && st2 < en1) confs.push({r1,r2,cd});
    }
  }
  const cont = document.getElementById('conflictResults');
  cont.innerHTML = '';
  if (confs.length===0) { cont.textContent = 'No conflicts detected.'; return; }
  confs.forEach(conf => {
    const p = document.createElement('p');
    p.innerHTML = `<strong>Room ${conf.r1.ROOM}</strong> conflict on ${conf.cd.join(', ')}:<br>
      • ${conf.r1.Subject_Course} (${conf.r1.Start_Time}-${conf.r1.End_Time}, ${conf.r1.Start_Date} to ${conf.r1.End_Date})<br>
      • ${conf.r2.Subject_Course} (${conf.r2.Start_Time}-${conf.r2.End_Time}, ${conf.r2.Start_Date} to ${conf.r2.End_Date})`;
    cont.appendChild(p);
  });
}

function timeToMins(t) {
  const [time, mod] = t.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (mod === 'PM' && h < 12) h += 12;
  if (mod === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}
