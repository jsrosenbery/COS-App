export function parseHour(t) {
  if(!t) return null;
  const m=t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if(!m) return null;
  let h=parseInt(m[1]),min=parseInt(m[2]),amp=m[3];
  if(amp==='AM'&&h===12)h=0; if(amp==='PM'&&h!==12)h+=12;
  return h+min/60;
}
export function getTimeRangeFromData(data) {
  let min=24,max=0;data.forEach(r=>{
    let s=parseHour(r.Start_Time),e=parseHour(r.End_Time);
    if(s!=null)min=Math.min(min,s); if(e!=null)max=Math.max(max,e);
  });return{start:min,end:max};
}