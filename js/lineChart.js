export function renderLineChart(data){
  const ctx=document.getElementById('linechart-canvas').getContext('2d');
  const counts={},labels=[];data.forEach(r=>{
    const h=parseInt(r.Start_Time.match(/^(\d+)/)[1]);
    counts[h]=(counts[h]||0)+1;
  });for(let h=6;h<=22;h++)labels.push(h);
  const ds=labels.map(h=>counts[h]||0);
  new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Classes per Hour',data:ds}]},options:{scales:{y:{beginAtZero:true}}}});
}