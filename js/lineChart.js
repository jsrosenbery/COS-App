export function renderLineChart(data) {
  const ctx = document.getElementById('linechart-canvas').getContext('2d');
  // Process data into time-series
  /* Adapt from original line chart logic */

  new Chart(ctx, {
    type: 'line',
    data: {/* datasets and labels */},
    options: {/* styling and axes */}
  });
}
