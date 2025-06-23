import { getTimeRangeFromData, parseHour } from './timeUtils.js';

export function renderHeatmap(data) {
  // Clear container
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '';

  const { start, end } = getTimeRangeFromData(data);
  // Build table/grid elements
  /* Adapt logic from original app.js to generate hmTable */

  // Append to container
  container.appendChild(hmTable);
}
