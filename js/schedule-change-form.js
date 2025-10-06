// schedule-change-form.js — Shadow DOM component
(function () {
  const DEFAULT_THEME = {
    btnBg: '#003366',
    btnHoverBg: '#0055aa',
    btnColor: '#fff',
    btnPadding: '10px 24px',
    btnFontSize: '1.1em',
    btnBorderRadius: '6px',
    btnBorder: 'none'
  };

  function cssVars(theme){
    return `
      :host{ --btn-bg:${theme.btnBg}; --btn-hover-bg:${theme.btnHoverBg}; --btn-color:${theme.btnColor};
             --btn-padding:${theme.btnPadding}; --btn-font:${theme.btnFontSize};
             --btn-radius:${theme.btnBorderRadius}; --btn-border:${theme.btnBorder}; }
    `;
  }

  const cssBase = `
    :host{ all: initial; font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif; color:#1a1a1a }
    /* Button matches Export PDF */
    .btn{
      display:inline-flex; gap:.5rem; align-items:center;
      padding:var(--btn-padding); font-size:var(--btn-font);
      background:var(--btn-bg); color:var(--btn-color);
      border-radius:var(--btn-radius); border:var(--btn-border);
      cursor:pointer; transition:background .2s;
    }
    .btn:hover{ background:var(--btn-hover-bg) }
    .btn:focus{ outline:3px solid rgba(15,98,254,.25); outline-offset:2px }

    /* Modal */
    .modal{ position:fixed; inset:0; display:none; place-items:center;
      background:rgba(6,10,20,.55); backdrop-filter:saturate(120%) blur(3px);
      z-index:2147483647; /* above everything */
    }
    .modal.open{ display:grid }

    .paper{ background:#fff; width:min(1100px,92vw); max-height:92vh; border-radius:16px;
      box-shadow:0 20px 60px rgba(0,0,0,.25); display:flex; flex-direction:column }
    header{ display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; border-bottom:1px solid #dcdfe6; }
    header h2{ margin:0; font-weight:700; font-size:1.15rem; letter-spacing:.2px }
    main{ padding:1rem 1.25rem; overflow:auto }
    footer{ display:flex; gap:.5rem; justify-content:flex-end; align-items:center; padding:.75rem 1.25rem; border-top:1px solid #dcdfe6; background:#fafafa; }

    form{ --gap:.65rem; }
    .row{ display:grid; grid-template-columns:repeat(12,1fr); gap:var(--gap); align-items:center }
    .field{ display:flex; flex-direction:column; gap:.35rem }
    label{ font-size:.78rem; color:#444 }
    input[type="text"],input[type="number"],input[type="date"],textarea,select{
      border:1px solid #dcdfe6; border-radius:.5rem; padding:.55rem .6rem; font-size:.95rem; background:#fff;
    }
    textarea{ min-height:72px; }
    .pill{ display:inline-flex; align-items:center; gap:.5rem; border:1px solid #dcdfe6; border-radius:999px; padding:.35rem .65rem; margin:.25rem .35rem .25rem 0; }
    .checkgrid{ display:flex; flex-wrap:wrap }
    .section{ margin:1rem 0 1.25rem }
    .section h3{ font-size:.95rem; margin:.25rem 0 .65rem; font-weight:700; border-bottom:2px solid #e9ecf3; padding-bottom:.35rem }
    .table{ width:100%; border-collapse:collapse; border:1px solid #dcdfe6; border-radius:.75rem; overflow:hidden }
    .table thead th{ background:#f2f4f8; font-weight:700; font-size:.85rem; text-align:left; padding:.6rem; border-bottom:1px solid #dcdfe6 }
    .table td{ border-top:1px solid #dcdfe6; padding:.5rem }
    .muted{ color:#6b7280; font-size:.85rem }
    .badge{ display:inline-flex; align-items:center; gap:.4rem; background:#eef2ff; color:#243bff; padding:.25rem .5rem; border-radius:.5rem; border:1px solid #d7ddff; font-size:.75rem }
    .note{ background:#fffbe6; border:1px dashed #f2d024; border-radius:.5rem; padding:.5rem .6rem; font-size:.85rem }

    @media print{
      .modal{ all:unset }
      .paper{ all:unset }
      header,.btn,footer{ display:none !important }
      main{ padding:0 }
    }
  `;

  const html = (buttonText) => `
    <button id="openBtn" class="btn" type="button" aria-haspopup="dialog" aria-controls="scfModal" aria-expanded="false">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      ${buttonText || 'Schedule Change Form'}
    </button>

    <div id="scfModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="scfTitle">
      <div class="paper" tabindex="-1">
        <header>
          <h2 id="scfTitle">Change of Schedule Form</h2>
          <div style="display:flex;gap:.5rem;align-items:center">
            <span class="badge" title="This form is editable and will print cleanly">Editable</span>
            <button id="closeBtn" class="btn" type="button" aria-label="Close form">Close</button>
          </div>
        </header>
        <main>
          <form id="scf">
            <div class="section">
              <div class="row">
                <div class="field" style="grid-column: span 3;">
                  <label for="year">Year</label>
                  <input id="year" name="year" type="text" placeholder="YYYY" />
                </div>
                <div class="field" style="grid-column: span 9;">
                  <label>Approval</label>
                  <div class="row">
                    <div class="field" style="grid-column: span 4;">
                      <label class="muted">Date sent to Scheduler</label>
                      <input type="date" name="date_sent" />
                    </div>
                    <div class="field" style="grid-column: span 4;">
                      <label>Division Chair</label>
                      <input type="text" name="division_chair" placeholder="Name / Initials" />
                    </div>
                    <div class="field" style="grid-column: span 4;">
                      <label>Area Dean</label>
                      <input type="text" name="area_dean" placeholder="Name / Initials" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="row">
                <div class="field" style="grid-column: span 6;">
                  <label>Term</label>
                  <div class="checkgrid">
                    <label class="pill"><input type="checkbox" name="term" value="Spring"> Spring</label>
                    <label class="pill"><input type="checkbox" name="term" value="Summer"> Summer</label>
                    <label class="pill"><input type="checkbox" name="term" value="Fall"> Fall</label>
                  </div>
                </div>
                <div class="field" style="grid-column: span 6;">
                  <label>Campus</label>
                  <div class="checkgrid">
                    <label class="pill"><input type="checkbox" name="campus" value="Visalia"> Visalia</label>
                    <label class="pill"><input type="checkbox" name="campus" value="Tulare"> Tulare</label>
                    <label class="pill"><input type="checkbox" name="campus" value="Hanford"> Hanford</label>
                    <label class="pill"><input type="checkbox" name="campus" value="Online"> Online</label>
                    <label class="pill"><input type="checkbox" name="campus" value="Off-Campus"> Off-Campus</label>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <h3>Action</h3>
              <div class="checkgrid">
                ${[
                  'Modification','Cancel - No Staff','Cancel - Low Enroll','Cancel - Rebuild',
                  'Cancel - Clerical Err.','Cancel - Sched. Dev.','Un-Cancel','Addition','Activation','Inactivate'
                ].map(v=>`<label class="pill"><input type="checkbox" name="action" value="${v}"> ${v}</label>`).join('')}
              </div>
              <div class="row" style="margin-top:.5rem;">
                <div class="field" style="grid-column: span 2;">
                  <label># Enrolled</label>
                  <input type="number" name="num_enrolled" min="0" />
                </div>
                <div class="field" style="grid-column: span 2;">
                  <label>Adj. Canceled</label>
                  <input type="number" name="adj_canceled" min="0" />
                </div>
                <div class="field" style="grid-column: span 8;">
                  <label>Class Comp. Form sent to Academic Services</label>
                  <div class="checkgrid">
                    <label class="pill"><input type="checkbox" name="class_comp_sent" value="Yes"> Yes</label>
                    <label class="pill"><input type="checkbox" name="class_comp_sent" value="No"> No</label>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="field" style="grid-column: span 6;">
                  <label>Visible in Class Search?</label>
                  <div class="checkgrid">
                    <label class="pill"><input type="radio" name="visible" value="Yes"> Yes</label>
                    <label class="pill"><input type="radio" name="visible" value="No"> No</label>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <h3>Change Details</h3>
              <table class="table" aria-label="Change details">
                <thead>
                  <tr>
                    <th style="width:22%">Field</th>
                    <th>New / Current…</th>
                    <th>Changed To…</th>
                    <th style="width:70px">Done</th>
                  </tr>
                </thead>
                <tbody id="rows"></tbody>
              </table>
            </div>

            <div class="section">
              <h3>For Academic Services Use Only</h3>
              <div class="note">Enter totals based on course outline and scheduled hours.</div>

              <div class="row" style="margin-top:.75rem;">
                <div class="field" style="grid-column: span 4;">
                  <label>Lecture Hours</label>
                  <input type="number" step="0.1" min="0" name="lecture_hours" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label>Lab Hours</label>
                  <input type="number" step="0.1" min="0" name="lab_hours" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label>Activity Hours</label>
                  <input type="number" step="0.1" min="0" name="activity_hours" />
                </div>
              </div>

              <div class="row">
                <div class="field" style="grid-column: span 4;">
                  <label># of Days Scheduled for Course</label>
                  <input type="number" min="0" name="days_scheduled_lecture" placeholder="Lecture" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label class="muted">&nbsp;</label>
                  <input type="number" min="0" name="days_scheduled_lab" placeholder="Lab" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label class="muted">&nbsp;</label>
                  <input type="number" min="0" name="days_scheduled_activity" placeholder="Activity" />
                </div>
              </div>

              <div class="row">
                <div class="field" style="grid-column: span 4;">
                  <label># of Contact Hours per Day</label>
                  <input type="number" step="0.1" min="0" name="contact_per_day_lecture" placeholder="Lecture" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label class="muted">&nbsp;</label>
                  <input type="number" step="0.1" min="0" name="contact_per_day_lab" placeholder="Lab" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label class="muted">&nbsp;</label>
                  <input type="number" step="0.1" min="0" name="contact_per_day_activity" placeholder="Activity" />
                </div>
              </div>

              <div class="row">
                <div class="field" style="grid-column: span 4;">
                  <label>Total (Lecture)</label>
                  <input type="number" step="0.1" min="0" name="total_lecture" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label>Total (Lab)</label>
                  <input type="number" step="0.1" min="0" name="total_lab" />
                </div>
                <div class="field" style="grid-column: span 4;">
                  <label>Total (Activity)</label>
                  <input type="number" step="0.1" min="0" name="total_activity" />
                </div>
              </div>

              <div class="row">
                <div class="field" style="grid-column: span 6;">
                  <label>Notes / Additional Calculations</label>
                  <textarea name="notes"></textarea>
                </div>
                <div class="field" style="grid-column: span 6;">
                  <label>Payroll Information</label>
                  <textarea name="payroll_info"></textarea>
                </div>
              </div>

              <div class="row">
                <div class="field" style="grid-column: span 3;">
                  <label>Semester Lecture Hours</label>
                  <input type="number" step="0.1" min="0" name="sem_lect" />
                </div>
                <div class="field" style="grid-column: span 3;">
                  <label>Semester Lab Hours</label>
                  <input type="number" step="0.1" min="0" name="sem_lab" />
                </div>
                <div class="field" style="grid-column: span 3;">
                  <label>Semester Activity Hours</label>
                  <input type="number" step="0.1" min="0" name="sem_act" />
                </div>
                <div class="field" style="grid-column: span 3;">
                  <label>Sick Leave Hours</label>
                  <input type="number" step="0.1" min="0" name="sick_leave" />
                </div>
              </div>

              <div class="row">
                <div class="field" style="grid-column: span 6;">
                  <label>Date Forwarded to Payroll & HR</label>
                  <input type="date" name="date_forwarded" />
                </div>
                <div class="field" style="grid-column: span 6;">
                  <label>Date and Initial</label>
                  <input type="text" name="date_and_initial" placeholder="MM/DD/YYYY – Initials" />
                </div>
              </div>
            </div>
          </form>
        </main>
        <footer>
          <button id="printBtn" class="btn" type="button">Print</button>
          <button id="saveBtn" class="btn" type="button">Download JSON</button>
          <button id="clearBtn" class="btn" type="button">Clear</button>
          <button id="closeBtn2" class="btn" type="button">Close</button>
        </footer>
      </div>
    </div>
  `;

  const CHANGE_FIELDS = [
    'CRN','Subject & Course #','Time(s)','Day(s)','Short Term Dates','# of Weeks','Units','Capacity',
    'Building(s)','Room(s)','Instructor Full Name','Banner ID','Split Load Instructor','Split Load Banner ID'
  ];

  const STORAGE_KEY = 'cos_schedule_change_form_v1';

  function buildRows(tbody){
    CHANGE_FIELDS.forEach((label,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td><label class="muted">${label}</label></td>
        <td><input type="text" name="current_${i}" /></td>
        <td><input type="text" name="changed_${i}" /></td>
        <td style="text-align:center"><input type="checkbox" name="done_${i}" aria-label="Done for ${label}"></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function formToJSON(form){
    const data = new FormData(form);
    const obj = {};
    for(const [k,v] of data.entries()){
      if(obj[k]!==undefined){ Array.isArray(obj[k]) ? obj[k].push(v) : obj[k]=[obj[k],v]; }
      else obj[k]=v;
    }
    [...form.querySelectorAll('input[type="checkbox"][name^="done_"]')].forEach(cb=>{
      if(!(cb.name in obj)) obj[cb.name]=false;
    });
    return obj;
  }
  function jsonToForm(form,json){
    for(const el of form.elements){
      if(!el.name) continue;
      if(el.type==='checkbox' || el.type==='radio'){
        const v=json[el.name];
        if(Array.isArray(v)) el.checked=v.includes(el.value);
        else if(typeof v!=='undefined') el.checked=(v===true||v===el.value);
      } else if(typeof json[el.name] !== 'undefined'){ el.value=json[el.name]; }
    }
  }

  function focusTrap(modal, firstEl){
    function onKey(e){
      if(e.key==='Escape'){ modal.classList.remove('open'); }
      if(e.key!=='Tab') return;
      const focusables = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      const f = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
      if(!f.length) return;
      const first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ last.focus(); e.preventDefault(); }
      else if(!e.shiftKey && document.activeElement===last){ first.focus(); e.preventDefault(); }
    }
    modal.addEventListener('keydown', onKey);
    if(firstEl) firstEl.focus();
  }

  function attachBehavior(shadow, theme){
    const openBtn = shadow.getElementById('openBtn');
    const modal = shadow.getElementById('scfModal');
    const closeBtn = shadow.getElementById('closeBtn');
    const closeBtn2 = shadow.getElementById('closeBtn2');
    const printBtn = shadow.getElementById('printBtn');
    const saveBtn = shadow.getElementById('saveBtn');
    const clearBtn = shadow.getElementById('clearBtn');
    const form = shadow.getElementById('scf');
    const tbody = shadow.getElementById('rows');

    buildRows(tbody);

    function preserve(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(formToJSON(form))); }
    function restore(){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      try{ jsonToForm(form, JSON.parse(raw)); }catch(e){ console.warn('[SCF] restore failed', e); }
    }

    function open(){
      modal.classList.add('open');
      openBtn.setAttribute('aria-expanded','true');
      restore();
      setTimeout(()=>shadow.getElementById('year')?.focus(), 50);
      focusTrap(modal, shadow.getElementById('year'));
    }
    function close(){
      modal.classList.remove('open');
      openBtn.setAttribute('aria-expanded','false');
      openBtn.focus();
    }

    openBtn.addEventListener('click', open);
    [closeBtn, closeBtn2].forEach(b=>b.addEventListener('click', close));
    modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });

    form.addEventListener('input', preserve);
    clearBtn.addEventListener('click', ()=>{ if(confirm('Clear all fields?')){ form.reset(); localStorage.removeItem(STORAGE_KEY); }});
    saveBtn.addEventListener('click', ()=>{
      const blob = new Blob([JSON.stringify(formToJSON(form), null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='schedule-change-form.json'; a.click(); URL.revokeObjectURL(a.href);
    });
    printBtn.addEventListener('click', ()=>window.print());

    // expose for debugging if needed
    shadow.host.open = open;
    shadow.host.close = close;
  }

  function makeComponent(mountEl, opts){
    const theme = Object.assign({}, DEFAULT_THEME, opts?.theme || {});
    const buttonText = opts?.buttonText || 'Schedule Change Form';

    const host = document.createElement('div');
    host.setAttribute('data-scf','');
    const shadow = host.attachShadow({ mode:'open' });

    const styleVars = document.createElement('style');
    styleVars.textContent = cssVars(theme);
    shadow.appendChild(styleVars);

    const styleBase = document.createElement('style');
    styleBase.textContent = cssBase;
    shadow.appendChild(styleBase);

    const wrap = document.createElement('div');
    wrap.innerHTML = html(buttonText);
    shadow.appendChild(wrap);

    mountEl.appendChild(host);
    attachBehavior(shadow, theme);
  }

  window.ScheduleChangeForm = {
    init({ mount, buttonText, theme } = {}){
      const el = (typeof mount === 'string') ? document.querySelector(mount) : mount;
      if(!el){ console.error('[SCF] mount not found:', mount); return; }
      makeComponent(el, { buttonText, theme });
    }
  };
})();
