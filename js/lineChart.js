export function renderLineChart(data) {
  const ctx = document.getElementById('linechart-canvas').getContext('2d');
  const counts = {}, labels = [];
  data.forEach(r => {
    const hour = parseInt(r.Start_Time.match(/^(\d+)/)[1], 10);
    counts[hour] = (counts[hour] || 0) + 1;
  });
  for (let h = 6; h <= 22; h++) labels.push(h);
  const dataset = labels.map(h => counts[h] || 0);
  new Chart(ctx, { type:'line', data:{ labels, datasets:[{ label:'Classes per Hour', data:dataset }]}, options:{ scales:{ y:{ beginAtZero:true }}}});
}
