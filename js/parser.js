function parseCSVFile(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data
        .filter(r => r.ROOM && !['', 'N/A', 'LIVE'].includes(r.ROOM.toUpperCase()))
        .filter(r => !(r.BUILDING && r.BUILDING.toUpperCase() === 'ONLINE'))
        .map(r => {
          // split days into array
          const daysMap = {'M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday'};
          const daysArr = (r.DAYS||'').split('').map(d => daysMap[d]||d);
          // split time
          let [start, end] = (r.TIME||'').split(' - ').map(t => {
            let d = t.trim();
            const ampm = d.slice(-2);
            let [h, m] = d.slice(0,-2).split(':').map(x=>parseInt(x,10));
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return ('0'+h).slice(-2)+':'+('0'+m).slice(-2);
          });
          return {
            Subject_Course: r.Title || r.SUBJECT_COURSE || '',
            CRN: r.CRN,
            Building: r.BUILDING,
            Room: r.ROOM,
            Days: daysArr,
            Start_Time: start,
            End_Time: end,
            Start_Date: r.START_DATE || r.Start_Date || '',
            End_Date: r.END_DATE || r.End_Date || '',
            Instructor: r.INSTRUCTOR || r.Instructor || ''
          };
        });
      callback(data);
    }
  });
}
