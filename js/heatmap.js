import { getTimeRangeFromData, parseHour } from './timeUtils.js';

export function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '';
  if (!data.length) return;
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const {start, end} = getTimeRangeFromData(data);
  const interval=0.5, slots=[];
  for(let t=start; t<=end; t+=interval) slots.push(t);
  const table=document.createElement('table'); table.className='heatmap';
  const thead=document.createElement('thead'), headerRow=document.createElement('tr');
  headerRow.appendChild(document.createElement('th'));
  days.forEach(d=>{ const th=document.createElement('th'); th.textContent=d; headerRow.appendChild(th); });
  thead.appendChild(headerRow); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  slots.forEach(t=> {
    const row=document.createElement('tr');
    const timeCell=document.createElement('td');
    const h=Math.floor(t), m=(t-h)*60;
    const label=((h%12)||12)+':' + (m<10?'0'+m:m) + (h<12?'AM':'PM');
    timeCell.textContent=label; row.appendChild(timeCell);
    days.forEach(d=>{
      const cell=document.createElement('td');
      // find if any event covers this slot
      data.forEach(r=>{
        if(r.Days.includes(d)) {
          const s=parseHour(r.Start_Time), e=parseHour(r.End_Time);
          if(t>=s && t<e) cell.style.background='#afd';
        }
      });
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody); container.appendChild(table);
}
