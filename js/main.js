import { parseCSVFile } from './parser.js';
import { renderHeatmap } from './heatmap.js';
import { renderLineChart } from './lineChart.js';
import { initCalendar } from './calendar.js';

const input=document.getElementById('schedule-upload');
input.addEventListener('change', async(e)=>{
  const file=e.target.files[0]; if(!file)return;
  const data=await parseCSVFile(file);
  renderHeatmap(data);
  renderLineChart(data);
  initCalendar(data);
});