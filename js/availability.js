// Availability tool logic for both snapshot and calendar views

import { hmDays } from './constants.js';
import { extractField, isValidRoom } from './utils.js';

// --- Room Availability Tool for snapshot (table view) ---
export function handleAvailability() {
  const resultsDiv = document.getElementById('avail-results');
  const startInput = document.getElementById('avail-start');
  const endInput = document.getElementById('avail-end');
  if (!resultsDiv || !startInput || !endInput) return;

  resultsDiv.textContent = '';
  const days = Array.from(
    document.querySelectorAll('#availability-ui .days input:checked')
  ).map(cb => cb.value);
  const start = startInput.value, end = endInput.value;
  if (!days.length || !start || !end) {
    resultsDiv.textContent = 'Please select at least one day and both start/end times.';
    return;
  }
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const sMin = toMin(start), eMin = toMin(end);

  // Assume a global variable or import for currentData
  const currentData = window.currentData || []; // fallback
  const rooms = [...new Set(currentData
    .filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM))
    .map(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}`))];
  const occ = new Set();
  currentData.forEach(i => {
    if (!isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM)) return;
    if (Array.isArray(i.Days) && i.Days.some(d => days.includes(d))) {
      const si = toMin(i.Start_Time), ei = toMin(i.End_Time);
      if (!(ei <= sMin || si >= eMin)) {
        occ.add(`${i.Building || i.BUILDING}-${i.Room || i.ROOM}`);
      }
    }
  });
  const avail = rooms.filter(r => !occ.has(r)).sort();
  if (avail.length) {
    resultsDiv.innerHTML = '<ul>' + avail.map(r => `<li>${r}</li>`).join('') + '</ul>';
  } else {
    resultsDiv.textContent = 'No rooms available.';
  }
}

export function handleClearAvailability() {
  document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
  document.getElementById('avail-start').value = '';
  document.getElementById('avail-end').value = '';
  document.getElementById('avail-results').textContent = '';
}

// --- Room Availability Tool for FullCalendar view with date range ---
export function handleCalendarAvailability() {
  const resultDiv = document.getElementById('calendar-avail-results');
  const dateStart = document.getElementById('calendar-avail-date-start').value;
  const dateEnd = document.getElementById('calendar-avail-date-end').value;
  const timeStart = document.getElementById('calendar-avail-time-start').value;
  const timeEnd = document.getElementById('calendar-avail-time-end').value;
  const days = Array.from(document.querySelectorAll('#calendar-availability-ui input[type="checkbox"]:checked')).map(cb => cb.value);

  resultDiv.innerHTML = '';
  if (!dateStart || !dateEnd || !timeStart || !timeEnd || !days.length) {
    resultDiv.textContent = 'Please select a date range, time range, and at least one day.';
    return;
  }
  const dStart = new Date(dateStart);
  const dEnd = new Date(dateEnd);
  if (dStart > dEnd) {
    resultDiv.textContent = 'Start date must be before end date.';
    return;
  }

  // Assume a global variable or import for currentData
  const currentData = window.currentData || [];
  const rooms = [...new Set(currentData
    .filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM))
    .map(i => `${i.Building || i.BUILDING}-${i.Room || i.ROOM}`))];
  if (!rooms.length) {
    resultDiv.textContent = 'No rooms found in data.';
    return;
  }
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const userStartMin = toMin(timeStart);
  const userEndMin = toMin(timeEnd);

  // Build all queried dates in range, filter by selected days
  const queriedDates = [];
  let d = new Date(dStart);
  while (d <= dEnd) {
    const dow = hmDays[d.getDay()];
    if (days.includes(dow)) {
      queriedDates.push(new Date(d)); // copy
    }
    d.setDate(d.getDate() + 1);
  }
  if (!queriedDates.length) {
    resultDiv.textContent = 'No matching dates in range for selected days.';
    return;
  }
  // For each queried date: find rooms that are occupied at the given time
  // Only consider courses active on that date and meeting on that day
  const occByDate = {}; // key: date string, value: Set of occupied rooms
  queriedDates.forEach(dayDate => {
    const ymd = dayDate.toISOString().slice(0, 10);
    const dayOfWeek = hmDays[dayDate.getDay()];
    occByDate[ymd] = new Set();
    currentData.forEach(i => {
      if (!isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM)) return;
      // Check if course is running on this date
      let courseStart = extractField(i, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
      let courseEnd = extractField(i, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
      // Try to normalize to ISO
      courseStart = (courseStart || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
      courseEnd = (courseEnd || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
      if (!courseStart || !courseEnd) return;
      const cStart = new Date(courseStart);
      const cEnd = new Date(courseEnd);
      if (dayDate < cStart || dayDate > cEnd) return;
      // Check if this course meets on this day
      let iDays = i.Days;
      if (typeof iDays === 'string') iDays = iDays.split(',').map(s => s.trim());
      if (!Array.isArray(iDays) || !iDays.includes(dayOfWeek)) return;
      // Time overlap
      const si = toMin(i.Start_Time || '');
      const ei = toMin(i.End_Time || '');
      if (!(ei <= userStartMin || si >= userEndMin)) {
        occByDate[ymd].add(`${i.Building || i.BUILDING}-${i.Room || i.ROOM}`);
      }
    });
  });

  // Find rooms that are free on ALL those queried dates (intersection of available sets)
  let availableRooms = rooms.filter(room =>
    queriedDates.every(dayDate => !occByDate[dayDate.toISOString().slice(0, 10)].has(room))
  );
  if (availableRooms.length) {
    resultDiv.innerHTML = `<b>Available rooms (${availableRooms.length}):</b> <ul>` +
      availableRooms.map(r => `<li>${r}</li>`).join('') + `</ul>`;
  } else {
    resultDiv.textContent = 'No rooms available for the selected date/time range and days.';
  }
}

export function handleClearCalendarAvailability() {
  document.querySelectorAll('#calendar-availability-ui input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('calendar-avail-date-start').value = '';
  document.getElementById('calendar-avail-date-end').value = '';
  document.getElementById('calendar-avail-time-start').value = '';
  document.getElementById('calendar-avail-time-end').value = '';
  document.getElementById('calendar-avail-results').innerHTML = '';
}
