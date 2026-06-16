(function () {
  'use strict';

  const REPORTS = {
    attrition: 'enrollment-attrition',
    consolidation: 'section-consolidation'
  };
  const state = { enrollment: [], consolidationInput: [], attritionRows: [], consolidationRows: [], attritionRan: false, attritionTerms: [] };
  const analyticsChoices = new Map();
  const dayLabels = {
    MO: 'M',
    TU: 'T',
    WE: 'W',
    TH: 'R',
    FR: 'F',
    SA: 'S',
    SU: 'U',
    TBA: 'TBA'
  };
  const dayOrder = Object.keys(dayLabels);

  const fields = {
    term: ['Term', 'TERM', 'term'],
    crn: ['CRN', 'Crn', 'crn'],
    subject: ['Subject', 'SUBJECT', 'Discipline', 'DISCIPLINE'],
    course: ['Course', 'COURSE', 'Course_Number', 'Course Number', 'Course No', 'Catalog', 'CATALOG'],
    section: ['Section', 'SECTION', 'Sec', 'SEC', 'SECTION_NUMB', 'Section Number'],
    campus: ['Campus', 'CAMPUS', 'Location', 'LOCATION'],
    modality: ['Modality', 'MODALITY', 'Instruction_Mode', 'Instruction Mode', 'Method', 'INSTRUCTIONAL_METHOD_CODE', 'INSTRUCTION_METHOD_DESC'],
    instructor: ['Instructor', 'INSTRUCTOR', 'Faculty', 'FACULTY', 'FACULTY'],
    days: ['Days', 'DAYS', 'Meeting Days', 'Meet Days', 'Day', 'Days Of Week', 'Mtg Days', 'Meeting Pattern', 'Meeting_Pattern'],
    time: ['Time', 'TIME', 'Meeting Time', 'Meet Time', 'Mtg Time', 'Time Range', 'Times'],
    start: ['Start_Time', 'START_TIME', 'Start Time', 'START TIME', 'Begin Time', 'BEGIN TIME', 'Begin_Time', 'BEGIN_TIME', 'Class Begin Time', 'Meeting Start', 'Mtg Start', 'Start'],
    end: ['End_Time', 'END_TIME', 'End Time', 'END TIME', 'Stop Time', 'STOP TIME', 'Stop_Time', 'STOP_TIME', 'Class End Time', 'Meeting End', 'Mtg End', 'End'],
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
      term: canon(val(row, fields.term) || row.__sourceTerm || currentTerm()),
      crn: canon(val(row, fields.crn)),
      subject,
      course,
      section: canon(val(row, fields.section)),
      campus,
      modality,
      instructor: canon(val(row, fields.instructor)),
      days,
      dayPattern: dayPattern(days),
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
    if (raw === 'DE' || /DUAL\s*ENROLL/.test(raw)) return 'DE';
    if (/ONLINE|WEB|ASYNC/.test(raw)) return 'ONLINE';
    if (/HYBRID|PARTIAL/.test(raw)) return 'HYBRID';
    if (/TBA/.test(raw)) return 'TBA';
    return raw || 'IN PERSON';
  }

  function isDualEnrollment(row) {
    const rawMethod = canon(val(row.raw || {}, fields.modality));
    return row.modality === 'DE' || rawMethod === 'DE' || /DUAL\s*ENROLL/.test(rawMethod);
  }

  function normalizeDays(raw, row = {}) {
    if (Array.isArray(row.Days) && row.Days.length) return normalizeDayArray(row.Days);
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

  function normalizeDayArray(days) {
    const aliases = {
      MONDAY: 'MO',
      TUESDAY: 'TU',
      WEDNESDAY: 'WE',
      THURSDAY: 'TH',
      FRIDAY: 'FR',
      SATURDAY: 'SA',
      SUNDAY: 'SU',
      M: 'MO',
      T: 'TU',
      W: 'WE',
      R: 'TH',
      F: 'FR',
      S: 'SA',
      U: 'SU'
    };
    dayOrder.forEach(day => {
      aliases[day] = day;
    });
    const normalized = days.map(day => aliases[canon(day)]).filter(Boolean);
    return dayOrder.filter(day => normalized.includes(day));
  }

  function dayPattern(days) {
    const normalized = normalizeDayArray(days || []);
    return normalized.length ? normalized.map(day => dayLabels[day]).join('') : 'TBA';
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
    if (!Number.isFinite(hour)) return 'ONLINE/TBA';
    return `${String(hour).padStart(2, '0')}:00-${String(hour).padStart(2, '0')}:59`;
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

  function termFromFilename(filename) {
    const text = String(filename || '');
    const match = text.match(/\b(20\d{2})(10|20|30|40)\b/);
    if (!match) return '';
    const year = Number(match[1]);
    const code = match[2];
    if (code === '10') return `FALL ${year - 1}`;
    if (code === '20') return `SPRING ${year}`;
    if (code === '30') return `SUMMER ${year}`;
    if (code === '40') return `WINTER ${year}`;
    return '';
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
            <div class="analytics-methodology">
              <h3>How to Use This Report</h3>
              <ul>
                <li>Upload the decision-term enrollment CSV and any same-season comparison files, such as Fall to Fall, Spring to Spring, or Summer to Summer.</li>
                <li>Use comparison terms from 2022 forward only. Earlier terms should be avoided because COVID-era disruption can distort normal enrollment and attrition patterns.</li>
                <li>Select the decision term before running the report. Historical terms provide context, but the decision-term columns should drive current planning.</li>
                <li>Dual Enrollment instructional method rows are omitted from this report so the analysis focuses on general enrollment behavior.</li>
              </ul>
              <h3>Methodology</h3>
              <ul>
                <li>Sections are deduplicated by CRN within term, with subject/course/section used as fallback, so multi-meeting rows are not double counted.</li>
                <li>Attrition Count = CENSUS_ENROLL - ACTUAL_ENROLL. Attrition Rate = Attrition Count / CENSUS_ENROLL.</li>
                <li>Census Fill Rate = CENSUS_ENROLL / MAX ENROLL. Final Fill Rate = ACTUAL_ENROLL / MAX ENROLL.</li>
                <li>All Terms columns include the decision term plus comparison terms. Historical Attrition excludes the decision term and uses comparison terms only.</li>
                <li>Min sections controls the minimum section count a grouped row must have before it appears in the report.</li>
              </ul>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Enrollment CSV(s) <input id="enrollmentCsv" type="file" accept=".csv" multiple></label>
            <label>Decision term <select id="attrDecisionTerm"></select></label>
            <label><input id="attrIncludeHistory" type="checkbox" checked> include historical comparison terms</label>
            ${filters('attr', { includeGroup: true, includeCancelled: false })}
            <button id="runAttrition" type="button">Run</button>
            <button id="clearAttrition" type="button">Clear</button>
            <button id="exportAttrition" type="button">Export CSV</button>
          </div>
          <div id="attritionMetrics" class="analytics-metrics"></div>
          <div id="attritionTable" class="analytics-table"></div>
          <div id="attritionLegend" class="analytics-legend"></div>
        </div>
        <div id="consolidationReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Section Consolidation Opportunities</h2>
            <p>Use this planning view to identify low-filled sections and possible receiving sections. Recommendations are review prompts, not automatic cancellation decisions.</p>
            <div class="analytics-methodology">
              <h3>How to Use This Report</h3>
              <ul>
                <li>Start with the current decision term, then use historical context to decide whether a low-filled pattern is recurring.</li>
                <li>Compare like terms where possible: Fall to Fall, Spring to Spring, and Summer to Summer. Limit historical review to 2022 and newer terms.</li>
                <li>Use the filters and thresholds to create a review list, then evaluate operational constraints before making any schedule decision.</li>
              </ul>
              <h3>Methodology</h3>
              <ul>
                <li>Low Fill = enrollment divided by capacity below the selected low-fill threshold.</li>
                <li>Receiving sections are other sections of the same course with enough open seats, optionally constrained by campus, modality, days, and time.</li>
                <li>Historical matching should be based on a stable section pattern, not CRN, because CRNs change across terms.</li>
                <li>Min sections is the minimum number of sections a course must have before it is considered for consolidation review.</li>
                <li>Recommendation scores are planning indicators only. They identify candidates for review, not automatic cancellations.</li>
              </ul>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Consolidation CSV(s) <input id="consolidationCsv" type="file" accept=".csv" multiple></label>
            ${filters('con', { includeGroup: false, includeCancelled: true })}
            <label>Min sections <input id="conMinSections" type="number" min="2" value="5" title="Minimum number of sections a course must have before it is considered for consolidation review."></label>
            <label>Low fill % <input id="conLowFill" type="number" min="0" max="100" value="50"></label>
            <label>Lookback terms <input id="conLookback" type="number" min="0" max="12" value="6"></label>
            <label>Min hist terms <input id="conMinHist" type="number" min="0" max="12" value="3"></label>
            <label>Chronic % <input id="conChronic" type="number" min="0" max="100" value="75"></label>
            <label>Day match <select id="conDayMatch"><option value="exact">same day pattern</option><option value="overlap">shares any day</option><option value="any">any day</option></select></label>
            <label>Start window <select id="conTimeWindow"><option value="0">same start time</option><option value="1">+/- 1 hour</option><option value="2" selected>+/- 2 hours</option><option value="3">+/- 3 hours</option><option value="4">+/- 4 hours</option><option value="">any time</option></select></label>
            <label><input id="conSameCampus" type="checkbox" checked> same campus</label>
            <label><input id="conSameModality" type="checkbox" checked> same modality</label>
            <button id="runConsolidation" type="button">Run</button>
            <button id="clearConsolidation" type="button">Clear</button>
            <button id="exportConsolidation" type="button">Export CSV</button>
          </div>
          <div id="consolidationMetrics" class="analytics-metrics"></div>
          <div id="consolidationTable" class="analytics-table"></div>
          <div id="consolidationLegend" class="analytics-legend"></div>
        </div>
      </section>`);
  }

  function filters(prefix, options = {}) {
    const includeGroup = typeof options === 'boolean' ? options : Boolean(options.includeGroup);
    const includeCancelled = typeof options === 'boolean' ? true : options.includeCancelled !== false;
    return `
      <label>Discipline <select id="${prefix}Subject" multiple data-placeholder="All disciplines"></select></label>
      <label>Course <select id="${prefix}Course" multiple data-placeholder="All courses"></select></label>
      <label>Campus <select id="${prefix}Campus" multiple data-placeholder="All campuses"></select></label>
      <label>Modality <select id="${prefix}Modality" multiple data-placeholder="All modalities"></select></label>
      <label>Instructor <select id="${prefix}Instructor" multiple data-placeholder="All instructors"></select></label>
      <label>Day <select id="${prefix}Day" multiple data-placeholder="All days"></select></label>
      <label>Start hour <select id="${prefix}Time" multiple data-placeholder="All start hours"></select></label>
      ${includeGroup ? '<label>Group by <select id="attrGroup"><option>COURSE</option><option value="SUBJECT">DISCIPLINE</option><option>SECTION</option><option>INSTRUCTOR</option><option>CAMPUS</option><option>MODALITY</option><option>DAY PATTERN</option><option>TIME BLOCK</option><option>OVERALL</option></select></label><label>Min sections <input id="attrMinSections" type="number" min="1" value="1" title="Minimum section count required for a grouped row to appear."></label>' : ''}
      <label><input id="${prefix}HideOnline" type="checkbox"> hide online</label>
      ${includeCancelled ? `<label><input id="${prefix}HideCancelled" type="checkbox" checked> hide cancelled</label>` : ''}
      <label><input id="${prefix}HideZero" type="checkbox" checked> hide zero cap</label>`;
  }

  function getSelectedValues(id) {
    const select = document.getElementById(id);
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(option => canon(option.value)).filter(Boolean);
  }

  function valueMatchesSelection(value, selectedValues) {
    if (!selectedValues.length) return true;
    const normalized = canon(value);
    return selectedValues.some(selected => normalized === selected);
  }

  function uniqueOptions(rows, getter) {
    return [...new Set(rows.map(getter).filter(Boolean).map(canon))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(value => ({ value, label: value }));
  }

  function uniqueDayOptions(rows) {
    return uniqueOptions(rows, row => row.dayPattern);
  }

  function rowsForDependentOptions(prefix, rows) {
    const selectedSubjects = getSelectedValues(prefix + 'Subject');
    const selectedCourses = getSelectedValues(prefix + 'Course');
    return rows.filter(row => {
      if (!valueMatchesSelection(row.subject, selectedSubjects)) return false;
      if (!valueMatchesSelection(row.course, selectedCourses)) return false;
      return true;
    });
  }

  function updateCourseOptions(prefix, rows) {
    const selectedSubjects = getSelectedValues(prefix + 'Subject');
    const courseRows = selectedSubjects.length ? rows.filter(row => valueMatchesSelection(row.subject, selectedSubjects)) : rows;
    setSelectOptions(prefix + 'Course', uniqueOptions(courseRows, row => row.course));
    updatePatternOptions(prefix, rows);
  }

  function updatePatternOptions(prefix, rows) {
    const scopedRows = rowsForDependentOptions(prefix, rows);
    setSelectOptions(prefix + 'Day', uniqueDayOptions(scopedRows));
    setSelectOptions(prefix + 'Time', uniqueOptions(scopedRows, row => row.timeBlock));
  }

  function setSelectOptions(id, options) {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = new Set(getSelectedValues(id));
    const choice = analyticsChoices.get(id);
    if (choice) {
      choice.destroy();
      analyticsChoices.delete(id);
    }
    select.replaceChildren();
    options.forEach(option => {
      const node = new Option(option.label, option.value, false, selected.has(canon(option.value)));
      select.appendChild(node);
    });
    if (window.Choices) {
      analyticsChoices.set(id, new Choices(select, {
        removeItemButton: true,
        searchEnabled: true,
        shouldSort: false,
        placeholderValue: select.dataset.placeholder || 'All'
      }));
    }
  }

  function clearSelect(id) {
    const select = document.getElementById(id);
    if (!select) return;
    const choice = analyticsChoices.get(id);
    if (choice) choice.removeActiveItems();
    Array.from(select.options || []).forEach(option => {
      option.selected = false;
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resetAnalyticsControls(prefix) {
    ['Subject', 'Course', 'Campus', 'Modality', 'Instructor', 'Day', 'Time'].forEach(name => clearSelect(prefix + name));
    const hideOnline = document.getElementById(prefix + 'HideOnline');
    if (hideOnline) hideOnline.checked = false;
    const hideCancelled = document.getElementById(prefix + 'HideCancelled');
    if (hideCancelled) hideCancelled.checked = true;
    const hideZero = document.getElementById(prefix + 'HideZero');
    if (hideZero) hideZero.checked = true;
    if (prefix === 'attr') {
      const group = document.getElementById('attrGroup');
      if (group) group.value = 'COURSE';
      const minSections = document.getElementById('attrMinSections');
      if (minSections) minSections.value = '1';
      const includeHistory = document.getElementById('attrIncludeHistory');
      if (includeHistory) includeHistory.checked = true;
      if ((state.enrollment.length || currentRows().length) && state.attritionRan) runAttrition();
    }
    if (prefix === 'con') {
      const minSections = document.getElementById('conMinSections');
      if (minSections) minSections.value = '5';
      const lowFill = document.getElementById('conLowFill');
      if (lowFill) lowFill.value = '50';
      const lookback = document.getElementById('conLookback');
      if (lookback) lookback.value = '6';
      const minHist = document.getElementById('conMinHist');
      if (minHist) minHist.value = '3';
      const chronic = document.getElementById('conChronic');
      if (chronic) chronic.value = '75';
      const dayMatch = document.getElementById('conDayMatch');
      if (dayMatch) dayMatch.value = 'exact';
      const timeWindow = document.getElementById('conTimeWindow');
      if (timeWindow) timeWindow.value = '2';
      const sameCampus = document.getElementById('conSameCampus');
      if (sameCampus) sameCampus.checked = true;
      const sameModality = document.getElementById('conSameModality');
      if (sameModality) sameModality.checked = true;
      if (state.consolidationRows.length) runConsolidation();
    }
  }

  function populateAnalyticsFilters(prefix, rows) {
    setSelectOptions(prefix + 'Subject', uniqueOptions(rows, row => row.subject));
    updateCourseOptions(prefix, rows);
    setSelectOptions(prefix + 'Campus', uniqueOptions(rows, row => row.campus));
    setSelectOptions(prefix + 'Modality', uniqueOptions(rows, row => row.modality));
    setSelectOptions(prefix + 'Instructor', uniqueOptions(rows, row => row.instructor));
    updatePatternOptions(prefix, rows);
    const subjectSelect = document.getElementById(prefix + 'Subject');
    if (subjectSelect) subjectSelect.onchange = () => updateCourseOptions(prefix, rows);
    const courseSelect = document.getElementById(prefix + 'Course');
    if (courseSelect) courseSelect.onchange = () => updatePatternOptions(prefix, rows);
  }

  function applyFilters(rows, prefix) {
    const selected = {
      subject: getSelectedValues(prefix + 'Subject'),
      course: getSelectedValues(prefix + 'Course'),
      campus: getSelectedValues(prefix + 'Campus'),
      modality: getSelectedValues(prefix + 'Modality'),
      instructor: getSelectedValues(prefix + 'Instructor'),
      day: getSelectedValues(prefix + 'Day'),
      time: getSelectedValues(prefix + 'Time')
    };
    return rows.filter((r) => {
      if (!valueMatchesSelection(r.subject, selected.subject)) return false;
      if (!valueMatchesSelection(r.course, selected.course)) return false;
      if (!valueMatchesSelection(r.campus, selected.campus)) return false;
      if (!valueMatchesSelection(r.modality, selected.modality)) return false;
      if (!valueMatchesSelection(r.instructor, selected.instructor)) return false;
      if (!valueMatchesSelection(r.dayPattern, selected.day)) return false;
      if (!valueMatchesSelection(r.timeBlock, selected.time)) return false;
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
      const sourceTerm = termFromFilename(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve((r.data || []).map(row => ({ ...row, __sourceTerm: sourceTerm }))),
        error: reject
      });
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
      existing.dayPattern = dayPattern(existing.days) || existing.dayPattern || row.dayPattern || 'TBA';
      if (!existing.start || (row.start && row.start < existing.start)) existing.start = row.start;
      if (!existing.end || (row.end && row.end > existing.end)) existing.end = row.end;
      existing.timeBlock = timeBlock(existing.start, existing.modality);
      existing.room = existing.room || row.room;
      existing.instructor = existing.instructor || row.instructor;
    });
    return [...map.values()];
  }

  async function loadAttritionFiles() {
    state.enrollment = dedupeEnrollmentRows((await readCsv(document.getElementById('enrollmentCsv'))).map(normalize))
      .filter(row => !isDualEnrollment(row));
    const fallbackRows = currentRows().filter(row => !isDualEnrollment(row));
    const allEnrollment = state.enrollment.length ? state.enrollment : fallbackRows;
    state.attritionTerms = collectTerms(allEnrollment);
    updateDecisionTermOptions(state.attritionTerms);
    populateAnalyticsFilters('attr', allEnrollment);
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
    renderAttritionLegend();
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
    const allRows = await loadConsolidationRows();
    const rows = applyFilters(allRows, 'con');
    const minSections = Number(document.getElementById('conMinSections')?.value || 5);
    const lowFill = Number(document.getElementById('conLowFill')?.value || 50) / 100;
    const options = {
      sameCampus: document.getElementById('conSameCampus')?.checked,
      sameModality: document.getElementById('conSameModality')?.checked,
      dayMatch: document.getElementById('conDayMatch')?.value || 'exact',
      timeWindowHours: document.getElementById('conTimeWindow')?.value === '' ? null : Number(document.getElementById('conTimeWindow')?.value || 2)
    };
    const byCourse = group(rows, (r) => `${r.term || currentTerm()}||${r.subject} ${r.course}`);
    const history = await historicalPatterns();
    state.consolidationRows = [];
    byCourse.forEach((sections, key) => {
      const course = key.split('||')[1] || key;
      if (sections.length < minSections) return;
      const low = sections.filter((s) => s.fillRate <= lowFill);
      low.forEach((source) => {
        const candidates = sections
          .filter((target) => target !== source && target.cap - target.actual >= source.actual)
          .filter((target) => !options.sameCampus || target.campus === source.campus)
          .filter((target) => !options.sameModality || target.modality === source.modality)
          .filter((target) => dayWindowMatches(source, target, options.dayMatch))
          .filter((target) => timeWindowMatches(source, target, options.timeWindowHours))
          .map((target) => candidate(source, target, history, options))
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
    renderConsolidationLegend();
  }

  async function loadConsolidationRows() {
    const uploaded = dedupeEnrollmentRows((await readCsv(document.getElementById('consolidationCsv'))).map(normalize));
    if (uploaded.length) state.consolidationInput = uploaded;
    const rows = state.consolidationInput.length ? state.consolidationInput : currentRows();
    populateAnalyticsFilters('con', rows);
    return rows;
  }

  function dayWindowMatches(source, target, mode) {
    if (mode === 'any') return true;
    if (mode === 'overlap') {
      const sourceDays = new Set(source.days || []);
      return (target.days || []).some(day => sourceDays.has(day));
    }
    return source.dayPattern === target.dayPattern;
  }

  function minutesFromTime(time) {
    if (!time) return null;
    const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function timeWindowMatches(source, target, windowHours) {
    if (windowHours == null) return true;
    const sourceStart = minutesFromTime(source.start);
    const targetStart = minutesFromTime(target.start);
    if (sourceStart == null || targetStart == null) return source.timeBlock === target.timeBlock;
    return Math.abs(sourceStart - targetStart) <= windowHours * 60;
  }

  function candidate(source, target, history, options = {}) {
    let score = 25;
    const reasons = [];
    if (target.campus === source.campus) { score += 15; reasons.push('same campus'); }
    if (target.modality === source.modality) { score += 15; reasons.push('same modality'); }
    if (target.dayPattern === source.dayPattern && target.start === source.start) { score += 20; reasons.push('same day/time pattern'); }
    else if (target.dayPattern === source.dayPattern) { score += 10; reasons.push('same days'); }
    else if (dayWindowMatches(source, target, options.dayMatch)) reasons.push(options.dayMatch === 'overlap' ? 'shared meeting day' : 'day allowed');
    if (target.start !== source.start && timeWindowMatches(source, target, options.timeWindowHours)) {
      reasons.push(options.timeWindowHours == null ? 'time allowed' : `within ${options.timeWindowHours} hour start window`);
    }
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
    const lowFill = Number(document.getElementById('conLowFill')?.value || 50) / 100;
    if (!lookback || !window.BACKEND_BASE_URL) return map;
    try {
      const terms = await fetch(`${window.BACKEND_BASE_URL}/terms`).then((r) => r.json());
      const priorTerms = (Array.isArray(terms) ? terms : []).filter((t) => t && t !== currentTerm()).slice(-lookback);
      const batches = await Promise.all(priorTerms.map((t) => fetch(`${window.BACKEND_BASE_URL}/schedule/${encodeURIComponent(t)}`).then((r) => r.ok ? r.json() : [])));
      batches.flat().map(normalize).forEach((row) => {
        const key = patternKey(row);
        const item = map.get(key) || { terms: 0, low: 0 };
        item.terms += 1;
        if (row.fillRate <= lowFill) item.low += 1;
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
      <table><thead><tr>${columns.map((c, index) => `<th><button type="button" class="analytics-sort" data-column="${index}" aria-label="Sort by ${label(c)}">${label(c)} <span aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
      <tbody>${display.map((row) => `<tr>${columns.map((c) => `<td data-sort="${escapeAttr(sortValue(row[c], c))}">${format(row[c], c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` :
      '<p class="analytics-empty">No rows match the selected criteria.</p>';
  }

  function escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sortValue(value, column = '') {
    if (typeof value === 'number') return String(value);
    if (/(rate|fill)$/i.test(column)) return String(num(value) / 100);
    return String(value ?? '').trim();
  }

  function sortAnalyticsTable(button) {
    const tableNode = button.closest('table');
    const tbody = tableNode?.querySelector('tbody');
    if (!tableNode || !tbody) return;
    const column = Number(button.dataset.column);
    const current = button.dataset.direction || 'none';
    const direction = current === 'asc' ? 'desc' : 'asc';
    tableNode.querySelectorAll('.analytics-sort').forEach(sortButton => {
      sortButton.dataset.direction = '';
      sortButton.querySelector('span').textContent = '';
    });
    button.dataset.direction = direction;
    button.querySelector('span').textContent = direction === 'asc' ? '^' : 'v';
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const values = rows.map(row => row.children[column]?.dataset.sort ?? '');
    const numeric = values.filter(Boolean).every(value => Number.isFinite(Number(value)));
    rows.sort((a, b) => {
      const left = a.children[column]?.dataset.sort ?? '';
      const right = b.children[column]?.dataset.sort ?? '';
      const result = numeric
        ? Number(left) - Number(right)
        : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? result : -result;
    });
    rows.forEach(row => tbody.appendChild(row));
  }

  function renderAttritionLegend() {
    const legend = document.getElementById('attritionLegend');
    if (!legend) return;
    const items = [
      ['Group', 'The current grouping selected in Group by, usually Discipline + Course.'],
      ['Terms', 'Number of uploaded terms represented in that row after filters are applied.'],
      ['Decision Sections', 'Number of sections for the selected decision term only.'],
      ['Decision Census', 'Sum of CENSUS_ENROLL for the selected decision term only.'],
      ['Decision Final', 'Sum of ACTUAL_ENROLL for the selected decision term only. If the decision-term file is not final or is a current snapshot, this can match Decision Census.'],
      ['Decision Attrition Count', 'Decision Census minus Decision Final, floored at zero.'],
      ['Decision Attrition Rate', 'Decision Attrition Count divided by Decision Census.'],
      ['Historical Attrition Rate', 'Historical attrition from comparison terms only; it excludes the decision term.'],
      ['All Terms Sections', 'Section count across the decision term plus included comparison terms.'],
      ['All Terms Census', 'CENSUS_ENROLL across all included terms.'],
      ['All Terms Final', 'ACTUAL_ENROLL across all included terms.'],
      ['All Terms Attrition Rate', 'All Terms Census minus All Terms Final, divided by All Terms Census.'],
      ['All Terms Census Fill', 'All Terms Census divided by total MAX ENROLL. Values above 100% mean sections exceeded listed capacity.'],
      ['All Terms Final Fill', 'All Terms Final divided by total MAX ENROLL. Values above 100% mean sections exceeded listed capacity.'],
      ['All Terms Available At Census', 'MAX ENROLL minus CENSUS_ENROLL across all included terms, floored at zero.'],
      ['All Terms Available At End', 'MAX ENROLL minus ACTUAL_ENROLL across all included terms, floored at zero.']
    ];
    legend.innerHTML = `
      <h3>Column Legend</h3>
      <p>Decision columns isolate the selected decision term. All Terms columns combine the decision term with any included comparison terms. Historical columns use comparison terms only.</p>
      <dl>${items.map(([term, definition]) => `<div><dt>${term}</dt><dd>${definition}</dd></div>`).join('')}</dl>`;
  }

  function renderConsolidationLegend() {
    const legend = document.getElementById('consolidationLegend');
    if (!legend) return;
    const items = [
      ['Consolidation CSV(s)', 'Optional upload for this report. If no file is uploaded, the report uses the currently loaded dashboard schedule.'],
      ['Min sections', 'Minimum number of sections a course must have before it is considered for consolidation review. This prevents one-off courses from being flagged.'],
      ['Low fill %', 'A source section is considered low-filled when ACTUAL_ENROLL divided by MAX ENROLL is at or below this threshold.'],
      ['Lookback terms', 'Number of prior terms to check for historical low-fill patterns when backend schedule history is available.'],
      ['Min hist terms', 'Minimum number of historical matches needed before a pattern can be labeled chronic.'],
      ['Chronic %', 'Historical low-fill share required to mark the source pattern as chronic. Example: 75% means at least three out of four matching historical patterns were low-filled.'],
      ['Day match', 'Controls which receiving sections can be considered: exact same meeting pattern, any shared meeting day, or any day.'],
      ['Start window', 'Controls how far apart source and receiving section start times can be. The default +/- 2 hours means a 10:00 source can match starts from 8:00 through 12:00.'],
      ['Same campus', 'When checked, source and receiving sections must be on the same campus.'],
      ['Same modality', 'When checked, source and receiving sections must use the same instructional modality.'],
      ['Score', 'Planning score based on operational similarity such as same campus, modality, days/time, instructor, room, and chronic historical low fill.'],
      ['Source Section', 'The lower-filled section being reviewed as a possible consolidation source.'],
      ['Target Section', 'The receiving section with enough open seats to absorb the source section enrollment.'],
      ['Target Open Seats', 'MAX ENROLL minus ACTUAL_ENROLL for the receiving section. It must be at least the source section enrollment.'],
      ['Freed Seats', 'The source section capacity that could be freed if the section were consolidated. This is a planning indicator, not an automatic cancellation instruction.']
    ];
    legend.innerHTML = `
      <h3>Control and Column Legend</h3>
      <p>This report only identifies review candidates. A section appears when a low-filled source section has another section in the same term and course with enough open seats and matching the selected campus, modality, day, and time-window rules.</p>
      <dl>${items.map(([term, definition]) => `<div><dt>${term}</dt><dd>${definition}</dd></div>`).join('')}</dl>`;
  }

  function label(text) {
    const labels = {
      group: 'Group',
      subject: 'Discipline',
      decisionSections: 'Decision Sections',
      decisionCensus: 'Decision Census',
      decisionFinal: 'Decision Final',
      decisionAttritionCount: 'Decision Attrition Count',
      decisionAttritionRate: 'Decision Attrition Rate',
      historicalAttritionRate: 'Historical Attrition Rate',
      sections: 'All Terms Sections',
      census: 'All Terms Census',
      final: 'All Terms Final',
      attritionRate: 'All Terms Attrition Rate',
      censusFillRate: 'All Terms Census Fill',
      finalFillRate: 'All Terms Final Fill',
      availableAtCensus: 'All Terms Available At Census',
      availableAtEnd: 'All Terms Available At End'
    };
    return labels[text] || text.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  function format(value, column = '') {
    if (typeof value === 'number' && /(rate|fill)$/i.test(column)) return pct(value);
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
      const rows = state.enrollment.length ? state.enrollment : currentRows().filter(row => !isDualEnrollment(row));
      updateDecisionTermOptions(state.attritionTerms.length ? state.attritionTerms : collectTerms(rows));
      populateAnalyticsFilters('attr', rows);
      document.getElementById('attritionTable').innerHTML = '<p class="analytics-empty">Upload enrollment CSV files, then click Run.</p>';
    }
    if (selected === REPORTS.consolidation) {
      populateAnalyticsFilters('con', state.consolidationInput.length ? state.consolidationInput : currentRows());
      renderConsolidationLegend();
    }
  }

  function injectStyle() {
    if (document.getElementById('analyticsReportStyles')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="analyticsReportStyles">
      .analytics-reports{width:min(1480px,calc(100% - 2rem));margin:16px auto 24px;padding:20px;background:#fff;border:1px solid #d8e1ec;border-radius:16px;box-shadow:0 8px 24px rgba(15,45,75,.08)}
      .analytics-report-intro{margin-bottom:16px;color:#51657c;line-height:1.45}
      .analytics-report-intro h2{margin:0 0 6px;color:#123367;font-size:24px}
      .analytics-report-intro p{margin:0;max-width:980px}
      .analytics-methodology{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px;padding:14px;border:1px solid #d8e1ec;border-radius:12px;background:#f8fbff}
      .analytics-methodology h3{margin:0 0 6px;color:#123367;font-size:15px}
      .analytics-methodology ul{margin:0;padding-left:18px}
      .analytics-methodology li{margin:4px 0}
      .analytics-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-bottom:18px}
      .analytics-toolbar label{display:flex;flex-direction:column;gap:4px;font-weight:600;color:#51657c;font-size:13px}
      .analytics-toolbar input,.analytics-toolbar select{min-height:34px;border:1px solid #ccd6e2;border-radius:6px;padding:6px 8px}
      .analytics-toolbar input[type=checkbox]{min-height:auto}
      .analytics-toolbar button{min-height:36px;border:0;border-radius:18px;padding:0 16px;background:#cdeffc;color:#002b5c;font-weight:700;cursor:pointer}
      .analytics-toolbar .choices{min-width:170px;margin-bottom:0}
      .analytics-toolbar .choices__inner{min-height:34px;border:1px solid #ccd6e2;border-radius:6px;background:#fff;padding:3px 6px}
      .analytics-toolbar .choices__list--multiple .choices__item{background:#174f7d;border-color:#174f7d}
      .analytics-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
      .analytics-metrics div{border:1px solid #d8e1ec;border-radius:8px;padding:12px;background:#f8fbff}
      .analytics-metrics strong{display:block;font-size:22px;color:#002b5c}
      .analytics-metrics span{font-size:12px;color:#51657c;text-transform:uppercase}
      .analytics-table{overflow:auto;max-height:620px;border:1px solid #d8e1ec;border-radius:8px}
      .analytics-table table{width:100%;border-collapse:collapse;background:#fff}
      .analytics-table th{position:sticky;top:0;background:#174f7d;color:#fff;text-align:left;padding:9px;font-size:13px}
      .analytics-table th .analytics-sort{display:flex;align-items:center;gap:5px;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:800;text-align:left;cursor:pointer;padding:0}
      .analytics-table th .analytics-sort span{min-width:10px;font-size:10px}
      .analytics-table td{border-top:1px solid #e6edf5;padding:8px;font-size:13px}
      .analytics-empty{padding:16px;margin:0;color:#51657c}
      .analytics-legend{margin-top:14px;padding:14px;border:1px solid #d8e1ec;border-radius:12px;background:#f8fbff;color:#51657c}
      .analytics-legend h3{margin:0 0 6px;color:#123367;font-size:16px}
      .analytics-legend p{margin:0 0 10px;max-width:980px}
      .analytics-legend dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px 16px;margin:0}
      .analytics-legend div{border-top:1px solid #e2eaf3;padding-top:8px}
      .analytics-legend dt{font-weight:800;color:#123367}
      .analytics-legend dd{margin:3px 0 0;line-height:1.35}
    </style>`);
  }

  function wire() {
    document.getElementById('viewSelect')?.addEventListener('change', updateVisibility);
    document.getElementById('termSelect')?.addEventListener('change', () => {
      if (document.getElementById('viewSelect')?.value === REPORTS.consolidation) runConsolidation();
    });
    document.getElementById('runAttrition')?.addEventListener('click', runAttrition);
    document.getElementById('enrollmentCsv')?.addEventListener('change', loadAttritionFiles);
    document.getElementById('clearAttrition')?.addEventListener('click', () => resetAnalyticsControls('attr'));
    document.getElementById('runConsolidation')?.addEventListener('click', runConsolidation);
    document.getElementById('consolidationCsv')?.addEventListener('change', loadConsolidationRows);
    document.getElementById('clearConsolidation')?.addEventListener('click', () => resetAnalyticsControls('con'));
    document.getElementById('exportAttrition')?.addEventListener('click', () => exportRows(state.attritionRows, `enrollment-attrition-${currentTerm() || 'term'}.csv`));
    document.getElementById('exportConsolidation')?.addEventListener('click', () => exportRows(state.consolidationRows.map(flattenOpportunity), `section-consolidation-${currentTerm() || 'term'}.csv`));
    document.getElementById('analyticsReports')?.addEventListener('click', (event) => {
      const button = event.target.closest('.analytics-sort');
      if (button) sortAnalyticsTable(button);
    });
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
