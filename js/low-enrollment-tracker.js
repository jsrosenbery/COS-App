(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSLowEnrollmentTracker = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const DEFAULT_JUSTIFICATIONS = Object.freeze([
    'Dual Enrollment',
    'Single section offering in Hanford',
    'Single section of course which are not scheduled every semester but meet specific requirements of a major',
    'No other available options for students at that time',
    'Single section of a required class in a program sequence',
    'Experimental to run this class twice per year.',
    'Single section Offering in Visalia',
    'Single section offering in Tulare',
    'Required for faculty to complete a full load for the semester',
    'Other'
  ]);

  const HEADER_ALIASES = Object.freeze({
    course: ['course(s)', 'course', 'subject/course', 'subj_course'],
    crnDisplay: ['crn(s)', 'crn', 'crns'],
    title: ['title', 'course title'],
    crossListId: ['cross list', 'cross_list', 'xlist'],
    crnCount: ['crn count'],
    currentEnrollment: ['current enrollment', 'actual_enroll', 'actual enroll', 'actualenroll', 'enrollment'],
    maxEnrollment: ['max enrollment', 'max enroll', 'maxenroll'],
    waitCount: ['wait count', 'waitcount'],
    instructionalMethod: ['inst. method', 'inst method', 'instructional_method_code', 'instructional method', 'insm_code_ssbsect'],
    scheduleType: ['sched type', 'schedule type', 'schedule_code', 'schd_code_ssrmeet'],
    appliedRule: ['applied rule'],
    threshold: ['threshold'],
    startDate: ['start date', 'startdate'],
    division: ['division', 'divisionid'],
    campus: ['campus'],
    faculty: ['faculty', 'instructor', 'facultyname'],
    justification: ['justification'],
    vpComments: ['comments to vps office', 'comments to vp office', 'comments to vp', 'vp comments']
  });

  let mounted = null;

  function normalizeHeader(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/[._/\\-]+/g, ' ')
      .replace(/[^\w\s()]/g, '')
      .trim()
      .toLowerCase();
  }

  function buildHeaderMap(headers = []) {
    const normalized = headers.map(normalizeHeader);
    const map = {};
    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      const aliasSet = aliases.map(normalizeHeader);
      const index = normalized.findIndex(header => aliasSet.includes(header));
      if (index >= 0) map[field] = index;
    });
    return map;
  }

  function valueAt(row, headerMap, field) {
    const index = headerMap[field];
    return index === undefined ? '' : row[index];
  }

  function cleanString(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = cleanString(value).replace(/[$,%]/g, '');
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toInteger(value) {
    const number = toNumber(value);
    return number === null ? null : Math.trunc(number);
  }

  function parseCrns(value) {
    const matches = String(value || '').match(/\d{3,}/g) || [];
    return Array.from(new Set(matches.map(item => item.trim()).filter(Boolean)));
  }

  function normalizeDate(value) {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number' && Number.isFinite(value)) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + Math.trunc(value));
      return epoch.toISOString().slice(0, 10);
    }
    const text = cleanString(value);
    const mdY = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (mdY) {
      const year = mdY[3].length === 2 ? Number(`20${mdY[3]}`) : Number(mdY[3]);
      const date = new Date(Date.UTC(year, Number(mdY[1]) - 1, Number(mdY[2])));
      return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
  }

  function extractSnapshotDateFromFilename(filename = '') {
    const text = cleanString(filename);
    const match = text.match(/(?:^|[^0-9])(\d{1,2})[-_](\d{1,2})[-_](\d{2,4})(?:[^0-9]|$)/);
    if (!match) return '';
    const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
    return normalizeDate(`${match[1]}/${match[2]}/${year}`);
  }

  function extractTermCodeFromFilename(filename = '') {
    const match = cleanString(filename).match(/\b(20\d{4})\b/);
    return match ? match[1] : '';
  }

  function displayTermFromCode(termCode = '') {
    const code = cleanString(termCode);
    const match = code.match(/^(20\d{2})(10|20|30)$/);
    if (!match) return code;
    const termYear = Number(match[1]);
    if (match[2] === '10') return `FALL ${termYear - 1}`;
    if (match[2] === '20') return `SPRING ${termYear}`;
    if (match[2] === '30') return `SUMMER ${termYear}`;
    return code;
  }

  function snapshotLabel(date, filename, fallback = 'Initial') {
    const datePart = date || extractSnapshotDateFromFilename(filename);
    return datePart ? `${fallback} - ${datePart}` : fallback;
  }

  function statusForRow(row) {
    if (!row) return 'Missing Update';
    const threshold = toNumber(row.threshold);
    const highest = toNumber(row.highestEnrollment ?? row.latestEnrollment ?? row.initialEnrollment);
    if (row.manualReview) return 'Manual Review';
    if (highest !== null && threshold !== null && highest >= threshold) return 'Threshold Met';
    if (row.latestEnrollment === null || row.latestEnrollment === undefined || row.latestEnrollment === '') return 'Missing Update';
    return 'Below Threshold';
  }

  function parseReasonsTable(table = []) {
    const reasons = [];
    table.forEach(row => {
      const reason = cleanString(Array.isArray(row) ? row[0] : row?.Reason || row?.reason || '');
      if (reason && !/^reason$/i.test(reason) && !reasons.includes(reason)) reasons.push(reason);
    });
    return reasons.length ? reasons : Array.from(DEFAULT_JUSTIFICATIONS);
  }

  function allowedReasons(workspaceOrReasons) {
    const reasons = Array.isArray(workspaceOrReasons)
      ? workspaceOrReasons
      : Array.isArray(workspaceOrReasons?.reasons) ? workspaceOrReasons.reasons : [];
    return Array.from(new Set((reasons.length ? reasons : DEFAULT_JUSTIFICATIONS).map(cleanString).filter(Boolean)));
  }

  function normalizeJustification(value, reasons) {
    const text = cleanString(value);
    if (!text) return '';
    return allowedReasons(reasons).includes(text) ? text : '';
  }

  function duplicateCrns(rows = []) {
    const counts = new Map();
    rows.forEach(row => (row.crns || []).forEach(crn => counts.set(String(crn), (counts.get(String(crn)) || 0) + 1)));
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([crn]) => crn);
  }

  function buildImportSummary(workspace, headerMap = {}) {
    const rows = workspace?.rows || [];
    const duplicateList = duplicateCrns(rows);
    return {
      rowsImported: rows.length,
      individualCrns: new Set(rows.flatMap(row => row.crns || [])).size,
      crossListedRows: rows.filter(row => (row.crns || []).length > 1 || cleanString(row.crossListId)).length,
      justificationChoicesLoaded: allowedReasons(workspace).length,
      blankJustifications: rows.filter(row => !cleanString(row.justification)).length,
      blankVpComments: rows.filter(row => !cleanString(row.vpComments)).length,
      invalidOrBlankThresholds: rows.filter(row => toNumber(row.threshold) === null).length,
      duplicateCrns: duplicateList,
      detectedTerm: workspace?.termCode || '',
      initialSnapshotDate: workspace?.initialSnapshotDate || '',
      requiredFields: {
        course: headerMap.course !== undefined,
        crn: headerMap.crnDisplay !== undefined,
        currentEnrollment: headerMap.currentEnrollment !== undefined,
        threshold: headerMap.threshold !== undefined
      }
    };
  }

  function validateImportWorkspace(workspace, headerMap = {}) {
    const summary = buildImportSummary(workspace, headerMap);
    const errors = [];
    if (!summary.requiredFields.course) errors.push('Course column was not found.');
    if (!summary.requiredFields.crn) errors.push('CRN column was not found.');
    if (!summary.requiredFields.currentEnrollment) errors.push('Current enrollment column was not found.');
    if (!summary.requiredFields.threshold) errors.push('Threshold column was not found.');
    if (!summary.rowsImported) errors.push('At least one valid data row with a CRN is required.');
    if (!cleanString(workspace?.termCode) || workspace.termCode === 'LOW-ENROLLMENT') errors.push('Term code must be detected from the filename or supplied explicitly.');
    if (summary.invalidOrBlankThresholds) errors.push(`${summary.invalidOrBlankThresholds} row(s) have invalid or blank thresholds.`);
    return { valid: errors.length === 0, errors, summary };
  }

  function rowFromWorkbook(row, headerMap, index, sourceMeta = {}) {
    const crnDisplay = cleanString(valueAt(row, headerMap, 'crnDisplay'));
    const crns = parseCrns(crnDisplay);
    const initialEnrollment = toInteger(valueAt(row, headerMap, 'currentEnrollment'));
    const maxEnrollment = toInteger(valueAt(row, headerMap, 'maxEnrollment'));
    const threshold = toInteger(valueAt(row, headerMap, 'threshold'));
    const trackerRow = {
      id: `ler-${cleanString(sourceMeta.termCode || 'term')}-${index + 1}`,
      displayOrder: index + 1,
      course: cleanString(valueAt(row, headerMap, 'course')),
      crnDisplay,
      crns,
      title: cleanString(valueAt(row, headerMap, 'title')),
      crossListId: cleanString(valueAt(row, headerMap, 'crossListId')),
      crnCount: toInteger(valueAt(row, headerMap, 'crnCount')) ?? crns.length,
      currentEnrollment: initialEnrollment,
      initialEnrollment,
      latestEnrollment: initialEnrollment,
      highestEnrollment: initialEnrollment,
      maxEnrollment,
      waitCount: toInteger(valueAt(row, headerMap, 'waitCount')),
      instructionalMethod: cleanString(valueAt(row, headerMap, 'instructionalMethod')),
      scheduleType: cleanString(valueAt(row, headerMap, 'scheduleType')),
      appliedRule: cleanString(valueAt(row, headerMap, 'appliedRule')),
      threshold,
      startDate: normalizeDate(valueAt(row, headerMap, 'startDate')),
      division: cleanString(valueAt(row, headerMap, 'division')),
      campus: cleanString(valueAt(row, headerMap, 'campus')),
      faculty: cleanString(valueAt(row, headerMap, 'faculty')),
      justification: normalizeJustification(valueAt(row, headerMap, 'justification'), sourceMeta.reasons || DEFAULT_JUSTIFICATIONS),
      vpComments: cleanString(valueAt(row, headerMap, 'vpComments')),
      missingSnapshots: [],
      snapshotValues: {}
    };
    trackerRow.status = statusForRow(trackerRow);
    return trackerRow;
  }

  function parseWorkbookTable(table = [], options = {}) {
    const headersIndex = table.findIndex(row => Array.isArray(row) && row.some(cell => /crn/i.test(cleanString(cell))));
    if (headersIndex < 0) throw new Error('Low Enrollment workbook header row was not found.');
    const headers = table[headersIndex];
    const headerMap = buildHeaderMap(headers);
    if (headerMap.crnDisplay === undefined || headerMap.course === undefined) {
      throw new Error('Workbook must include Course(s) and CRN(s) columns.');
    }
    const termCode = cleanString(options.termCode || extractTermCodeFromFilename(options.filename || '') || 'LOW-ENROLLMENT');
    const sourceDate = normalizeDate(options.snapshotDate || extractSnapshotDateFromFilename(options.filename || '') || new Date());
    const reasons = allowedReasons(options.reasons || DEFAULT_JUSTIFICATIONS);
    const rows = table.slice(headersIndex + 1)
      .filter(row => Array.isArray(row) && row.some(cell => cleanString(cell)))
      .map((row, index) => rowFromWorkbook(row, headerMap, index, { termCode, reasons }))
      .filter(row => row.crns.length);
    const snapshot = {
      snapshotDate: sourceDate,
      label: snapshotLabel(sourceDate, options.filename, 'Initial workbook'),
      sourceFilename: cleanString(options.filename),
      type: 'initial',
      values: {}
    };
    rows.forEach(row => {
      snapshot.values[row.id] = {
        enrollment: row.initialEnrollment,
        matchedCrns: row.crns,
        missingCrns: []
      };
      row.snapshotValues[sourceDate] = row.initialEnrollment;
    });
    const workspace = {
      termCode,
      displayTerm: displayTermFromCode(termCode),
      sourceFilename: cleanString(options.filename),
      initialSnapshotDate: sourceDate,
      reasons,
      rows,
      snapshots: [snapshot],
      uploadHistory: [{
        type: 'initial',
        sourceFilename: cleanString(options.filename),
        uploadedAt: new Date().toISOString(),
        snapshotDate: sourceDate,
        rowsImported: rows.length
      }],
      importSummary: null,
      importErrors: []
    };
    const validation = validateImportWorkspace(workspace, headerMap);
    workspace.importSummary = validation.summary;
    workspace.importErrors = validation.errors;
    if (!validation.valid && options.throwOnInvalid !== false) {
      throw new Error(validation.errors.join(' '));
    }
    return workspace;
  }

  function parseWorkbook(workbook, options = {}) {
    const sheetNames = workbook?.SheetNames || Object.keys(workbook?.Sheets || {});
    const reportName = sheetNames.find(name => /low enrollment/i.test(name)) || sheetNames[0];
    if (!reportName) throw new Error('Workbook did not contain a worksheet.');
    const xlsx = root.XLSX;
    if (!xlsx?.utils?.sheet_to_json) throw new Error('XLSX parser is not available.');
    const reportTable = xlsx.utils.sheet_to_json(workbook.Sheets[reportName], { header: 1, defval: '' });
    const reasonsName = sheetNames.find(name => /^reasons$/i.test(name));
    let reasons = Array.from(DEFAULT_JUSTIFICATIONS);
    if (reasonsName) {
      const reasonsTable = xlsx.utils.sheet_to_json(workbook.Sheets[reasonsName], { header: 1, defval: '' });
      reasons = parseReasonsTable(reasonsTable);
    }
    const workspace = parseWorkbookTable(reportTable, { ...options, reasons });
    workspace.reasons = reasons;
    workspace.rows = workspace.rows.map(row => ({ ...row, justification: normalizeJustification(row.justification, reasons) }));
    const validation = validateImportWorkspace(workspace, buildHeaderMap(reportTable.find(row => Array.isArray(row) && row.some(cell => /crn/i.test(cleanString(cell)))) || []));
    workspace.importSummary = validation.summary;
    workspace.importErrors = validation.errors;
    if (!validation.valid && options.throwOnInvalid !== false) throw new Error(validation.errors.join(' '));
    return workspace;
  }

  function firstPresent(row, keys) {
    for (const key of keys) {
      if (row && Object.prototype.hasOwnProperty.call(row, key) && cleanString(row[key]) !== '') return row[key];
      const found = Object.keys(row || {}).find(raw => normalizeHeader(raw) === normalizeHeader(key));
      if (found && cleanString(row[found]) !== '') return row[found];
    }
    return '';
  }

  function parseEnrollmentCsvRows(rawRows = []) {
    const byCrn = new Map();
    rawRows.forEach(row => {
      const crn = cleanString(firstPresent(row, ['CRN', 'crn']));
      if (!crn) return;
      if (byCrn.has(crn)) return;
      const enrollment = toInteger(firstPresent(row, ['ACTUAL_ENROLL', 'ActualEnroll', 'Actual Enroll', 'Current Enrollment', 'Enrollment']));
      byCrn.set(crn, {
        crn,
        enrollment,
        course: cleanString(firstPresent(row, ['SUBJECT/COURSE', 'SUBJ_COURSE', 'Course'])),
        title: cleanString(firstPresent(row, ['TITLE', 'Title'])),
        campus: cleanString(firstPresent(row, ['CAMPUS', 'Campus']))
      });
    });
    return byCrn;
  }

  function detectSnapshotDateFromRows(rawRows = []) {
    const dateKeys = ['SNAPSHOT_DATE', 'Snapshot Date', 'REPORT_DATE', 'Report Date', 'ACTIVITY_DATE', 'Activity Date', 'AS_OF_DATE', 'As Of Date'];
    for (const row of rawRows || []) {
      const value = firstPresent(row, dateKeys);
      const date = normalizeDate(value);
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    }
    return '';
  }

  function cloneWorkspace(workspace) {
    return JSON.parse(JSON.stringify(workspace || {}));
  }

  function applyEnrollmentSnapshot(workspace, rawRowsOrMap, options = {}) {
    const next = cloneWorkspace(workspace);
    const enrollmentMap = rawRowsOrMap instanceof Map ? rawRowsOrMap : parseEnrollmentCsvRows(rawRowsOrMap);
    const snapshotDate = normalizeDate(options.snapshotDate || new Date());
    let fullyMatchedRows = 0;
    let partiallyMatchedRows = 0;
    let completelyMissingRows = 0;
    let individualCrnsMatched = 0;
    let individualCrnsMissing = 0;
    let newlyMet = 0;
    const snapshot = {
      snapshotDate,
      label: snapshotLabel(snapshotDate, options.sourceFilename, 'Enrollment update'),
      sourceFilename: cleanString(options.sourceFilename),
      type: 'enrollment-update',
      values: {}
    };
    next.rows = (next.rows || []).map(row => {
      const before = statusForRow(row);
      const matchedCrns = [];
      const missingCrns = [];
      let total = 0;
      (row.crns || []).forEach(crn => {
        const update = enrollmentMap.get(String(crn));
        if (update && update.enrollment !== null && update.enrollment !== undefined) {
          matchedCrns.push(String(crn));
          total += Number(update.enrollment) || 0;
        } else {
          missingCrns.push(String(crn));
        }
      });
      const value = matchedCrns.length ? total : null;
      individualCrnsMatched += matchedCrns.length;
      individualCrnsMissing += missingCrns.length;
      if (matchedCrns.length && !missingCrns.length) fullyMatchedRows += 1;
      else if (matchedCrns.length && missingCrns.length) partiallyMatchedRows += 1;
      else completelyMissingRows += 1;
      const updated = {
        ...row,
        latestEnrollment: value,
        currentEnrollment: value === null ? row.currentEnrollment : value,
        highestEnrollment: (() => {
          const values = [row.initialEnrollment, row.highestEnrollment, value].map(toNumber).filter(number => number !== null);
          return values.length ? Math.max(...values) : null;
        })(),
        missingSnapshots: value === null
          ? Array.from(new Set([...(row.missingSnapshots || []), snapshotDate]))
          : (row.missingSnapshots || []).filter(date => date !== snapshotDate),
        snapshotValues: { ...(row.snapshotValues || {}), [snapshotDate]: value },
        snapshotMatchStatus: { ...(row.snapshotMatchStatus || {}), [snapshotDate]: matchedCrns.length && missingCrns.length ? 'partial' : matchedCrns.length ? 'matched' : 'missing' },
        snapshotMissingCrns: { ...(row.snapshotMissingCrns || {}), [snapshotDate]: missingCrns }
      };
      updated.status = statusForRow(updated);
      if (before !== 'Threshold Met' && updated.status === 'Threshold Met') newlyMet += 1;
      snapshot.values[row.id] = { enrollment: value, matchedCrns, missingCrns };
      return updated;
    });
    next.snapshots = [...(next.snapshots || []).filter(item => item.snapshotDate !== snapshotDate), snapshot]
      .sort((a, b) => String(a.snapshotDate).localeCompare(String(b.snapshotDate)));
    const uploadSummary = {
      fullyMatchedRows,
      partiallyMatchedRows,
      completelyMissingRows,
      individualCrnsMatched,
      individualCrnsMissing,
      newlyMet
    };
    next.uploadHistory = [...(next.uploadHistory || []).filter(item => !(item.type === 'snapshot' && item.snapshotDate === snapshotDate)), {
      type: 'snapshot',
      sourceFilename: cleanString(options.sourceFilename),
      uploadedAt: new Date().toISOString(),
      snapshotDate,
      ...uploadSummary
    }];
    next.updatedAt = new Date().toISOString();
    return {
      workspace: next,
      snapshot,
      uploadHistory: next.uploadHistory[next.uploadHistory.length - 1],
      ...uploadSummary
    };
  }

  function escapeHtml(value) {
    return cleanString(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function apiUrl(path) {
    const base = mounted?.backendBaseUrl || root.BACKEND_BASE_URL || '';
    return base ? `${base}${path}` : '';
  }

  function authHeaders() {
    const token = mounted?.getToken?.() || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchJson(path, options = {}) {
    const url = apiUrl(path);
    if (!url) throw new Error('Backend is not configured.');
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload.error || `Request failed (${response.status})`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  function selectedWorkspace() {
    return mounted?.workspace || null;
  }

  function statusCounts(workspace) {
    const counts = { all: 0, below: 0, met: 0, missing: 0, manual: 0 };
    (workspace?.rows || []).forEach(row => {
      counts.all += 1;
      const status = statusForRow(row);
      if (status === 'Threshold Met') counts.met += 1;
      else if (status === 'Missing Update') counts.missing += 1;
      else if (status === 'Manual Review') counts.manual += 1;
      else counts.below += 1;
    });
    return counts;
  }

  function renderMetrics(workspace) {
    const counts = statusCounts(workspace);
    return `
      <div class="low-enrollment-metrics">
        <button type="button" data-status-card="all"><strong>${counts.all}</strong><span>Rows</span></button>
        <button type="button" data-status-card="below"><strong>${counts.below}</strong><span>Below Threshold</span></button>
        <button type="button" data-status-card="met"><strong>${counts.met}</strong><span>Threshold Met</span></button>
        <button type="button" data-status-card="missing"><strong>${counts.missing}</strong><span>Missing Update</span></button>
        <button type="button" data-status-card="manual"><strong>${counts.manual}</strong><span>Manual Review</span></button>
        <div><strong>${(workspace?.snapshots || []).length}</strong><span>Dated Snapshots</span></div>
      </div>
    `;
  }

  function reasonOptions(workspace, selected) {
    const reasons = allowedReasons(workspace);
    return `<option value=""></option>${reasons.map(reason => `<option value="${escapeHtml(reason)}"${reason === selected ? ' selected' : ''}>${escapeHtml(reason)}</option>`).join('')}`;
  }

  function filteredRows(workspace) {
    const filters = mounted?.filters || {};
    const status = filters.status || 'all';
    const search = cleanString(filters.search).toLowerCase();
    const division = filters.division || 'all';
    const campus = filters.campus || 'all';
    const showThresholdMet = filters.showThresholdMet !== false;
    return (workspace?.rows || []).filter(row => {
      const rowStatus = statusForRow(row);
      if (!showThresholdMet && rowStatus === 'Threshold Met') return false;
      if (status === 'below' && rowStatus !== 'Below Threshold') return false;
      if (status === 'met' && rowStatus !== 'Threshold Met') return false;
      if (status === 'missing' && rowStatus !== 'Missing Update') return false;
      if (status === 'manual' && rowStatus !== 'Manual Review') return false;
      if (division !== 'all' && cleanString(row.division) !== division) return false;
      if (campus !== 'all' && cleanString(row.campus) !== campus) return false;
      if (!search) return true;
      return [row.course, row.crnDisplay, row.title, row.division, row.campus, row.faculty, row.justification, row.vpComments]
        .some(value => cleanString(value).toLowerCase().includes(search));
    });
  }

  function distinctOptions(rows, field) {
    return Array.from(new Set((rows || []).map(row => cleanString(row[field])).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function renderTable(workspace) {
    const snapshots = (workspace?.snapshots || []).filter(snapshot => snapshot.type !== 'initial');
    const rows = filteredRows(workspace);
    const snapshotHeaders = snapshots.map(snapshot => `<th>${escapeHtml(snapshot.snapshotDate || snapshot.label)}</th>`).join('');
    const body = rows.map(row => {
      const cells = snapshots.map(snapshot => {
        const value = row.snapshotValues?.[snapshot.snapshotDate];
        const matchStatus = row.snapshotMatchStatus?.[snapshot.snapshotDate] || (value === null || value === undefined ? 'missing' : 'matched');
        const missing = row.snapshotMissingCrns?.[snapshot.snapshotDate] || [];
        const marker = matchStatus === 'partial'
          ? ` <span class="snapshot-warning" title="Missing CRNs: ${escapeHtml(missing.join(', '))}">Partial</span>`
          : matchStatus === 'missing' ? '<span class="muted">Missing</span>' : '';
        return `<td class="snapshot-${escapeHtml(matchStatus)}">${value === null || value === undefined ? '' : escapeHtml(value)}${marker}</td>`;
      }).join('');
      const status = statusForRow(row);
      return `
        <tr data-row-id="${escapeHtml(row.id)}">
          <td>${escapeHtml(row.course)}</td>
          <td>${escapeHtml(row.crnDisplay)}</td>
          <td>${escapeHtml(row.title)}</td>
          <td>${escapeHtml(row.initialEnrollment)}</td>
          ${cells}
          <td>${row.latestEnrollment === null || row.latestEnrollment === undefined ? '' : escapeHtml(row.latestEnrollment)}</td>
          <td>${row.highestEnrollment === null || row.highestEnrollment === undefined ? '' : escapeHtml(row.highestEnrollment)}</td>
          <td>${escapeHtml(row.threshold)}</td>
          <td><span class="status-pill ${status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(status)}</span></td>
          <td>${escapeHtml(row.maxEnrollment)}</td>
          <td>${escapeHtml(row.waitCount)}</td>
          <td>${escapeHtml(row.instructionalMethod)}</td>
          <td>${escapeHtml(row.appliedRule)}</td>
          <td>${escapeHtml(row.startDate)}</td>
          <td>${escapeHtml(row.division)}</td>
          <td>${escapeHtml(row.campus)}</td>
          <td>${escapeHtml(row.faculty)}</td>
          <td><select data-low-enrollment-field="justification">${reasonOptions(workspace, row.justification)}</select></td>
          <td><textarea data-low-enrollment-field="vpComments" rows="3">${escapeHtml(row.vpComments)}</textarea></td>
        </tr>
      `;
    }).join('');
    return `
      <div class="analytics-table low-enrollment-table-wrap">
        <table class="low-enrollment-table">
          <thead>
            <tr>
              <th>Course(s)</th>
              <th>CRN(s)</th>
              <th>Title</th>
              <th>Initial Enrollment</th>
              ${snapshotHeaders}
              <th>Latest Enrollment</th>
              <th>Highest Enrollment</th>
              <th>Threshold</th>
              <th>Status</th>
              <th>Max Enrollment</th>
              <th>Wait Count</th>
              <th>Inst. Method</th>
              <th>Applied Rule</th>
              <th>Start Date</th>
              <th>Division</th>
              <th>Campus</th>
              <th>Faculty</th>
              <th>Justification</th>
              <th>Comments to VP Office</th>
            </tr>
          </thead>
          <tbody>${body || '<tr><td colspan="18">No rows match the current filters.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function renderHistory(workspace) {
    const items = (workspace?.uploadHistory || []).slice().reverse();
    if (!items.length) return '<p class="analytics-empty">No upload history yet.</p>';
    return `<ul class="low-enrollment-history">${items.map(item => `
      <li>
        <strong>${escapeHtml(item.snapshotDate || item.uploadedAt || '')}</strong>
        <span>${escapeHtml(item.type || 'upload')} ${item.sourceFilename ? `from ${escapeHtml(item.sourceFilename)}` : ''}</span>
        <small>${escapeHtml(Object.entries(item).filter(([key]) => !['type', 'sourceFilename', 'snapshotDate', 'uploadedAt'].includes(key)).map(([key, value]) => `${key}: ${value}`).join(' | '))}</small>
      </li>
    `).join('')}</ul>`;
  }

  function renderImportSummary(workspace) {
    const summary = workspace?.importSummary;
    if (!summary) return '';
    return `
      <div class="low-enrollment-summary-grid">
        <span><strong>${escapeHtml(summary.rowsImported)}</strong> Rows imported</span>
        <span><strong>${escapeHtml(summary.individualCrns)}</strong> Individual CRNs</span>
        <span><strong>${escapeHtml(summary.crossListedRows)}</strong> Cross-listed rows</span>
        <span><strong>${escapeHtml(summary.justificationChoicesLoaded)}</strong> Justification choices</span>
        <span><strong>${escapeHtml(summary.blankJustifications)}</strong> Blank justifications</span>
        <span><strong>${escapeHtml(summary.blankVpComments)}</strong> Blank VP comments</span>
        <span><strong>${escapeHtml(summary.invalidOrBlankThresholds)}</strong> Invalid/blank thresholds</span>
        <span><strong>${escapeHtml((summary.duplicateCrns || []).length)}</strong> Duplicate CRNs</span>
      </div>
    `;
  }

  function render() {
    if (!mounted?.container) return;
    const workspace = mounted.workspace;
    const terms = mounted.terms || [];
    const divisions = distinctOptions(workspace?.rows || [], 'division');
    const campuses = distinctOptions(workspace?.rows || [], 'campus');
    mounted.container.innerHTML = `
      <div class="low-enrollment-tracker">
        <div class="analytics-report-intro">
          <h2>Low Enrollment Tracking</h2>
          <p>Persistent term workspace for low-enrolled sections. Import the initial watchlist workbook once, then apply dated Section Seating CSV updates to track CRN-level enrollment movement and VP comments over time.</p>
          <div class="analytics-methodology">
            <div>
              <h3>How to Use This Report</h3>
              <ul>
                <li>Import the initial Low Enrollment workbook for a term. Hidden workbook reasons are used for the Justification dropdown.</li>
                <li>Upload later Section Seating CSV files as dated enrollment updates. Individual CRNs are matched directly; visible cross-listed rows sum their member CRNs.</li>
                <li>Justification and VP comments autosave to the backend for the selected term workspace.</li>
              </ul>
            </div>
            <div>
              <h3>Methodology</h3>
              <ul>
                <li>Status is based on each row's highest observed enrollment compared with the workbook threshold.</li>
                <li>Missing Update means no member CRN from that visible workbook row appeared in the dated CSV update.</li>
                <li>This module intentionally stays separate from the central Section Seating archive so low-enrollment tracking can preserve manual comments and workbook-specific context.</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="analytics-toolbar low-enrollment-toolbar">
          <label>Saved term
            <select id="lowEnrollmentTerm">
              <option value="">${terms.length ? 'Select term' : 'No saved terms'}</option>
              ${terms.map(term => `<option value="${escapeHtml(term.termCode)}"${workspace?.termCode === term.termCode ? ' selected' : ''}>${escapeHtml(term.displayTerm || term.termCode)} (${escapeHtml(term.termCode)})</option>`).join('')}
            </select>
          </label>
          <label>Initial workbook <input id="lowEnrollmentWorkbookFile" type="file" accept=".xlsx,.xls"></label>
          <button id="importLowEnrollmentWorkbook" type="button">Import Initial Workbook</button>
          <label>Update date <input id="lowEnrollmentSnapshotDate" type="date" value="${escapeHtml(new Date().toISOString().slice(0, 10))}"></label>
          <label>Enrollment update CSV <input id="lowEnrollmentCsvFile" type="file" accept=".csv"></label>
          <button id="uploadLowEnrollmentSnapshot" type="button"${workspace ? '' : ' disabled'}>Upload Enrollment Update</button>
          <button id="refreshLowEnrollmentTerms" type="button">Refresh Terms</button>
        </div>
        <div class="analytics-toolbar low-enrollment-filterbar">
          <label>Status
            <select id="lowEnrollmentStatusFilter">
              <option value="all"${mounted?.filters?.status === 'all' ? ' selected' : ''}>All statuses</option>
              <option value="below"${mounted?.filters?.status === 'below' ? ' selected' : ''}>Below Threshold</option>
              <option value="met"${mounted?.filters?.status === 'met' ? ' selected' : ''}>Threshold Met</option>
              <option value="missing"${mounted?.filters?.status === 'missing' ? ' selected' : ''}>Missing Update</option>
              <option value="manual"${mounted?.filters?.status === 'manual' ? ' selected' : ''}>Manual Review</option>
            </select>
          </label>
          <label>Division
            <select id="lowEnrollmentDivisionFilter">
              <option value="all">All divisions</option>
              ${divisions.map(value => `<option value="${escapeHtml(value)}"${mounted?.filters?.division === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </label>
          <label>Campus
            <select id="lowEnrollmentCampusFilter">
              <option value="all">All campuses</option>
              ${campuses.map(value => `<option value="${escapeHtml(value)}"${mounted?.filters?.campus === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </label>
          <label><input id="lowEnrollmentShowThresholdMet" type="checkbox"${mounted?.filters?.showThresholdMet === false ? '' : ' checked'}> Show Threshold Met</label>
          <label>Search <input id="lowEnrollmentSearch" type="search" placeholder="Course, CRN, faculty, comment" value="${escapeHtml(mounted?.filters?.search || '')}"></label>
          <span id="lowEnrollmentSaveStatus" class="analytics-note">${workspace ? `Loaded ${escapeHtml(workspace.displayTerm || workspace.termCode)}.` : 'Import or select a saved workspace.'}</span>
        </div>
        ${workspace ? renderMetrics(workspace) : ''}
        <details class="dashboard-scope-panel" ${workspace ? 'open' : ''}>
          <summary>Upload history and workspace context</summary>
          ${workspace ? `
            <p><strong>Term:</strong> ${escapeHtml(workspace.displayTerm || workspace.termCode)} | <strong>Rows:</strong> ${escapeHtml((workspace.rows || []).length)} | <strong>Source:</strong> ${escapeHtml(workspace.sourceFilename || 'N/A')}</p>
            ${renderImportSummary(workspace)}
            ${renderHistory(workspace)}
          ` : '<p class="analytics-empty">No Low Enrollment workspace selected.</p>'}
        </details>
        ${workspace ? renderTable(workspace) : '<p class="analytics-empty">Import the initial workbook or select a saved term to begin tracking.</p>'}
      </div>
    `;
    attachHandlers();
    injectLowEnrollmentStyles();
  }

  function setStatus(message) {
    const node = mounted?.container?.querySelector('#lowEnrollmentSaveStatus');
    if (node) node.textContent = message;
  }

  async function ensureAccess() {
    if (mounted?.getToken?.()) return true;
    mounted?.requestAccess?.();
    throw new Error('Unlock this report before saving changes.');
  }

  async function loadTerms(selectTerm = '') {
    if (!apiUrl('/api/low-enrollment-tracking')) {
      mounted.terms = [];
      return;
    }
    const payload = await fetchJson('/api/low-enrollment-tracking');
    mounted.terms = payload.data || [];
    const nextTerm = selectTerm || mounted.workspace?.termCode || mounted.terms[0]?.termCode || '';
    if (nextTerm) await loadWorkspace(nextTerm);
  }

  async function loadWorkspace(term) {
    if (!term) return;
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(term)}`);
    mounted.workspace = payload.data;
  }

  async function saveWorkspace(workspace) {
    await ensureAccess();
    const existing = (mounted.terms || []).find(term => String(term.termCode) === String(workspace.termCode));
    let replaceExisting = false;
    if (existing) {
      replaceExisting = root.confirm?.(`A Low Enrollment workspace already exists for ${workspace.displayTerm || workspace.termCode}.\n\nReplacing it will remove the current snapshot history, Justifications, and VP comments for that term.\n\nReplace the existing term workspace?`) === true;
      if (!replaceExisting) throw new Error('Import canceled. Existing workspace was not replaced.');
    }
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspace.termCode)}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ workspace, replaceExisting })
    });
    mounted.workspace = payload.data;
    await loadTerms(workspace.termCode);
  }

  async function saveSnapshot(result) {
    await ensureAccess();
    const existing = (mounted.workspace?.snapshots || []).some(snapshot => snapshot.snapshotDate === result.snapshot.snapshotDate && snapshot.type !== 'initial');
    let replaceExisting = false;
    if (existing) {
      replaceExisting = root.confirm?.(`A snapshot already exists for ${result.snapshot.snapshotDate}.\n\nReplacing it will replace that dated column and recalculate Latest, Highest, and Status. Comments and Justifications will remain unchanged.\n\nReplace existing snapshot?`) === true;
      if (!replaceExisting) throw new Error('Snapshot upload canceled. Existing dated snapshot was not replaced.');
    }
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(result.workspace.termCode)}/snapshots`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ snapshot: result.snapshot, uploadHistory: result.uploadHistory, rows: result.workspace.rows, replaceExisting })
    });
    mounted.workspace = payload.data;
    await loadTerms(result.workspace.termCode);
  }

  async function readWorkbookFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = root.XLSX.read(buffer, { type: 'array', cellDates: true });
    return parseWorkbook(workbook, { filename: file.name });
  }

  async function readCsvFile(file) {
    return new Promise((resolve, reject) => {
      root.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: result => resolve(result.data || []),
        error: reject
      });
    });
  }

  function attachHandlers() {
    const container = mounted?.container;
    if (!container) return;
    container.querySelector('#refreshLowEnrollmentTerms')?.addEventListener('click', () => loadTerms().then(render).catch(err => setStatus(err.message)));
    container.querySelector('#lowEnrollmentTerm')?.addEventListener('change', event => {
      loadWorkspace(event.target.value).then(render).catch(err => setStatus(err.message));
    });
    container.querySelector('#lowEnrollmentStatusFilter')?.addEventListener('change', event => {
      mounted.filters.status = event.target.value || 'all';
      render();
    });
    container.querySelector('#lowEnrollmentSearch')?.addEventListener('input', event => {
      mounted.filters.search = event.target.value || '';
      render();
    });
    container.querySelector('#lowEnrollmentDivisionFilter')?.addEventListener('change', event => {
      mounted.filters.division = event.target.value || 'all';
      render();
    });
    container.querySelector('#lowEnrollmentCampusFilter')?.addEventListener('change', event => {
      mounted.filters.campus = event.target.value || 'all';
      render();
    });
    container.querySelector('#lowEnrollmentShowThresholdMet')?.addEventListener('change', event => {
      mounted.filters.showThresholdMet = Boolean(event.target.checked);
      render();
    });
    container.querySelectorAll('[data-status-card]')?.forEach(button => {
      button.addEventListener('click', () => {
        const filter = container.querySelector('#lowEnrollmentStatusFilter');
        if (filter) filter.value = button.dataset.statusCard || 'all';
        mounted.filters.status = button.dataset.statusCard || 'all';
        render();
      });
    });
    container.querySelector('#importLowEnrollmentWorkbook')?.addEventListener('click', async () => {
      const file = container.querySelector('#lowEnrollmentWorkbookFile')?.files?.[0];
      if (!file) return setStatus('Choose an initial Low Enrollment workbook first.');
      try {
        setStatus('Importing workbook...');
        const workspace = await readWorkbookFile(file);
        await saveWorkspace(workspace);
        const summary = workspace.importSummary || {};
        setStatus(`Imported ${workspace.rows.length} row(s), ${summary.individualCrns || 0} CRN(s), ${summary.crossListedRows || 0} cross-listed row(s).`);
        render();
      } catch (err) {
        setStatus(err.message || 'Workbook import failed.');
      }
    });
    container.querySelector('#lowEnrollmentCsvFile')?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const rows = await readCsvFile(file);
        const detected = detectSnapshotDateFromRows(rows) || extractSnapshotDateFromFilename(file.name);
        const input = container.querySelector('#lowEnrollmentSnapshotDate');
        if (detected && input) input.value = detected;
      } catch (err) {
        console.warn('Low Enrollment CSV date detection failed:', err);
      }
    });
    container.querySelector('#uploadLowEnrollmentSnapshot')?.addEventListener('click', async () => {
      const file = container.querySelector('#lowEnrollmentCsvFile')?.files?.[0];
      const workspace = selectedWorkspace();
      if (!workspace) return setStatus('Select or import a Low Enrollment workspace first.');
      if (!file) return setStatus('Choose an enrollment update CSV first.');
      try {
        setStatus('Applying enrollment update...');
        const rows = await readCsvFile(file);
        const snapshotDate = container.querySelector('#lowEnrollmentSnapshotDate')?.value || detectSnapshotDateFromRows(rows) || extractSnapshotDateFromFilename(file.name) || new Date().toISOString().slice(0, 10);
        const result = applyEnrollmentSnapshot(workspace, rows, { snapshotDate, sourceFilename: file.name });
        await saveSnapshot(result);
        setStatus(`Snapshot saved. ${result.fullyMatchedRows} full, ${result.partiallyMatchedRows} partial, ${result.completelyMissingRows} missing row(s); ${result.newlyMet} newly met threshold.`);
        render();
      } catch (err) {
        setStatus(err.message || 'Enrollment update failed.');
      }
    });
    container.querySelectorAll('[data-low-enrollment-field]')?.forEach(input => {
      const eventName = input.tagName === 'TEXTAREA' ? 'blur' : 'change';
      input.addEventListener(eventName, async event => {
        const rowNode = event.target.closest('tr[data-row-id]');
        const rowId = rowNode?.dataset.rowId;
        const field = event.target.dataset.lowEnrollmentField;
        const workspace = selectedWorkspace();
        const row = (workspace?.rows || []).find(item => item.id === rowId);
        if (!workspace || !row || !field) return;
        const previousValue = row[field] || '';
        const nextValue = event.target.value;
        row[field] = nextValue;
        try {
          setStatus('Saving row...');
          await ensureAccess();
          await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspace.termCode)}/rows/${encodeURIComponent(rowId)}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ [field]: nextValue })
          });
          setStatus('Saved.');
        } catch (err) {
          row[field] = previousValue;
          event.target.value = previousValue;
          setStatus(err.message || 'Row save failed.');
        }
      });
    });
  }

  function injectLowEnrollmentStyles() {
    if (root.document?.getElementById('lowEnrollmentTrackerStyles')) return;
    root.document?.head?.insertAdjacentHTML('beforeend', `<style id="lowEnrollmentTrackerStyles">
      .low-enrollment-tracker .analytics-methodology{grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))}
      .low-enrollment-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
      .low-enrollment-metrics button,.low-enrollment-metrics div{border:1px solid #d5e1ee;border-radius:10px;background:#f8fbff;padding:12px;text-align:left;color:#123367}
      .low-enrollment-metrics strong{display:block;font-size:24px;font-weight:900}
      .low-enrollment-metrics span{display:block;color:#51657c;font-size:11px;font-weight:900;text-transform:uppercase}
      .low-enrollment-table-wrap{max-height:680px;overflow:auto}
      .low-enrollment-table{min-width:1500px;width:100%;border-collapse:collapse}
      .low-enrollment-table th{position:sticky;top:0;z-index:2;background:#245685;color:#fff}
      .low-enrollment-table th,.low-enrollment-table td{padding:8px;border-bottom:1px solid #e1e8f0;vertical-align:top;font-size:12px}
      .low-enrollment-table textarea{min-width:210px;width:100%;resize:vertical}
      .low-enrollment-table select{min-width:220px}
      .status-pill{display:inline-flex;border-radius:999px;padding:3px 8px;font-weight:900;font-size:11px;background:#eaf1f8;color:#123367}
      .status-pill.threshold-met{background:#ecfdf3;color:#166534}
      .status-pill.below-threshold{background:#fff7ed;color:#9a3412}
      .status-pill.missing-update{background:#fef2f2;color:#991b1b}
      .status-pill.manual-review{background:#eef2ff;color:#3730a3}
      .low-enrollment-history{display:grid;gap:6px;margin:8px 0;padding-left:20px}
      .low-enrollment-history small{display:block;color:#60758d}
      .low-enrollment-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:10px 0}
      .low-enrollment-summary-grid span{display:flex;flex-direction:column;border:1px solid #d8e1ec;border-radius:8px;background:#fff;padding:8px}
      .snapshot-warning{display:inline-flex;margin-left:4px;border-radius:999px;padding:2px 6px;background:#fff7ed;color:#9a3412;font-size:10px;font-weight:900;text-transform:uppercase}
      .snapshot-partial{background:#fffaf0}
      .snapshot-missing{background:#fff5f5}
      .muted{color:#8b98a8}
    </style>`);
  }

  function mount(options = {}) {
    if (!options.container) return;
    mounted = {
      container: options.container,
      backendBaseUrl: options.backendBaseUrl || root.BACKEND_BASE_URL || '',
      getToken: options.getToken,
      requestAccess: options.requestAccess,
      terms: [],
      workspace: null,
      filters: { status: 'all', search: '', division: 'all', campus: 'all', showThresholdMet: true }
    };
    render();
    loadTerms().then(render).catch(err => setStatus(err.message || 'Low Enrollment Tracking load failed.'));
  }

  return {
    DEFAULT_JUSTIFICATIONS,
    normalizeHeader,
    buildHeaderMap,
    parseCrns,
    parseReasonsTable,
    parseWorkbookTable,
    parseWorkbook,
    parseEnrollmentCsvRows,
    detectSnapshotDateFromRows,
    validateImportWorkspace,
    buildImportSummary,
    applyEnrollmentSnapshot,
    statusForRow,
    displayTermFromCode,
    extractTermCodeFromFilename,
    extractSnapshotDateFromFilename,
    mount
  };
});
