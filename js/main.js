import { parseCSVFile } from './parser.js';
import { renderHeatmap } from './heatmap.js';
import { renderLineChart } from './lineChart.js';
import { initCalendar } from './calendar.js';

const uploadInput = document.getElementById('schedule-upload');
uploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await parseCSVFile(file);
    renderHeatmap(data);
    renderLineChart(data);
    initCalendar(data);
  } catch (err) {
    console.error('Error parsing schedule:', err);
  }
});
