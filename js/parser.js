function parseCSVFile(file, callback) {
  Papa.parse(file, { header:true, skipEmptyLines:true,
    complete: results => {
      const data = results.data
        .filter(r => r['ROOM'] && !['', 'N/A', 'LIVE'].includes(r['ROOM'].toUpperCase()))
        .filter(r => !(r['BUILDING'] && r['BUILDING'].toUpperCase()==='ONLINE'))
        .map(r => {
          const daysMap={'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
          const daysArr=(r['DAYS']||'').split('').map(d=>daysMap[d]||d);
          const raw=r['Time']||r['TIME']||''; const parts=raw.split(' - ');
          let s='00:00',e='00:00';
          if(parts.length===2){
            ['start','end'].forEach((t,i)=>{
              let str=parts[i].trim(); const ap=str.slice(-2);
              let [h,m]=str.slice(0,-2).split(':').map(Number);
              if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;
              const hh=('0'+h).slice(-2), mm=('0'+m).slice(-2);
              if(t==='start')s=`${hh}:${mm}`; else e=`${hh}:${mm}`;
            });
          }
          return { Subject_Course:r['Subject_Course']||r['Title']||'', CRN:r['CRN'],
                   Building:r['BUILDING'], Room:r['ROOM'], Days:daysArr, Start_Time:s, End_Time:e };
        });
      callback(data);
    }
  });
}