// COS-App js/app.js (modularized entry point)

// Import modules (using ES6 module syntax)
import { termStartDates, holidaySet, hmDays } from './constants.js';
import * as utils from './utils.js';
import * as dataLoader from './data.js';
import * as calgetc from './calgetc.js';
import * as heatmap from './heatmap.js';
import * as linechart from './linechart.js';
import * as calendar from './calendar.js';
import * as availability from './availability.js';

document.addEventListener('DOMContentLoaded', () => {
  // Tabs, term selection, and backend data loading
  heatmap.initHeatmap();
  linechart.initLineChartChoices();

  // Set up UI event handlers for view switch, etc
  utils.setupTermTabs({
    onTermChange: dataLoader.handleTermChange,
    onUpload: dataLoader.handleUpload,
    onRoomDropdown: dataLoader.buildRoomDropdowns,
  });

  // Defensive: Only add event listeners if elements exist
  const heatmapCampusSelect = document.getElementById('heatmap-campus-select');
  if (heatmapCampusSelect) {
    heatmapCampusSelect.addEventListener('change', heatmap.updateAllHeatmap);
  }

  const linechartCampusSelect = document.getElementById('linechart-campus-select');
  if (linechartCampusSelect) {
    linechartCampusSelect.addEventListener('change', linechart.renderLineChart);
  }

  const heatmapClearBtn = document.getElementById('heatmap-clear-btn');
  if (heatmapClearBtn) {
    heatmapClearBtn.onclick = heatmap.clearHeatmapFilter;
  }

  const linechartClearBtn = document.getElementById('linechart-clear-btn');
  if (linechartClearBtn) {
    linechartClearBtn.onclick = linechart.clearLineChartFilter;
  }

  const courseSelect = document.getElementById('courseSelect');
  if (courseSelect) {
    courseSelect.addEventListener('change', heatmap.updateAllHeatmap);
  }

  const lineCourseSelect = document.getElementById('lineCourseSelect');
  if (lineCourseSelect) {
    lineCourseSelect.addEventListener('change', linechart.renderLineChart);
  }

  const calendarRoomSelect = document.getElementById('calendar-room-select');
  if (calendarRoomSelect) {
    calendarRoomSelect.addEventListener('change', calendar.renderFullCalendar);
  }

  const availCheckBtn = document.getElementById('avail-check-btn');
  if (availCheckBtn) {
    availCheckBtn.onclick = availability.handleAvailability;
  }

  const availClearBtn = document.getElementById('avail-clear-btn');
  if (availClearBtn) {
    availClearBtn.onclick = availability.handleClearAvailability;
  }

  const calendarAvailCheckBtn = document.getElementById('calendar-avail-check-btn');
  if (calendarAvailCheckBtn) {
    calendarAvailCheckBtn.onclick = availability.handleCalendarAvailability;
  }

  const calendarAvailClearBtn = document.getElementById('calendar-avail-clear-btn');
  if (calendarAvailClearBtn) {
    calendarAvailClearBtn.onclick = availability.handleClearCalendarAvailability;
  }

  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.addEventListener('change', function() {
      const view = this.value;
      heatmap.showHide(view === 'heatmap');
      linechart.showHide(view === 'linechart');
      calendar.showHide(view === 'fullcalendar');
      utils.showSnapshotUI(view === 'calendar');
      utils.showUploadUI(view === 'calendar');
      if (view === 'fullcalendar') calendar.renderFullCalendar();
      if (view === 'linechart') linechart.renderLineChart();
    });
  }

  // Initial load for default term and view
  dataLoader.handleInitialLoad();
});
