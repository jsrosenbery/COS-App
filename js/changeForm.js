// js/changeForm.js
(function(){
  // Uses globals from app.js: hmRaw or normalized data array. If you have a single
  // normalized array elsewhere, expose it to window.currentData after parsing.
  const $ = (id) => document.getElementById(id);

  const campusByBuilding = {
    // Add your mapping if desired; fallback will leave selection unchanged.
    // e.g. 'CEDAR':'VISALIA','HOSPRK':'VISALIA','TULAREA':'TULARE','HANF':'HANFORD'
  };

  function fmtDays(arr){ return Array.isArray(arr) ? arr.join(' / ') : String(arr||''); }
  function fmtTimes(row){ 
    const s = row.Start_Time || ''; const e = row.End_Time || '';
    return (s && e) ? `${s}–${e}` : (s || e || '');
  }
  function toMMDD(d){
    if(!d) return '';
    // expects YYYY-MM-DD
    const [Y,M,D] = d.split('-'); return `${M}/${D}`;
  }
  function weekCount(startISO, endISO){
    if(!startISO || !endISO) return '';
    const a = new Date(startISO), b = new Date(endISO);
    const ms = Math.max(0, b - a);
    return Math.max(1, Math.round(ms / (7*24*3600*1000)));
  }
  function findCapacity(building, room){
    if(!window.roomList) return '';
    const hit = window.roomList.find(r => r.building?.toUpperCase()===String(building||'').toUpperCase()
                                      && String(r.room||'').toUpperCase()===String(room||'').toUpperCase());
    return hit?.cap ?? '';
  }

  async function fillFromCRN(){
    const crn = $('cos-crn-input').value.trim();
    if(!crn) return;

    // Prefer a normalized data array if you have one set:
    const rows = (window.currentData && window.currentData.length) ? window.currentData : (window.hmRaw || []);
    // try both normalized keys and raw keys
    const match = rows.find(r => String(r.CRN||r.crn||'').trim() === crn);
    if(!match) {
      alert('CRN not found in loaded data.');
      return;
    }

    // Extract
    const subj = match.SUBJECT || match.Subject || '';
    const course = match.COURSE || match.Course || '';
    const building = match.Building || match.BUILDING || '';
    const room = match.Room || match.ROOM || '';
    const days = match.Days || match.DAYS || '';
    const start = match.Start_Date || match.Start || match.Start_Date_ISO || '';
    const end   = match.End_Date || match.End || match.End_Date_ISO || '';
    const units = match.Units || match.UNITS || ''; // will be empty unless your CSV includes it

    // Fill fields
    $('f-crn').value = crn;
    $('f-subjcourse').value = [subj, course].filter(Boolean).join(' ');
    $('f-building').value = building;
    $('f-room').value = room;
    $('f-days').value = Array.isArray(days) ? fmtDays(days) : String(days||'');
    $('f-times').value = fmtTimes(match);
    $('f-shortdates').value = [toMMDD(start), toMMDD(end)].filter(Boolean).join('–');
    $('f-weeks').value = weekCount(start, end);
    $('f-units').value = units || ''; // stays blank if not in data
    $('f-capacity').value = findCapacity(building, room);

    // Campus (optional heuristic)
    const campusGuess = campusByBuilding[String(building||'').toUpperCase()];
    if(campusGuess) $('f-campus').value = campusGuess;

    // Year/Term guess from Start_Date
    if(start && start.split('-')[0]) $('f-year').value = start.split('-')[0];
    // You can set a smarter Term inference if needed.

    // visible default
    $('f-visible').value = 'YES';
  }

  function printForm(){
    // Quick, reliable print: use the panel itself
    window.print();
    // If you prefer a PDF, use html2canvas + jsPDF already loaded in index.html.
  }

// Hook up (defer until DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  const fillBtn  = document.getElementById('cos-crn-fill-btn');
  const printBtn = document.getElementById('cos-form-print-btn');
  if (fillBtn)  fillBtn.addEventListener('click', fillFromCRN);
  if (printBtn) printBtn.addEventListener('click', printForm);
});

