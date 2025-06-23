export function initAvailability(currentData) {
  const form = document.getElementById('availability-form');
  const results = document.getElementById('availability-results');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const startDate = form.querySelector('#avail-start').value;
    const endDate = form.querySelector('#avail-end').value;
    const days = Array.from(form.querySelectorAll('input[name="day"]:checked')).map(cb => cb.value);
    const timeStart = form.querySelector('#avail-time-start').value;
    const timeEnd = form.querySelector('#avail-time-end').value;
    if (!startDate || !endDate || days.length === 0) {
      results.textContent = 'Please fill all fields.';
      return;
    }
    // Filter rooms with no conflicts
    const rooms = [...new Set(currentData.map(r => `${r.Building}-${r.Room}`))];
    const available = rooms.filter(room => {
      const bookings = currentData.filter(r => `${r.Building}-${r.Room}` === room);
      // check if any booking conflicts
      return !bookings.some(r => {
        // date overlap
        if (r.End_Date < startDate || r.Start_Date > endDate) return false;
        // day overlap
        if (!r.Days.some(d => days.includes(d))) return false;
        // time conflict
        return !(r.End_Time <= timeStart || r.Start_Time >= timeEnd);
      });
    });
    if (available.length === 0) {
      results.innerHTML = '<p>No rooms available.</p>';
    } else {
      results.innerHTML = '<ul>' + available.map(r => `<li>${r}</li>`).join('') + '</ul>';
    }
  });
}
