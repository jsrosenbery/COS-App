// js/parser.js
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, { header: true, skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err)
    });
  });
}
function normalizeRows(rows) {
  const dayMap = { M:'Monday',T:'Tuesday',W:'Wednesday',R:'Thursday',F:'Friday',S:'Saturday',U:'Sunday' };
  return rows.map(r => ({
    Building: r.BUILDING, Room: r.ROOM,
    Days: (r.DAYS||'').split('').map(d=>dayMap[d]||d),
    Start_Time: r['Start_Time']||r['Time']?.split('-')[0]?.trim()||'',
    End_Time: r['End_Time']||r['Time']?.split('-')[1]?.trim()||'',
    CRN: r.CRN, SUBJECT: r.SUBJECT, COURSE: r.COURSE
  }));
}
window.parseCSVFile = parseCSVFile;
window.normalizeRows = normalizeRows;
