// js/parser.js

// Parses a CSV file (via PapaParse) into an array of row-objects
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}

// Normalizes raw rows into the format your schedule logic expects
function normalizeRows(rows) {
  const dayMap = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', R: 'Thursday', F: 'Friday', S: 'Saturday', U: 'Sunday' };
  return rows
    .filter(r => r.ROOM && !['', 'N/A', 'LIVE'].includes(r.ROOM.toUpperCase()))
    .filter(r => !(r.BUILDING && r.BUILDING.toUpperCase() === 'ONLINE'))
    .map(r => {
      const days = (r.DAYS || '').split('').map(d => dayMap[d] || d);
      const [start, end] = (r.Time || '').split('-').map(t => t.trim());
      return {
        Building: r.BUILDING || '',
        Room: r.ROOM || '',
        Days: days,
        Start_Time: start || '',
        End_Time: end || '',
        Start_Date: r.Start_Date || '',
        End_Date: r.End_Date || '',
        CRN: r.CRN || '',
        SUBJECT: r.SUBJECT || '',
        COURSE: r.COURSE || ''
      };
    });
}

// Expose globally for your app.js to call
window.parseCSVFile = parseCSVFile;
window.normalizeRows = normalizeRows;
