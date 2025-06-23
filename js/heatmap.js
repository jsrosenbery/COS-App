import { getTimeRangeFromData, parseHour } from './timeUtils.js';

export function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  // Simple stub: display parsed data
  const { start, end } = getTimeRangeFromData(data);
  container.innerHTML = '<h3>Parsed Entries: ' + data.length + '</h3>'
    + '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
}
