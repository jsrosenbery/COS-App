import {getTimeRangeFromData,parseHour} from'./timeUtils.js';
export function renderHeatmap(data){
  const c=document.getElementById('heatmap-container');c.innerHTML='';
  if(!data.length)return;
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const {start,end}=getTimeRangeFromData(data);
  const slots=[];for(let t=start;t<=end;t+=0.5)slots.push(t);
  const table=document.createElement('table');table.className='heatmap';
  const thead=document.createElement('thead'),hdr=document.createElement('tr');
  hdr.appendChild(document.createElement('th'));
  days.forEach(d=>{let th=document.createElement('th');th.textContent=d;hdr.appendChild(th);});
  thead.appendChild(hdr);table.appendChild(thead);
  const tbody=document.createElement('tbody');
  slots.forEach(t=>{let tr=document.createElement('tr');
    let h=Math.floor(t),m=(t-h)*60;let lbl=(h%12||12)+':'+(m<10?'0'+m:m)+(h<12?'AM':'PM');
    let td=document.createElement('td');td.textContent=lbl;tr.appendChild(td);
    days.forEach(d=>{let cell=document.createElement('td');
      data.forEach(r=>{if(r.Days.includes(d)&&t>=parseHour(r.Start_Time)&&t<parseHour(r.End_Time))cell.style.background='#afd';});
      tr.appendChild(cell);
    });tbody.appendChild(tr);
  });
  table.appendChild(tbody);c.appendChild(table);
}