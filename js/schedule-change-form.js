// js/schedule-change-form.js — Shadow DOM component with DOCX export
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
    .lookup-panel{ background:linear-gradient(135deg,#eef9ff,#effff9); border:1px solid #d7e8f4; border-radius:.75rem; padding:.85rem; }
    .lookup-actions{ display:flex; gap:.5rem; align-items:end; flex-wrap:wrap }
    .lookup-actions .field{ min-width:190px }
    .status{ font-size:.85rem; color:#4b5563; min-height:1.2rem }
    .status.ok{ color:#047857 }
    .status.err{ color:#b91c1c }
    .export-group{ display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; margin-right:auto }
    .export-group select{ border:1px solid #dcdfe6; border-radius:.5rem; padding:.55rem .6rem; font-size:.95rem; background:#fff; }
    .export-group .status{ min-width:220px }
    .email-panel{ border:1px solid #d7e8f4; border-radius:.75rem; padding:.85rem; background:#f8fcff; margin-top:1rem }
    .email-panel summary{ cursor:pointer; font-weight:700; color:#123367 }
    .email-panel .email-actions{ display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-top:.75rem }
    .email-panel .note{ margin:.75rem 0 }
    .btn[disabled]{ opacity:.55; cursor:not-allowed }

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
            <div class="section lookup-panel">
              <h3>Autofill From Schedule</h3>
              <div class="lookup-actions">
                <div class="field">
                  <label for="crnLookup">CRN</label>
                  <input id="crnLookup" type="text" inputmode="numeric" placeholder="Enter CRN" list="crnOptions" />
                  <datalist id="crnOptions"></datalist>
                </div>
                <button id="lookupBtn" class="btn" type="button">Autofill</button>
                <div id="lookupStatus" class="status" aria-live="polite"></div>
              </div>
            </div>

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
          <details id="emailPanel" class="email-panel">
            <summary>Email Draft</summary>
            <p class="note">Prepare an Outlook / Microsoft 365 or local email draft. Recipients are editable; the app does not send automatically or enforce an approval route.</p>
            <div class="row" style="margin-top:.75rem">
              <div class="field" style="grid-column: span 6;">
                <label>To</label>
                <input id="emailTo" type="text" placeholder="recipient@college.edu" />
              </div>
              <div class="field" style="grid-column: span 3;">
                <label>CC</label>
                <input id="emailCc" type="text" placeholder="optional" />
              </div>
              <div class="field" style="grid-column: span 3;">
                <label>BCC</label>
                <input id="emailBcc" type="text" placeholder="optional" />
              </div>
            </div>
            <div class="row">
              <div class="field" style="grid-column: span 6;">
                <label>Subject</label>
                <input id="emailSubject" type="text" />
              </div>
              <div class="field" style="grid-column: span 6;">
                <label>Attachment option</label>
                <select id="emailAttachmentMode">
                  <option value="none">No attachment / draft only</option>
                  <option value="docx" selected>DOCX</option>
                  <option value="pdf" disabled hidden>PDF from DOCX</option>
                  <option value="both" disabled hidden>Both DOCX and PDF</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>Message body</label>
              <textarea id="emailBody">Attached is the schedule change request for review.</textarea>
            </div>
            <div class="email-actions">
              <button id="previewEmailBtn" class="btn" type="button">Open Outlook Draft / Email Draft</button>
              <div id="emailStatus" class="status" aria-live="polite">Microsoft 365 draft creation is not configured. Use the local email draft fallback and attach exported files manually.</div>
            </div>
          </details>
        </main>
        <footer>
          <div class="export-group">
            <label for="exportMode" class="muted">Export</label>
            <select id="exportMode">
              <option value="docx" selected>Export DOCX</option>
              <option value="pdf" disabled hidden>Export PDF from DOCX</option>
              <option value="both" disabled hidden>Export both DOCX and PDF</option>
            </select>
            <button id="exportScheduleChangeBtn" class="btn" type="button">Export DOCX</button>
            <button id="openEmailPanelBtn" class="btn" type="button" aria-controls="emailPanel" aria-expanded="false">Create Outlook Draft / Email Draft</button>
            <div id="exportStatus" class="status" aria-live="polite"></div>
          </div>
          <button id="printBtn" class="btn" type="button">Print</button>
          <button id="clearBtn" class="btn" type="button">Clear</button>
          <button id="closeBtn2" class="btn" type="button">Close</button>
        </footer>
      </div>
    </div>
  `;

  const CHANGE_FIELD_DEFS = [
    ['CRN', 'crn'],
    ['Subject & Course #', 'subject_course'],
    ['Time(s)', 'times'],
    ['Day(s)', 'days'],
    ['Short Term Dates', 'short_dates'],
    ['# of Weeks', 'weeks'],
    ['Units', 'units'],
    ['Capacity', 'capacity'],
    ['Building(s)', 'building'],
    ['Room(s)', 'room'],
    ['Instructor Full Name', 'instructor_full'],
    ['Banner ID', 'banner_id'],
    ['Split Load Instructor', 'split_instructor'],
    ['Split Load Banner ID', 'split_banner_id']
  ];

  const CHANGE_FIELDS = CHANGE_FIELD_DEFS.map(([label]) => label);
  const CHANGE_FIELD_EXPORT_KEYS = CHANGE_FIELD_DEFS.map(([, key]) => key);
  const PDF_CONVERSION_UNAVAILABLE_MESSAGE = 'PDF conversion is unavailable on the server. Please export DOCX and save as PDF from Word.';
  let exportCapabilitiesPromise = null;

  const CHANGE_FIELD_INDEX = CHANGE_FIELDS.reduce((acc, label, index) => {
    acc[label] = index;
    return acc;
  }, {});

  function scfBackendBaseUrl() {
    return window.BACKEND_BASE_URL ||
      window.COS_APP_CONFIG?.backendBaseUrl ||
      window.COS_BACKEND_BASE_URL ||
      'https://app-backend-pp98.onrender.com';
  }

  async function scfFetchExportCapabilities() {
    if (!exportCapabilitiesPromise) {
      exportCapabilitiesPromise = fetch(`${scfBackendBaseUrl()}/api/export-capabilities`, { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error(`Export capability check failed (${res.status})`);
          return res.json();
        })
        .catch(err => {
          console.warn('[SCF] Export capability check failed:', err);
          return {
            docxExport: true,
            pdfFromDocx: false,
            converter: 'unavailable',
            emailDraftSupported: true,
            microsoftGraphDraftSupported: false,
            mailtoFallbackSupported: true,
            directBackendSendSupported: false,
            emailDelivery: {
              draftSupported: true,
              graphDraft: false,
              mailto: true,
              backendSend: false,
              directBackendSend: false,
              attachments: false
            },
            notes: [PDF_CONVERSION_UNAVAILABLE_MESSAGE]
          };
        });
    }
    return exportCapabilitiesPromise;
  }

  function setExportStatus(shadow, message = '', type = '') {
    const status = shadow.getElementById('exportStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function setExportLoading(shadow, loading, message = '') {
    const button = shadow.getElementById('exportScheduleChangeBtn');
    const mode = shadow.getElementById('exportMode');
    if (button) button.disabled = Boolean(loading);
    if (mode) mode.disabled = Boolean(loading);
    if (message) setExportStatus(shadow, message);
  }

  function updateExportButtonLabel(shadow) {
    const mode = shadow.getElementById('exportMode')?.value || 'docx';
    const button = shadow.getElementById('exportScheduleChangeBtn');
    if (!button) return;
    button.textContent = mode === 'pdf'
      ? 'Export PDF'
      : mode === 'both'
        ? 'Export DOCX and PDF'
        : 'Export DOCX';
  }

  function applyExportCapabilities(shadow, capabilities) {
    const mode = shadow.getElementById('exportMode');
    if (!mode) return;
    const pdfAvailable = Boolean(capabilities?.pdfFromDocx);
    Array.from(mode.options || []).forEach(option => {
      if (option.value === 'pdf' || option.value === 'both') {
        option.disabled = !pdfAvailable;
        option.hidden = !pdfAvailable;
      }
    });
    if (!pdfAvailable && (mode.value === 'pdf' || mode.value === 'both')) mode.value = 'docx';
    const note = pdfAvailable
      ? `PDF conversion available: ${capabilities.converter || 'server converter'}.`
      : PDF_CONVERSION_UNAVAILABLE_MESSAGE;
    setExportStatus(shadow, note, pdfAvailable ? 'ok' : '');
    updateExportButtonLabel(shadow);
    applyEmailCapabilities(shadow, capabilities);
  }

  function scfEmailDefaults() {
    const config = window.SCF_EMAIL_DEFAULTS || window.COS_APP_CONFIG?.scheduleChangeEmailDefaults || {};
    return {
      to: config.to || config.recipients || '',
      cc: config.cc || '',
      bcc: config.bcc || '',
      subjectPrefix: config.subjectPrefix || 'Schedule Change Request',
      body: config.body || 'Attached is the schedule change request for review.'
    };
  }

  function selectedRadioValue(form, name) {
    return [...form.querySelectorAll(`[name="${name}"]`)].find(input => input.checked)?.value || '';
  }

  function scfEmailContext(shadow) {
    const form = shadow.getElementById('scf');
    const data = scfGetMergeData(shadow);
    return {
      term: selectedRadioValue(form, 'term'),
      crn: data.crn || '',
      course: data.subject_course || '',
      user: '',
      data
    };
  }

  function defaultEmailSubject(shadow) {
    const defaults = scfEmailDefaults();
    const context = scfEmailContext(shadow);
    const parts = [defaults.subjectPrefix, context.term, context.crn || context.course].filter(Boolean);
    return parts.join(' - ');
  }

  function seedEmailFields(shadow) {
    const defaults = scfEmailDefaults();
    const fields = [
      ['emailTo', defaults.to],
      ['emailCc', defaults.cc],
      ['emailBcc', defaults.bcc],
      ['emailBody', defaults.body]
    ];
    fields.forEach(([id, value]) => {
      const node = shadow.getElementById(id);
      if (node && !node.value) node.value = Array.isArray(value) ? value.join(', ') : String(value || '');
    });
    const subject = shadow.getElementById('emailSubject');
    if (subject && !subject.value) subject.value = defaultEmailSubject(shadow);
  }

  function setEmailStatus(shadow, message = '', type = '') {
    const status = shadow.getElementById('emailStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function parseEmailList(value) {
    return String(value || '').split(/[;,]/).map(item => item.trim()).filter(Boolean);
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function readEmailFields(shadow) {
    const email = {
      recipients: parseEmailList(shadow.getElementById('emailTo')?.value),
      cc: parseEmailList(shadow.getElementById('emailCc')?.value),
      bcc: parseEmailList(shadow.getElementById('emailBcc')?.value),
      subject: shadow.getElementById('emailSubject')?.value || defaultEmailSubject(shadow),
      body: shadow.getElementById('emailBody')?.value || '',
      attachmentMode: shadow.getElementById('emailAttachmentMode')?.value || 'docx'
    };
    const invalid = [...email.recipients, ...email.cc, ...email.bcc].filter(item => !validEmail(item));
    if (!email.recipients.length) throw new Error('Enter at least one recipient.');
    if (invalid.length) throw new Error(`Invalid email address: ${invalid[0]}`);
    return email;
  }

  function buildScheduleChangeMailtoUrl(email) {
    const params = new URLSearchParams();
    if (email.cc.length) params.set('cc', email.cc.join(','));
    if (email.bcc.length) params.set('bcc', email.bcc.join(','));
    params.set('subject', email.subject);
    params.set('body', `${email.body || ''}\n\nAttachments cannot be added automatically through the email draft fallback. Download the DOCX/PDF from the app and attach it manually.`);
    return `mailto:${encodeURIComponent(email.recipients.join(','))}?${params.toString()}`;
  }

  function applyEmailCapabilities(shadow, capabilities) {
    const pdfAvailable = Boolean(capabilities?.pdfFromDocx);
    const graphDraft = Boolean(capabilities?.microsoftGraphDraftSupported || capabilities?.emailDelivery?.graphDraft);
    const attachmentMode = shadow.getElementById('emailAttachmentMode');
    Array.from(attachmentMode?.options || []).forEach(option => {
      if (option.value === 'pdf' || option.value === 'both') {
        option.disabled = !pdfAvailable;
        option.hidden = !pdfAvailable;
      }
    });
    if (!pdfAvailable && (attachmentMode?.value === 'pdf' || attachmentMode?.value === 'both')) attachmentMode.value = 'docx';
    setEmailStatus(shadow, graphDraft
      ? 'Microsoft 365 draft creation is available. Review recipients before opening the draft.'
      : 'Microsoft 365 draft creation is not configured. Opening local email draft instead. Attach exported DOCX/PDF manually.', graphDraft ? 'ok' : '');
  }

  async function createMicrosoftGraphDraft(shadow, email) {
    const { blob, baseName } = await scfBuildOfficialDocx(shadow);
    const attachments = email.attachmentMode === 'none'
      ? []
      : await scheduleChangeEmailAttachments(shadow, email.attachmentMode, blob, baseName);
    const context = scfEmailContext(shadow);
    const response = await fetch(`${scfBackendBaseUrl()}/api/schedule-change/create-email-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: email.recipients,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        attachments,
        metadata: {
          term: context.term,
          crn: context.crn,
          course: context.course,
          timestamp: new Date().toISOString()
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `Email draft creation failed (${response.status})`);
    }
    return payload;
  }

  async function openEmailDraft(shadow) {
    try {
      const email = readEmailFields(shadow);
      const capabilities = await scfFetchExportCapabilities();
      const graphDraft = Boolean(capabilities?.microsoftGraphDraftSupported || capabilities?.emailDelivery?.graphDraft);
      if (graphDraft) {
        try {
          setEmailStatus(shadow, 'Creating Microsoft 365 draft...');
          const draft = await createMicrosoftGraphDraft(shadow, email);
          if (draft.webLink) window.open(draft.webLink, '_blank', 'noopener');
          setEmailStatus(shadow, 'Microsoft 365 draft created. Review and send from Outlook.', 'ok');
          return;
        } catch (draftErr) {
          console.warn('[SCF] Microsoft 365 draft failed, falling back to mailto:', draftErr);
          setEmailStatus(shadow, 'Microsoft 365 draft creation failed. Opening local email draft instead.');
        }
      }
      window.location.href = buildScheduleChangeMailtoUrl(email);
      setEmailStatus(shadow, 'Mail draft opened without attachments. Please attach the exported DOCX/PDF manually.', 'ok');
    } catch (err) {
      setEmailStatus(shadow, `${err.message || 'Email draft could not be opened.'} Please download the form and send manually.`, 'err');
    }
  }

  // ===== Exports =====
  function scfMark(b){ return b ? "☒" : "☐"; }

  function getChangeFieldData(form) {
    const getCurrent = label => {
      const index = CHANGE_FIELD_INDEX[label];
      return index === undefined ? '' : (form.elements[`current_${index}`]?.value || '');
    };
    const getChanged = label => {
      const index = CHANGE_FIELD_INDEX[label];
      return index === undefined ? '' : (form.elements[`changed_${index}`]?.value || '');
    };
    const getDone = label => {
      const index = CHANGE_FIELD_INDEX[label];
      return index === undefined ? false : Boolean(form.elements[`done_${index}`]?.checked);
    };
    return CHANGE_FIELD_DEFS.reduce((acc, [label, key]) => {
      acc[key] = getCurrent(label);
      acc[`${key}_changed`] = getChanged(label);
      acc[`${key}_done`] = scfMark(getDone(label));
      return acc;
    }, {});
  }

  function scfGetMergeData(shadow){
    const form = shadow.getElementById('scf');
    const fd = new FormData(form);
    const data = {};
    for (const [k,v] of fd.entries()){
      if (data[k] !== undefined) {
        if (Array.isArray(data[k])) data[k].push(v); else data[k] = [data[k], v];
      } else data[k] = v;
    }
    const has = (name, value)=>{
      const els = form.querySelectorAll(`[name="${name}"]`);
      for (const el of els) if ((el.type==='checkbox'||el.type==='radio') && el.checked && el.value===value) return true;
      return false;
    };

    return {
      ...getChangeFieldData(form),
      year: data.year || "",
      date_sent: data.date_sent || "",
      date_processed: data.date_processed || "",
      date_forwarded: data.date_forwarded || "",
      date_and_initial: data.date_and_initial || "",
      division_chair: data.division_chair || "",
      area_dean: data.area_dean || "",

      term_spring: scfMark(has('term','Spring')),
      term_summer: scfMark(has('term','Summer')),
      term_fall:   scfMark(has('term','Fall')),

      campus_visalia:   scfMark(has('campus','Visalia')),
      campus_tulare:    scfMark(has('campus','Tulare')),
      campus_hanford:   scfMark(has('campus','Hanford')),
      campus_online:    scfMark(has('campus','Online')),
      campus_offcampus: scfMark(has('campus','Off-Campus')),

      action_modification: scfMark(has('action','Modification')),
      action_cancel_no_staff: scfMark(has('action','Cancel - No Staff')),
      action_cancel_low_enroll: scfMark(has('action','Cancel - Low Enroll')),
      action_cancel_rebuild: scfMark(has('action','Cancel - Rebuild')),
      action_cancel_clerical: scfMark(has('action','Cancel - Clerical Err.')),
      action_cancel_sched_dev: scfMark(has('action','Cancel - Sched. Dev.')),
      action_uncancel: scfMark(has('action','Un-Cancel')),
      action_addition: scfMark(has('action','Addition')),
      action_activation: scfMark(has('action','Activation')),
      action_inactivate: scfMark(has('action','Inactivate')),
      num_enrolled: data.num_enrolled || "",
      adj_canceled: data.adj_canceled || "",
      class_comp_yes: scfMark(has('class_comp_sent','Yes')),
      class_comp_no: scfMark(has('class_comp_sent','No')),

      visible_yes: scfMark(has('visible','Yes')),
      visible_no:  scfMark(has('visible','No')),

      lecture_hours:   data.lecture_hours   || "",
      lab_hours:       data.lab_hours       || "",
      activity_hours:  data.activity_hours  || "",
      sem_lect:        data.sem_lect        || "",
      sem_lab:         data.sem_lab         || "",
      sem_act:         data.sem_act         || "",
      sick_leave:      data.sick_leave      || ""
    };
  }

async function scfBuildOfficialDocx(shadow){
  // 1) Where your template lives (keep relative if deploying under a subpath)
  const TEMPLATE_URL = window.SCF_TEMPLATE_URL || 'templates/Change_of_Schedule_Form_CRN_ONLY_v2.docx';

  // 2) Tags expected in the template
  const changeFieldTags = CHANGE_FIELD_EXPORT_KEYS.reduce((tags, key) => {
    tags.push(key, `${key}_changed`, `${key}_done`);
    return tags;
  }, []);

  const EXPECTED_TAGS = [
    ...changeFieldTags,
    'year','date_sent','date_processed','date_forwarded','date_and_initial','division_chair','area_dean',
    'term_spring','term_summer','term_fall',
    'campus_visalia','campus_tulare','campus_hanford','campus_online','campus_offcampus',
    'action_modification','action_cancel_no_staff','action_cancel_low_enroll',
    'action_cancel_rebuild','action_cancel_clerical','action_cancel_sched_dev',
    'action_uncancel','action_addition','action_activation','action_inactivate',
    'num_enrolled','adj_canceled','class_comp_yes','class_comp_no',
    'visible_yes','visible_no',
    'lecture_hours','lab_hours','activity_hours','sem_lect','sem_lab','sem_act','sick_leave'
  ];

  try{
    // Load template (no-cache to avoid stale 404s or old copies)
    const res = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if(!res.ok) throw new Error(`Fetch failed (${res.status}) at ${TEMPLATE_URL}`);
    const content = await res.arrayBuffer();

    // Build data from the form
    const data = scfGetMergeData(shadow);

    // Optional: warn early if any expected keys are missing
    const missingProvided = EXPECTED_TAGS.filter(k => !(k in data));
    if (missingProvided.length) {
      console.warn('[SCF] Data object is missing keys (will render as empty):', missingProvided);
      // This is just a warning; export will still proceed with empty strings.
    }

    // Init docxtemplater with a nullGetter so missing keys don’t throw
    const zip = new window.PizZip(content);
    const doc = new window.docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: (part) => {
        // part = { tag, scopePath, filePath, ... }
        console.warn('[SCF] Missing tag in data (rendering empty):', part.tag);
        return ''; // Render empty string if a key isn’t provided
      }
    });

    // Merge + render
    doc.setData(data);
    doc.render(); // If template has syntax issues, this will still throw

    const blob = doc.getZip().generate({ type:'blob' });
    const baseName = `Change_of_Schedule_${data.crn || data.year || 'form'}`;
    return { blob, data, baseName };
  } catch (e) {
    console.error('[SCF] DOCX export failed:', e);

    // Docxtemplater-specific error info (very helpful)
    if (e.properties && Array.isArray(e.properties.errors)) {
      const details = e.properties.errors
        .map(err => `• ${err.properties?.explanation || err.message || String(err)}`)
        .join('\n');
      alert(
        'DOCX export failed while rendering the template.\n\n' +
        details + '\n\n' +
        'Tips:\n' +
        '• Make sure the template tags exactly match the data keys (see console).\n' +
        '• If the error mentions an unknown tag, open the DOCX and search for that tag.\n' +
        '• Keep the template in compatibility mode (no content controls).'
      );
      throw e;
    }

    alert(
      'DOCX export failed.\n' +
      `Template URL: ${window.SCF_TEMPLATE_URL || 'templates/Change_of_Schedule_Form_CRN_ONLY_v2.docx'}\n` +
      '• Confirm PizZip, Docxtemplater, FileSaver are loaded.\n' +
      '• Serve via http:// (not file://) when testing locally.\n' +
      'Check the console for the full stack trace.'
    );
    throw e;
  }
}

async function scfExportDocx(shadow){
  try {
    const { blob, baseName } = await scfBuildOfficialDocx(shadow);
    window.saveAs(blob, `${baseName}.docx`);
    setExportStatus(shadow, 'DOCX exported.', 'ok');
  } catch (e) {
    // scfBuildOfficialDocx already alerts with details.
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read generated DOCX.'));
    reader.readAsDataURL(blob);
  });
}

async function scfExportPdf(shadow) {
  try {
    const { blob, baseName } = await scfBuildOfficialDocx(shadow);
    await scfConvertDocxBlobToPdf(blob, baseName);
    setExportStatus(shadow, 'PDF exported from DOCX.', 'ok');
  } catch (e) {
    console.error('[SCF] PDF export failed:', e);
    setExportStatus(shadow, e.message || 'PDF conversion failed.', 'err');
    alert(
      'PDF export failed while converting the official DOCX form.\n\n' +
      `${e.message || e}\n\n` +
      PDF_CONVERSION_UNAVAILABLE_MESSAGE
    );
  }
}

async function scfConvertDocxBlobToPdf(blob, baseName) {
    const pdfBlob = await scfFetchPdfBlobFromDocx(blob, baseName);
    window.saveAs(pdfBlob, `${baseName}.pdf`);
}

async function scfFetchPdfBlobFromDocx(blob, baseName) {
    const docxBase64 = await blobToBase64(blob);
    const res = await fetch(`${scfBackendBaseUrl()}/api/schedule-change/convert-docx-to-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: `${baseName}.docx`, docxBase64 })
    });
    if (!res.ok) {
      const contentType = res.headers.get('Content-Type') || '';
      const message = contentType.includes('application/json')
        ? (await res.json()).error
        : await res.text();
      throw new Error(message || `PDF conversion failed (${res.status})`);
    }
    return res.blob();
}

async function scfExportSelected(shadow) {
  const mode = shadow.getElementById('exportMode')?.value || 'docx';
  try {
    if (mode === 'docx') {
      setExportLoading(shadow, true, 'Generating DOCX...');
      const { blob, baseName } = await scfBuildOfficialDocx(shadow);
      window.saveAs(blob, `${baseName}.docx`);
      setExportStatus(shadow, 'DOCX exported.', 'ok');
      return;
    }
    const capabilities = await scfFetchExportCapabilities();
    if (!capabilities.pdfFromDocx) throw new Error(PDF_CONVERSION_UNAVAILABLE_MESSAGE);
    setExportLoading(shadow, true, 'Generating PDF from DOCX...');
    const { blob, baseName } = await scfBuildOfficialDocx(shadow);
    if (mode === 'both') window.saveAs(blob, `${baseName}.docx`);
    await scfConvertDocxBlobToPdf(blob, baseName);
    setExportStatus(shadow, mode === 'both' ? 'DOCX and PDF exported.' : 'PDF exported from DOCX.', 'ok');
  } catch (e) {
    console.error('[SCF] Export failed:', e);
    const message = e.message || 'Schedule Change Form export failed.';
    setExportStatus(shadow, message, 'err');
    if (mode !== 'docx') {
      alert(
        'PDF export failed while converting the official DOCX form.\n\n' +
        `${message}\n\n` +
        PDF_CONVERSION_UNAVAILABLE_MESSAGE
      );
    }
  } finally {
    setExportLoading(shadow, false);
    updateExportButtonLabel(shadow);
  }
}

async function scheduleChangeEmailAttachments(shadow, mode, blob, baseName) {
  const attachments = [];
  if (mode === 'docx' || mode === 'both') {
    attachments.push({
      filename: `${baseName}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contentBase64: await blobToBase64(blob)
    });
  }
  if (mode === 'pdf' || mode === 'both') {
    const pdfBlob = await scfFetchPdfBlobFromDocx(blob, baseName);
    attachments.push({
      filename: `${baseName}.pdf`,
      contentType: 'application/pdf',
      contentBase64: await blobToBase64(pdfBlob)
    });
  }
  return attachments;
}

async function sendScheduleChangeEmail(shadow) {
  try {
    const capabilities = await scfFetchExportCapabilities();
    if (!capabilities.directBackendSendSupported && !capabilities.emailDelivery?.directBackendSend) {
      throw new Error('Direct backend sending is disabled. Use Open Email Draft or download the DOCX/PDF and send manually.');
    }
    const email = readEmailFields(shadow);
    if (!confirm('Send this schedule change request to the listed recipients?')) {
      setEmailStatus(shadow, 'Email send cancelled.');
      return;
    }
    setEmailStatus(shadow, 'Preparing email attachment...');
    const { blob, baseName } = await scfBuildOfficialDocx(shadow);
    const attachments = await scheduleChangeEmailAttachments(shadow, email.attachmentMode, blob, baseName);
    setEmailStatus(shadow, 'Sending email...');
    const context = scfEmailContext(shadow);
    const response = await fetch(`${scfBackendBaseUrl()}/api/schedule-change/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: email.recipients,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        attachments,
        metadata: {
          term: context.term,
          crn: context.crn,
          course: context.course,
          timestamp: new Date().toISOString()
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `Email send failed (${response.status})`);
    }
    setEmailStatus(shadow, `Email sent${payload.providerMessageId ? ` (${payload.providerMessageId})` : ''}.`, 'ok');
  } catch (err) {
    console.error('[SCF] Email send failed:', err);
    setEmailStatus(shadow, `${err.message || 'Email send failed.'} Download DOCX/PDF or open an email draft to send manually.`, 'err');
  }
}

  function extractField(row, keys) {
    for (const key of keys) {
      const candidates = [
        key,
        key.toLowerCase(),
        key.toUpperCase(),
        key.replace(/\s+/g, '_'),
        key.replace(/\s+/g, '_').toLowerCase(),
        key.replace(/\s+/g, '_').toUpperCase()
      ];
      for (const candidate of candidates) {
        const value = row?.[candidate];
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
      }
    }
    return '';
  }

  function setFieldValue(form, label, value) {
    const index = CHANGE_FIELD_INDEX[label];
    if (index === undefined) return;
    const input = form.elements[`current_${index}`];
    if (input) input.value = value || '';
  }

  function setChecked(form, name, values) {
    const wanted = new Set((Array.isArray(values) ? values : [values]).filter(Boolean));
    [...form.querySelectorAll(`[name="${name}"]`)].forEach(input => {
      input.checked = wanted.has(input.value);
    });
  }

  function normalizeDayList(days) {
    if (Array.isArray(days)) return days.filter(Boolean);
    const daysMap = { U:'Sunday', M:'Monday', T:'Tuesday', W:'Wednesday', R:'Thursday', F:'Friday', S:'Saturday' };
    return String(days || '').split('').map(day => daysMap[day] || day).filter(Boolean);
  }

  function getCourseValue(row) {
    const subjectCourse = extractField(row, ['Subject_Course', 'Subject Course', 'Course']);
    if (subjectCourse) return subjectCourse;
    return [extractField(row, ['Subject', 'SUBJ']), extractField(row, ['Course Number', 'Course_Num', 'COURSE'])]
      .filter(Boolean)
      .join(' ');
  }

  function getTimeValue(row) {
    const time = extractField(row, ['Time', 'Meeting Time']);
    if (time) return time;
    const start = extractField(row, ['Start_Time', 'Start Time']);
    const end = extractField(row, ['End_Time', 'End Time']);
    return [start, end].filter(Boolean).join(' - ');
  }

  function getDateRangeValue(row) {
    const start = extractField(row, ['Start_Date', 'Start Date', 'Start']);
    const end = extractField(row, ['End_Date', 'End Date', 'End']);
    return [start, end].filter(Boolean).join(' - ');
  }

  function getTermSeason(term) {
    return ['Spring', 'Summer', 'Fall'].find(season => String(term || '').includes(season)) || '';
  }

  function getCampusValue(row) {
    const campus = extractField(row, ['Campus']);
    const building = extractField(row, ['Building']);
    if (/tulare|tcc/i.test(campus) || /^TCC/i.test(building)) return 'Tulare';
    if (/hanford/i.test(campus) || /^HAN/i.test(building)) return 'Hanford';
    if (/online/i.test(campus) || /^ONLINE/i.test(building)) return 'Online';
    if (/off/i.test(campus)) return 'Off-Campus';
    return campus ? 'Visalia' : '';
  }

  function getRoomCapacityValue(row) {
    const sectionCapacity = extractField(row, ['Capacity', 'Max Enrollment', 'Enrollment Max', 'Cap']);
    if (sectionCapacity) return sectionCapacity;
    const building = extractField(row, ['Building']);
    const room = extractField(row, ['Room']);
    const roomMeta = (window.ROOM_CATALOG || []).find(item =>
      String(item.building || '').trim() === building &&
      String(item.room || '').trim() === room
    );
    return roomMeta?.capacity == null ? '' : String(roomMeta.capacity);
  }

  function findScheduleRowByCrn(getScheduleData, crn) {
    const normalized = String(crn || '').trim();
    if (!normalized) return null;
    return (getScheduleData?.() || []).find(row => extractField(row, ['CRN']) === normalized) || null;
  }

  function populateCrnOptions(datalist, getScheduleData) {
    if (!datalist) return;
    const crns = [...new Set((getScheduleData?.() || [])
      .map(row => extractField(row, ['CRN']))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    datalist.replaceChildren();
    crns.forEach(crn => datalist.appendChild(new Option(crn, crn)));
  }

  function autofillFromCrn(shadow, getScheduleData, getCurrentTerm) {
    const form = shadow.getElementById('scf');
    const crnInput = shadow.getElementById('crnLookup');
    const status = shadow.getElementById('lookupStatus');
    const row = findScheduleRowByCrn(getScheduleData, crnInput?.value);
    if (!row) {
      status.textContent = crnInput?.value ? `No loaded section found for CRN ${crnInput.value}.` : 'Enter a CRN to autofill.';
      status.className = 'status err';
      return;
    }

    const building = extractField(row, ['Building']);
    const room = extractField(row, ['Room']);
    const instructor = extractField(row, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty']);

    setFieldValue(form, 'CRN', extractField(row, ['CRN']));
    setFieldValue(form, 'Subject & Course #', getCourseValue(row));
    setFieldValue(form, 'Time(s)', getTimeValue(row));
    setFieldValue(form, 'Day(s)', normalizeDayList(row.Days || extractField(row, ['DAYS', 'Days'])).join(', '));
    setFieldValue(form, 'Short Term Dates', getDateRangeValue(row));
    setFieldValue(form, '# of Weeks', extractField(row, ['Weeks', '# of Weeks', 'Number of Weeks']));
    setFieldValue(form, 'Units', extractField(row, ['Units', 'Credit Hours', 'Credits']));
    setFieldValue(form, 'Capacity', getRoomCapacityValue(row));
    setFieldValue(form, 'Building(s)', building);
    setFieldValue(form, 'Room(s)', room);
    setFieldValue(form, 'Instructor Full Name', instructor);
    setFieldValue(form, 'Banner ID', extractField(row, ['Banner ID', 'Banner_ID', 'Instructor ID']));

    setChecked(form, 'term', getTermSeason(getCurrentTerm?.()));
    setChecked(form, 'campus', getCampusValue(row));

    status.textContent = `Autofilled ${getCourseValue(row) || 'section'} from CRN ${extractField(row, ['CRN'])}.`;
    status.className = 'status ok';
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
// Build the "Change Details" table rows
function buildRows(tbody){
  if (!tbody) return;
  // Avoid duplicating rows if init runs twice
  tbody.innerHTML = '';
  CHANGE_FIELDS.forEach((label, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><label class="muted">${label}</label></td>
      <td><input type="text" name="current_${i}" /></td>
      <td><input type="text" name="changed_${i}" /></td>
      <td style="text-align:center">
        <input type="checkbox" name="done_${i}" aria-label="Done for ${label}">
      </td>
    `;
    tbody.appendChild(tr);
  });
}

  function attachBehavior(shadow, opts){
    const openBtn = shadow.getElementById('openBtn');
    const modal = shadow.getElementById('scfModal');
    const closeBtn = shadow.getElementById('closeBtn');
    const closeBtn2 = shadow.getElementById('closeBtn2');
    const printBtn = shadow.getElementById('printBtn');
    const exportMode = shadow.getElementById('exportMode');
    const exportScheduleChangeBtn = shadow.getElementById('exportScheduleChangeBtn');
    const openEmailPanelBtn = shadow.getElementById('openEmailPanelBtn');
    const clearBtn = shadow.getElementById('clearBtn');
    const lookupBtn = shadow.getElementById('lookupBtn');
    const crnLookup = shadow.getElementById('crnLookup');
    const crnOptions = shadow.getElementById('crnOptions');
    const lookupStatus = shadow.getElementById('lookupStatus');
    const emailPanel = shadow.getElementById('emailPanel');
    const previewEmailBtn = shadow.getElementById('previewEmailBtn');
    const emailSubject = shadow.getElementById('emailSubject');
    const form = shadow.getElementById('scf');
    const tbody = shadow.getElementById('rows');
    const getScheduleData = opts?.getScheduleData || (() => []);
    const getCurrentTerm = opts?.getCurrentTerm || (() => '');

    buildRows(tbody);
    updateExportButtonLabel(shadow);
    scfFetchExportCapabilities().then(capabilities => applyExportCapabilities(shadow, capabilities));

    function resetFormState() {
      form.reset();
      if (crnLookup) crnLookup.value = '';
      if (lookupStatus) {
        lookupStatus.textContent = '';
        lookupStatus.className = 'status';
      }
    }

    function open(){
      resetFormState();
      modal.classList.add('open');
      openBtn.setAttribute('aria-expanded','true');
      populateCrnOptions(crnOptions, getScheduleData);
      seedEmailFields(shadow);
      setTimeout(()=>crnLookup?.focus(), 50);
      focusTrap(modal, crnLookup);
    }
    function close(){
      resetFormState();
      modal.classList.remove('open');
      openBtn.setAttribute('aria-expanded','false');
      openBtn.focus();
    }

    openBtn.addEventListener('click', open);
    [closeBtn, closeBtn2].forEach(b=>b.addEventListener('click', close));
    modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });

    lookupBtn.addEventListener('click', () => {
      autofillFromCrn(shadow, getScheduleData, getCurrentTerm);
      if (emailSubject) emailSubject.value = defaultEmailSubject(shadow);
    });
    crnLookup.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        autofillFromCrn(shadow, getScheduleData, getCurrentTerm);
        if (emailSubject) emailSubject.value = defaultEmailSubject(shadow);
      }
    });
    clearBtn.addEventListener('click', ()=>{
      if(confirm('Clear all fields?')){
        resetFormState();
      }
    });
    printBtn.addEventListener('click', ()=>window.print());
    if (exportMode) exportMode.addEventListener('change', () => updateExportButtonLabel(shadow));
    if (exportScheduleChangeBtn) exportScheduleChangeBtn.addEventListener('click', () => scfExportSelected(shadow));
    if (openEmailPanelBtn && emailPanel) {
      openEmailPanelBtn.addEventListener('click', () => {
        emailPanel.open = true;
        openEmailPanelBtn.setAttribute('aria-expanded', 'true');
        seedEmailFields(shadow);
        emailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => shadow.getElementById('emailTo')?.focus(), 100);
      });
      emailPanel.addEventListener('toggle', () => {
        openEmailPanelBtn.setAttribute('aria-expanded', emailPanel.open ? 'true' : 'false');
      });
    }
    if (previewEmailBtn) previewEmailBtn.addEventListener('click', () => openEmailDraft(shadow));

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
    attachBehavior(shadow, opts);
  }

  window.ScheduleChangeForm = {
    init({ mount, buttonText, theme, getScheduleData, getCurrentTerm } = {}){
      const el = (typeof mount === 'string') ? document.querySelector(mount) : mount;
      if(!el){ console.error('[SCF] mount not found:', mount); return; }
      makeComponent(el, { buttonText, theme, getScheduleData, getCurrentTerm });
    }
  };
})();
