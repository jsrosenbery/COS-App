(function () {
  'use strict';

  const REPORTS = {
    attrition: 'enrollment-attrition',
    consolidation: 'section-consolidation'
  };
  const state = { census: [], final: [], attritionRows: [], consolidationRows: [], attritionRan: false };

  const fields = {
    term: ['Term', 'TERM', 'term'],
    crn: ['CRN', 'Crn', 'crn'],
    subject: ['Subject', 'SUBJECT', 'Discipline', 'DISCIPLINE'],
    course: ['Course', 'COURSE', 'Course_Number', 'Course Number', 'Course No', 'Catalog', 'CATALOG'],
    section: ['Section', 'SECTION', 'Sec', 'SEC'],
    campus: ['Campus', 'CAMPUS', 'Location', 'LOCATION'],
    modality: ['Modality', 'MODALITY', 'Instruction_Mode', 'Instruction Mode', 'Method'],
    instructor: ['Instructor', 'INSTRUCTOR', 'Faculty', 'FACULTY'],
    days: ['Days', 'DAYS', 'Meeting Days'],
    time: ['Time', 'TIME', 'Meeting Time'],
    start: ['Start_Time', 'Start Time', 'Begin Time', 'Start'],
    end: ['End_Time', 'End Time', 'End'],
    room: ['Room', 'ROOM'],
    building: ['Building', 'BUILDING'],
    cap: ['Capacity', 'CAPACITY', 'Seats', 'SEATS', 'Max Enrollment', 'Maximum Enrollment'],
    actual: ['Actual_Enroll', 'Actual Enroll', 'Enrollment', 'Enroll', 'ENROLLED', 'Current Enrollment'],
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
    const combined = val(row, ['Subject_Course', 'Subject Course', 'Course ID']);
    return canon((combined.match(/[A-Z]+\s*([A-Z]?\d{1,4}[A-Z]?)/) || [])[1] || combined);
  }

  function normalize(row) {
    const subjectCourse = val(row, ['Subject_Course', 'Subject Course', 'Course ID']);
    const subject = canon(val(row, fields.subject) || (subjectCourse.match(/^([A-Z]+)/i) || [])[1]);
    const course = courseNumber(row);
    const campus = canon(val(row, fields.campus) || val(row, fields.building));
    const modality = normalizeModality(val(row, fields.modality), row);
    const days = normalizeDays(val(row, fields.days));
    const times = normalizeTimes(row);
    const cap = num(val(row, fields.cap));
    const actual = num(val(row, fields.actual));
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

  function normalizeDays(raw) {
    const text = canon(raw);
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
            <p>Upload a census enrollment CSV and an end-of-term enrollment CSV, then run the report to compare enrollment loss, fill rates, and available seats. If either file is not provided, the report will use the currently loaded schedule data as a fallback.</p>
          </div>
          <div class="analytics-toolbar">
            <label>Census CSV <input id="censusCsv" type="file" accept=".csv"></label>
            <label>Final CSV <input id="finalCsv" type="file" accept=".csv"></label>
            ${filters('attr', true)}
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
            ${filters('con', false)}
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

  function filters(prefix, includeGroup) {
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
      <label><input id="${prefix}HideCancelled" type="checkbox" checked> hide cancelled</label>
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
    const file = input?.files?.[0];
    if (!file) return [];
    return new Promise((resolve, reject) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject }));
  }

  async function runAttrition() {
    state.attritionRan = true;
    state.census = (await readCsv(document.getElementById('censusCsv'))).map(normalize);
    state.final = (await readCsv(document.getElementById('finalCsv'))).map(normalize);
    const census = applyFilters(state.census.length ? state.census : currentRows(), 'attr');
    const finalMap = new Map((state.final.length ? state.final : currentRows()).map((r) => [sectionKey(r), r]));
    const grouped = new Map();
    const groupBy = document.getElementById('attrGroup')?.value || 'COURSE';
    census.forEach((c) => {
      const f = finalMap.get(sectionKey(c)) || c;
      const key = groupKey(c, groupBy);
      const item = grouped.get(key) || { group: key, sections: 0, census: 0, final: 0, capacity: 0 };
      item.sections += 1;
      item.census += c.actual;
      item.final += f.actual;
      item.capacity += c.cap || f.cap;
      grouped.set(key, item);
    });
    const min = Number(document.getElementById('attrMinSections')?.value || 1);
    state.attritionRows = [...grouped.values()].filter((r) => r.sections >= min).map((r) => ({
      ...r,
      attritionCount: Math.max(0, r.census - r.final),
      attritionRate: r.census > 0 ? Math.max(0, r.census - r.final) / r.census : 0,
      censusFillRate: r.capacity > 0 ? r.census / r.capacity : 0,
      finalFillRate: r.capacity > 0 ? r.final / r.capacity : 0,
      availableAtCensus: Math.max(0, r.capacity - r.census),
      availableAtEnd: Math.max(0, r.capacity - r.final)
    })).sort((a, b) => b.attritionCount - a.attritionCount);
    metric('attritionMetrics', [
      ['Sections', sum(state.attritionRows, 'sections')],
      ['Census Enroll', sum(state.attritionRows, 'census')],
      ['Final Enroll', sum(state.attritionRows, 'final')],
      ['Attrition Rate', pct(safeDiv(sum(state.attritionRows, 'attritionCount'), sum(state.attritionRows, 'census')))]
    ]);
    table('attritionTable', state.attritionRows, ['group', 'sections', 'census', 'final', 'attritionCount', 'attritionRate', 'censusFillRate', 'finalFillRate', 'availableAtCensus', 'availableAtEnd']);
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
      document.getElementById('attritionTable').innerHTML = '<p class="analytics-empty">Upload census and final enrollment CSV files, then click Run.</p>';
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
