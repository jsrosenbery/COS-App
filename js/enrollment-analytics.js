(function () {
  'use strict';

  const REPORTS = {
    attrition: 'enrollment-attrition',
    consolidation: 'section-consolidation'
  };
  const state = { enrollment: [], attritionRows: [], consolidationRows: [], attritionRan: false, attritionTerms: [] };

  const fields = {
    term: ['Term', 'TERM', 'term'],
    crn: ['CRN', 'Crn', 'crn'],
    subject: ['Subject', 'SUBJECT', 'Discipline', 'DISCIPLINE'],
    course: ['Course', 'COURSE', 'Course_Number', 'Course Number', 'Course No', 'Catalog', 'CATALOG'],
    section: ['Section', 'SECTION', 'Sec', 'SEC', 'SECTION_NUMB', 'Section Number'],
    campus: ['Campus', 'CAMPUS', 'Location', 'LOCATION'],
    modality: ['Modality', 'MODALITY', 'Instruction_Mode', 'Instruction Mode', 'Method', 'INSTRUCTIONAL_METHOD_CODE', 'INSTRUCTION_METHOD_DESC'],
    instructor: ['Instructor', 'INSTRUCTOR', 'Faculty', 'FACULTY', 'FACULTY'],
    days: ['Days', 'DAYS', 'Meeting Days'],
    time: ['Time', 'TIME', 'Meeting Time'],
    start: ['Start_Time', 'Start Time', 'Begin Time', 'Start'],
    end: ['End_Time', 'End Time', 'End'],
    room: ['Room', 'ROOM'],
    building: ['Building', 'BUILDING'],
    cap: ['Capacity', 'CAPACITY', 'Seats', 'SEATS', 'Max Enrollment', 'Maximum Enrollment', 'MAX ENROLL'],
    actual: ['Actual_Enroll', 'ACTUAL_ENROLL', 'Actual Enroll', 'Enrollment', 'Enroll', 'ENROLLED', 'Current Enrollment'],
    census: ['Census_Enroll', 'CENSUS_ENROLL', 'Census Enroll', 'Census Enrollment'],
    fill: ['Fill_Rate', 'Fill Rate', 'Percent Full', '% Full'],
    status: ['Status', 'STATUS', 'Section Status']
  };

  function val(row, names) {
    for (const name of names) {
      if (row && row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return String(row[name]).trim();
    }
    return '';
  }

  function num(value) {
    const parsed = Number(String(value || '').replace(/[%,$]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function pct(value) {
    return `${Math.round((value || 0) * 1000) / 10}%`;
  }

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function courseNumber(row) {
    const direct = val(row, fields.course);
    if (direct) return canon(direct).replace(/^([A-Z]+)\s+/, '');
    const combined = val(row, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    return canon((combined.match(/[A-Z]+\s*([A-Z]?\d{1,4}[A-Z]?)/) || [])[1] || combined);
  }

  function normalize(row) {
    const subjectCourse = val(row, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    const subject = canon(val(row, fields.subject) || (subjectCourse.match(/^([A-Z]+)/i) || [])[1]);
    const course = courseNumber(row);
    const campus = canon(val(row, fields.campus) || val(row, fields.building));
    const modality = normalizeModality(val(row, fields.modality), row);
    const days = normalizeDays(val(row, fields.days), row);
    const times = normalizeTimes(row);
    const cap = num(val(row, fields.cap));
    const actual = num(val(row, fields.actual));
    const censusValue = val(row, fields.census);
    const census = censusValue === '' ? null : num(censusValue);
    return {
      raw: row,
      term: canon(val(row, fields.term) || currentTerm()),
      crn: canon(val(row, fields.crn)),
      subject,
      course,
      section: canon(val(row, fields.section)),
      campus,
      modality,
      instructor: canon(val(row, fields.instructor)),
      days,
      dayPattern: days.join('') || 'TBA',
      start: times.start,
      end: times.end,
      timeBlock: timeBlock(times.start, modality),
      room: canon([val(row, fields.building), val(row, fields.room)].filter(Boolean).join(' ')),
      cap,
      actual,
      census,
      fillRate: cap > 0 ? actual / cap : num(val(row, fields.fill)) / 100,
      status: canon(val(row, fields.status))
    };
  }

  function normalizeModality(text, row) {
    const raw = canon(text || val(row, fields.room) || val(row, fields.building));
    if (/ONLINE|WEB|ASYNC/.test(raw)) return 'ONLINE';
    if (/HYBRID|PARTIAL/.test(raw)) return 'HYBRID';
    if (/TBA/.test(raw)) return 'TBA';
    return raw || 'IN PERSON';
  }

  function normalizeDays(raw, row = {}) {
    const text = canon(raw);
    const dayFlags = [
      ['MONDAY', 'MO'],
      ['TUESDAY', 'TU'],
      ['WEDNESDAY', 'WE'],
      ['THURSDAY', 'TH'],
      ['FRIDAY', 'FR'],
      ['SATURDAY', 'SA'],
      ['SUNDAY', 'SU']
    ]
      .filter(([column]) => String(row[column] || '').trim())
      .map(([, code]) => code);
    if (dayFlags.length) return dayFlags;
    if (!text || /ONLINE|TBA/.test(text)) return [];
    const longDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const found = longDays.filter((d) => text.includes(d)).map((d) => d.slice(0, 2));
    if (found.length) return found;
    const map = { M: 'MO', T: 'TU', W: 'WE', R: 'TH', F: 'FR', S: 'SA', U: 'SU' };
    return text.replace(/[^MTWRFSU]/g, '').split('').map((d) => map[d]).filter(Boolean);
  }

  function normalizeTimes(row) {
    const combined = val(row, fields.time);
    let start = val(row, fields.start);
    let end = val(row, fields.end);
    if ((!start || !end) && combined.includes('-')) {
      [start, end] = combined.split('-').map((part) => part.trim());
    }
    return { start: normalizeTime(start), end: normalizeTime(end) };
  }

  function normalizeTime(raw) {
    const text = String(raw || '').trim();
    if (!text || /TBA|ONLINE/i.test(text)) return '';
    const match = text.match(/(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridian = (match[3] || '').toUpperCase();
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function timeBlock(start, modality) {
    if (!start || modality === 'ONLINE' || modality === 'TBA') return 'ONLINE/TBA';
    const hour = Number(start.slice(0, 2));
    if (hour < 12) return 'MORNING';
    if (hour < 17) return 'AFTERNOON';
    return 'EVENING';
  }

  function sectionKey(section) {
    return section.crn ? `${section.term}|${section.crn}` : [section.term, section.subject, section.course, section.section].join('|');
  }

  function patternKey(section) {
    return [section.subject, section.course, section.campus, section.modality, section.dayPattern, section.start, section.end].join('-');
  }

  function currentRows() {
    return (window.COSScheduleApp?.getCurrentData?.() || window.currentData || []).map(normalize);
  }

  function currentTerm() {
    return window.COSScheduleApp?.getCurrentTerm?.() || document.getElementById('termSelect')?.value || '';
  }

  function ensureOptions() {
    const select = document.getElementById('viewSelect');
    if (!select) return;
    if (!select.querySelector(`[value="${REPORTS.attrition}"]`)) select.add(new Option('Enrollment Attrition', REPORTS.attrition));
    if (!select.querySelector(`[value="${REPORTS.consolidation}"]`)) select.add(new Option('Section Consolidation Opportunities', REPORTS.consolidation));
  }

  function buildUi() {
    if (document.getElementById('analyticsReports')) return;
    const anchor = document.getElementById('view-container') || document.getElementById('room-filter') || document.body;
    const position = anchor === document.body ? 'afterbegin' : 'afterend';
    anchor.insertAdjacentHTML(position, `
      <section id="analyticsReports" class="analytics-reports" style="display:none">
        <div id="attritionReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Attrition</h2>
            <p>Upload enrollment snapshot CSV files for the decision term and any comparison terms. This report uses CENSUS_ENROLL as census enrollment and ACTUAL_ENROLL as end/current enrollment, while keeping the selected decision term separate from historical terms.</p>
          </div>
          <div class="analytics-toolbar">
            <label>Enrollment CSV(s) <input id="enrollmentCsv" type="file" accept=".csv" multiple></label>
            <label>Decision term <select id="attrDecisionTerm"></select></label>
            <label><input id="attrIncludeHistory" type="checkbox" checked> include historical comparison terms</label>
            ${filters('attr', { includeGroup: true, includeCancelled: false })}
            <button id="runAttrition" type="button">Run</button>
            <button id="exportAttrition" type="button">Export CSV</button>
          </div>
          <div id="attritionMetrics" class="analytics-metrics"></div>
          <div id="attritionTable" class="analytics-table"></div>
        </div>
        <div id="consolidationReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Section Consolidation Opportunities</h2>
            <p>Use this planning view to identify low-filled sections and possible receiving sections. Recommendations are review prompts, not automatic cancellation decisions.</p>
          </div>
          <div class="analytics-toolbar">
            ${filters('con', { includeGroup: false, includeCancelled: true })}
            <label>Min sections <input id="conMinSections" type="number" min="2" value="5"></label>
            <label>Low fill % <input id="conLowFill" type="number" min="0" max="100" value="50"></label>
            <label>Lookback terms <input id="conLookback" type="number" min="0" max="12" value="6"></label>
            <label>Min hist terms <input id="conMinHist" type="number" min="0" max="12" value="3"></label>
            <label>Chronic % <input id="conChronic" type="number" min="0" max="100" value="75"></label>
            <label><input id="conSameCampus" type="checkbox" checked> same campus</label>
            <label><input id="conSameModality" type="checkbox" checked> same modality</label>
            <label><input id="conSameTime" type="checkbox"> same time only</label>
            <button id="runConsolidation" type="button">Run</button>
            <button id="exportConsolidation" type="button">Export CSV</button>
          </div>
          <div id="consolidationMetrics" class="analytics-metrics"></div>
          <div id="consolidationTable" class="analytics-table"></div>
        </div>
      </section>`);
  }

  function filters(prefix, options = {}) {
    const includeGroup = typeof options === 'boolean' ? options : Boolean(options.includeGroup);
    const includeCancelled = typeof options === 'boolean' ? true : options.includeCancelled !== false;
    return `
      <label>Subject <input id="${prefix}Subject" placeholder="All"></label>
      <label>Course <input id="${prefix}Course" placeholder="All"></label>
      <label>Campus <input id="${prefix}Campus" placeholder="All"></label>
      <label>Modality <input id="${prefix}Modality" placeholder="All"></label>
      <label>Instructor <input id="${prefix}Instructor" placeholder="All"></label>
      <label>Day <input id="${prefix}Day" placeholder="All"></label>
      <label>Time block <select id="${prefix}Time"><option value="">All</option><option>MORNING</option><option>AFTERNOON</option><option>EVENING</option><option>ONLINE/TBA</option></select></label>
      ${includeGroup ? '<label>Group by <select id="attrGroup"><option>COURSE</option><option>SUBJECT</option><option>SECTION</option><option>INSTRUCTOR</option><option>CAMPUS</option><option>MODALITY</option><option>DAY PATTERN</option><option>TIME BLOCK</option><option>OVERALL</option></select></label><label>Min sections <input id="attrMinSections" type="number" min="1" value="1"></label>' : ''}
      <label><input id="${prefix}HideOnline" type="checkbox"> hide online</label>
      ${includeCancelled ? `<label><input id="${prefix}HideCancelled" type="checkbox" checked> hide cancelled</label>` : ''}
      <label><input id="${prefix}HideZero" type="checkbox" checked> hide zero cap</label>`;
  }

  function applyFilters(rows, prefix) {
    const f = (id) => canon(document.getElementById(prefix + id)?.value);
    return rows.filter((r) => {
      if (f('Subject') && !r.subject.includes(f('Subject'))) return false;
      if (f('Course') && !r.course.includes(f('Course'))) return false;
      if (f('Campus') && !r.campus.includes(f('Campus'))) return false;
      if (f('Modality') && !r.modality.includes(f('Modality'))) return false;
      if (f('Instructor') && !r.instructor.includes(f('Instructor'))) return false;
      if (f('Day') && !r.dayPattern.includes(f('Day'))) return false;
      if (f('Time') && r.timeBlock !== f('Time')) return false;
      if (document.getElementById(prefix + 'HideOnline')?.checked && r.modality === 'ONLINE') return false;
      if (document.getElementById(prefix + 'HideCancelled')?.checked && /CANCEL/.test(r.status)) return false;
      if (document.getElementById(prefix + 'HideZero')?.checked && r.cap <= 0) return false;
      return true;
    });
  }

  async function readCsv(input) {
    const files = Array.from(input?.files || []);
    if (!files.length) return [];
    const batches = await Promise.all(files.map(file => new Promise((resolve, reject) => {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject });
    })));
    return batches.flat();
  }

  function collectTerms(...rowSets) {
    const terms = new Set();
    rowSets.flat().forEach(row => {
      if (row?.term) terms.add(row.term);
    });
    const active = canon(currentTerm());
    if (active) terms.add(active);
    return [...terms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function updateDecisionTermOptions(terms) {
    const select = document.getElementById('attrDecisionTerm');
    if (!select) return '';
    const active = canon(currentTerm());
    const prior = select.value;
    select.replaceChildren();
    terms.forEach(term => select.add(new Option(term, term)));
    if (terms.includes(prior)) select.value = prior;
    else if (terms.includes(active)) select.value = active;
    else if (terms.length) select.value = terms[terms.length - 1];
    return select.value;
  }

  function emptyAttritionRecord(group) {
    return {
      group,
      sections: 0,
      census: 0,
      final: 0,
      capacity: 0,
      terms: new Set(),
      decisionSections: 0,
      decisionCensus: 0,
      decisionFinal: 0,
      decisionCapacity: 0,
      historySections: 0,
      historyCensus: 0,
      historyFinal: 0,
      historyCapacity: 0,
      historyTerms: new Set()
    };
  }

  function dedupeEnrollmentRows(rows) {
    const map = new Map();
    rows.forEach(row => {
      const key = sectionKey(row);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row, days: [...row.days], dayPattern: row.dayPattern });
        return;
      }
      const daySet = new Set([...(existing.days || []), ...(row.days || [])]);
      existing.days = [...daySet];
      existing.dayPattern = existing.days.join('') || existing.dayPattern || row.dayPattern || 'TBA';
      if (!existing.start || (row.start && row.start < existing.start)) existing.start = row.start;
      if (!existing.end || (row.end && row.end > existing.end)) existing.end = row.end;
      existing.timeBlock = timeBlock(existing.start, existing.modality);
      existing.room = existing.room || row.room;
      existing.instructor = existing.instructor || row.instructor;
    });
    return [...map.values()];
  }

  async function loadAttritionFiles() {
    state.enrollment = dedupeEnrollmentRows((await readCsv(document.getElementById('enrollmentCsv'))).map(normalize));
    const fallbackRows = currentRows();
    const allEnrollment = state.enrollment.length ? state.enrollment : fallbackRows;
    state.attritionTerms = collectTerms(allEnrollment);
    updateDecisionTermOptions(state.attritionTerms);
    return allEnrollment;
  }

  async function runAttrition() {
    state.attritionRan = true;
    const allEnrollment = await loadAttritionFiles();
    const decisionTerm = document.getElementById('attrDecisionTerm')?.value || updateDecisionTermOptions(state.attritionTerms);
    const includeHistory = document.getElementById('attrIncludeHistory')?.checked;
    const enrollment = applyFilters(allEnrollment, 'attr')
      .filter(row => includeHistory || row.term === decisionTerm);
    const grouped = new Map();
    const groupBy = document.getElementById('attrGroup')?.value || 'COURSE';
    enrollment.forEach((row) => {
      const key = groupKey(row, groupBy);
      const item = grouped.get(key) || emptyAttritionRecord(key);
      const isDecisionTerm = row.term === decisionTerm;
      const censusEnroll = row.census == null ? row.actual : row.census;
      const finalEnroll = row.actual;
      item.sections += 1;
      item.census += censusEnroll;
      item.final += finalEnroll;
      item.capacity += row.cap;
      item.terms.add(row.term || 'UNKNOWN');
      if (isDecisionTerm) {
        item.decisionSections += 1;
        item.decisionCensus += censusEnroll;
        item.decisionFinal += finalEnroll;
        item.decisionCapacity += row.cap;
      } else {
        item.historySections += 1;
        item.historyCensus += censusEnroll;
        item.historyFinal += finalEnroll;
        item.historyCapacity += row.cap;
        item.historyTerms.add(row.term || 'UNKNOWN');
      }
      grouped.set(key, item);
    });
    const min = Number(document.getElementById('attrMinSections')?.value || 1);
    state.attritionRows = [...grouped.values()].filter((r) => r.sections >= min).map((r) => ({
      ...r,
      terms: r.terms.size,
      historyTerms: r.historyTerms.size,
      decisionAttritionCount: Math.max(0, r.decisionCensus - r.decisionFinal),
      decisionAttritionRate: r.decisionCensus > 0 ? Math.max(0, r.decisionCensus - r.decisionFinal) / r.decisionCensus : 0,
      historicalAttritionCount: Math.max(0, r.historyCensus - r.historyFinal),
      historicalAttritionRate: r.historyCensus > 0 ? Math.max(0, r.historyCensus - r.historyFinal) / r.historyCensus : 0,
      attritionCount: Math.max(0, r.census - r.final),
      attritionRate: r.census > 0 ? Math.max(0, r.census - r.final) / r.census : 0,
      censusFillRate: r.capacity > 0 ? r.census / r.capacity : 0,
      finalFillRate: r.capacity > 0 ? r.final / r.capacity : 0,
      availableAtCensus: Math.max(0, r.capacity - r.census),
      availableAtEnd: Math.max(0, r.capacity - r.final)
    })).sort((a, b) => b.decisionAttritionCount - a.decisionAttritionCount || b.attritionCount - a.attritionCount);
    const decisionRows = state.attritionRows.filter(row => row.decisionSections > 0);
    metric('attritionMetrics', [
      ['Decision Term', decisionTerm || 'N/A'],
      ['Terms Included', includeHistory ? state.attritionTerms.length : 1],
      ['Decision Sections', sum(decisionRows, 'decisionSections')],
      ['Decision Census', sum(decisionRows, 'decisionCensus')],
      ['Decision Final', sum(decisionRows, 'decisionFinal')],
      ['Decision Attrition', pct(safeDiv(sum(decisionRows, 'decisionAttritionCount'), sum(decisionRows, 'decisionCensus')))],
      ['Historical Attrition', pct(safeDiv(sum(state.attritionRows, 'historicalAttritionCount'), sum(state.attritionRows, 'historyCensus')))]
    ]);
    table('attritionTable', state.attritionRows, [
      'group',
      'terms',
      'decisionSections',
      'decisionCensus',
      'decisionFinal',
      'decisionAttritionCount',
      'decisionAttritionRate',
      'historicalAttritionRate',
      'sections',
      'census',
      'final',
      'attritionRate',
      'censusFillRate',
      'finalFillRate',
      'availableAtCensus',
      'availableAtEnd'
    ]);
  }

  function groupKey(row, groupBy) {
    const map = {
      OVERALL: 'Overall',
      SUBJECT: row.subject,
      COURSE: `${row.subject} ${row.course}`,
      SECTION: `${row.subject} ${row.course} ${row.section}`,
      INSTRUCTOR: row.instructor || 'UNKNOWN',
      CAMPUS: row.campus || 'UNKNOWN',
      MODALITY: row.modality,
      'DAY PATTERN': row.dayPattern,
      'TIME BLOCK': row.timeBlock
    };
    return map[groupBy] || map.COURSE;
  }

  async function runConsolidation() {
    const rows = applyFilters(currentRows(), 'con');
    const minSections = Number(document.getElementById('conMinSections')?.value || 5);
    const lowFill = Number(document.getElementById('conLowFill')?.value || 50) / 100;
    const sameCampus = document.getElementById('conSameCampus')?.checked;
    const sameModality = document.getElementById('conSameModality')?.checked;
    const sameTime = document.getElementById('conSameTime')?.checked;
    const byCourse = group(rows, (r) => `${r.subject} ${r.course}`);
    const history = await historicalPatterns();
    state.consolidationRows = [];
    byCourse.forEach((sections, course) => {
      if (sections.length < minSections) return;
      const low = sections.filter((s) => s.fillRate <= lowFill);
      low.forEach((source) => {
        const candidates = sections
          .filter((target) => target !== source && target.cap - target.actual >= source.actual)
          .filter((target) => !sameCampus || target.campus === source.campus)
          .filter((target) => !sameModality || target.modality === source.modality)
          .filter((target) => !sameTime || (target.dayPattern === source.dayPattern && target.start === source.start))
          .map((target) => candidate(source, target, history))
          .sort((a, b) => b.score - a.score);
        if (candidates[0]) state.consolidationRows.push({ course, source, ...candidates[0], sectionCount: sections.length });
      });
    });
    state.consolidationRows.sort((a, b) => b.score - a.score);
    metric('consolidationMetrics', [
      ['Courses Reviewed', byCourse.size],
      ['Opportunities', state.consolidationRows.length],
      ['Seats Potentially Freed', sum(state.consolidationRows, 'freedSeats')],
      ['Avg Score', Math.round(safeDiv(sum(state.consolidationRows, 'score'), state.consolidationRows.length))]
    ]);
    table('consolidationTable', state.consolidationRows.map(flattenOpportunity), ['score', 'label', 'course', 'sourceSection', 'sourceFill', 'targetSection', 'targetOpenSeats', 'freedSeats', 'matchReason', 'historicalTerms', 'chronicLowFill']);
  }

  function candidate(source, target, history) {
    let score = 25;
    const reasons = [];
    if (target.campus === source.campus) { score += 15; reasons.push('same campus'); }
    if (target.modality === source.modality) { score += 15; reasons.push('same modality'); }
    if (target.dayPattern === source.dayPattern && target.start === source.start) { score += 20; reasons.push('same time pattern'); }
    else if (target.dayPattern === source.dayPattern) { score += 10; reasons.push('same days'); }
    if (target.instructor && target.instructor === source.instructor) { score += 10; reasons.push('same instructor'); }
    if (target.room && target.room === source.room) { score += 5; reasons.push('same room'); }
    const hist = history.get(patternKey(source)) || { terms: 0, low: 0 };
    const chronicThreshold = Number(document.getElementById('conChronic')?.value || 75) / 100;
    const minHist = Number(document.getElementById('conMinHist')?.value || 3);
    const chronic = hist.terms >= minHist && safeDiv(hist.low, hist.terms) >= chronicThreshold;
    if (chronic) score += 10;
    return {
      target,
      score: Math.min(100, score),
      label: score >= 75 ? 'High Review Priority' : score >= 55 ? 'Review Candidate' : 'Low Priority Review',
      freedSeats: source.cap,
      matchReason: reasons.join(', ') || 'open seats available',
      historicalTerms: hist.terms,
      chronicLowFill: chronic ? 'Yes' : 'No'
    };
  }

  async function historicalPatterns() {
    const map = new Map();
    const lookback = Number(document.getElementById('conLookback')?.value || 0);
    if (!lookback || !window.BACKEND_BASE_URL) return map;
    try {
      const terms = await fetch(`${window.BACKEND_BASE_URL}/terms`).then((r) => r.json());
      const priorTerms = (Array.isArray(terms) ? terms : []).filter((t) => t && t !== currentTerm()).slice(-lookback);
      const batches = await Promise.all(priorTerms.map((t) => fetch(`${window.BACKEND_BASE_URL}/schedule/${encodeURIComponent(t)}`).then((r) => r.ok ? r.json() : [])));
      batches.flat().map(normalize).forEach((row) => {
        const key = patternKey(row);
        const item = map.get(key) || { terms: 0, low: 0 };
        item.terms += 1;
        if (row.fillRate <= 0.5) item.low += 1;
        map.set(key, item);
      });
    } catch (err) {
      console.warn('Historical consolidation lookup skipped:', err);
    }
    return map;
  }

  function flattenOpportunity(row) {
    return {
      score: row.score,
      label: row.label,
      course: row.course,
      sourceSection: describe(row.source),
      sourceFill: pct(row.source.fillRate),
      targetSection: describe(row.target),
      targetOpenSeats: Math.max(0, row.target.cap - row.target.actual),
      freedSeats: row.freedSeats,
      matchReason: row.matchReason,
      historicalTerms: row.historicalTerms,
      chronicLowFill: row.chronicLowFill
    };
  }

  function describe(row) {
    return [row.crn || row.section, row.campus, row.modality, row.dayPattern, row.start].filter(Boolean).join(' / ');
  }

  function group(rows, keyer) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyer(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function sum(rows, key) {
    return rows.reduce((total, row) => total + num(row[key]), 0);
  }

  function safeDiv(a, b) {
    return b ? a / b : 0;
  }

  function metric(id, items) {
    document.getElementById(id).innerHTML = items.map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  }

  function table(id, rows, columns) {
    const display = rows.slice(0, 500);
    document.getElementById(id).innerHTML = display.length ? `
      <table><thead><tr>${columns.map((c) => `<th>${label(c)}</th>`).join('')}</tr></thead>
      <tbody>${display.map((row) => `<tr>${columns.map((c) => `<td>${format(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>` :
      '<p class="analytics-empty">No rows match the selected criteria.</p>';
  }

  function label(text) {
    return text.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  function format(value) {
    if (typeof value === 'number' && value >= 0 && value <= 1) return pct(value);
    return value ?? '';
  }

  function exportRows(rows, filename) {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function updateVisibility() {
    const selected = document.getElementById('viewSelect')?.value;
    const wrap = document.getElementById('analyticsReports');
    if (!wrap) return;
    wrap.style.display = [REPORTS.attrition, REPORTS.consolidation].includes(selected) ? 'block' : 'none';
    document.getElementById('attritionReport').style.display = selected === REPORTS.attrition ? 'block' : 'none';
    document.getElementById('consolidationReport').style.display = selected === REPORTS.consolidation ? 'block' : 'none';
    if (selected === REPORTS.attrition && !state.attritionRan) {
      updateDecisionTermOptions(state.attritionTerms.length ? state.attritionTerms : collectTerms(currentRows()));
      document.getElementById('attritionTable').innerHTML = '<p class="analytics-empty">Upload enrollment CSV files, then click Run.</p>';
    }
  }

  function injectStyle() {
    if (document.getElementById('analyticsReportStyles')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="analyticsReportStyles">
      .analytics-reports{width:min(1480px,calc(100% - 2rem));margin:16px auto 24px;padding:20px;background:#fff;border:1px solid #d8e1ec;border-radius:16px;box-shadow:0 8px 24px rgba(15,45,75,.08)}
      .analytics-report-intro{margin-bottom:16px;color:#51657c;line-height:1.45}
      .analytics-report-intro h2{margin:0 0 6px;color:#123367;font-size:24px}
      .analytics-report-intro p{margin:0;max-width:980px}
      .analytics-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-bottom:18px}
      .analytics-toolbar label{display:flex;flex-direction:column;gap:4px;font-weight:600;color:#51657c;font-size:13px}
      .analytics-toolbar input,.analytics-toolbar select{min-height:34px;border:1px solid #ccd6e2;border-radius:6px;padding:6px 8px}
      .analytics-toolbar input[type=checkbox]{min-height:auto}
      .analytics-toolbar button{min-height:36px;border:0;border-radius:18px;padding:0 16px;background:#cdeffc;color:#002b5c;font-weight:700;cursor:pointer}
      .analytics-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
      .analytics-metrics div{border:1px solid #d8e1ec;border-radius:8px;padding:12px;background:#f8fbff}
      .analytics-metrics strong{display:block;font-size:22px;color:#002b5c}
      .analytics-metrics span{font-size:12px;color:#51657c;text-transform:uppercase}
      .analytics-table{overflow:auto;max-height:620px;border:1px solid #d8e1ec;border-radius:8px}
      .analytics-table table{width:100%;border-collapse:collapse;background:#fff}
      .analytics-table th{position:sticky;top:0;background:#174f7d;color:#fff;text-align:left;padding:9px;font-size:13px}
      .analytics-table td{border-top:1px solid #e6edf5;padding:8px;font-size:13px}
      .analytics-empty{padding:16px;margin:0;color:#51657c}
    </style>`);
  }

  function wire() {
    document.getElementById('viewSelect')?.addEventListener('change', updateVisibility);
    document.getElementById('termSelect')?.addEventListener('change', () => {
      if (document.getElementById('viewSelect')?.value === REPORTS.consolidation) runConsolidation();
    });
    document.getElementById('runAttrition')?.addEventListener('click', runAttrition);
    document.getElementById('enrollmentCsv')?.addEventListener('change', loadAttritionFiles);
    document.getElementById('runConsolidation')?.addEventListener('click', runConsolidation);
    document.getElementById('exportAttrition')?.addEventListener('click', () => exportRows(state.attritionRows, `enrollment-attrition-${currentTerm() || 'term'}.csv`));
    document.getElementById('exportConsolidation')?.addEventListener('click', () => exportRows(state.consolidationRows.map(flattenOpportunity), `section-consolidation-${currentTerm() || 'term'}.csv`));
  }

  function init() {
    ensureOptions();
    buildUi();
    injectStyle();
    wire();
    updateVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
