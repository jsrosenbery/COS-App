export function initCalendar(data) {
  const calendarEl = document.getElementById('calendar');
  const events = data.flatMap(r => r.Days.map(day => ({
    title: '',
    startRecur: r.Start_Date,
    endRecur: r.End_Date,
    daysOfWeek: [['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(day)],
    startTime: r.Start_Time,
    endTime: r.End_Time,
    extendedProps: {
      timeRange: `${r.Start_Time}-${r.End_Time}`,
      courseRoom: `${r.SUBJECT} ${r.COURSE}`.trim(),
      crn: r.CRN ? `CRN ${r.CRN}` : ''
    }
  })));
  const calendar = new FullCalendar.Calendar(calendarEl, { initialView:'timeGridWeek', weekNumbers:true, events,
    eventContent: arg => {
      const p = arg.event.extendedProps;
      const lines = [p.timeRange, p.courseRoom, p.crn].filter(x => x);
      return { html: lines.map(l=>`<div>${l}</div>`).join('') };
    }
  });
  calendar.render();
}
