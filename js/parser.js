// parser.js
function parseCSVFile(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data
        .filter(r => r['ROOM'] && !['', 'N/A', 'LIVE'].includes(r['ROOM'].toUpperCase()))
        .filter(r => !(r['BUILDING'] && r['BUILDING'].toUpperCase() === 'ONLINE'))
        .map(r => {
          const daysMap = {'M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','U':'Sunday','S':'Saturday'};
          const dayCodes = (r.DAYS||'').split('');
          const days = dayCodes.map(dc => daysMap[dc] || '');
          return {
            Subject_Course: r.Subject_Course,
            BUILDING:       r.BUILDING,
            ROOM:           r.ROOM,
            DAYS:           days,
            Start_Date:     r.Start_Date,
            End_Date:       r.End_Date,
            Start_Time:     r.Start_Time,
            End_Time:       r.End_Time
          };
        });
      callback(data);
    }
  });
}
