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

  // Set up campus dropdown listeners for heatmap/linechart
  document.getElementById('heatmap-campus-select').addEventListener('change', heatmap.updateAllHeatmap);
  document.getElementById('linechart-campus-select').addEventListener('change', linechart.renderLineChart);

  // Heatmap/linechart course selector clear buttons
  document.getElementById('heatmap-clear-btn').onclick = heatmap.clearHeatmapFilter;
  document.getElementById('linechart-clear-btn').onclick = linechart.clearLineChartFilter;

  // Heatmap/linechart course selector listeners
  document.getElementById('courseSelect').addEventListener('change', heatmap.updateAllHeatmap);
  document.getElementById('lineCourseSelect').addEventListener('change', linechart.renderLineChart);

  // Calendar room dropdown
  document.getElementById('calendar-room-select').addEventListener('change', calendar.renderFullCalendar);

  // Room availability tools (snapshot and calendar)
  document.getElementById('avail-check-btn').onclick = availability.handleAvailability;
  document.getElementById('avail-clear-btn').onclick = availability.handleClearAvailability;
  document.getElementById('calendar-avail-check-btn').onclick = availability.handleCalendarAvailability;
  document.getElementById('calendar-avail-clear-btn').onclick = availability.handleClearCalendarAvailability;

  // UI view switching
  document.getElementById('viewSelect').addEventListener('change', function() {
    const view = this.value;
    heatmap.showHide(view === 'heatmap');
    linechart.showHide(view === 'linechart');
    calendar.showHide(view === 'fullcalendar');
    utils.showSnapshotUI(view === 'calendar');
    utils.showUploadUI(view === 'calendar');
    if (view === 'fullcalendar') calendar.renderFullCalendar();
    if (view === 'linechart') linechart.renderLineChart();
  });

  // Initial load for default term and view
  dataLoader.handleInitialLoad();
});
