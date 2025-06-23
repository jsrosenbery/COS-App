export function initAvailability(currentData){
  const form=document.getElementById('availability-form'),res=document.getElementById('availability-results');
  form.addEventListener('submit',e=>{e.preventDefault();
    const sd=form['avail-start'].value,ed=form['avail-end'].value;
    const days=Array.from(form.querySelectorAll('input[name="day"]:checked')).map(cb=>cb.value);
    const ts=form['avail-time-start'].value,te=form['avail-time-end'].value;
    if(!sd||!ed||!days.length){res.textContent='Please fill all fields.';return;}
    const rooms=[...new Set(currentData.map(r=>`${r.Building}-${r.Room}`))];
    const avail=rooms.filter(room=>{const bks=currentData.filter(r=>`${r.Building}-${r.Room}`===room);
      return!bks.some(r=>{
        if(r.End_Date<sd||r.Start_Date>ed)return false;
        if(!r.Days.some(d=>days.includes(d)))return false;
        return!(r.End_Time<=ts||r.Start_Time>=te);
      });
    });
    res.innerHTML=avail.length?'<ul>'+avail.map(r=>`<li>${r}</li>`).join('')+'</ul>':'<p>No rooms available.</p>';
  });
}