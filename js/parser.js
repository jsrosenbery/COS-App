export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data
          .filter(r => r['ROOM'] && !['', 'N/A', 'LIVE'].includes((r['ROOM']||'').toUpperCase()))
          .filter(r => !(r['BUILDING'] && r['BUILDING'].toUpperCase() === 'ONLINE'))
          .map(r => ({
            Building: r['BUILDING'] || '',
            Room: r['ROOM'] || '',
            Days: (r['DAYS'] || '').split('').map(d => ({'M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','U':'Sunday','S':'Saturday'})[d]||d),
            Start_Time: r['Time']?.split('-')[0].trim() || '',
            End_Time: r['Time']?.split('-')[1].trim() || '',
            Start_Date: r['Start_Date'] || '',
            End_Date: r['End_Date'] || '',
            Instructor: r['Instructor'] || '',
            Campus: r['CAMPUS'] || ''
          }));
        resolve(data);
      },
      error: (err) => reject(err)
    });
  });
}
