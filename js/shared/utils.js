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

  window.COSUtils = {
    backendBaseUrl,
    featureEnabled,
    jsonHeaders,
    commonAnalyticsDefinitions,
    standardAnalyticsAssumptions,
    renderStandardMethodologyPanel
  };
})();
