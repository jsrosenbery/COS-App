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
  const MANUAL_IMPORT_SCHEMA = 'TIMBER_LOW_ENROLLMENT_MANUAL_V1';
  const EXCLUSION_REASONS = Object.freeze(['Open lab', 'Athletics or team activity', 'Accepted low-enrollment exception', 'Other']);

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

  const TIMELINE_EDGE_PADDING_PX = 8;

  let mounted = null;
  let lowEnrollmentResizeHandler = null;

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

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function calculateTimelineScrollLimits({
    firstColumnLeft = 0,
    lastColumnRight = 0,
    viewportWidth = 0,
    scrollWidth = 0,
    frozenLeftWidth = 0,
    frozenRightWidth = 0,
    padding = TIMELINE_EDGE_PADDING_PX
  } = {}) {
    const clientWidth = Math.max(0, finiteNumber(viewportWidth));
    const contentWidth = Math.max(clientWidth, finiteNumber(scrollWidth, clientWidth));
    const physicalMax = Math.max(0, contentWidth - clientWidth);
    const earliest = finiteNumber(firstColumnLeft) - finiteNumber(frozenLeftWidth) - finiteNumber(padding);
    const latest = finiteNumber(lastColumnRight) - clientWidth + finiteNumber(frozenRightWidth) + finiteNumber(padding);
    const minScrollLeft = Math.min(physicalMax, Math.max(0, earliest));
    const maxScrollLeft = Math.min(physicalMax, Math.max(minScrollLeft, latest));
    return { minScrollLeft, maxScrollLeft };
  }

  function calculateTimelineNavigationScroll({
    currentScrollLeft = 0,
    viewportWidth = 0,
    scrollWidth = 0,
    frozenLeftWidth = 0,
    frozenRightWidth = 0,
    targetLeft = 0,
    targetRight = 0,
    minScrollLeft = 0,
    maxScrollLeft,
    padding = TIMELINE_EDGE_PADDING_PX
  } = {}) {
    const current = Math.max(0, finiteNumber(currentScrollLeft));
    const clientWidth = Math.max(0, finiteNumber(viewportWidth));
    const contentWidth = Math.max(clientWidth, finiteNumber(scrollWidth, clientWidth));
    const physicalMax = Math.max(0, contentWidth - clientWidth);
    const min = Math.max(0, finiteNumber(minScrollLeft));
    const max = Math.max(min, maxScrollLeft === undefined ? physicalMax : Math.min(physicalMax, finiteNumber(maxScrollLeft, physicalMax)));
    const leftPane = Math.max(0, finiteNumber(frozenLeftWidth));
    const rightPane = Math.max(0, finiteNumber(frozenRightWidth));
    const edgePadding = Math.max(0, finiteNumber(padding));
    const visibleLeft = current + leftPane + edgePadding;
    const visibleRight = current + clientWidth - rightPane - edgePadding;
    let next = current;
    if (finiteNumber(targetLeft) < visibleLeft) {
      next = finiteNumber(targetLeft) - leftPane - edgePadding;
    } else if (finiteNumber(targetRight) > visibleRight) {
      next = finiteNumber(targetRight) - clientWidth + rightPane + edgePadding;
    }
    return Math.min(max, Math.max(min, next));
  }

  function localDateInputValue(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    if (value instanceof Date && !Number.isNaN(value.getTime())) return localDateInputValue(value);
    if (typeof value === 'number' && Number.isFinite(value)) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + Math.trunc(value));
      return epoch.toISOString().slice(0, 10);
    }
    const text = cleanString(value);
    const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) return `${ymd[1]}-${String(Number(ymd[2])).padStart(2, '0')}-${String(Number(ymd[3])).padStart(2, '0')}`;
    const mdY = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (mdY) {
      const year = mdY[3].length === 2 ? Number(`20${mdY[3]}`) : Number(mdY[3]);
      const date = new Date(Date.UTC(year, Number(mdY[1]) - 1, Number(mdY[2])));
      return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? text : localDateInputValue(parsed);
  }

  function parseStartDateList(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return [];
    const normalized = raw
      .replace(/\r?\n+/g, ';')
      .replace(/\s*[;,]\s*/g, ';')
      .replace(/\b(\d{4}-\d{2}-\d{2})T[^\s;,]+/g, '$1');
    const tokens = normalized.includes(';')
      ? normalized.split(';')
      : normalized.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g) || [normalized];
    return Array.from(new Set(tokens.map(normalizeDate).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))))
      .sort((a, b) => a.localeCompare(b));
  }

  function formatShortDate(isoDate) {
    const normalized = normalizeDate(isoDate);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return cleanString(isoDate);
    return `${Number(match[2])}/${Number(match[3])}/${String(match[1]).slice(-2)}`;
  }

  function formatSnapshotColumnLabel(snapshotDate) {
    const normalized = normalizeDate(snapshotDate);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return `${cleanString(snapshotDate)} Enrollment`;
    return `${Number(match[2])}-${Number(match[3])}-${String(match[1]).slice(-2)} Enrollment`;
  }

  function formatStartDateDisplay(value) {
    const dates = Array.isArray(value) ? value : parseStartDateList(value);
    if (!dates.length) return cleanString(value);
    return dates.map(formatShortDate).join('\n');
  }

  function startDateSortValue(row) {
    const dates = row?.startDates?.length ? row.startDates : parseStartDateList(row?.startDateOriginal || row?.startDate || '');
    return dates[0] || '';
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
    if (row.presumedCancelled) return 'Presumed Cancelled';
    if (row.latestEnrollment === null || row.latestEnrollment === undefined || row.latestEnrollment === '') return 'Missing Update';
    return 'Below Threshold';
  }

  function removedFromActiveWatchlist(row) {
    return Boolean(row?.missingFromLatestWorkbook) || Boolean(row?.presumedCancelled) || statusForRow(row) === 'Threshold Met';
  }

  function removedReason(row) {
    const reasons = [];
    if (row?.exclusion?.excluded) {
      const exclusionParts = ['Excluded from Tracking'];
      if (row.exclusion.reason) exclusionParts.push(cleanString(row.exclusion.reason));
      if (row.exclusion.note) exclusionParts.push(cleanString(row.exclusion.note));
      reasons.push(exclusionParts.filter(Boolean).join(': '));
    }
    if (statusForRow(row) === 'Threshold Met') reasons.push('Threshold Met');
    if (row?.presumedCancelled) {
      const cancelledParts = ['Missing from Latest Enrollment Upload - Presumed Cancelled'];
      if (row.presumedCancelledSnapshotDate) cancelledParts.push(formatShortDate(row.presumedCancelledSnapshotDate));
      reasons.push(cancelledParts.join(': '));
    }
    if (row?.missingFromLatestWorkbook) reasons.push('Removed from Latest Baseline');
    return reasons.join('; ') || '';
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
      startDateOriginal: cleanString(valueAt(row, headerMap, 'startDate')),
      startDates: parseStartDateList(valueAt(row, headerMap, 'startDate')),
      startDate: parseStartDateList(valueAt(row, headerMap, 'startDate')).join(', '),
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
    const sourceDate = normalizeDate(options.snapshotDate || extractSnapshotDateFromFilename(options.filename || '') || localDateInputValue());
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
    if (reportTable.some(row => Array.isArray(row) && row.some(value => cleanString(value) === MANUAL_IMPORT_SCHEMA))) {
      throw new Error('This is an edited Timber export. Use Import Edited Tracker instead of Import Initial Workbook.');
    }
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

  function recalculateRowEnrollmentState(row, snapshots = []) {
    const datedSnapshots = (snapshots || []).filter(snapshot => snapshot.type !== 'initial');
    const datedValues = datedSnapshots
      .map(snapshot => row.snapshotValues?.[snapshot.snapshotDate])
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(toNumber)
      .filter(value => value !== null);
    const latestSnapshot = datedSnapshots.slice().reverse().find(snapshot => {
      const value = row.snapshotValues?.[snapshot.snapshotDate];
      return value !== null && value !== undefined && value !== '';
    });
    const latestEnrollment = latestSnapshot
      ? row.snapshotValues[latestSnapshot.snapshotDate]
      : row.initialEnrollment;
    const highestValues = [row.initialEnrollment, ...datedValues].map(toNumber).filter(value => value !== null);
    const next = {
      ...row,
      latestEnrollment,
      currentEnrollment: latestEnrollment === null || latestEnrollment === undefined || latestEnrollment === '' ? row.currentEnrollment : latestEnrollment,
      highestEnrollment: highestValues.length ? Math.max(...highestValues) : null,
      presumedCancelled: false,
      presumedCancelledSnapshotDate: ''
    };
    next.status = statusForRow(next);
    return next;
  }

  function deleteEnrollmentSnapshot(workspace, snapshotDate) {
    const date = normalizeDate(snapshotDate);
    const next = cloneWorkspace(workspace);
    const removed = (next.snapshots || []).find(snapshot => snapshot.type !== 'initial' && snapshot.snapshotDate === date);
    if (!removed) throw new Error(`No enrollment update snapshot was found for ${date || 'the selected date'}.`);
    next.snapshots = (next.snapshots || []).filter(snapshot => !(snapshot.type !== 'initial' && snapshot.snapshotDate === date));
    next.rows = (next.rows || []).map(row => {
      const snapshotValues = { ...(row.snapshotValues || {}) };
      const snapshotMatchStatus = { ...(row.snapshotMatchStatus || {}) };
      const snapshotMissingCrns = { ...(row.snapshotMissingCrns || {}) };
      delete snapshotValues[date];
      delete snapshotMatchStatus[date];
      delete snapshotMissingCrns[date];
      const missingSnapshots = (row.missingSnapshots || []).filter(item => item !== date);
      return recalculateRowEnrollmentState({
        ...row,
        snapshotValues,
        snapshotMatchStatus,
        snapshotMissingCrns,
        missingSnapshots
      }, next.snapshots);
    });
    next.uploadHistory = [...(next.uploadHistory || []), {
      type: 'snapshot-delete',
      sourceFilename: removed.sourceFilename || '',
      uploadedAt: new Date().toISOString(),
      snapshotDate: date,
      rowsAffected: next.rows.length
    }];
    next.updatedAt = new Date().toISOString();
    return { workspace: next, removedSnapshot: removed };
  }

  function applyEnrollmentSnapshot(workspace, rawRowsOrMap, options = {}) {
    const next = cloneWorkspace(workspace);
    const enrollmentMap = rawRowsOrMap instanceof Map ? rawRowsOrMap : parseEnrollmentCsvRows(rawRowsOrMap);
    const snapshotDate = normalizeDate(options.snapshotDate || localDateInputValue());
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
        presumedCancelled: value === null ? true : false,
        presumedCancelledSnapshotDate: value === null ? snapshotDate : '',
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

  function crnSetKey(crns = []) {
    return Array.from(new Set((crns || []).map(String).filter(Boolean))).sort().join('|');
  }

  function courseCrossListKey(row) {
    const course = cleanString(row?.course).toUpperCase();
    const crossList = cleanString(row?.crossListId).toUpperCase();
    return course && crossList ? `${course}|${crossList}` : '';
  }

  function baselineFieldsFromRow(row, options = {}) {
    const fields = {
      course: row.course,
      crnDisplay: row.crnDisplay,
      crns: row.crns || [],
      title: row.title,
      crossListId: row.crossListId,
      crnCount: row.crnCount,
      maxEnrollment: row.maxEnrollment,
      waitCount: row.waitCount,
      instructionalMethod: row.instructionalMethod,
      scheduleType: row.scheduleType,
      appliedRule: row.appliedRule,
      threshold: row.threshold,
      startDateOriginal: row.startDateOriginal,
      startDates: row.startDates || parseStartDateList(row.startDateOriginal || row.startDate),
      startDate: (row.startDates || parseStartDateList(row.startDateOriginal || row.startDate)).join(', '),
      division: row.division,
      campus: row.campus,
      faculty: row.faculty,
      missingFromLatestWorkbook: false
    };
    if (options.includeInitialEnrollment) {
      fields.initialEnrollment = row.initialEnrollment;
      fields.currentEnrollment = row.initialEnrollment;
    }
    return fields;
  }

  function findRefreshMatch(row, indexes) {
    const exact = indexes.byExactCrns.get(crnSetKey(row.crns));
    if (exact) return { row: exact, strategy: 'exact-crn-set' };
    if ((row.crns || []).length === 1) {
      const single = indexes.bySingleCrn.get(String(row.crns[0]));
      if (single) return { row: single, strategy: 'single-crn' };
    }
    const fallbackKey = courseCrossListKey(row);
    if (fallbackKey) {
      const fallback = indexes.byCourseCrossList.get(fallbackKey);
      if (fallback) return { row: fallback, strategy: 'course-cross-list' };
    }
    return null;
  }

  function buildRefreshIndexes(rows = []) {
    const indexes = { byExactCrns: new Map(), bySingleCrn: new Map(), byCourseCrossList: new Map() };
    rows.forEach(row => {
      const exactKey = crnSetKey(row.crns);
      if (exactKey && !indexes.byExactCrns.has(exactKey)) indexes.byExactCrns.set(exactKey, row);
      (row.crns || []).forEach(crn => {
        if (!indexes.bySingleCrn.has(String(crn))) indexes.bySingleCrn.set(String(crn), row);
      });
      const fallbackKey = courseCrossListKey(row);
      if (fallbackKey && !indexes.byCourseCrossList.has(fallbackKey)) indexes.byCourseCrossList.set(fallbackKey, row);
    });
    return indexes;
  }

  function refreshBaselineWorkspace(existingWorkspace, incomingWorkspace, options = {}) {
    const existing = cloneWorkspace(existingWorkspace);
    const incoming = cloneWorkspace(incomingWorkspace);
    const indexes = buildRefreshIndexes(incoming.rows || []);
    const matchedIncomingIds = new Set();
    const summary = {
      matchedRows: 0,
      exactCrnSetMatches: 0,
      singleCrnMatches: 0,
      courseCrossListMatches: 0,
      newRows: 0,
      missingRows: 0,
      preservedSnapshots: (existing.snapshots || []).filter(snapshot => snapshot.type !== 'initial').length,
      preservedManualFields: 0,
      initialEnrollmentUpdated: Boolean(options.includeInitialEnrollment)
    };
    const rows = (existing.rows || []).map(row => {
      const match = findRefreshMatch(row, indexes);
      if (!match) {
        summary.missingRows += 1;
        return { ...row, missingFromLatestWorkbook: true };
      }
      matchedIncomingIds.add(match.row.id);
      summary.matchedRows += 1;
      if (match.strategy === 'exact-crn-set') summary.exactCrnSetMatches += 1;
      if (match.strategy === 'single-crn') summary.singleCrnMatches += 1;
      if (match.strategy === 'course-cross-list') summary.courseCrossListMatches += 1;
      if (cleanString(row.justification) || cleanString(row.vpComments)) summary.preservedManualFields += 1;
      const refreshed = {
        ...row,
        ...baselineFieldsFromRow(match.row, options),
        justification: row.justification,
        vpComments: row.vpComments,
        exclusion: row.exclusion || null,
        latestEnrollment: row.latestEnrollment,
        highestEnrollment: row.highestEnrollment,
        snapshotValues: row.snapshotValues || {},
        snapshotMatchStatus: row.snapshotMatchStatus || {},
        snapshotMissingCrns: row.snapshotMissingCrns || {},
        missingSnapshots: row.missingSnapshots || []
      };
      refreshed.status = statusForRow(refreshed);
      return refreshed;
    });
    (incoming.rows || []).forEach(row => {
      if (matchedIncomingIds.has(row.id)) return;
      summary.newRows += 1;
      rows.push({
        ...row,
        id: `ler-${cleanString(existing.termCode || incoming.termCode || 'term')}-${rows.length + 1}`,
        displayOrder: rows.length + 1,
        snapshotValues: {},
        missingSnapshots: (existing.snapshots || []).filter(snapshot => snapshot.type !== 'initial').map(snapshot => snapshot.snapshotDate),
        missingFromLatestWorkbook: false
      });
    });
    const refreshedWorkspace = {
      ...existing,
      sourceFilename: incoming.sourceFilename || existing.sourceFilename,
      reasons: incoming.reasons?.length ? incoming.reasons : existing.reasons,
      importSummary: incoming.importSummary,
      importErrors: incoming.importErrors,
      rows,
      uploadHistory: [...(existing.uploadHistory || []), {
        type: 'baseline-refresh',
        sourceFilename: incoming.sourceFilename,
        uploadedAt: new Date().toISOString(),
        snapshotDate: incoming.initialSnapshotDate,
        ...summary
      }],
      updatedAt: new Date().toISOString()
    };
    refreshedWorkspace.importSummary = { ...(buildImportSummary(refreshedWorkspace) || {}), ...summary };
    return { workspace: refreshedWorkspace, summary };
  }

  function workspaceImportPreview(existingWorkspace, incomingWorkspace) {
    const indexes = buildRefreshIndexes(incomingWorkspace?.rows || []);
    const matchedIncomingIds = new Set();
    let matchedRows = 0;
    let missingRows = 0;
    (existingWorkspace?.rows || []).forEach(row => {
      const match = findRefreshMatch(row, indexes);
      if (match) {
        matchedRows += 1;
        matchedIncomingIds.add(match.row.id);
      } else {
        missingRows += 1;
      }
    });
    return {
      existingRows: (existingWorkspace?.rows || []).length,
      incomingRows: (incomingWorkspace?.rows || []).length,
      matchedRows,
      newRows: (incomingWorkspace?.rows || []).filter(row => !matchedIncomingIds.has(row.id)).length,
      missingRows,
      preservedSnapshots: (existingWorkspace?.snapshots || []).filter(snapshot => snapshot.type !== 'initial').length
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
    const counts = { all: 0, active: 0, removed: 0, below: 0, met: 0, missing: 0, manual: 0, excluded: 0 };
    (workspace?.rows || []).forEach(row => {
      if (row.exclusion?.excluded) {
        counts.excluded += 1;
        return;
      }
      counts.all += 1;
      const status = statusForRow(row);
      if (removedFromActiveWatchlist(row)) counts.removed += 1;
      else counts.active += 1;
      if (status === 'Threshold Met') counts.met += 1;
      else if (status === 'Presumed Cancelled') counts.missing += 1;
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
        <button type="button" data-section-view-card="active"><strong>${counts.active}</strong><span>Active Watchlist</span></button>
        <button type="button" data-section-view-card="removed"><strong>${counts.removed}</strong><span>Removed / Met Minimum</span></button>
        <button type="button" data-status-card="below"><strong>${counts.below}</strong><span>Below Threshold</span></button>
        <button type="button" data-status-card="met"><strong>${counts.met}</strong><span>Threshold Met</span></button>
        <button type="button" data-status-card="missing"><strong>${counts.missing}</strong><span>Missing Update</span></button>
        <button type="button" data-status-card="manual"><strong>${counts.manual}</strong><span>Manual Review</span></button>
        <button type="button" data-excluded-view="true"><strong>${counts.excluded}</strong><span>Excluded Rows</span></button>
        <div><strong>${(workspace?.snapshots || []).length}</strong><span>Dated Snapshots</span></div>
      </div>
    `;
  }

  function reasonOptions(workspace, selected) {
    const reasons = allowedReasons(workspace);
    return `<option value=""></option>${reasons.map(reason => `<option value="${escapeHtml(reason)}"${reason === selected ? ' selected' : ''}>${escapeHtml(reason)}</option>`).join('')}`;
  }

  function filterValues(key) {
    const values = mounted?.filters?.[key];
    if (Array.isArray(values)) return values;
    if (!values || values === 'all') return [];
    return [values];
  }

  function filterLabel(value) {
    return cleanString(value) || '(Blank)';
  }

  function filterValue(row, field) {
    return cleanString(row?.[field]) || '(Blank)';
  }

  function rowMatchesMultiFilter(row, key, field) {
    const selected = filterValues(key);
    if (!selected.length) return true;
    return selected.includes(filterValue(row, field));
  }

  function statusFilterValue(row) {
    return statusForRow(row);
  }

  function filteredRows(workspace) {
    const filters = mounted?.filters || {};
    const search = cleanString(filters.search).toLowerCase();
    const sectionView = filters.sectionView || 'active';
    const filtered = (workspace?.rows || []).filter(row => {
      if (row.exclusion?.excluded && mounted?.showExcluded !== true) return false;
      if (!row.exclusion?.excluded && mounted?.showExcluded === true) return false;
      const rowStatus = statusForRow(row);
      const removed = removedFromActiveWatchlist(row);
      if (sectionView === 'active' && removed) return false;
      if (sectionView === 'removed' && !removed) return false;
      const selectedStatuses = filterValues('status');
      if (selectedStatuses.length && !selectedStatuses.includes(rowStatus)) return false;
      if (!rowMatchesMultiFilter(row, 'division', 'division')) return false;
      if (!rowMatchesMultiFilter(row, 'campus', 'campus')) return false;
      if (!rowMatchesMultiFilter(row, 'instructionalMethod', 'instructionalMethod')) return false;
      if (!rowMatchesMultiFilter(row, 'scheduleType', 'scheduleType')) return false;
      if (!search) return true;
      return [row.course, row.crnDisplay, row.title, row.division, row.campus, row.faculty, row.justification, row.vpComments]
        .some(value => cleanString(value).toLowerCase().includes(search));
    });
    return sortRows(filtered);
  }

  function buildExcelExportModel(workspace, rows = workspace?.rows || []) {
    const snapshots = (workspace?.snapshots || []).filter(snapshot => snapshot.type !== 'initial');
    const columns = [
      { key: 'course', header: 'Course', width: 14, value: row => row.course },
      { key: 'crnDisplay', header: 'CRN', width: 14, value: row => row.crnDisplay },
      { key: 'title', header: 'Title', width: 30, value: row => row.title },
      { key: 'initialEnrollment', header: '1st Day Enrollment', width: 14, value: row => row.initialEnrollment },
      ...snapshots.map(snapshot => ({
        key: `snapshot:${snapshot.snapshotDate}`,
        header: formatSnapshotColumnLabel(snapshot.snapshotDate || snapshot.label),
        width: 13,
        value: row => row.snapshotValues?.[snapshot.snapshotDate] ?? ''
      })),
      { key: 'maxEnrollment', header: 'Max Enrollment', width: 14, value: row => row.maxEnrollment },
      { key: 'instructionalMethod', header: 'Instructional Method', width: 20, value: row => row.instructionalMethod },
      { key: 'appliedRule', header: 'Applied Rule', width: 20, value: row => row.appliedRule },
      { key: 'scheduleType', header: 'Schedule Type', width: 16, value: row => row.scheduleType },
      { key: 'startDate', header: 'Start Date', width: 16, value: row => formatStartDateDisplay(row.startDates?.length ? row.startDates : row.startDateOriginal || row.startDate) },
      { key: 'division', header: 'Division', width: 20, value: row => row.division },
      { key: 'campus', header: 'Campus', width: 14, value: row => row.campus },
      { key: 'faculty', header: 'Faculty', width: 24, value: row => row.faculty },
      { key: 'latestEnrollment', header: 'Latest', width: 11, value: row => row.latestEnrollment ?? '' },
      { key: 'highestEnrollment', header: 'Highest', width: 11, value: row => row.highestEnrollment ?? '' },
      { key: 'threshold', header: 'Threshold', width: 11, value: row => row.threshold },
      { key: 'status', header: 'Status', width: 18, value: row => statusForRow(row) },
      { key: 'removedReason', header: 'Removed / Met Minimum Reason', width: 24, value: row => removedReason(row) },
      { key: 'justification', header: 'Justification', width: 48, value: row => row.justification },
      { key: 'vpComments', header: 'Comments to VPs Office', width: 48, value: row => row.vpComments },
      { key: '_timberRowId', header: 'Timber Row ID', width: 1, hidden: true, value: row => row.id },
      { key: '_timberTermCode', header: 'Timber Term Code', width: 1, hidden: true, value: () => workspace?.termCode || '' },
      { key: '_timberSchema', header: 'Timber Import Schema', width: 1, hidden: true, value: () => MANUAL_IMPORT_SCHEMA },
      { key: '_timberOriginalJustification', header: 'Timber Original Justification', width: 1, hidden: true, value: row => row.justification || '' },
      { key: '_timberOriginalVpComments', header: 'Timber Original VP Comments', width: 1, hidden: true, value: row => row.vpComments || '' }
    ];
    return {
      columns,
      rows: (rows || []).map(row => columns.map(column => column.value(row) ?? '')),
      reasons: allowedReasons(workspace),
      justificationColumnIndex: columns.findIndex(column => column.key === 'justification') + 1
    };
  }

  function removedOrExcludedExportRows(workspace) {
    return (workspace?.rows || []).filter(row => row?.exclusion?.excluded || removedFromActiveWatchlist(row));
  }

  function worksheetDataRowHeight(values = []) {
    const maxLines = values.reduce((max, value) => {
      const lines = String(value ?? '').split(/\r?\n/).length;
      return Math.max(max, lines);
    }, 1);
    return Math.min(96, Math.max(22, (maxLines * 15) + 6));
  }

  function applyExcelWorksheetLayout(worksheet, model) {
    model.columns.forEach((column, index) => {
      const excelColumn = worksheet.getColumn(index + 1);
      excelColumn.width = column.width;
      excelColumn.hidden = Boolean(column.hidden);
    });
    worksheet.views = [{
      state: 'frozen',
      xSplit: 3,
      ySplit: 1,
      topLeftCell: 'D2',
      activeCell: 'D2'
    }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, model.rows.length + 1), column: model.columns.length }
    };
    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245685' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 28;
    worksheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'top', wrapText: true };
      if (rowNumber > 1) row.height = worksheetDataRowHeight(row.values.slice(1));
    });
  }

  function createExcelWorkbook(workspace, rows = workspace?.rows || [], ExcelJS = root.ExcelJS) {
    if (!ExcelJS?.Workbook) throw new Error('Excel export library is not available. Refresh the page and try again.');
    const model = buildExcelExportModel(workspace, rows);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TIMBER';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Low Enrollment');
    worksheet.addRow(model.columns.map(column => column.header));
    model.rows.forEach(values => worksheet.addRow(values));
    applyExcelWorksheetLayout(worksheet, model);

    const removedRows = removedOrExcludedExportRows(workspace);
    const removedModel = buildExcelExportModel(workspace, removedRows);
    const removedWorksheet = workbook.addWorksheet('Removed Sections');
    removedWorksheet.addRow(removedModel.columns.map(column => column.header));
    removedModel.rows.forEach(values => removedWorksheet.addRow(values));
    applyExcelWorksheetLayout(removedWorksheet, removedModel);

    const reasonsSheet = workbook.addWorksheet('Justifications');
    model.reasons.forEach(reason => reasonsSheet.addRow([reason]));
    reasonsSheet.getColumn(1).width = 90;
    reasonsSheet.state = 'veryHidden';
    if (model.reasons.length) {
      workbook.definedNames.add(`'Justifications'!$A$1:$A$${model.reasons.length}`, 'JustificationOptions');
      for (let rowNumber = 2; rowNumber <= model.rows.length + 1; rowNumber += 1) {
        worksheet.getCell(rowNumber, model.justificationColumnIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['JustificationOptions'],
          showErrorMessage: true,
          errorTitle: 'Invalid justification',
          error: 'Choose a justification from the dropdown list.'
        };
      }
    }
    return workbook;
  }

  function parseManualUpdateWorkbook(workbook, workspace) {
    const xlsx = root.XLSX;
    if (!xlsx?.utils?.sheet_to_json) throw new Error('XLSX parser is not available.');
    const sheetNames = workbook?.SheetNames || Object.keys(workbook?.Sheets || {});
    const reportName = sheetNames.find(name => /^low enrollment$/i.test(name));
    if (!reportName) throw new Error('This is not a Timber Low Enrollment export: the Low Enrollment worksheet is missing.');
    const table = xlsx.utils.sheet_to_json(workbook.Sheets[reportName], { header: 1, defval: '' });
    const headerIndex = table.findIndex(row => Array.isArray(row) && row.some(value => normalizeHeader(value) === normalizeHeader('Timber Row ID')));
    if (headerIndex < 0) throw new Error('This workbook does not contain Timber import metadata. Export a fresh tracker workbook and edit that file.');
    const headers = table[headerIndex].map(normalizeHeader);
    const column = label => headers.indexOf(normalizeHeader(label));
    const indexes = {
      rowId: column('Timber Row ID'),
      termCode: column('Timber Term Code'),
      schema: column('Timber Import Schema'),
      justification: column('Justification'),
      vpComments: column('Comments to VPs Office'),
      originalJustification: column('Timber Original Justification'),
      originalVpComments: column('Timber Original VP Comments')
    };
    if (Object.values(indexes).some(index => index < 0)) throw new Error('The workbook is missing required Timber manual-update columns.');
    const savedRows = new Map((workspace?.rows || []).map(row => [String(row.id), row]));
    const allowed = allowedReasons(workspace);
    const seen = new Set();
    const errors = [];
    const updates = [];
    let unchangedRows = 0;
    table.slice(headerIndex + 1).forEach((values, offset) => {
      const rowNumber = headerIndex + offset + 2;
      const rowId = cleanString(values[indexes.rowId]);
      if (!rowId) return;
      const termCode = cleanString(values[indexes.termCode]);
      const schema = cleanString(values[indexes.schema]);
      const justification = cleanString(values[indexes.justification]);
      const vpComments = values[indexes.vpComments] === null || values[indexes.vpComments] === undefined ? '' : String(values[indexes.vpComments]);
      const expectedJustification = cleanString(values[indexes.originalJustification]);
      const expectedVpComments = values[indexes.originalVpComments] === null || values[indexes.originalVpComments] === undefined ? '' : String(values[indexes.originalVpComments]);
      if (seen.has(rowId)) errors.push(`Row ${rowNumber}: duplicate Timber row ID.`);
      seen.add(rowId);
      if (termCode !== cleanString(workspace?.termCode)) errors.push(`Row ${rowNumber}: term ${termCode || '(blank)'} does not match ${workspace?.termCode}.`);
      if (schema !== MANUAL_IMPORT_SCHEMA) errors.push(`Row ${rowNumber}: unsupported or missing Timber import schema.`);
      const saved = savedRows.get(rowId);
      if (!saved) errors.push(`Row ${rowNumber}: tracker row ${rowId} was not found in the selected term.`);
      if (justification && !allowed.includes(justification)) errors.push(`Row ${rowNumber}: Justification must be selected from the saved dropdown list.`);
      if (!saved) return;
      if (expectedJustification !== cleanString(saved.justification) || expectedVpComments !== String(saved.vpComments || '')) {
        errors.push(`Row ${rowNumber}: dashboard manual fields changed after this workbook was exported. Export a fresh workbook before importing.`);
      }
      if (justification === cleanString(saved.justification) && vpComments === String(saved.vpComments || '')) unchangedRows += 1;
      else updates.push({ rowId, justification, vpComments, expectedJustification, expectedVpComments });
    });
    if (!seen.size) errors.push('The workbook does not contain any exported tracker rows.');
    return {
      valid: errors.length === 0,
      errors,
      updates,
      summary: {
        workbookRows: seen.size,
        changedRows: updates.length,
        unchangedRows,
        clearedJustifications: updates.filter(update => !update.justification && cleanString(savedRows.get(update.rowId)?.justification)).length,
        clearedVpComments: updates.filter(update => !update.vpComments && String(savedRows.get(update.rowId)?.vpComments || '')).length
      }
    };
  }

  async function exportLowEnrollmentExcel(workspace, rows = workspace?.rows || []) {
    const workbook = createExcelWorkbook(workspace, rows);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = root.document.createElement('a');
    const term = cleanString(workspace?.displayTerm || workspace?.termCode || 'Low Enrollment').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    link.href = URL.createObjectURL(blob);
    link.download = `${term || 'Low-Enrollment'}-Tracking.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function distinctOptions(rows, field) {
    return Array.from(new Set((rows || []).map(row => filterValue(row, field)))).sort((a, b) => a.localeCompare(b));
  }

  function sortValue(row, key, snapshots = []) {
    if (key?.startsWith('snapshot:')) return toNumber(row.snapshotValues?.[key.slice(9)]);
    if (key === 'status') return statusForRow(row);
    if (key === 'startDate') return startDateSortValue(row);
    if (['initialEnrollment', 'latestEnrollment', 'highestEnrollment', 'threshold', 'waitCount'].includes(key)) return toNumber(row[key]);
    return cleanString(row[key]);
  }

  function compareSortValues(a, b, direction) {
    const blankA = a === null || a === undefined || a === '';
    const blankB = b === null || b === undefined || b === '';
    if (blankA && blankB) return 0;
    if (blankA) return 1;
    if (blankB) return -1;
    const numberA = typeof a === 'number' && Number.isFinite(a);
    const numberB = typeof b === 'number' && Number.isFinite(b);
    const result = numberA && numberB
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    return direction === 'desc' ? -result : result;
  }

  function sortRows(rows = []) {
    const state = mounted?.sort || {};
    if (!state.key || !state.direction) return rows.slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return rows.slice().sort((a, b) => {
      const compared = compareSortValues(sortValue(a, state.key), sortValue(b, state.key), state.direction);
      return compared || ((a.displayOrder || 0) - (b.displayOrder || 0));
    });
  }

  function sortButton(key, label) {
    const active = mounted?.sort?.key === key ? mounted.sort.direction : '';
    const marker = active === 'asc' ? ' ▲' : active === 'desc' ? ' ▼' : '';
    return `<button type="button" class="low-enrollment-sort" data-sort-key="${escapeHtml(key)}">${escapeHtml(label)}${marker}</button>`;
  }

  function renderMultiSelectFilter(key, label, options = []) {
    const selected = filterValues(key);
    const selectedText = selected.length ? `${selected.length} selected` : 'All';
    return `
      <details class="low-enrollment-filter-menu" data-filter-menu="${escapeHtml(key)}">
        <summary>${escapeHtml(label)} <span>${escapeHtml(selectedText)}</span></summary>
        <div class="low-enrollment-filter-panel">
          <input type="search" data-filter-search="${escapeHtml(key)}" placeholder="Search ${escapeHtml(label.toLowerCase())}">
          <div class="low-enrollment-filter-actions">
            <button type="button" data-filter-select-all="${escapeHtml(key)}">Select All</button>
            <button type="button" data-filter-clear="${escapeHtml(key)}">Clear All</button>
          </div>
          <div class="low-enrollment-filter-options">
            ${options.map(value => `
              <label data-filter-option="${escapeHtml(key)}">
                <input type="checkbox" value="${escapeHtml(value)}"${selected.includes(value) ? ' checked' : ''}>
                <span>${escapeHtml(filterLabel(value))}</span>
              </label>
            `).join('')}
          </div>
          <div class="low-enrollment-filter-actions">
            <button type="button" data-filter-apply="${escapeHtml(key)}">Apply</button>
            <button type="button" data-filter-cancel="${escapeHtml(key)}">Cancel</button>
          </div>
        </div>
      </details>
    `;
  }

  function activeFilterSummary() {
    const parts = ['status', 'division', 'campus', 'instructionalMethod', 'scheduleType']
      .map(key => [key, filterValues(key)])
      .filter(([, values]) => values.length)
      .map(([key, values]) => `${key}: ${values.join(', ')}`);
    const sectionView = mounted?.filters?.sectionView || 'active';
    const sectionNote = sectionView === 'active'
      ? 'section view: Active Watchlist'
      : sectionView === 'removed' ? 'section view: Removed / Met Minimum' : 'section view: All Sections';
    return [sectionNote, ...parts].filter(Boolean).join(' | ') || 'No active filters';
  }

  function rowsForSectionView(workspace, sectionView) {
    const previous = mounted?.filters?.sectionView;
    if (mounted?.filters) mounted.filters.sectionView = sectionView;
    const rows = filteredRows(workspace);
    if (mounted?.filters) mounted.filters.sectionView = previous;
    return rows;
  }

  function renderTable(workspace) {
    const snapshots = (workspace?.snapshots || []).filter(snapshot => snapshot.type !== 'initial');
    const rows = filteredRows(workspace);
    const updatedSnapshotDate = mounted?.updatedSnapshotDate || '';
    const timelineColumns = [
      { key: 'initialEnrollment', label: '1st Day Enrollment', sortKey: 'initialEnrollment', type: 'initial' },
      ...snapshots.map(snapshot => ({
        key: snapshot.snapshotDate,
        label: formatSnapshotColumnLabel(snapshot.snapshotDate || snapshot.label),
        sortKey: `snapshot:${snapshot.snapshotDate}`,
        type: 'snapshot',
        snapshot
      }))
    ];
    const timelineHeaders = timelineColumns.map(column => {
      const isUpdated = column.type === 'snapshot' && column.key === updatedSnapshotDate;
      return `<th class="timeline-col ${isUpdated ? 'updated-column' : ''}" data-timeline-column="true" data-updated-column="${isUpdated ? 'true' : 'false'}">${sortButton(column.sortKey, column.label)}</th>`;
    }).join('');
    const emptyColspan = 17 + timelineColumns.length;
    const timelineColGroup = timelineColumns.map(() => '<col class="col-timeline">').join('');
    const body = rows.map(row => {
      const timelineCells = timelineColumns.map(column => {
        if (column.type === 'initial') return `<td class="timeline-col initial-column" data-timeline-column="true">${escapeHtml(row.initialEnrollment)}</td>`;
        const snapshot = column.snapshot;
        const value = row.snapshotValues?.[snapshot.snapshotDate];
        const matchStatus = row.snapshotMatchStatus?.[snapshot.snapshotDate] || (value === null || value === undefined ? 'missing' : 'matched');
        const missing = row.snapshotMissingCrns?.[snapshot.snapshotDate] || [];
        const marker = matchStatus === 'partial'
          ? ` <span class="snapshot-warning" title="Missing CRNs: ${escapeHtml(missing.join(', '))}">Partial</span>`
          : '';
        const content = value === null || value === undefined ? '<span class="muted">Missing</span>' : escapeHtml(value);
        const isUpdated = snapshot.snapshotDate === updatedSnapshotDate;
        return `<td class="timeline-col snapshot-${escapeHtml(matchStatus)} ${isUpdated ? 'updated-column' : ''}" data-timeline-column="true" data-updated-column="${isUpdated ? 'true' : 'false'}">${content}${marker}</td>`;
      }).join('');
      const status = statusForRow(row);
      const exclusion = row.exclusion || {};
      return `
        <tr data-row-id="${escapeHtml(row.id)}">
          <td class="sticky-left sticky-course">${escapeHtml(row.course)}</td>
          <td class="sticky-left sticky-crn">${escapeHtml(row.crnDisplay)}</td>
          <td class="sticky-left sticky-title">
            ${escapeHtml(row.title)}
            ${exclusion.excluded ? `<small class="low-enrollment-exclusion-note"><strong>Excluded:</strong> ${escapeHtml(exclusion.reason)}${exclusion.note ? ` — ${escapeHtml(exclusion.note)}` : ''}</small>` : ''}
            <button type="button" class="low-enrollment-row-action" data-exclusion-action="${exclusion.excluded ? 'restore' : 'exclude'}">${exclusion.excluded ? 'Restore to tracking' : 'Exclude from tracking'}</button>
          </td>
          ${timelineCells}
          <td>${escapeHtml(row.maxEnrollment)}</td>
          <td>${escapeHtml(row.instructionalMethod)}</td>
          <td>${escapeHtml(row.appliedRule)}</td>
          <td>${escapeHtml(row.scheduleType)}</td>
          <td class="low-enrollment-date-cell">${escapeHtml(formatStartDateDisplay(row.startDates?.length ? row.startDates : row.startDateOriginal || row.startDate))}</td>
          <td>${escapeHtml(row.division)}</td>
          <td>${escapeHtml(row.campus)}</td>
          <td>${escapeHtml(row.faculty)}</td>
          <td class="right-adjacent">${row.latestEnrollment === null || row.latestEnrollment === undefined ? '' : escapeHtml(row.latestEnrollment)}</td>
          <td class="right-adjacent">${row.highestEnrollment === null || row.highestEnrollment === undefined ? '' : escapeHtml(row.highestEnrollment)}</td>
          <td class="right-adjacent">${escapeHtml(row.threshold)}</td>
          <td class="sticky-right sticky-status"><span class="status-pill ${status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(status)}</span></td>
          <td class="sticky-right sticky-justification"><select data-low-enrollment-field="justification">${reasonOptions(workspace, row.justification)}</select></td>
          <td class="sticky-right sticky-comments"><textarea data-low-enrollment-field="vpComments" rows="3">${escapeHtml(row.vpComments)}</textarea></td>
        </tr>
      `;
    }).join('');
    return `
      <div class="low-enrollment-worksheet-shell">
        <div class="low-enrollment-timeline-nav">
          <span>Enrollment timeline</span>
          <button type="button" data-timeline-nav="earlier">Earlier</button>
          <button type="button" data-timeline-nav="later">Later</button>
          <button type="button" data-timeline-nav="latest">Latest Snapshot</button>
          <button type="button" data-timeline-nav="updated">View Updated Column</button>
        </div>
        <div class="analytics-table low-enrollment-table-wrap" id="lowEnrollmentTimelineScroller">
          <table class="low-enrollment-table low-enrollment-worksheet">
            <colgroup>
              <col class="col-course">
              <col class="col-crn">
              <col class="col-title">
              ${timelineColGroup}
              <col class="col-narrow">
              <col class="col-medium">
              <col class="col-medium">
              <col class="col-medium">
              <col class="col-medium">
              <col class="col-medium">
              <col class="col-narrow">
              <col class="col-medium">
              <col class="col-narrow">
              <col class="col-narrow">
              <col class="col-narrow">
              <col class="col-status">
              <col class="col-justification">
              <col class="col-comments">
            </colgroup>
            <thead>
              <tr>
                <th class="sticky-left sticky-course">${sortButton('course', 'Course')}</th>
                <th class="sticky-left sticky-crn">${sortButton('crnDisplay', 'CRN')}</th>
                <th class="sticky-left sticky-title">${sortButton('title', 'Title')}</th>
                ${timelineHeaders}
                <th>Max Enrollment</th>
                <th>${sortButton('instructionalMethod', 'Instructional Method')}</th>
                <th>Applied Rule</th>
                <th>${sortButton('scheduleType', 'Schedule Type')}</th>
                <th>${sortButton('startDate', 'Start Date')}</th>
                <th>${sortButton('division', 'Division')}</th>
                <th>${sortButton('campus', 'Campus')}</th>
                <th>${sortButton('faculty', 'Faculty')}</th>
                <th class="right-adjacent">${sortButton('latestEnrollment', 'Latest')}</th>
                <th class="right-adjacent">${sortButton('highestEnrollment', 'Highest')}</th>
                <th class="right-adjacent">${sortButton('threshold', 'Threshold')}</th>
                <th class="sticky-right sticky-status">${sortButton('status', 'Status')}</th>
                <th class="sticky-right sticky-justification">${sortButton('justification', 'Justification')}</th>
                <th class="sticky-right sticky-comments">Comments to VP Office</th>
              </tr>
            </thead>
            <tbody>${body || `<tr><td colspan="${emptyColspan}">No rows match the current filters.</td></tr>`}</tbody>
          </table>
        </div>
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
    const instructionalMethods = distinctOptions(workspace?.rows || [], 'instructionalMethod');
    const scheduleTypes = distinctOptions(workspace?.rows || [], 'scheduleType');
    const statusOptions = ['Below Threshold', 'Threshold Met', 'Missing Update', 'Presumed Cancelled', 'Manual Review'];
    const datedSnapshots = (workspace?.snapshots || []).filter(snapshot => snapshot.type !== 'initial');
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
                <li>Export an editable tracker, make only manual-field changes, then use Import Edited Tracker to preview and apply them.</li>
                <li>Use Exclude from tracking for accepted term-specific exceptions. Excluded rows retain their history and can be restored.</li>
              </ul>
            </div>
            <div>
              <h3>Methodology</h3>
              <ul>
                <li>Status is based on each row's highest observed enrollment compared with the workbook threshold.</li>
                <li>Missing Update means no member CRN from that visible workbook row appeared in the dated CSV update. After an enrollment update upload, those rows are treated as Presumed Cancelled and moved out of the active watchlist while preserving history.</li>
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
          <label>Update date <input id="lowEnrollmentSnapshotDate" type="date" value="${escapeHtml(mounted.snapshotDate || localDateInputValue())}"></label>
          <label>Enrollment update CSV <input id="lowEnrollmentCsvFile" type="file" accept=".csv"></label>
          <button id="uploadLowEnrollmentSnapshot" type="button"${workspace ? '' : ' disabled'}>Upload Enrollment Update</button>
          <label>Delete update column
            <select id="lowEnrollmentDeleteSnapshotDate"${datedSnapshots.length ? '' : ' disabled'}>
              <option value="">${datedSnapshots.length ? 'Select dated upload' : 'No dated uploads'}</option>
              ${datedSnapshots.map(snapshot => `<option value="${escapeHtml(snapshot.snapshotDate)}">${escapeHtml(formatSnapshotColumnLabel(snapshot.snapshotDate || snapshot.label))}</option>`).join('')}
            </select>
          </label>
          <button id="deleteLowEnrollmentSnapshot" type="button"${workspace && datedSnapshots.length ? '' : ' disabled'}>Delete Column</button>
          <button id="refreshLowEnrollmentTerms" type="button">Refresh Terms</button>
          <label>Edited tracker <input id="lowEnrollmentManualWorkbookFile" type="file" accept=".xlsx"></label>
          <button id="importLowEnrollmentManualWorkbook" type="button"${workspace ? '' : ' disabled'}>Import Edited Tracker</button>
        </div>
        <div class="analytics-toolbar low-enrollment-filterbar">
          <label>Section View
            <select id="lowEnrollmentSectionView">
              <option value="active"${(mounted?.filters?.sectionView || 'active') === 'active' ? ' selected' : ''}>Active Watchlist</option>
              <option value="removed"${mounted?.filters?.sectionView === 'removed' ? ' selected' : ''}>Removed / Met Minimum</option>
              <option value="all"${mounted?.filters?.sectionView === 'all' ? ' selected' : ''}>All Sections</option>
            </select>
          </label>
          ${renderMultiSelectFilter('status', 'Status', statusOptions)}
          ${renderMultiSelectFilter('division', 'Division', divisions)}
          ${renderMultiSelectFilter('campus', 'Campus', campuses)}
          ${renderMultiSelectFilter('instructionalMethod', 'Instructional Method / Modality', instructionalMethods)}
          ${renderMultiSelectFilter('scheduleType', 'Schedule Type', scheduleTypes)}
          <label>Search <input id="lowEnrollmentSearch" type="search" placeholder="Course, CRN, faculty, comment" value="${escapeHtml(mounted?.filters?.search || '')}"></label>
          <button id="clearLowEnrollmentFilters" type="button">Clear All Filters</button>
          <button id="exportLowEnrollmentExcel" type="button"${workspace && !mounted?.showExcluded ? '' : ' disabled'}>Export Current View to Excel</button>
          <button id="toggleLowEnrollmentExcluded" type="button"${workspace ? '' : ' disabled'}>${mounted?.showExcluded ? 'Show Active Rows' : 'Show Excluded Rows'}</button>
          <span class="analytics-note low-enrollment-active-filters">${escapeHtml(activeFilterSummary())}</span>
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

  function measuredFrozenTimelineWidths(scroller) {
    if (!scroller?.getBoundingClientRect) return { frozenLeftWidth: 0, frozenRightWidth: 0 };
    const scrollerRect = scroller.getBoundingClientRect();
    const leftCells = Array.from(scroller.querySelectorAll('thead .sticky-left'));
    const rightCells = Array.from(scroller.querySelectorAll('thead .sticky-right'));
    const frozenLeftWidth = leftCells.reduce((max, cell) => {
      const rect = cell.getBoundingClientRect();
      return Math.max(max, rect.right - scrollerRect.left);
    }, 0);
    const frozenRightWidth = rightCells.reduce((max, cell) => {
      const rect = cell.getBoundingClientRect();
      return Math.max(max, scrollerRect.right - rect.left);
    }, 0);
    return {
      frozenLeftWidth: Math.max(0, frozenLeftWidth),
      frozenRightWidth: Math.max(0, frozenRightWidth)
    };
  }

  function timelineColumnMetrics(scroller) {
    return Array.from(scroller?.querySelectorAll('thead [data-timeline-column="true"]') || [])
      .map(cell => ({
        cell,
        left: finiteNumber(cell.offsetLeft),
        right: finiteNumber(cell.offsetLeft) + finiteNumber(cell.offsetWidth)
      }));
  }

  function scrollLowEnrollmentTimeline(scroller, action, options = {}) {
    const columns = timelineColumnMetrics(scroller);
    if (!scroller || !columns.length) return;
    const first = columns[0];
    const last = columns[columns.length - 1];
    const frozen = measuredFrozenTimelineWidths(scroller);
    const limits = calculateTimelineScrollLimits({
      firstColumnLeft: first.left,
      lastColumnRight: last.right,
      viewportWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      frozenLeftWidth: frozen.frozenLeftWidth,
      frozenRightWidth: frozen.frozenRightWidth
    });
    const visibleLeft = finiteNumber(scroller.scrollLeft) + frozen.frozenLeftWidth + TIMELINE_EDGE_PADDING_PX;
    const visibleRight = finiteNumber(scroller.scrollLeft) + finiteNumber(scroller.clientWidth) - frozen.frozenRightWidth - TIMELINE_EDGE_PADDING_PX;
    let target = null;
    if (action === 'latest') target = last;
    if (action === 'updated') target = columns.find(column => column.cell.dataset.updatedColumn === 'true') || last;
    if (action === 'later') target = columns.find(column => column.right > visibleRight + 1) || last;
    if (action === 'earlier') target = columns.slice().reverse().find(column => column.left < visibleLeft - 1) || first;
    if (!target) return;
    const nextScrollLeft = calculateTimelineNavigationScroll({
      currentScrollLeft: scroller.scrollLeft,
      viewportWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      frozenLeftWidth: frozen.frozenLeftWidth,
      frozenRightWidth: frozen.frozenRightWidth,
      targetLeft: target.left,
      targetRight: target.right,
      minScrollLeft: limits.minScrollLeft,
      maxScrollLeft: limits.maxScrollLeft
    });
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ left: nextScrollLeft, behavior: options.behavior || 'smooth' });
    } else {
      scroller.scrollLeft = nextScrollLeft;
    }
    scroller.dataset.timelineFocusedAction = action;
  }

  function recalculateLowEnrollmentTimelineNavigation() {
    const scroller = mounted?.container?.querySelector('#lowEnrollmentTimelineScroller');
    const action = scroller?.dataset?.timelineFocusedAction;
    if (!scroller || !['latest', 'updated'].includes(action)) return;
    scrollLowEnrollmentTimeline(scroller, action, { behavior: 'auto' });
  }

  function setStatus(message) {
    const node = mounted?.container?.querySelector('#lowEnrollmentSaveStatus');
    if (node) node.textContent = message;
  }

  function showModal({ title, body, actions = [] }) {
    return new Promise(resolve => {
      const overlay = root.document?.createElement('div');
      if (!overlay) return resolve('');
      overlay.className = 'low-enrollment-modal-backdrop';
      overlay.innerHTML = `
        <div class="low-enrollment-modal" role="dialog" aria-modal="true" aria-labelledby="lowEnrollmentModalTitle">
          <h3 id="lowEnrollmentModalTitle">${escapeHtml(title)}</h3>
          <div class="low-enrollment-modal-body">${body}</div>
          <div class="low-enrollment-modal-actions">
            ${actions.map(action => `<button type="button" data-modal-action="${escapeHtml(action.value)}"${action.primary ? ' class="primary"' : ''}>${escapeHtml(action.label)}</button>`).join('')}
          </div>
        </div>
      `;
      const close = value => {
        overlay.remove();
        resolve(value);
      };
      overlay.addEventListener('click', event => {
        if (event.target === overlay) close('');
        const button = event.target.closest?.('[data-modal-action]');
        if (!button) return;
        const action = actions.find(item => item.value === button.dataset.modalAction);
        if (action?.validate && !action.validate(overlay)) return;
        close(action?.capture ? action.capture(overlay) : (button.dataset.modalAction || ''));
      });
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') close('');
      });
      root.document.body.appendChild(overlay);
      overlay.querySelector('button, input')?.focus();
    });
  }

  async function chooseExistingWorkspaceImport(existingWorkspace, incomingWorkspace) {
    const preview = workspaceImportPreview(existingWorkspace, incomingWorkspace);
    const termLabel = existingWorkspace.displayTerm || existingWorkspace.termCode;
    const body = `
      <p><strong>${escapeHtml(termLabel)}</strong> already has a Low Enrollment workspace.</p>
      <div class="low-enrollment-summary-grid">
        <span><strong>${preview.existingRows}</strong> Existing rows</span>
        <span><strong>${preview.incomingRows}</strong> Incoming rows</span>
        <span><strong>${preview.matchedRows}</strong> Refresh matches</span>
        <span><strong>${preview.newRows}</strong> New rows</span>
        <span><strong>${preview.missingRows}</strong> Existing rows not in workbook</span>
        <span><strong>${preview.preservedSnapshots}</strong> Dated snapshots preserved by refresh</span>
      </div>
      <p><strong>Replace Entire Workspace</strong> removes periodic snapshots, upload history, Timber-entered justifications, VP comments, and Highest/Latest history.</p>
      <p><strong>Refresh Baseline Roster</strong> preserves dated snapshots, upload history, justifications, VP comments, highest history, and threshold-met history.</p>
      <label class="low-enrollment-confirm-line">
        Type ${escapeHtml(existingWorkspace.termCode)} to enable replacement
        <input data-replace-term-confirm type="text" autocomplete="off">
      </label>
      <label><input data-refresh-initial-enrollment type="checkbox"> Also refresh 1st Day Enrollment from the incoming workbook</label>
    `;
    const action = await showModal({
      title: 'Existing Low Enrollment Workspace',
      body,
      actions: [
        {
          value: 'refresh',
          label: 'Refresh Baseline Roster',
          primary: true,
          capture: overlay => ({ mode: 'refresh', includeInitialEnrollment: Boolean(overlay.querySelector('[data-refresh-initial-enrollment]')?.checked) })
        },
        {
          value: 'replace',
          label: 'Replace Entire Workspace',
          validate: overlay => cleanString(overlay.querySelector('[data-replace-term-confirm]')?.value) === cleanString(existingWorkspace.termCode)
        },
        { value: 'cancel', label: 'Cancel' }
      ]
    });
    if (action?.mode === 'refresh') return action;
    if (action === 'replace') return { mode: 'replace' };
    return { mode: 'cancel' };
  }

  function showSnapshotResult(result, error = null) {
    if (error) {
      return showModal({
        title: 'Enrollment Update Failed',
        body: `<p>${escapeHtml(error.message || 'Enrollment update failed.')}</p>`,
        actions: [{ value: 'try', label: 'Try Again', primary: true }, { value: 'close', label: 'Close' }]
      });
    }
    const partial = result.partiallyMatchedRows > 0 || result.completelyMissingRows > 0;
    const title = partial ? 'Enrollment Update Saved with Warnings' : 'Enrollment Update Saved';
    const body = `
      <div class="low-enrollment-summary-grid">
        <span><strong>${result.fullyMatchedRows}</strong> Full matches</span>
        <span><strong>${result.partiallyMatchedRows}</strong> Partial matches</span>
        <span><strong>${result.completelyMissingRows}</strong> Missing rows</span>
        <span><strong>${result.individualCrnsMatched}</strong> CRNs matched</span>
        <span><strong>${result.individualCrnsMissing}</strong> CRNs missing</span>
        <span><strong>${result.newlyMet}</strong> Newly met threshold</span>
      </div>
      <p>${partial ? 'Some rows were partial or missing. The dated column was saved with row-level warnings.' : 'The dated enrollment column was saved and the workspace was reloaded.'}</p>
    `;
    return showModal({
      title,
      body,
      actions: [{ value: 'view', label: 'View Updated Column', primary: true }, { value: 'close', label: 'Close' }]
    }).then(action => {
      if (action === 'view') {
        Array.from(root.document?.querySelectorAll('[data-sort-key]') || [])
          .find(node => node.dataset.sortKey === `snapshot:${result.snapshot.snapshotDate}`)
          ?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    });
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
    mounted.updatedSnapshotDate = '';
  }

  async function saveWorkspace(workspace) {
    await ensureAccess();
    const existing = (mounted.terms || []).find(term => String(term.termCode) === String(workspace.termCode));
    let replaceExisting = false;
    let workspaceToSave = workspace;
    if (existing) {
      const existingWorkspace = String(mounted.workspace?.termCode) === String(workspace.termCode)
        ? mounted.workspace
        : (await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspace.termCode)}`)).data;
      const decision = await chooseExistingWorkspaceImport(existingWorkspace, workspace);
      if (decision.mode === 'cancel') throw new Error('Import canceled. Existing workspace was not changed.');
      if (decision.mode === 'refresh') {
        const refreshed = refreshBaselineWorkspace(existingWorkspace, workspace, { includeInitialEnrollment: decision.includeInitialEnrollment });
        workspaceToSave = refreshed.workspace;
        replaceExisting = true;
      } else {
        replaceExisting = true;
      }
    }
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspaceToSave.termCode)}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ workspace: workspaceToSave, replaceExisting })
    });
    mounted.workspace = payload.data;
    await loadTerms(workspaceToSave.termCode);
  }

  async function replaceSavedWorkspace(workspace) {
    await ensureAccess();
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspace.termCode)}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ workspace, replaceExisting: true })
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
    try {
      const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(result.workspace.termCode)}/snapshots`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ snapshot: result.snapshot, uploadHistory: result.uploadHistory, rows: result.workspace.rows, replaceExisting })
      });
      mounted.workspace = payload.data;
      mounted.updatedSnapshotDate = result.snapshot.snapshotDate;
      await loadTerms(result.workspace.termCode);
      mounted.updatedSnapshotDate = result.snapshot.snapshotDate;
    } catch (err) {
      console.warn('Low Enrollment snapshot upload failed', {
        endpoint: `/api/low-enrollment-tracking/${encodeURIComponent(result.workspace.termCode)}/snapshots`,
        httpStatus: err.status || '',
        backendErrorCode: err.payload?.code || err.payload?.error || '',
        snapshotDate: result.snapshot?.snapshotDate || '',
        termCode: result.workspace?.termCode || '',
        recordsParsed: result.individualCrnsMatched + result.individualCrnsMissing
      });
      throw err;
    }
  }

  async function readWorkbookFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = root.XLSX.read(buffer, { type: 'array', cellDates: true });
    return parseWorkbook(workbook, { filename: file.name });
  }

  async function readManualUpdateFile(file, workspace) {
    const buffer = await file.arrayBuffer();
    const workbook = root.XLSX.read(buffer, { type: 'array', cellDates: true });
    return parseManualUpdateWorkbook(workbook, workspace);
  }

  async function confirmManualImport(preview, filename) {
    const summary = preview.summary;
    const errors = preview.errors.slice(0, 12);
    const body = `
      <p><strong>${escapeHtml(filename)}</strong> will update only Justification and Comments to VPs Office. Enrollment data, thresholds, statuses, and snapshots cannot be changed by this import.</p>
      <div class="low-enrollment-summary-grid">
        <span><strong>${summary.workbookRows}</strong> Workbook rows</span>
        <span><strong>${summary.changedRows}</strong> Rows changed</span>
        <span><strong>${summary.unchangedRows}</strong> Rows unchanged</span>
        <span><strong>${summary.clearedJustifications}</strong> Justifications cleared</span>
        <span><strong>${summary.clearedVpComments}</strong> VP comments cleared</span>
        <span><strong>${preview.errors.length}</strong> Errors</span>
      </div>
      ${errors.length ? `<div class="low-enrollment-import-errors"><strong>Nothing can be saved until these errors are corrected:</strong><ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>${preview.errors.length > errors.length ? `<p>And ${preview.errors.length - errors.length} more error(s).</p>` : ''}</div>` : ''}
    `;
    return showModal({
      title: preview.valid ? 'Confirm Edited Tracker Import' : 'Edited Tracker Import Blocked',
      body,
      actions: preview.valid && summary.changedRows
        ? [{ value: 'import', label: 'Apply Manual Updates', primary: true }, { value: 'cancel', label: 'Cancel' }]
        : [{ value: 'close', label: 'Close', primary: true }]
    });
  }

  async function saveManualImport(workspace, preview, sourceFilename) {
    await ensureAccess();
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspace.termCode)}/manual-import`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ updates: preview.updates, sourceFilename })
    });
    mounted.workspace = payload.data;
    await loadTerms(workspace.termCode);
  }

  async function confirmDeleteSnapshot(workspace, snapshot) {
    const body = `
      <p>This will remove the <strong>${escapeHtml(formatSnapshotColumnLabel(snapshot.snapshotDate))}</strong> column from <strong>${escapeHtml(workspace.displayTerm || workspace.termCode)}</strong>.</p>
      <p>Enrollment values from that upload will be removed from every row, and Latest, Highest, Status, and presumed-cancelled flags will be recalculated from the remaining snapshots. Justifications and VP comments will remain unchanged.</p>
      <p>This is the right tool when a dated enrollment upload was saved with the wrong date.</p>
    `;
    const decision = await showModal({
      title: 'Delete Enrollment Update Column?',
      body,
      actions: [
        { value: 'delete', label: 'Delete Snapshot Column', primary: true },
        { value: 'cancel', label: 'Cancel' }
      ]
    });
    return decision === 'delete';
  }

  async function chooseExclusionChange(workspace, row, action) {
    if (action === 'restore') {
      const decision = await showModal({
        title: 'Restore Row to Low Enrollment Tracking',
        body: `<p>Restore <strong>${escapeHtml(row.course)}</strong> (${escapeHtml(row.crnDisplay)}) to dashboard counts, alerts, and exports?</p>`,
        actions: [{ value: 'restore', label: 'Restore Row', primary: true }, { value: 'cancel', label: 'Cancel' }]
      });
      return decision === 'restore' ? { excluded: false, reason: '', note: '' } : null;
    }
    const body = `
      <p>Exclude <strong>${escapeHtml(row.course)}</strong> (${escapeHtml(row.crnDisplay)}) for ${escapeHtml(workspace.displayTerm || workspace.termCode)}. Its enrollment history will be preserved and it can be restored later.</p>
      <label class="low-enrollment-confirm-line">Exclusion reason
        <select data-exclusion-reason><option value=""></option>${EXCLUSION_REASONS.map(reason => `<option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>`).join('')}</select>
      </label>
      <label class="low-enrollment-confirm-line">Optional note
        <textarea data-exclusion-note rows="4" placeholder="For example: open lab or athletics team"></textarea>
      </label>
    `;
    const decision = await showModal({
      title: 'Exclude Row from Low Enrollment Tracking',
      body,
      actions: [{
        value: 'exclude',
        label: 'Exclude Row',
        primary: true,
        validate: overlay => Boolean(cleanString(overlay.querySelector('[data-exclusion-reason]')?.value)),
        capture: overlay => ({
          excluded: true,
          reason: cleanString(overlay.querySelector('[data-exclusion-reason]')?.value),
          note: String(overlay.querySelector('[data-exclusion-note]')?.value || '')
        })
      }, { value: 'cancel', label: 'Cancel' }]
    });
    return typeof decision === 'object' ? decision : null;
  }

  async function saveExclusion(workspace, row, change) {
    await ensureAccess();
    const payload = await fetchJson(`/api/low-enrollment-tracking/${encodeURIComponent(workspace.termCode)}/rows/${encodeURIComponent(row.id)}/exclusion`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(change)
    });
    const index = (workspace.rows || []).findIndex(item => item.id === row.id);
    if (index >= 0) workspace.rows[index] = payload.data.row;
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
    container.querySelector('#lowEnrollmentSearch')?.addEventListener('input', event => {
      mounted.filters.search = event.target.value || '';
      render();
    });
    container.querySelector('#lowEnrollmentSectionView')?.addEventListener('change', event => {
      mounted.filters.sectionView = event.target.value || 'active';
      render();
    });
    container.querySelector('#lowEnrollmentSnapshotDate')?.addEventListener('change', event => {
      mounted.snapshotDate = event.target.value || localDateInputValue();
    });
    container.querySelector('#clearLowEnrollmentFilters')?.addEventListener('click', () => {
      mounted.filters = { status: [], search: '', division: [], campus: [], instructionalMethod: [], scheduleType: [], sectionView: 'active' };
      render();
    });
    container.querySelector('#toggleLowEnrollmentExcluded')?.addEventListener('click', () => {
      mounted.showExcluded = !mounted.showExcluded;
      render();
    });
    container.querySelector('[data-excluded-view]')?.addEventListener('click', () => {
      mounted.showExcluded = true;
      mounted.filters.status = [];
      render();
    });
    container.querySelector('#exportLowEnrollmentExcel')?.addEventListener('click', async event => {
      const workspace = selectedWorkspace();
      if (!workspace) return setStatus('Select a Low Enrollment workspace before exporting.');
      const button = event.currentTarget;
      try {
        button.disabled = true;
        button.textContent = 'Exporting...';
        setStatus('Building editable Excel workbook...');
        await exportLowEnrollmentExcel(workspace, filteredRows(workspace));
        setStatus(`Exported ${filteredRows(workspace).length} visible row(s) with the Justification dropdown.`);
      } catch (err) {
        setStatus(err.message || 'Excel export failed.');
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.textContent = 'Export Current View to Excel';
        }
      }
    });
    container.querySelectorAll('[data-filter-search]')?.forEach(input => {
      input.addEventListener('input', event => {
        const panel = event.target.closest('.low-enrollment-filter-panel');
        const search = cleanString(event.target.value).toLowerCase();
        panel?.querySelectorAll('[data-filter-option]')?.forEach(label => {
          label.hidden = search && !cleanString(label.textContent).toLowerCase().includes(search);
        });
      });
    });
    container.querySelectorAll('[data-filter-select-all]')?.forEach(button => {
      button.addEventListener('click', () => button.closest('.low-enrollment-filter-panel')?.querySelectorAll('input[type="checkbox"]')?.forEach(input => { input.checked = true; }));
    });
    container.querySelectorAll('[data-filter-clear]')?.forEach(button => {
      button.addEventListener('click', () => button.closest('.low-enrollment-filter-panel')?.querySelectorAll('input[type="checkbox"]')?.forEach(input => { input.checked = false; }));
    });
    container.querySelectorAll('[data-filter-cancel]')?.forEach(button => {
      button.addEventListener('click', () => render());
    });
    container.querySelectorAll('[data-filter-apply]')?.forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.filterApply;
        mounted.filters[key] = Array.from(button.closest('.low-enrollment-filter-panel')?.querySelectorAll('input[type="checkbox"]:checked') || []).map(input => input.value);
        render();
      });
    });
    container.querySelectorAll('[data-sort-key]')?.forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.sortKey;
        const current = mounted.sort || {};
        const nextDirection = current.key !== key ? 'asc' : current.direction === 'asc' ? 'desc' : current.direction === 'desc' ? '' : 'asc';
        mounted.sort = nextDirection ? { key, direction: nextDirection } : { key: '', direction: '' };
        render();
      });
    });
    container.querySelectorAll('[data-timeline-nav]')?.forEach(button => {
      button.addEventListener('click', () => {
        const scroller = container.querySelector('#lowEnrollmentTimelineScroller');
        scrollLowEnrollmentTimeline(scroller, button.dataset.timelineNav);
      });
    });
    container.querySelectorAll('[data-status-card]')?.forEach(button => {
      button.addEventListener('click', () => {
        const raw = button.dataset.statusCard || '';
        const map = { below: 'Below Threshold', met: 'Threshold Met', missing: 'Missing Update', manual: 'Manual Review' };
        mounted.filters.status = raw === 'all' ? [] : [map[raw] || raw];
        mounted.showExcluded = false;
        if (raw === 'all') mounted.filters.sectionView = 'all';
        if (raw === 'met') mounted.filters.sectionView = 'removed';
        if (raw === 'below' || raw === 'missing' || raw === 'manual') mounted.filters.sectionView = 'all';
        render();
      });
    });
    container.querySelectorAll('[data-section-view-card]')?.forEach(button => {
      button.addEventListener('click', () => {
        mounted.filters.sectionView = button.dataset.sectionViewCard || 'active';
        mounted.filters.status = [];
        mounted.showExcluded = false;
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
    container.querySelector('#importLowEnrollmentManualWorkbook')?.addEventListener('click', async event => {
      const workspace = selectedWorkspace();
      const file = container.querySelector('#lowEnrollmentManualWorkbookFile')?.files?.[0];
      if (!workspace) return setStatus('Select a saved Low Enrollment workspace first.');
      if (!file) return setStatus('Choose an edited Timber tracker workbook first.');
      const button = event.currentTarget;
      try {
        button.disabled = true;
        button.textContent = 'Checking...';
        setStatus('Validating edited tracker workbook...');
        await loadWorkspace(workspace.termCode);
        const currentWorkspace = selectedWorkspace();
        const preview = await readManualUpdateFile(file, currentWorkspace);
        const decision = await confirmManualImport(preview, file.name);
        if (decision !== 'import') {
          setStatus(preview.valid ? 'Edited tracker import canceled.' : 'Edited tracker import blocked; no data was changed.');
          return;
        }
        await saveManualImport(currentWorkspace, preview, file.name);
        setStatus(`Imported manual updates for ${preview.summary.changedRows} row(s). Enrollment data was unchanged.`);
        render();
      } catch (err) {
        setStatus(err.message || 'Edited tracker import failed.');
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.textContent = 'Import Edited Tracker';
        }
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
      const button = container.querySelector('#uploadLowEnrollmentSnapshot');
      try {
        if (button) {
          button.disabled = true;
          button.textContent = 'Uploading...';
        }
        setStatus('Applying enrollment update...');
        const rows = await readCsvFile(file);
        const snapshotDate = container.querySelector('#lowEnrollmentSnapshotDate')?.value || detectSnapshotDateFromRows(rows) || extractSnapshotDateFromFilename(file.name) || localDateInputValue();
        mounted.snapshotDate = snapshotDate;
        const result = applyEnrollmentSnapshot(workspace, rows, { snapshotDate, sourceFilename: file.name });
        await saveSnapshot(result);
        setStatus(`Snapshot saved. ${result.fullyMatchedRows} full, ${result.partiallyMatchedRows} partial, ${result.completelyMissingRows} missing row(s); ${result.newlyMet} newly met threshold.`);
        render();
        await showSnapshotResult(result);
        const fileInput = mounted.container?.querySelector('#lowEnrollmentCsvFile');
        if (fileInput) fileInput.value = '';
      } catch (err) {
        await showSnapshotResult(null, err);
        setStatus(err.message || 'Enrollment update failed.');
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.textContent = 'Upload Enrollment Update';
        }
      }
    });
    container.querySelector('#deleteLowEnrollmentSnapshot')?.addEventListener('click', async event => {
      const workspace = selectedWorkspace();
      const snapshotDate = container.querySelector('#lowEnrollmentDeleteSnapshotDate')?.value || '';
      const snapshot = (workspace?.snapshots || []).find(item => item.type !== 'initial' && item.snapshotDate === snapshotDate);
      if (!workspace) return setStatus('Select a Low Enrollment workspace before deleting an update column.');
      if (!snapshot) return setStatus('Select a dated enrollment update column to delete.');
      const button = event.currentTarget;
      try {
        const confirmed = await confirmDeleteSnapshot(workspace, snapshot);
        if (!confirmed) {
          setStatus('Snapshot column deletion canceled.');
          return;
        }
        button.disabled = true;
        button.textContent = 'Deleting...';
        setStatus(`Deleting ${formatSnapshotColumnLabel(snapshot.snapshotDate)}...`);
        const result = deleteEnrollmentSnapshot(workspace, snapshot.snapshotDate);
        await replaceSavedWorkspace(result.workspace);
        mounted.updatedSnapshotDate = '';
        setStatus(`Deleted ${formatSnapshotColumnLabel(snapshot.snapshotDate)} and recalculated tracker statuses.`);
        render();
      } catch (err) {
        setStatus(err.message || 'Snapshot column deletion failed.');
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.textContent = 'Delete Column';
        }
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
    container.querySelectorAll('[data-exclusion-action]')?.forEach(button => {
      button.addEventListener('click', async event => {
        const rowId = event.target.closest('tr[data-row-id]')?.dataset.rowId;
        const workspace = selectedWorkspace();
        const row = (workspace?.rows || []).find(item => item.id === rowId);
        if (!workspace || !row) return;
        try {
          const change = await chooseExclusionChange(workspace, row, event.target.dataset.exclusionAction);
          if (!change) return;
          setStatus(change.excluded ? 'Excluding row...' : 'Restoring row...');
          await saveExclusion(workspace, row, change);
          setStatus(change.excluded ? 'Row excluded. Enrollment history was preserved.' : 'Row restored to active tracking.');
          render();
        } catch (err) {
          setStatus(err.message || 'Exclusion update failed.');
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
      .low-enrollment-worksheet-shell{border:1px solid #d5e1ee;border-radius:12px;background:#fff;overflow:hidden}
      .low-enrollment-timeline-nav{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px 12px;border-bottom:1px solid #d5e1ee;background:#f8fbff}
      .low-enrollment-timeline-nav span{margin-right:auto;font-weight:900;color:#123367}
      .low-enrollment-timeline-nav button{border:1px solid #c8d8e8;border-radius:999px;background:#fff;color:#123367;font-weight:900;padding:6px 10px;cursor:pointer}
      .low-enrollment-table-wrap{max-height:680px;overflow:auto}
      .low-enrollment-table{--low-enrollment-course-width:75px;--low-enrollment-crn-width:65px;--low-enrollment-title-width:140px;--low-enrollment-status-width:75px;--low-enrollment-justification-width:120px;--low-enrollment-comments-width:165px;min-width:2100px;width:max-content;border-collapse:separate;border-spacing:0;table-layout:fixed}
      .low-enrollment-table .col-course{width:var(--low-enrollment-course-width)}
      .low-enrollment-table .col-crn{width:var(--low-enrollment-crn-width)}
      .low-enrollment-table .col-title{width:var(--low-enrollment-title-width)}
      .low-enrollment-table .col-timeline{width:78px}
      .low-enrollment-table .col-narrow{width:84px}
      .low-enrollment-table .col-medium{width:112px}
      .low-enrollment-table .col-status{width:var(--low-enrollment-status-width)}
      .low-enrollment-table .col-justification{width:var(--low-enrollment-justification-width)}
      .low-enrollment-table .col-comments{width:var(--low-enrollment-comments-width)}
      .low-enrollment-table th{position:sticky;top:0;z-index:3;background:#245685;color:#fff;box-shadow:0 1px 0 #1d4771}
      .low-enrollment-table th,.low-enrollment-table td{padding:8px;border-bottom:1px solid #e1e8f0;border-right:1px solid #eef3f8;vertical-align:top;font-size:12px;line-height:1.25}
      .low-enrollment-table tbody tr:hover td{background:#fff7ed}
      .low-enrollment-table tbody tr:hover .sticky-left,.low-enrollment-table tbody tr:hover .sticky-right{background:#fff7ed}
      .low-enrollment-row-action{display:block;margin-top:6px;border:1px solid #cbd8e6;border-radius:6px;background:#fff;padding:3px 6px;color:#17355d;font-size:10px;font-weight:900;cursor:pointer}
      .low-enrollment-exclusion-note{display:block;margin-top:5px;color:#8a4b08;white-space:normal}
      .low-enrollment-import-errors{border:1px solid #fecaca;border-radius:8px;background:#fff5f5;color:#991b1b;padding:10px}
      .low-enrollment-table th button.low-enrollment-sort{all:unset;cursor:pointer;font:inherit;color:inherit;display:block;width:100%}
      .low-enrollment-table textarea{min-width:0;width:100%;resize:vertical}
      .low-enrollment-table select{min-width:0;width:100%}
      .timeline-col{min-width:86px;text-align:center}
      .initial-column{font-weight:900;background:#f8fbff}
      .right-adjacent{min-width:86px;text-align:center}
      .updated-column{box-shadow:inset 0 0 0 2px rgba(245,124,0,.35);background:#fff7ed}
      .sticky-left,.sticky-right{position:sticky;background:#fff;z-index:2}
      th.sticky-left,th.sticky-right{z-index:5;background:#245685}
      .sticky-course{left:0;min-width:var(--low-enrollment-course-width);width:var(--low-enrollment-course-width)}
      .sticky-crn{left:var(--low-enrollment-course-width);min-width:var(--low-enrollment-crn-width);width:var(--low-enrollment-crn-width)}
      .sticky-title{left:calc(var(--low-enrollment-course-width) + var(--low-enrollment-crn-width));min-width:var(--low-enrollment-title-width);width:var(--low-enrollment-title-width);box-shadow:4px 0 8px rgba(18,51,103,.08)}
      .sticky-comments{right:0;min-width:var(--low-enrollment-comments-width);width:var(--low-enrollment-comments-width);box-shadow:-4px 0 8px rgba(18,51,103,.08)}
      .sticky-justification{right:var(--low-enrollment-comments-width);min-width:var(--low-enrollment-justification-width);width:var(--low-enrollment-justification-width)}
      .sticky-status{right:calc(var(--low-enrollment-comments-width) + var(--low-enrollment-justification-width));min-width:var(--low-enrollment-status-width);width:var(--low-enrollment-status-width)}
      .low-enrollment-date-cell{white-space:pre-line}
      .low-enrollment-filterbar{align-items:flex-start}
      .low-enrollment-filter-menu{position:relative;min-width:170px}
      .low-enrollment-filter-menu summary{cursor:pointer;border:1px solid #cfdbe8;border-radius:8px;background:#fff;padding:8px 10px;font-weight:800;color:#17355d;list-style:none}
      .low-enrollment-filter-menu summary span{display:block;color:#5b6d81;font-size:11px;font-weight:700}
      .low-enrollment-filter-panel{position:absolute;z-index:20;top:calc(100% + 6px);left:0;width:270px;max-width:80vw;border:1px solid #cbd8e6;border-radius:10px;background:#fff;box-shadow:0 18px 36px rgba(15,35,60,.18);padding:10px}
      .low-enrollment-filter-panel input[type="search"]{width:100%;margin-bottom:8px}
      .low-enrollment-filter-options{max-height:220px;overflow:auto;display:grid;gap:4px;margin:8px 0}
      .low-enrollment-filter-options label{display:flex;gap:6px;align-items:center;font-size:12px}
      .low-enrollment-filter-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
      .low-enrollment-filter-actions button{border:1px solid #cbd8e6;border-radius:7px;background:#f8fbff;padding:5px 8px;color:#17355d;font-weight:800}
      .low-enrollment-active-filters{flex-basis:100%}
      .low-enrollment-modal-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(10,24,40,.48);display:flex;align-items:center;justify-content:center;padding:20px}
      .low-enrollment-modal{width:min(720px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:12px;border:1px solid #cbd8e6;box-shadow:0 24px 70px rgba(7,20,38,.35);padding:18px;color:#10233c}
      .low-enrollment-modal h3{margin-top:0;color:#123367}
      .low-enrollment-modal-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:16px}
      .low-enrollment-modal-actions button{border:1px solid #cbd8e6;border-radius:9px;background:#fff;padding:8px 12px;font-weight:900;color:#17355d}
      .low-enrollment-modal-actions button.primary{background:#0d4f80;color:#fff;border-color:#0d4f80}
      .low-enrollment-confirm-line{display:grid;gap:5px;margin:12px 0}
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
    if (lowEnrollmentResizeHandler && root.removeEventListener) {
      root.removeEventListener('resize', lowEnrollmentResizeHandler);
    }
    mounted = {
      container: options.container,
      backendBaseUrl: options.backendBaseUrl || root.BACKEND_BASE_URL || '',
      getToken: options.getToken,
      requestAccess: options.requestAccess,
      terms: [],
      workspace: null,
      filters: { status: [], search: '', division: [], campus: [], instructionalMethod: [], scheduleType: [], sectionView: 'active' },
      sort: { key: '', direction: '' },
      snapshotDate: localDateInputValue(),
      updatedSnapshotDate: '',
      showExcluded: false
    };
    lowEnrollmentResizeHandler = () => {
      const run = () => recalculateLowEnrollmentTimelineNavigation();
      if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(run);
      else run();
    };
    root.addEventListener?.('resize', lowEnrollmentResizeHandler);
    render();
    loadTerms().then(render).catch(err => setStatus(err.message || 'Low Enrollment Tracking load failed.'));
  }

  return {
    DEFAULT_JUSTIFICATIONS,
    normalizeHeader,
    buildHeaderMap,
    parseCrns,
    localDateInputValue,
    normalizeDate,
    parseStartDateList,
    formatStartDateDisplay,
    formatSnapshotColumnLabel,
    parseReasonsTable,
    parseWorkbookTable,
    parseWorkbook,
    parseEnrollmentCsvRows,
    detectSnapshotDateFromRows,
    validateImportWorkspace,
    buildImportSummary,
    applyEnrollmentSnapshot,
    deleteEnrollmentSnapshot,
    refreshBaselineWorkspace,
    workspaceImportPreview,
    statusForRow,
    removedFromActiveWatchlist,
    removedReason,
    calculateTimelineScrollLimits,
    calculateTimelineNavigationScroll,
    displayTermFromCode,
    extractTermCodeFromFilename,
    extractSnapshotDateFromFilename,
    parseManualUpdateWorkbook,
    buildExcelExportModel,
    removedOrExcludedExportRows,
    worksheetDataRowHeight,
    createExcelWorkbook,
    mount
  };
});
