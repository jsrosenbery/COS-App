import { terms, fetchSchedule } from './dataLoader.js';

document.addEventListener('DOMContentLoaded', () => {
  const tabsContainer = document.getElementById('term-tabs');
  const gridContainer = document.getElementById('schedule-grid');

  terms.forEach(term => {
    const tab = document.createElement('div');
    tab.textContent = term;
    tab.classList.add('tab');
    tab.addEventListener('click', () => loadTerm(term, tab));
    tabsContainer.appendChild(tab);
  });

  // Load the first term by default
  const firstTab = tabsContainer.querySelector('.tab');
  if (firstTab) loadTerm(terms[0], firstTab);

  document.getElementById('availability-btn').addEventListener('click', () => {
    alert('Room availability feature coming soon!');
  });
});

function loadTerm(term, tabElement) {
  // highlight active
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabElement.classList.add('active');
  
  // fetch and display
  fetchSchedule(term).then(data => {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = '';
    data.forEach(item => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `<strong>${item.Subject_Course} (${item.CRN})</strong><br>
                        ${item.Days.join(', ')} ${item.Start_Time} - ${item.End_Time}<br>
                        ${item.Building} - ${item.Room}`;
      grid.appendChild(slot);
    });
  });
}
