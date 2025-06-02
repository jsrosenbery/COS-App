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
          const [startDate, endDate] = [r.Start_Date, r.End_Date];
          const timeParts = (r.Time || '').split('-').map(t => t.trim());
          const startTime = timeParts[0] || '';
          const endTime = timeParts[1] || '';
          return {
            Subject_Course: r.Subject_Course,
            BUILDING:       r.BUILDING,
            ROOM:           r.ROOM,
            DAYS:           days,
            Start_Date:     startDate,
            End_Date:       endDate,
            Start_Time:     startTime,
            End_Time:       endTime,
            Instructor:     r.Instructor || ''
          };
        });
      callback(data);
    }
  });
}
