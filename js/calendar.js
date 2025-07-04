export function initCalendar(data) {
  const calendarEl = document.getElementById('calendar');
  const events = data.flatMap(r => r.Days.map(day => ({
    title: '',
    startRecur: r.Start_Date,
    endRecur: r.End_Date,
    daysOfWeek: [ ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(day) ],
    startTime: r.Start_Time,
    endTime: r.End_Time,
    extendedProps: {
      timeRange: `${r.Start_Time}-${r.End_Time}`,
      courseRoom: `${r.SUBJECT || ''} ${r.COURSE || ''}`.trim(),
      crn: r.CRN ? `CRN ${r.CRN}` : ''
    }
  })));
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    weekNumbers: true,
    events,
    eventContent: arg => {
      const props = arg.event.extendedProps;
      const lines = [];
      if (props.timeRange) lines.push(props.timeRange);
      if (props.courseRoom) lines.push(props.courseRoom);
      if (props.crn) lines.push(props.crn);
      const html = lines.map(l => `<div>${l}</div>`).join('');
      return { html: `<div class="fc-custom-event">${html}</div>` };
    }
  });
  calendar.render();
}
