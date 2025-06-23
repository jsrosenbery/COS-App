import { getTimeRangeFromData, parseHour } from './timeUtils.js';

export function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '';

  const { start, end } = getTimeRangeFromData(data);
  // Build heatmap grid based on start/end and room occupancy
  // [Implementation here]

  // Append generated heatmap element
  container.appendChild(hmTable);
}
