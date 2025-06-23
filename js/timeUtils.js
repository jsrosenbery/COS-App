export function parseHour(t) {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1],10), min = parseInt(m[2],10);
  const ampm = m[3]?.toUpperCase();
  if (ampm==='AM'&&h===12) h=0;
  if (ampm==='PM'&&h!==12) h+=12;
  return h+min/60;
}
export function getTimeRangeFromData(data) {
  let min=24, max=0;
  data.forEach(r=>{
    const s=parseHour(r.Start_Time), e=parseHour(r.End_Time);
    if(s!=null) min=Math.min(min,s);
    if(e!=null) max=Math.max(max,e);
  });
  return {start:min,end:max};
}
