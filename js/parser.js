function parseCSVFile(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data
        .filter(r => r['ROOM'] && !['', 'N/A', 'LIVE'].includes(r['ROOM'].toUpperCase()))
        .filter(r => !(r['BUILDING'] && r['BUILDING'].toUpperCase() === 'ONLINE'))
        .map(r => {
          const daysMap = {'M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday'};
          const daysArr = (r['DAYS']||'').split('').map(d => daysMap[d]||d);
          // split time into start/end
          const rawTime = r['Time'] || r['TIME'] || '';
          const parts = rawTime.split(' - ');
          let start24 = '00:00', end24 = '00:00';
          if (parts.length === 2) {
            ['start','end'].forEach((t, i) => {
              let str = parts[i].trim();
              const ampm = str.slice(-2);
              let [h, m] = str.slice(0,-2).split(':').map(x => parseInt(x,10));
              if (ampm === 'PM' && h < 12) h += 12;
              if (ampm === 'AM' && h === 12) h = 0;
              const hh = ('0'+h).slice(-2), mm = ('0'+m).slice(-2);
              if (t==='start') start24 = `${hh}:${mm}`; else end24 = `${hh}:${mm}`;
            });
          }
          return {
            Subject_Course: r['Title'] || r['Subject_Course'] || '',
            CRN: r['CRN'],
            Building: r['BUILDING'],
            Room: r['ROOM'],
            Days: daysArr,
            Start_Time: start24,
            End_Time: end24
          };
        });
      callback(data);
    }
  });
}
