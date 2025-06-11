function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  const yr = d.getFullYear();
  return `${mo}/${da}/${yr}`;
}

function renderSchedule() {
  clearSchedule();
  const filt = document.getElementById('room-select')?.value || 'All';
  const data = filt === 'All'
    ? currentData
    : currentData.filter(i => `${i.Building}-${i.Room}` === filt);
  const rect = container.getBoundingClientRect();

  daysOfWeek.forEach((day, dIdx) => {
    let evs = data
      .filter(i => i.Days.includes(day))
      .filter(i => parseHour(i.Start_Time) !== parseHour(i.End_Time))
      .map(i => ({
        ...i,
        startMin: parseTime(i.Start_Time),
        endMin:   parseTime(i.End_Time)
      }))
      .sort((a,b) => a.startMin - b.startMin);

    // ... column stacking logic ...

    cols.flat().forEach(ev => {
      // ... positioning logic ...
      const b = document.createElement('div');
      b.className = 'class-block';
      b.style.top    = `${topPx}px`;
      b.style.left   = `${leftPx}px`;
      b.style.width  = `${widthPx}px`;
      b.style.height = `${heightPx}px`;

      b.innerHTML = `
        <span>${ev.Subject_Course}</span><br>
        <span>${ev.CRN}</span><br>
        <span>${format12(ev.Start_Time)} - ${format12(ev.End_Time)}</span><br>
        <span>${formatDate(ev.Start_Date)} - ${formatDate(ev.End_Date)}</span>
      `;
      container.appendChild(b);
    });
  });
}