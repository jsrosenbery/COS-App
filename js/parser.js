// parser.js
// Parses raw CSV file and normalizes parsed rows
export function parseCSVFile(file) {
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
const dayMap = {
  'M': 'Monday','T': 'Tuesday','W': 'Wednesday','R': 'Thursday',
  'F': 'Friday','U': 'Sunday','S': 'Saturday'
};
export function normalizeRows(rows) {
  return rows
    .filter(r => r.ROOM && !['', 'N/A', 'LIVE'].includes(r.ROOM.toUpperCase()))
    .filter(r => !(r.BUILDING && r.BUILDING.toUpperCase()==='ONLINE'))
    .map(r => ({
      Building: r.BUILDING || '',
      Room: r.ROOM || '',
      Days: (r.DAYS||'').split('').map(d=>dayMap[d]||d),
      Start_Time: r.Time?.split('-')[0].trim()||'',
      End_Time:   r.Time?.split('-')[1].trim()||'',
      Start_Date: r.Start_Date||'',
      End_Date:   r.End_Date||'',
      CRN:        r.CRN||'',
      SUBJECT:    r.SUBJECT||'',
      COURSE:     r.COURSE||''
    }));
}
