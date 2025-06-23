// calendar.js - FullCalendar setup, rendering, and holiday logic

import { termStartDates, holidaySet, hmDays } from './constants.js';
import { extractField, isValidRoom, format12 } from './utils.js';

// Expects a global or imported currentData array, and calendarRoomFilter select element

export function renderFullCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  // Get data and filter by room if needed
  const calendarRoomFilter = document.getElementById('calendar-room-select');
  let data = (window.currentData || []);
  const filt = calendarRoomFilter?.value || 'All';
  if (filt && filt !== 'All') {
    data = data.filter(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}` === filt);
  }
  // OMIT invalid rooms
  data = (data || []).filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM));
  const daysMap = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  const events = [];
  data.forEach(ev => {
    let daysArr = Array.isArray(ev.Days) ? ev.Days : (typeof ev.Days === "string" ? ev.Days.split(',') : []);
    daysArr = daysArr.map(d => d.trim()).filter(d => daysMap.hasOwnProperty(d));
    if (!daysArr.length) return;
    // Get date span
    let startDate = extractField(ev, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
    let endDate = extractField(ev, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
    if (!startDate || !endDate) return;
    // Normalize date format to YYYY-MM-DD
    startDate = (startDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
    endDate = (endDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
    let start = new Date(startDate);
    let end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    end.setDate(end.getDate() + 1); // endRecur is exclusive

    const title = extractField(ev, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
    const instructor = extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
    const subject_course = ev.Subject_Course || '';
    const crn = ev.CRN || '';
    const bldg_room = `${ev.Building || ''}-${ev.Room || ''}`;
    const displayTime = `${format12(ev.Start_Time)} - ${format12(ev.End_Time)}`;
    const startDateDisplay = startDate || 'N/A';
    const endDateDisplay = endDate || 'N/A';

    events.push({
      title: `${subject_course} CRN: ${crn}\n${bldg_room}`,
      startTime: ev.Start_Time,
      endTime: ev.End_Time,
      daysOfWeek: daysArr.map(d => daysMap[d]),
      startRecur: start.toISOString().slice(0,10),
      endRecur: end.toISOString().slice(0,10),
      extendedProps: {
        subject_course,
        crn,
        bldg_room,
        displayTime,
        instructor,
        title,
        dateRange: `${startDateDisplay} - ${endDateDisplay}`
      }
    });
  });

  const currentTerm = window.currentTerm || '';
  const initialDate = termStartDates[currentTerm] || new Date().toISOString().slice(0, 10);

  // Destroy previous calendar if present
  if (calendarEl._fullCalendar) {
    calendarEl._fullCalendar.destroy();
    calendarEl.innerHTML = '';
  }

  const fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    allDaySlot: false,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    events: events,
    height: 700,
    initialDate: initialDate,
    eventDidMount: function(info) {
      // Tooltip logic
      info.el.addEventListener('mouseenter', function(e) {
        const props = info.event.extendedProps;
        const tooltip = document.getElementById('class-block-tooltip');
        tooltip.innerHTML = `
<b>${props.subject_course || ''}</b><br>
${props.title ? `<span>${props.title}</span><br>` : ''}
CRN: ${props.crn || ''}<br>
Time: ${props.displayTime}<br>
Date Range: ${props.dateRange}<br>
Instructor: ${props.instructor || 'N/A'}
        `.trim();
        tooltip.style.display = 'block';
        tooltip.style.left = (e.pageX + 12) + 'px';
        tooltip.style.top  = (e.pageY + 12) + 'px';
      });
      info.el.addEventListener('mouseleave', function() {
        const tooltip = document.getElementById('class-block-tooltip');
        tooltip.style.display = 'none';
      });
      info.el.addEventListener('mousemove', function(e) {
        const tooltip = document.getElementById('class-block-tooltip');
        tooltip.style.left = (e.pageX + 12) + 'px';
        tooltip.style.top  = (e.pageY + 12) + 'px';
      });
    },
    dayCellDidMount: function(arg) {
      // Gray out holidays
      const iso = arg.date.toISOString().slice(0,10);
      if (holidaySet.has(iso)) {
        arg.el.style.backgroundColor = '#e0e0e0';
        arg.el.style.opacity = '0.7';
        arg.el.title = 'Holiday';
      }
    }
  });
  fullCalendarInstance.render();
  calendarEl._fullCalendar = fullCalendarInstance;
}

// Show/hide logic for calendar panel
export function showHide(show) {
  document.getElementById('calendar-container').style.display = show ? 'block' : 'none';
  document.getElementById('calendar-room-filter').style.display = show ? 'block' : 'none';
  document.getElementById('calendar-availability-ui').style.display = show ? 'block' : 'none';
}
