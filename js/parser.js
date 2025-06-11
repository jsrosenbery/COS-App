function parseCSVFile(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data
        .filter(r => r['ROOM'] && !['', 'N/A', 'LIVE'].includes(r['ROOM'].toUpperCase()))
        .filter(r => !(r['BUILDING'] && r['BUILDING'].toUpperCase() === 'ONLINE'))
        .map(r => {
          const daysMap = { 'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 'R': 'Thursday', 'F': 'Friday', 'U': 'Sunday', 'S': 'Saturday' };
          const daysArr = (r['DAYS'] || '').split('').map(d => daysMap[d] || d);

          // Time parsing
          const timeStr = (r['Time'] || r['TIME'] || '').trim();
          const parts = timeStr.split('-').map(s => s.trim());
          let start24 = '00:00', end24 = '00:00';
          const to24 = (t) => {
            const m = t.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
            if (m) {
              let h = parseInt(m[1], 10);
              let min = m[2] ? parseInt(m[2], 10) : 0;
              const ap = m[3].toUpperCase();
              if (ap === 'PM' && h < 12) h += 12;
              if (ap === 'AM' && h === 12) h = 0;
              return (h < 10 ? '0' + h : h) + ':' + (min < 10 ? '0' + min : min);
            }
            return '00:00';
          };
          if (parts.length === 2) {
            start24 = to24(parts[0]);
            end24 = to24(parts[1]);
          }

          return {
            Subject_Course: r['Subject_Course'] || r['Title'] || '',
            CRN: r['CRN'],
            Building: r['BUILDING'],
            Room: r['ROOM'],
            Days: daysArr,
            Start_Time: start24,
            End_Time: end24,
            // Capture date fields
            Start_Date: r['Start_Date'] || r['Start Date'] || r['start_date'],
            End_Date: r['End_Date']   || r['End Date']   || r['end_date'],
            CAMPUS: r['CAMPUS'] || r['Campus'] || r['campus'] || ''
          };
        });
      callback(data);
    }
  });
}