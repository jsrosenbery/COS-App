export function initCalendar(data) {
  const calendarEl = document.getElementById('calendar');
  if (window.FullCalendar) {
    const events = data.flatMap(r => r.Days.map(day => ({
      title: `${r.Building}-${r.Room}`,
      startRecur: r.Start_Date,
      endRecur: r.End_Date,
      daysOfWeek: [ ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(day) ],
      startTime: r.Start_Time,
      endTime: r.End_Time
    })));

    new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      plugins: [ FullCalendar.timeGridPlugin ],
      weekNumbers: true,
      events
    }).render();
  }
}
