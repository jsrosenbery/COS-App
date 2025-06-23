// linechart.js - Line chart logic, rendering, and filtering

import { hmDays } from './constants.js';
import { extractField, isValidRoom, parseHour, getTimeRangeFromData } from './utils.js';
import * as calgetc from './calgetc.js';

let lineCourseChoices;
let lineChartInstance;

// Populate line chart course selector (Choices.js)
export function initLineChartChoices() {
  lineCourseChoices = new Choices('#lineCourseSelect', {
    removeItemButton: true,
    searchEnabled: true,
    placeholderValue: 'Filter by discipline/course',
    callbackOnCreateTemplates: function(template) {
      return {
        choice: (classNames, data) => {
          return template(`
            <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled 
              ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="" data-choice 
              data-id="${data.id}" data-value="${data.value}" ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'} 
              role="option">
              <input type="checkbox" ${data.selected ? 'checked' : ''} tabindex="-1"/>
              <span>${data.label}</span>
            </div>
          `);
        }
      }
    }
  });
}

// Render the line chart based on selected filters
export function renderLineChart() {
  const data = (window.currentData || []).filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM));
  const campus = document.getElementById('linechart-campus-select')?.value || '';
  const selected = lineCourseChoices.getValue(true);

  let filtered = data;
  if (campus) {
    filtered = filtered.filter(r => (r.Campus || r.campus || r.CAMPUS) === campus);
  }

  // CAL-GETC group filtering
  let filterCourseCodes = new Set();
  selected.forEach(val => {
    if (calgetc.isCALGETCGroup(val)) {
      calgetc.getCourseCodesFromCALGETC(val).forEach(c => filterCourseCodes.add(c));
    } else {
      if (window.normalizeCALGETCCode) {
        filterCourseCodes.add(window.normalizeCALGETCCode(val));
      } else {
        filterCourseCodes.add(val);
      }
    }
  });

  if (selected.length) {
    filtered = filtered.filter(r => 
      filterCourseCodes.has(window.normalizeCALGETCCode ? window.normalizeCALGETCCode(r.Subject_Course || r.key) : (r.Subject_Course || r.key))
    );
  }

  // Group by week and count
  const weekCounts = {};
  filtered.forEach(row => {
    let startDate = extractField(row, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
    let endDate = extractField(row, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
    if (!startDate || !endDate) return;
    // Normalize to YYYY-MM-DD
    startDate = (startDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
    endDate = (endDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
    let s = new Date(startDate);
    let e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    // For each week from start to end, count 1
    s.setHours(0,0,0,0);
    e.setHours(0,0,0,0);
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    for (let d = new Date(s); d <= e; d = new Date(d.getTime() + oneWeek)) {
      const weekStr = d.toISOString().slice(0, 10);
      weekCounts[weekStr] = (weekCounts[weekStr] || 0) + 1;
    }
  });
  // Build chart data
  const weeks = Object.keys(weekCounts).sort();
  const counts = weeks.map(w => weekCounts[w]);

  // Destroy previous chart if present
  const chartContainer = document.getElementById('linechart');
  if (lineChartInstance && lineChartInstance.destroy) {
    lineChartInstance.destroy();
    chartContainer.innerHTML = '<canvas id="linechart-canvas"></canvas>';
  }

  const ctx = document.getElementById('linechart-canvas').getContext('2d');
  lineChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Sections scheduled',
        data: counts,
        fill: false,
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { title: { display: true, text: 'Week start' } },
        y: { title: { display: true, text: 'Section Count' }, beginAtZero: true }
      }
    }
  });
}

// Clear line chart filters
export function clearLineChartFilter() {
  if (lineCourseChoices) lineCourseChoices.removeActiveItems();
  renderLineChart();
}

// Show/hide logic for linechart panel
export function showHide(show) {
  document.getElementById('linechart-tool').style.display = show ? 'block' : 'none';
}
