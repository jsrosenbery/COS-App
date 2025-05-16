document.addEventListener('DOMContentLoaded', () => {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentData = [];

  const tabs = document.getElementById('term-tabs');
  const uploadDiv = document.getElementById('upload-container');
  const tsDiv = document.getElementById('upload-timestamp');
  const roomDiv = document.getElementById('room-filter');
  const table = document.getElementById('schedule-table');
  const container = document.getElementById('schedule-container');
  const availabilityBtn = document.getElementById('availability-btn');

  // Create tabs
  terms.forEach((term, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx === 2 ? ' active' : '');
    tab.textContent = term;
    tab.addEventListener('click', () => selectTerm(term, tab));
    tabs.appendChild(tab);
  });

  // Initial load
  selectTerm(terms[2], tabs.children[2]);

  // Bind availability
  availabilityBtn.addEventListener('click', showAvailability);

  function selectTerm(term, tabElem) {
    // Activate tab
    Array.from(tabs.children).forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    // Reset
    setupUpload();
    clearSchedule();
    tsDiv.textContent = '';
  }

  function setupUpload() {
    roomDiv.innerHTML = '';
    uploadDiv.innerHTML = `<label>Upload CSV for ${currentTerm}: <input type="file" id="file-input" accept=".csv"></label>`;
    document.getElementById('file-input').onchange = e => {
      parseCSVFile(e.target.files[0], data => {
        currentData = data;
        tsDiv.textContent = 'Last upload: ' + new Date().toLocaleString();
        buildRoomDropdown();
        renderSchedule();
        // save this term's schedule
        const key = 'cos_schedule_' + currentTerm;
        localStorage.setItem(key, JSON.stringify({
          data: currentData,
          timestamp: tsDiv.textContent
        }));
      });
    };
});
