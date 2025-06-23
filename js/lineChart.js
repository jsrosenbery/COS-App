export function renderLineChart(data) {
  const ctx = document.getElementById('linechart-canvas').getContext('2d');
  // Process data into datasets and labels
  // [Implementation here]

  new Chart(ctx, {
    type: 'line',
    data: {/* datasets & labels */},
    options: {/* chart options */}
  });
}
