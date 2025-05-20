// ... existing imports and setup ...

document.addEventListener('DOMContentLoaded', () => {
  // Populate rooms dropdown
  const roomSelect = document.getElementById('roomSelect');
  rooms.sort((a, b) => {
    const nameA = `${a.campus} ${a.building} ${a.room}`.toUpperCase();
    const nameB = `${b.campus} ${b.building} ${b.room}`.toUpperCase();
    return nameA.localeCompare(nameB);
  });
  rooms.forEach(r => {
    const option = document.createElement('option');
    option.value = r.id;
    option.textContent = `${r.campus} ${r.building} ${r.room}`;
    roomSelect.appendChild(option);
  });

  // Availability button handler
  document.getElementById('availabilityBtn').addEventListener('click', () => {
    const selectedDays = getSelectedDays(); // your existing function
    const start = getStartTime();
    const end = getEndTime();
    const available = findAvailableRooms(selectedDays, start, end);
    const list = document.getElementById('availabilityList');
    list.innerHTML = '';
    available.sort((a, b) => {
      const nameA = `${a.campus} ${a.building} ${a.room}`.toUpperCase();
      const nameB = `${b.campus} ${b.building} ${b.room}`.toUpperCase();
      return nameA.localeCompare(nameB);
    });
    available.forEach(r => {
      const div = document.createElement('div');
      div.textContent = `${r.campus} ${r.building} ${r.room}`;
      list.appendChild(div);
    });
  });

  // Render schedule with hover info
  function renderSchedule() {
    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';
    schedule.forEach(item => {
      const cell = document.createElement('div');
      cell.classList.add('class-block');
      // position & sizing logic...
      cell.style.gridRowStart = item.startRow;
      cell.style.gridRowEnd = item.endRow;
      cell.style.gridColumnStart = item.dayIndex + 1;
      cell.textContent = item.courseCode;
      // Tooltip info
      const info = `Course: ${item.courseCode}\nInstructor: ${item.instructor}\nRoom: ${item.room}\nTime: ${item.startTime} - ${item.endTime}`;
      cell.title = info;
      grid.appendChild(cell);
    });
  }

  // After data loads
  renderSchedule();
});
