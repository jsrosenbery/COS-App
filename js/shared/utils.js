// Shared browser utilities used by feature modules and gradual app.js extraction.
(function () {
  function backendBaseUrl() {
    return window.BACKEND_BASE_URL || window.COS_APP_CONFIG?.backendBaseUrl || '';
  }

  function featureEnabled(name) {
    return window.COS_APP_CONFIG?.features?.[name] !== false;
  }

  function jsonHeaders(extra = {}) {
    return {
      'Content-Type': 'application/json',
      ...extra
    };
  }

  const commonAnalyticsDefinitions = [
    ['Campus Choice Count', 'Number of distinct campus codes represented in a day/time bucket after filters and exclusions are applied.'],
    ['Course Choice Count', 'Number of distinct discipline + course combinations available in a day/time bucket after CRN/day/time deduplication.'],
    ['GE Choice Count', 'Number of distinct CAL-GETC mapped courses available in a day/time bucket after filters are applied.'],
    ['Subject Breadth Count', 'Number of distinct subject/discipline codes represented in a day/time bucket.'],
    ['Seat Choice Count', 'Total section capacity offered in a day/time bucket.'],
    ['Modality Choice Count', 'Number of distinct reportable modality categories represented in a bucket.'],
    ['Choice Diversity Index', '0-100 index that increases when a time block has more unique courses, more unique subjects, more CAL-GETC/GE choices, and less concentration in only one or two courses. High diversity means many different courses/subjects are available. Low diversity means many seats or sections may be concentrated in a small number of courses.'],
    ['Student Presence', 'Estimated students physically scheduled in a time block. Uses census enrollment when available, otherwise actual/current enrollment, and adds that enrollment to each half-hour interval the section overlaps.'],
    ['Sections Active', 'Distinct CRNs active in a day/time bucket. Duplicate meeting rows for the same CRN/day/start/end are counted once.'],
    ['Seats Offered', 'Total section capacity available in the selected scope or time bucket.'],
    ['Enrollment Present', 'Enrollment represented in a selected time bucket, using census enrollment when available and actual/current enrollment when census is unavailable.'],
    ['Fill Rate', 'Enrollment divided by seats offered. Census enrollment is preferred; actual/current enrollment is used when census is unavailable.'],
    ['Waitlist Pressure', 'Waitlist count relative to seat supply and fill rate. Used as an indicator that observed enrollment may understate demand when sections are full or near full.'],
    ['Empty Seats', 'Seats offered minus enrollment, floored at zero unless a report explicitly displays over-capacity context.'],
    ['Faculty Count', 'Distinct faculty represented in a bucket after omitted faculty rows are excluded.'],
    ['LHE', 'Lecture Hour Equivalent value from the Faculty Schedule source. LHE is summed across included instructional meeting rows after deduplication.'],
    ['Prime-Time Concentration', 'Share of the selected metric occurring during the configured prime-time window. Default prime time is Monday-Thursday, 9:00 AM-3:00 PM.'],
    ['Choice Gap', 'A planning pattern where student choice is limited relative to enrollment pressure or fill behavior. It is an evidence-informed prompt, not proof of unmet preference.'],
    ['Hidden Demand', 'A planning pattern where limited supply, high fill, waitlist pressure, or strong presence suggests demand may be constrained by the available schedule.'],
    ['Oversupply', 'A planning pattern where seats or sections are high relative to enrollment, fill, and waitlist evidence.'],
    ['Expansion Candidate', 'A recommendation category indicating that added capacity may be worth review when demand evidence is strong and choice/supply are limited.'],
    ['Consolidation Candidate', 'A recommendation category indicating that low-filled sections may be worth review when receiving capacity and student choice impacts appear manageable.']
  ];

  const standardAnalyticsAssumptions = [
    'Census enrollment is preferred when available.',
    'Actual/current enrollment is used when census is unavailable.',
    'Online/TBA sections are excluded from physical time-based analysis unless selected.',
    'Duplicate CRNs are counted once unless distinct meeting times exist.',
    'Lecture/lab/activity may count separately when meeting times differ.',
    'Reports show evidence-informed patterns, not proof of student preference.'
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const COLLAPSIBLE_STORAGE_PREFIX = 'cos-collapsible-section:';

  function slugify(value) {
    return String(value || 'section')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  function readStoredOpenState(id) {
    if (!id) return null;
    try {
      const value = window.localStorage?.getItem(`${COLLAPSIBLE_STORAGE_PREFIX}${id}`);
      return value === null || value === undefined ? null : value !== 'collapsed';
    } catch (err) {
      return null;
    }
  }

  function writeStoredOpenState(id, isOpen) {
    if (!id) return;
    try {
      window.localStorage?.setItem(`${COLLAPSIBLE_STORAGE_PREFIX}${id}`, isOpen ? 'open' : 'collapsed');
    } catch (err) {
      // localStorage can be unavailable in private or embedded contexts.
    }
  }

  function setCollapsibleOpen(section, isOpen, options = {}) {
    if (!section) return;
    const button = section.querySelector?.('.collapsible-section-toggle');
    const body = section.querySelector?.('.collapsible-section-body');
    const normalizedOpen = Boolean(isOpen);
    section.classList.toggle('is-collapsed', !normalizedOpen);
    section.dataset.collapsibleOpen = normalizedOpen ? 'true' : 'false';
    if (button) {
      button.setAttribute('aria-expanded', normalizedOpen ? 'true' : 'false');
      const state = button.querySelector?.('.collapsible-section-state');
      if (state) state.textContent = normalizedOpen ? 'Collapse' : 'Expand';
    }
    if (body) body.hidden = !normalizedOpen;
    if (options.persist !== false) writeStoredOpenState(section.dataset.collapsibleId, normalizedOpen);
  }

  function createCollapsibleSection(options = {}) {
    const id = slugify(options.id || options.title || `section-${Date.now()}`);
    const title = options.title || 'Section';
    const section = document.createElement('section');
    section.className = ['collapsible-section', options.className || ''].filter(Boolean).join(' ');
    section.dataset.collapsibleId = id;
    const bodyId = `${id}-body`;
    const header = document.createElement('div');
    header.className = 'collapsible-section-header';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'collapsible-section-toggle';
    button.setAttribute('aria-controls', bodyId);
    button.innerHTML = `<span class="collapsible-section-chevron" aria-hidden="true"></span><span class="collapsible-section-title">${escapeHtml(title)}</span><span class="collapsible-section-state"></span>`;
    header.appendChild(button);
    const body = document.createElement('div');
    body.className = 'collapsible-section-body';
    body.id = bodyId;
    if (typeof Node !== 'undefined' && options.body instanceof Node) body.appendChild(options.body);
    else if (options.html !== undefined) body.innerHTML = String(options.html);
    section.append(header, body);
    button.addEventListener('click', () => {
      setCollapsibleOpen(section, button.getAttribute('aria-expanded') !== 'true', { persist: options.persist });
    });
    const stored = options.persist === false ? null : readStoredOpenState(id);
    setCollapsibleOpen(section, stored ?? options.defaultOpen !== false, { persist: false });
    return section;
  }

  function applyCollapsibleSection(target, options = {}) {
    if (!target || target.dataset?.collapsibleBound === 'true') return target?.closest?.('.collapsible-section') || null;
    if (target.classList?.contains('collapsible-section')) return target;
    const id = slugify(options.id || target.id || target.dataset?.collapsibleId || target.dataset?.collapsibleTitle || options.title);
    const title = options.title || target.dataset?.collapsibleTitle || target.getAttribute?.('aria-label') || target.querySelector?.('h2,h3,summary')?.textContent || 'Section';
    const section = createCollapsibleSection({
      id,
      title,
      className: options.className || target.dataset?.collapsibleClass || '',
      persist: options.persist,
      defaultOpen: options.defaultOpen
    });
    const body = section.querySelector('.collapsible-section-body');
    const parent = target.parentNode;
    if (!parent || !body) return null;
    parent.insertBefore(section, target);
    body.appendChild(target);
    target.dataset.collapsibleBound = 'true';
    return section;
  }

  function applyCollapsibleSections(root = document, definitions = []) {
    const sections = [];
    (definitions || []).forEach(definition => {
      const target = typeof definition.selector === 'string'
        ? root.querySelector?.(definition.selector) || document.querySelector?.(definition.selector)
        : definition.target;
      const section = applyCollapsibleSection(target, definition);
      if (section) sections.push(section);
    });
    root.querySelectorAll?.('[data-collapsible-title]:not([data-collapsible-bound])').forEach(target => {
      const section = applyCollapsibleSection(target, {
        title: target.dataset.collapsibleTitle,
        id: target.dataset.collapsibleId || target.id || target.dataset.collapsibleTitle,
        className: target.dataset.collapsibleClass || ''
      });
      if (section) sections.push(section);
    });
    return sections;
  }

  function setAllCollapsibleSections(root = document, isOpen = true) {
    root.querySelectorAll?.('.collapsible-section').forEach(section => {
      setCollapsibleOpen(section, isOpen);
    });
  }

  function createCollapsibleControls(target, options = {}) {
    if (!target) return null;
    const controls = document.createElement('div');
    controls.className = 'collapsible-section-controls';
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.textContent = 'Expand all';
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.textContent = 'Collapse all';
    expand.addEventListener('click', () => setAllCollapsibleSections(target, true));
    collapse.addEventListener('click', () => setAllCollapsibleSections(target, false));
    controls.append(expand, collapse);
    target.insertBefore(controls, target.firstChild);
    return controls;
  }

  function renderStandardMethodologyPanel(node, config = {}) {
    if (!node) return;
    const definitions = new Map();
    [...commonAnalyticsDefinitions, ...(config.items || [])].forEach(([term, definition]) => {
      if (term && !definitions.has(term)) definitions.set(term, definition);
    });
    const metrics = Array.isArray(config.metricsUsed) && config.metricsUsed.length
      ? config.metricsUsed
      : (config.items || []).slice(0, 10).map(([term]) => term);
    const assumptions = [
      ...(config.assumptions ? [config.assumptions] : []),
      ...standardAnalyticsAssumptions
    ];
    const list = values => (values || []).filter(Boolean).map(value => `<li>${escapeHtml(value)}</li>`).join('');
    node.innerHTML = `
      <details class="methodology-panel" open>
        <summary>Methodology & Data Dictionary</summary>
        <div class="methodology-panel-body">
          <h3>${escapeHtml(config.title || 'Report Methodology & Data Dictionary')}</h3>
          <section><h4>Purpose</h4><p>${escapeHtml(config.purpose || '')}</p></section>
          <section><h4>Metrics Used</h4><ul>${list(metrics)}</ul></section>
          <section><h4>Calculation Rules</h4><p>${escapeHtml(config.calculationRules || '')}</p></section>
          <section><h4>Assumptions</h4><ul>${list(assumptions)}</ul></section>
          <section><h4>Limitations</h4><p>${escapeHtml(config.limitations || '')}</p></section>
          <section><h4>Definitions, Calculations, and Headers</h4><dl>${[...definitions.entries()].map(([term, definition]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(definition)}</dd></div>`).join('')}</dl></section>
        </div>
      </details>`;
  }

  function timestampLabel(date = new Date()) {
    return date.toLocaleString();
  }

  function heatmapExportStatus(message, ok = true) {
    let node = document.getElementById('heatmap-export-status');
    if (!node) {
      node = document.createElement('div');
      node.id = 'heatmap-export-status';
      node.className = 'analytics-note heatmap-export-status';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.status = ok ? 'ok' : 'error';
    window.setTimeout?.(() => { node.textContent = ''; }, 5000);
  }

  function heatmapFilename(title = 'heatmap', ext = 'png') {
    const slug = slugify(title || 'heatmap');
    return `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  function heatmapExportContext(options = {}) {
    const lines = [
      options.title || 'Heatmap',
      ...(options.filters || []),
      options.metric ? `Metric: ${options.metric}` : '',
      options.modalityScope ? `Modality scope: ${options.modalityScope}` : '',
      `Exported: ${timestampLabel()}`
    ].filter(Boolean);
    const legend = options.legend || 'Darker cells indicate higher values. Blank cells indicate zero or unavailable values.';
    return { lines, legend };
  }

  function cloneHeatmapForExport(container, options = {}) {
    const source = typeof container === 'string' ? document.querySelector(container) : container;
    if (!source) throw new Error('Heatmap export source was not found.');
    const shell = document.createElement('div');
    const { lines, legend } = heatmapExportContext(options);
    shell.className = 'heatmap-export-surface';
    shell.style.position = 'fixed';
    shell.style.left = '-100000px';
    shell.style.top = '0';
    shell.style.zIndex = '-1';
    shell.style.background = '#fff';
    shell.style.color = '#172033';
    shell.style.padding = '24px';
    shell.style.width = 'max-content';
    shell.innerHTML = `
      <div class="heatmap-export-header">
        <h2>${escapeHtml(options.title || 'Heatmap')}</h2>
        <p>${lines.slice(1).map(escapeHtml).join(' | ')}</p>
      </div>`;
    const clone = source.cloneNode(true);
    clone.querySelectorAll('.heatmap-export-toolbar,.collapsible-section-header,.collapsible-controls').forEach(node => node.remove());
    clone.querySelectorAll('.heatmap-wrap').forEach(node => {
      node.style.overflow = 'visible';
      node.style.maxWidth = 'none';
      node.style.width = 'max-content';
    });
    clone.querySelectorAll('.heatmap-table,.heatmap').forEach(node => {
      node.style.width = 'max-content';
      node.style.minWidth = 'max-content';
    });
    shell.appendChild(clone);
    const footer = document.createElement('div');
    footer.className = 'heatmap-export-footer';
    footer.innerHTML = `<p>${escapeHtml(legend)}</p>`;
    shell.appendChild(footer);
    document.body.appendChild(shell);
    return shell;
  }

  async function heatmapCanvas(container, options = {}) {
    if (!window.html2canvas) throw new Error('PNG export is unavailable because html2canvas is not loaded.');
    const surface = cloneHeatmapForExport(container, options);
    try {
      const width = Math.ceil(surface.scrollWidth);
      const height = Math.ceil(surface.scrollHeight);
      return await window.html2canvas(surface, {
        backgroundColor: '#ffffff',
        scale: options.scale || 2,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0
      });
    } finally {
      surface.remove();
    }
  }

  async function exportHeatmapAsPng(container, options = {}) {
    const canvas = await heatmapCanvas(container, options);
    const link = document.createElement('a');
    link.download = options.pngFilename || options.filename || heatmapFilename(options.title, 'png');
    link.href = canvas.toDataURL('image/png');
    link.click();
    heatmapExportStatus('Heatmap PNG exported.');
    return canvas;
  }

  async function copyHeatmapImage(container, options = {}) {
    const canvas = await heatmapCanvas(container, options);
    const copySupported = navigator.clipboard && window.ClipboardItem && canvas.toBlob;
    if (!copySupported) {
      await exportHeatmapAsPng(container, options);
      heatmapExportStatus('Clipboard image copy is not supported; downloaded PNG instead.', false);
      return false;
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    heatmapExportStatus('Heatmap image copied to clipboard.');
    return true;
  }

  async function exportHeatmapAsPdf(container, options = {}) {
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF || window.jspdf;
    if (!jsPDF) throw new Error('PDF export is unavailable because jsPDF is not loaded.');
    const canvas = await heatmapCanvas(container, options);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth() - 48;
    const pageHeight = pdf.internal.pageSize.getHeight() - 48;
    const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imageWidth = canvas.width * scale;
    const imageHeight = canvas.height * scale;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 24, 24, imageWidth, imageHeight);
    pdf.save(options.pdfFilename || heatmapFilename(options.title, 'pdf'));
    heatmapExportStatus('Heatmap PDF exported.');
    return pdf;
  }

  function exportHeatmapMatrixCsv(rows = [], options = {}) {
    const metaRows = [
      ['Report name', options.title || 'Heatmap'],
      ['Term/source', options.term || ''],
      ['Selected filters', (options.filters || []).join('; ')],
      ['Metric selected', options.metric || ''],
      ['Modality scope', options.modalityScope || ''],
      ['Exported', timestampLabel()],
      []
    ];
    const columns = options.columns || ['reportName', 'termSource', 'selectedFilters', 'metric', 'day', 'timeBlock', 'value', 'sections', 'seats', 'enrollment', 'fillRate', 'waitlist', 'modalityScope'];
    const escapeCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ...metaRows.map(row => row.map(escapeCell).join(',')),
      columns.map(escapeCell).join(','),
      ...(rows || []).map(row => columns.map(column => escapeCell(row[column])).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = options.csvFilename || heatmapFilename(options.title, 'csv');
    link.click();
    URL.revokeObjectURL(url);
    heatmapExportStatus('Heatmap CSV exported.');
    return csv;
  }

  function renderHeatmapExportToolbar(target, config = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return null;
    host.querySelector('.heatmap-export-toolbar')?.remove();
    const toolbar = document.createElement('div');
    toolbar.className = 'heatmap-export-toolbar';
    toolbar.innerHTML = `
      <button type="button" data-heatmap-export="png">Export Heatmap PNG</button>
      <button type="button" data-heatmap-export="copy">Copy Heatmap Image</button>
      <button type="button" data-heatmap-export="pdf">Export Heatmap PDF</button>
      <button type="button" data-heatmap-export="csv">Export Heatmap CSV</button>
      <span class="heatmap-export-inline-status" aria-live="polite"></span>`;
    const source = () => config.container ? (typeof config.container === 'function' ? config.container() : document.querySelector(config.container)) : host;
    const options = () => typeof config.options === 'function' ? config.options() : (config.options || {});
    const rows = () => typeof config.rows === 'function' ? config.rows() : (config.rows || []);
    const setInline = (message, ok = true) => {
      const status = toolbar.querySelector('.heatmap-export-inline-status');
      if (status) {
        status.textContent = message;
        status.dataset.status = ok ? 'ok' : 'error';
      }
    };
    toolbar.querySelector('[data-heatmap-export="png"]').addEventListener('click', () => exportHeatmapAsPng(source(), options()).then(() => setInline('PNG exported.')).catch(err => setInline(err.message || 'PNG export failed.', false)));
    toolbar.querySelector('[data-heatmap-export="copy"]').addEventListener('click', () => copyHeatmapImage(source(), options()).then(copied => setInline(copied ? 'Copied.' : 'Downloaded PNG fallback.')).catch(err => setInline(err.message || 'Copy failed.', false)));
    toolbar.querySelector('[data-heatmap-export="pdf"]').addEventListener('click', () => exportHeatmapAsPdf(source(), options()).then(() => setInline('PDF exported.')).catch(err => setInline(err.message || 'PDF export failed.', false)));
    toolbar.querySelector('[data-heatmap-export="csv"]').addEventListener('click', () => {
      try {
        exportHeatmapMatrixCsv(rows(), options());
        setInline('CSV exported.');
      } catch (err) {
        setInline(err.message || 'CSV export failed.', false);
      }
    });
    host.insertBefore(toolbar, host.firstChild);
    return toolbar;
  }

  window.COSUtils = {
    backendBaseUrl,
    featureEnabled,
    jsonHeaders,
    commonAnalyticsDefinitions,
    standardAnalyticsAssumptions,
    MetricDefinitionRegistry: window.MetricDefinitionRegistry,
    MetricHelpProvider: window.MetricHelpProvider,
    attachMetricHelp: window.MetricHelpProvider?.attach,
    closeAllMetricHelp: window.MetricHelpProvider?.closeAll,
    renderStandardMethodologyPanel,
    createCollapsibleSection,
    applyCollapsibleSection,
    applyCollapsibleSections,
    setCollapsibleOpen,
    setAllCollapsibleSections,
    createCollapsibleControls
    , exportHeatmapAsPng,
    copyHeatmapImage,
    exportHeatmapAsPdf,
    exportHeatmapMatrixCsv,
    renderHeatmapExportToolbar,
    cloneHeatmapForExport
  };
})();
