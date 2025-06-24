// parser.js
// Parses raw CSV file and normalizes parsed rows

function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);  // return raw rows
      },
      error: (err) => reject(err)
    });
  });
}

// Normalize raw rows (from CSV or server) into app data
function normalizeRows(rows) {
  // Map days shorthand to full names
  const dayMap = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', R: 'Thursday', F: 'Friday', S: 'Saturday', U: 'Sunday' };
  return rows
    .filter(r => r.ROOM && !['', 'N/A', 'LIVE'].includes(r.ROOM.toUpperCase()))
    .filter(r => !(r.BUILDING && r.BUILDING.toUpperCase() === 'ONLINE'))
    .map(r => {
      const days = (r.DAYS || '').split('').map(d => dayMap[d] || d);
      const timeParts = (r.Time || '').split('-');
      return {
        Building: r.BUILDING || '',
        Room: r.ROOM || '',
        Days: days,
        Start_Time: timeParts[0]?.trim() || '',
        End_Time: timeParts[1]?.trim() || '',
        Start_Date: r.Start_Date || '',
        End_Date: r.End_Date || '',
        CRN: r.CRN || '',
        SUBJECT: r.SUBJECT || '',
        COURSE: r.COURSE || ''
      };
    });
}

// Expose functions globally
window.parseCSVFile = parseCSVFile;
window.normalizeRows = normalizeRows;
