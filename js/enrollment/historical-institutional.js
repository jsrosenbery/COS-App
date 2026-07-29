// Historical Institutional Results import, storage, yield model, and pending FTES estimates.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSHistoricalInstitutional = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const STORAGE_KEY = 'cos-historical-institutional-results-v1';
  const DB_NAME = 'timber-historical-institutional-results';
  const DB_VERSION = 1;
  const MODEL_VERSION = 'historical-institutional-yield-v1';
  const SOURCE = 'INSTITUTIONAL_CUBE';
  const SOURCE_QUALITY = 'FINAL_INSTITUTIONAL_ACTUAL';
  const TERM_COLUMN_PATTERN = /^(19|20)\d{2}(10|20|30)$/;
  const DEFAULT_RECONCILIATION_TOLERANCE = 0.01;
  const ELIGIBLE_PENDING_ATTENDANCE = new Set(['P', 'E', 'I', 'WE', 'WORK EXPERIENCE']);
  const MODEL_THRESHOLDS = Object.freeze({
    high: { minTerms: 4, minEnrollment: 100, maxCv: 0.12, maxWape: 0.08, maxBias: 0.05 },
    medium: { minTerms: 3, minEnrollment: 50, maxCv: 0.25, maxWape: 0.15, maxBias: 0.1 },
    low: { minTerms: 2, minEnrollment: 20 },
    maxHighVarianceCv: 0.45,
    maxHighVarianceWape: 0.25
  });
  const HEADER_ALIASES = Object.freeze({
    campus: ['Campus', 'Campus Code', 'Location'],
    division: ['Division', 'Division Name', 'Division ID'],
    subject: ['Subject', 'Subj', 'Subject Code'],
    courseNumber: ['Course', 'Course #', 'Course Number', 'Course No', 'Catalog Number'],
    crn: ['CRN', 'Course Reference Number', 'Section CRN'],
    attendanceMethod: ['Accounting Method', 'Attendance Method', 'Attendance Accounting Method', 'Acct Method', 'Accounting'],
    partOfTerm: ['Part of Term', 'Part-Of-Term', 'Part_Of_Term', 'POT', 'PTRM', 'PTRM Code'],
    censusEnrollment: ['Enrollment', 'Census Enrollment', 'Census Enroll', 'Headcount'],
    studentContactHours: ['Student Contact Hrs', 'Student Contact Hours', 'Contact Hours', 'Total Student Contact Hours', 'SCH']
  });
  const FTES_MEASURE_HEADERS = Object.freeze(['Individual FTES', 'FTES', 'Section FTES']);
  const REQUIRED_FIELDS = ['subject', 'courseNumber', 'attendanceMethod', 'censusEnrollment'];

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function headerKey(value) {
    return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '');
  }

  function numberValue(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(String(value).replace(/[$,%]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round(value, digits = 6) {
    const factor = 10 ** digits;
    return Number.isFinite(value) ? Math.round(value * factor) / factor : null;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  }

  function standardDeviation(values) {
    const avg = average(values);
    if (avg == null) return null;
    const valid = values.filter(Number.isFinite);
    if (valid.length < 2) return 0;
    return Math.sqrt(valid.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (valid.length - 1));
  }

  function termSeason(termCode) {
    const suffix = String(termCode || '').slice(-2);
    if (suffix === '10') return 'Fall';
    if (suffix === '20') return 'Spring';
    if (suffix === '30') return 'Summer';
    return '';
  }

  function normalizeTermCode(value) {
    const raw = clean(value);
    const exact = raw.match(/\b((?:19|20)\d{2}(?:10|20|30))\b/);
    return exact ? exact[1] : raw;
  }

  function seasonYearTermCode(value) {
    const raw = clean(value);
    const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
    if (!yearMatch) return '';
    const year = Number(yearMatch[1]);
    if (/FALL/i.test(raw)) return `${year + 1}10`;
    if (/SPRING/i.test(raw)) return `${year}20`;
    if (/SUMMER/i.test(raw)) return `${year}30`;
    return '';
  }

  function normalizeSubject(value) {
    return clean(value).toUpperCase();
  }

  function normalizeCourse(value) {
    return clean(value).toUpperCase();
  }

  function isWorkExperienceIdentity(row = {}) {
    const subject = normalizeSubject(row.subject || row.Subject || row.SUBJECT || '');
    const course = normalizeCourse(row.courseNumber || row.course || row.Course || row.COURSE || '');
    const division = clean(row.division || row.Division || row.DIVISION || '').toUpperCase();
    const population = clean(row.population || row.Population || '').toUpperCase();
    const sourceType = clean(row.sourceType || row.__sourceType || '').toUpperCase();
    const modality = clean(row.modality || row.instructionalMethod || row.instructionalMethodLabel || '').toUpperCase();
    return Boolean(
      row.isWorkExperience ||
      /WORK\s*EXPERIENCE/.test(sourceType) ||
      /WORK\s*EXPERIENCE/.test(population) ||
      /WORK\s*EXPERIENCE/.test(division) ||
      /^WKEX|^WKEXP|WORK\s*EXP/.test(subject) ||
      /WORK\s*EXP/.test(course) ||
      /WORK\s*EXPERIENCE/.test(modality)
    );
  }

  function normalizeAttendanceMethod(value, row = {}) {
    const raw = clean(value).toUpperCase();
    if (!raw && isWorkExperienceIdentity(row)) return 'WORK EXPERIENCE';
    if (/OPEN.*ENTRY|OPEN.*EXIT/.test(raw)) return 'E';
    if (/POSITIVE/.test(raw) && !/OPEN/.test(raw)) return 'P';
    if (/WORK.*EXPERIENCE/.test(raw)) return 'WORK EXPERIENCE';
    return raw.replace(/^ATTENDANCE\s+METHOD\s+/, '').trim();
  }

  function normalizePartOfTerm(value) {
    return clean(value).toUpperCase();
  }

  function courseKey(subject, courseNumber) {
    return [normalizeSubject(subject), normalizeCourse(courseNumber)].filter(Boolean).join(' ');
  }

  function stableCourseKeyForRow(row = {}) {
    const subject = normalizeSubject(row.subject || row.Subject || row.SUBJECT || '');
    const courseNumber = normalizeCourse(row.courseNumber || row.course || row.Course || row.COURSE || '');
    if (subject || courseNumber) return courseKey(subject, courseNumber);
    return clean(row.courseKey || row.CourseKey || '').toUpperCase();
  }

  function termCodeNear(termHeaders = [], index) {
    const direct = normalizeTermCode(termHeaders[index]);
    if (TERM_COLUMN_PATTERN.test(direct)) return direct;
    for (let offset = 1; offset <= 3; offset += 1) {
      const left = normalizeTermCode(termHeaders[index - offset]);
      if (TERM_COLUMN_PATTERN.test(left)) return left;
      const right = normalizeTermCode(termHeaders[index + offset]);
      if (TERM_COLUMN_PATTERN.test(right)) return right;
    }
    return '';
  }

  function resolveAliasColumns(headers = [], termHeaders = []) {
    const keys = headers.map(headerKey);
    const ftesMeasureKeys = FTES_MEASURE_HEADERS.map(headerKey);
    const columnMap = {};
    const ambiguities = [];
    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      const aliasKeys = aliases.map(headerKey);
      const matches = keys
        .map((key, index) => aliasKeys.includes(key) ? index : -1)
        .filter(index => index >= 0);
      if (matches.length === 1) columnMap[field] = matches[0];
      if (matches.length > 1) ambiguities.push({ field, columns: matches.map(index => headers[index]) });
    });
    const directTermColumns = headers
      .map((header, index) => ({ header: normalizeTermCode(header), index }))
      .filter(item => TERM_COLUMN_PATTERN.test(item.header));
    const pairedMeasureColumns = keys
      .map((key, index) => ftesMeasureKeys.includes(key) ? { header: termCodeNear(termHeaders, index), index, measureHeader: headers[index] } : null)
      .filter(item => item && TERM_COLUMN_PATTERN.test(item.header));
    const termColumns = pairedMeasureColumns.length ? pairedMeasureColumns : directTermColumns;
    return { columnMap, ambiguities, termColumns };
  }

  function detectHeaderRow(table = []) {
    let best = { rowIndex: -1, termHeaderRowIndex: -1, score: -1, headers: [], termHeaders: [], columnMap: {}, termColumns: [], ambiguities: [] };
    (table || []).forEach((row, rowIndex) => {
      const headers = (row || []).map(clean);
      const termHeaders = rowIndex > 0 ? (table[rowIndex - 1] || []).map(clean) : [];
      const resolved = resolveAliasColumns(headers, termHeaders);
      const requiredCount = REQUIRED_FIELDS.filter(field => resolved.columnMap[field] != null).length;
      const ftesMeasureKeys = FTES_MEASURE_HEADERS.map(headerKey);
      const measureCount = headers.filter(header => ftesMeasureKeys.includes(headerKey(header))).length;
      const score = requiredCount * 5 + resolved.termColumns.length * 4 + measureCount * 2 + Object.keys(resolved.columnMap).length - resolved.ambiguities.length * 10;
      if (score > best.score) best = { rowIndex, termHeaderRowIndex: termHeaders.length ? rowIndex - 1 : -1, score, headers, termHeaders, ...resolved };
    });
    return best;
  }

  function valueAt(row, index) {
    return index == null ? '' : clean(row?.[index]);
  }

  function rowObject(values, header) {
    const obj = {};
    Object.entries(header.columnMap).forEach(([field, index]) => {
      obj[field] = valueAt(values, index);
    });
    header.termColumns.forEach(term => {
      obj[term.header] = values?.[term.index] ?? '';
    });
    return obj;
  }

  function hasIdentity(row = {}) {
    return Boolean(clean(row.crn) || clean(row.subject) || clean(row.courseNumber));
  }

  function termFtesValues(row = {}, termColumns = []) {
    return termColumns.map(term => {
      const rawValue = clean(row[term.header]);
      const ftes = numberValue(rawValue);
      return {
        termCode: term.header,
        rawValue,
        ftes,
        hasNumericFtes: ftes != null,
        hasMeaningfulFtes: ftes != null && ftes !== 0
      };
    });
  }

  function rowHasAnyFtes(row = {}, termColumns = []) {
    return termFtesValues(row, termColumns).some(item => item.ftes != null);
  }

  function recordTotalsByTerm(records = [], detectedTerms = []) {
    const byTerm = {};
    detectedTerms.forEach(termCode => {
      byTerm[termCode] = { termCode, censusEnrollment: 0, finalInstitutionalFtes: 0, records: 0 };
    });
    records.forEach(record => {
      byTerm[record.termCode] ||= { termCode: record.termCode, censusEnrollment: 0, finalInstitutionalFtes: 0, records: 0 };
      byTerm[record.termCode].censusEnrollment += Number(record.censusEnrollment || 0);
      byTerm[record.termCode].finalInstitutionalFtes += Number(record.finalInstitutionalFtes || 0);
      byTerm[record.termCode].records += 1;
    });
    return byTerm;
  }

  function equalNumericSeries(values = [], tolerance = 0.000001) {
    if (values.length < 2) return false;
    return values.every(value => Math.abs(Number(value || 0) - Number(values[0] || 0)) <= tolerance);
  }

  function sourceDataVersion(records = [], batches = []) {
    const recordCount = records.length;
    const recordTerms = [...new Set(records.map(record => record.termCode).filter(Boolean))].sort();
    const batchIds = (batches || []).map(batch => batch.importBatchId).filter(Boolean).sort();
    const latestImport = (batches || []).map(batch => batch.importedAt || '').sort().pop() || '';
    const ftes = round(records.reduce((sum, record) => sum + Number(record.finalInstitutionalFtes || 0), 0), 3);
    const enrollment = round(records.reduce((sum, record) => sum + Number(record.censusEnrollment || 0), 0), 3);
    return [recordCount, recordTerms.join(','), batchIds.join(','), latestImport, ftes, enrollment].join('|');
  }

  function reconciliationTolerance(options = {}) {
    const parsed = numberValue(options.reconciliationTolerance);
    return parsed != null && parsed >= 0 ? parsed : DEFAULT_RECONCILIATION_TOLERANCE;
  }

  function inheritRow(parent = {}, child = {}) {
    const inherited = { ...child };
    ['campus', 'division', 'subject', 'courseNumber', 'crn', 'attendanceMethod', 'partOfTerm'].forEach(field => {
      if (!clean(inherited[field])) inherited[field] = parent[field] || '';
    });
    return inherited;
  }

  function makeRecord(row, termCode, ftes, context = {}) {
    const censusEnrollment = numberValue(row.censusEnrollment);
    const studentContactHours = numberValue(row.studentContactHours);
    const subject = normalizeSubject(row.subject);
    const courseNumber = normalizeCourse(row.courseNumber);
    const finalInstitutionalFtes = ftes == null ? null : Number(ftes);
    return {
      termCode,
      season: termSeason(termCode),
      campus: clean(row.campus),
      division: clean(row.division),
      subject,
      courseNumber,
      courseKey: stableCourseKeyForRow({ subject, courseNumber }),
      crn: clean(row.crn),
      attendanceMethod: normalizeAttendanceMethod(row.attendanceMethod, row),
      partOfTerm: normalizePartOfTerm(row.partOfTerm),
      censusEnrollment,
      studentContactHours,
      finalInstitutionalFtes,
      ftesPerEnrollment: censusEnrollment ? round(finalInstitutionalFtes / censusEnrollment) : null,
      ftesPerStudentContactHour: studentContactHours ? round(finalInstitutionalFtes / studentContactHours) : null,
      source: SOURCE,
      sourceQuality: SOURCE_QUALITY,
      originalFilename: context.originalFilename || '',
      importBatchId: context.importBatchId || '',
      importedAt: context.importedAt || '',
      validationStatus: context.validationStatus || 'VALID',
      hierarchyRole: context.hierarchyRole || 'explicit',
      detailClassification: context.detailClassification || 'explicit',
      sourceRowNumber: context.sourceRowNumber || null,
      recordIdentity: ''
    };
  }

  function stableRecordIdentity(record = {}) {
    return [
      record.termCode,
      record.crn || record.courseKey || 'NOCRN',
      record.attendanceMethod || 'NOATT',
      record.partOfTerm || 'NOPOT',
      record.detailClassification || 'explicit',
      record.sourceRowNumber || ''
    ].join('|');
  }

  function stableRecordId(record = {}) {
    return stableRecordIdentity(record)
      .split('|')
      .map(part => encodeURIComponent(clean(part)))
      .join('|');
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    });
  }

  function transactionPromise(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
    });
  }

  function createStoreIfMissing(db, tx, name, options) {
    return db.objectStoreNames.contains(name) ? tx.objectStore(name) : db.createObjectStore(name, options);
  }

  function createIndexIfMissing(store, name, keyPath, options = {}) {
    if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
  }

  function upgradeHistoricalDatabase(db, tx) {
    const records = createStoreIfMissing(db, tx, 'historicalRecords', { keyPath: 'recordId' });
    createIndexIfMissing(records, 'termCode', 'termCode');
    createIndexIfMissing(records, 'crn', 'crn');
    createIndexIfMissing(records, 'subject', 'subject');
    createIndexIfMissing(records, 'courseKey', 'courseKey');
    createIndexIfMissing(records, 'division', 'division');
    createIndexIfMissing(records, 'attendanceMethod', 'attendanceMethod');
    createIndexIfMissing(records, 'partOfTerm', 'partOfTerm');
    createIndexIfMissing(records, 'importBatchId', 'importBatchId');
    createIndexIfMissing(records, 'validationStatus', 'validationStatus');
    createIndexIfMissing(records, 'sourceQuality', 'sourceQuality');
    createIndexIfMissing(records, 'season', 'season');
    createIndexIfMissing(records, 'termAttendance', ['termCode', 'attendanceMethod']);
    createIndexIfMissing(records, 'termSubject', ['termCode', 'subject']);
    createIndexIfMissing(records, 'termCourse', ['termCode', 'courseKey']);
    createIndexIfMissing(records, 'subjectAttendance', ['subject', 'attendanceMethod']);
    createIndexIfMissing(records, 'courseAttendance', ['courseKey', 'attendanceMethod']);

    const batches = createStoreIfMissing(db, tx, 'importBatches', { keyPath: 'importBatchId' });
    createIndexIfMissing(batches, 'importedAt', 'importedAt');
    createIndexIfMissing(batches, 'originalFilename', 'filename');
    createIndexIfMissing(batches, 'status', 'validationStatus');

    const aggregates = createStoreIfMissing(db, tx, 'historicalModelAggregates', { keyPath: 'aggregateId' });
    createIndexIfMissing(aggregates, 'modelLevel', 'modelLevel');
    createIndexIfMissing(aggregates, 'groupKey', 'groupKey');
    createIndexIfMissing(aggregates, 'season', 'season');
    createIndexIfMissing(aggregates, 'attendanceMethod', 'attendanceMethod');
    createIndexIfMissing(aggregates, 'modelVersion', 'modelVersion');
    createStoreIfMissing(db, tx, 'metadata', { keyPath: 'key' });
  }

  function classifyStorageError(error = {}) {
    const name = error?.name || '';
    if (name === 'QuotaExceededError') return 'Storage quota exhausted. No partial import was saved.';
    if (name === 'VersionError') return 'Historical database upgrade failed. Close other TIMBER tabs and reload.';
    if (name === 'AbortError') return 'Historical database transaction was aborted. No partial import was saved.';
    if (name === 'InvalidStateError') return 'Browser storage is unavailable or the database connection is closed.';
    if (name === 'UnknownError') return 'Browser storage is unavailable or blocked. No partial import was saved.';
    return 'TIMBER could not save the historical institutional dataset because browser storage is unavailable or full. No partial import was saved.';
  }

  function createIndexedDbRepository(scope = (typeof window !== 'undefined' ? window : globalThis), options = {}) {
    const indexedDB = scope?.indexedDB;
    const IDBKeyRangeRef = scope?.IDBKeyRange || globalThis.IDBKeyRange;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    let db = null;
    let initialized = false;
    let initializing = null;
    let lastError = '';
    let lastSuccessfulTransaction = '';
    let migrationStatus = 'not-started';

    function ensureIndexedDb() {
      if (!indexedDB?.open || !IDBKeyRangeRef?.only) {
        const error = new Error('IndexedDB is unavailable in this browser context.');
        error.name = 'InvalidStateError';
        throw error;
      }
    }

    function openDatabase() {
      ensureIndexedDb();
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => upgradeHistoricalDatabase(event.target.result, event.target.transaction);
        request.onblocked = () => {
          lastError = 'TIMBER needs to update its historical database. Close other TIMBER tabs and reload this page.';
          reject(new Error(lastError));
        };
        request.onerror = () => {
          lastError = classifyStorageError(request.error);
          reject(request.error || new Error(lastError));
        };
        request.onsuccess = () => {
          db = request.result;
          db.onversionchange = () => {
            db.close();
            db = null;
            initialized = false;
            lastError = 'Historical database version changed. Reload TIMBER to continue.';
          };
          resolve(db);
        };
      });
    }

    function putMetadata(store, key, value) {
      store.put({ key, value, updatedAt: new Date().toISOString() });
    }

    async function initialize() {
      if (initialized && db) return db;
      if (initializing) return initializing;
      initializing = openDatabase()
        .then(async active => {
          initialized = true;
          await migrateLegacyLocalStorage();
          return active;
        })
        .catch(error => {
          lastError = classifyStorageError(error);
          throw error;
        })
        .finally(() => { initializing = null; });
      return initializing;
    }

    function decorateRecord(record = {}) {
      return { ...record, recordIdentity: record.recordIdentity || stableRecordIdentity(record), recordId: record.recordId || stableRecordId(record) };
    }

    function batchFromPreview(preview = {}, options = {}) {
      const records = preview.records || [];
      const diagnostics = preview.diagnostics || {};
      const terms = [...new Set(records.map(record => record.termCode).filter(Boolean))].sort();
      return {
        importBatchId: records[0]?.importBatchId || `HIR-${Date.now()}`,
        filename: diagnostics.filename || records[0]?.originalFilename || '',
        importedBy: options.importedBy || '',
        importedAt: records[0]?.importedAt || new Date().toISOString(),
        termsIncluded: terms,
        recordsAdded: records.length,
        recordsReplaced: 0,
        recordsExcluded: diagnostics.excludedRows || 0,
        uniqueCrns: diagnostics.uniqueCrns?.length || 0,
        validationWarnings: diagnostics.warnings || [],
        validationErrors: diagnostics.errors || [],
        validationStatus: preview.valid ? 'VALID' : 'ERROR',
        totalsByTerm: diagnostics.totalsByTerm || [],
        reconciliation: diagnostics.ftesReconciliation || [],
        importAction: options.mode || 'replace-selected-terms',
        replacedTerms: options.terms || terms,
        modelVersion: MODEL_VERSION
      };
    }

    function putRecordsInTransaction(tx, records = []) {
      const store = tx.objectStore('historicalRecords');
      let written = 0;
      records.forEach(record => {
        const request = store.put(decorateRecord(record));
        request.onsuccess = () => {
          written += 1;
          if (written === records.length || written % 500 === 0) {
            onProgress({ status: 'writing-records', written, total: records.length, message: `Writing ${written} of ${records.length} historical records...` });
          }
        };
      });
    }

    function queueDeleteRecordsByValues(store, indexName, values = [], onDone, onError) {
      const targets = [...values];
      let targetIndex = 0;
      const nextTarget = () => {
        if (targetIndex >= targets.length) {
          onDone();
          return;
        }
        const request = store.index(indexName).openCursor(IDBKeyRangeRef.only(targets[targetIndex]));
        request.onerror = () => onError(request.error || new Error(`Failed to delete records by ${indexName}.`));
        request.onsuccess = event => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            targetIndex += 1;
            nextTarget();
          }
        };
      };
      nextTarget();
    }

    async function saveImportBatch(batch, records = []) {
      const active = await initialize();
      const tx = active.transaction(['historicalRecords', 'importBatches', 'historicalModelAggregates', 'metadata'], 'readwrite');
      onProgress({ status: 'preparing-import', written: 0, total: records.length, message: 'Preparing historical import...' });
      putRecordsInTransaction(tx, records);
      tx.objectStore('importBatches').put(batch);
      const metadata = tx.objectStore('metadata');
      putMetadata(metadata, 'schemaVersion', DB_VERSION);
      putMetadata(metadata, 'activeModelVersion', MODEL_VERSION);
      putMetadata(metadata, 'modelStatus', 'stale');
      putMetadata(metadata, 'lastSuccessfulImport', batch);
      putMetadata(metadata, 'lastSuccessfulTransaction', { type: 'saveImportBatch', importBatchId: batch.importBatchId, at: new Date().toISOString() });
      clearModelAggregates(tx);
      await transactionPromise(tx);
      lastSuccessfulTransaction = `saveImportBatch:${batch.importBatchId}`;
      onProgress({ status: 'finalizing', written: records.length, total: records.length, message: 'Historical import finalized.' });
      await scope?.navigator?.storage?.persist?.();
    }

    async function replaceTerms(batch, records = [], termCodes = []) {
      const active = await initialize();
      const terms = [...new Set((termCodes.length ? termCodes : records.map(record => record.termCode)).filter(Boolean))];
      const tx = active.transaction(['historicalRecords', 'importBatches', 'historicalModelAggregates', 'metadata'], 'readwrite');
      onProgress({ status: 'preparing-import', written: 0, total: records.length, message: 'Preparing term replacement...' });
      const recordStore = tx.objectStore('historicalRecords');
      await new Promise((resolve, reject) => {
        queueDeleteRecordsByValues(recordStore, 'termCode', terms, () => {
          putRecordsInTransaction(tx, records);
          tx.objectStore('importBatches').put({ ...batch, replacedTerms: terms });
          const metadata = tx.objectStore('metadata');
          putMetadata(metadata, 'schemaVersion', DB_VERSION);
          putMetadata(metadata, 'activeModelVersion', MODEL_VERSION);
          putMetadata(metadata, 'modelStatus', 'stale');
          putMetadata(metadata, 'lastSuccessfulImport', { ...batch, replacedTerms: terms });
          putMetadata(metadata, 'lastSuccessfulTransaction', { type: 'replaceTerms', importBatchId: batch.importBatchId, terms, at: new Date().toISOString() });
          clearModelAggregates(tx);
          resolve();
        }, reject);
      });
      await transactionPromise(tx);
      lastSuccessfulTransaction = `replaceTerms:${batch.importBatchId}`;
      onProgress({ status: 'finalizing', written: records.length, total: records.length, message: 'Historical term replacement finalized.' });
      await scope?.navigator?.storage?.persist?.();
    }

    async function commitImport(preview, options = {}) {
      if (!preview?.valid) throw new Error('Historical Institutional Results import contains blocking validation errors.');
      const batch = batchFromPreview(preview, options);
      const records = (preview.records || []).map(decorateRecord);
      if ((options.mode || 'replace-selected-terms') === 'append') await saveImportBatch(batch, records);
      else await replaceTerms(batch, records, options.terms?.length ? options.terms.map(normalizeTermCode) : batch.termsIncluded);
      return load();
    }

    async function getAllRecords() {
      const active = await initialize();
      return requestPromise(active.transaction('historicalRecords', 'readonly').objectStore('historicalRecords').getAll());
    }

    async function getByIndex(indexName, value) {
      const active = await initialize();
      return requestPromise(active.transaction('historicalRecords', 'readonly').objectStore('historicalRecords').index(indexName).getAll(value));
    }

    async function getRecordsByTerm(termCode) {
      return getByIndex('termCode', normalizeTermCode(termCode));
    }

    async function getRecordsByTerms(termCodes = []) {
      const groups = await Promise.all([...new Set(termCodes.map(normalizeTermCode).filter(Boolean))].map(getRecordsByTerm));
      return groups.flat();
    }

    async function getRecordCount() {
      const active = await initialize();
      return requestPromise(active.transaction('historicalRecords', 'readonly').objectStore('historicalRecords').count());
    }

    async function getImportBatches() {
      const active = await initialize();
      const rows = await requestPromise(active.transaction('importBatches', 'readonly').objectStore('importBatches').getAll());
      return rows.sort((a, b) => String(a.importedAt || '').localeCompare(String(b.importedAt || '')));
    }

    async function getImportBatch(importBatchId) {
      const active = await initialize();
      return requestPromise(active.transaction('importBatches', 'readonly').objectStore('importBatches').get(importBatchId));
    }

    async function deleteImportBatch(importBatchId) {
      const active = await initialize();
      const tx = active.transaction(['historicalRecords', 'importBatches', 'historicalModelAggregates', 'metadata'], 'readwrite');
      await new Promise((resolve, reject) => {
        queueDeleteRecordsByValues(tx.objectStore('historicalRecords'), 'importBatchId', [importBatchId], () => {
          tx.objectStore('importBatches').delete(importBatchId);
          clearModelAggregates(tx);
          putMetadata(tx.objectStore('metadata'), 'modelStatus', 'stale');
          putMetadata(tx.objectStore('metadata'), 'lastSuccessfulTransaction', { type: 'deleteImportBatch', importBatchId, at: new Date().toISOString() });
          resolve();
        }, reject);
      });
      await transactionPromise(tx);
      lastSuccessfulTransaction = `deleteImportBatch:${importBatchId}`;
    }

    async function clearAll() {
      const active = await initialize();
      const tx = active.transaction(['historicalRecords', 'importBatches', 'historicalModelAggregates', 'metadata'], 'readwrite');
      tx.objectStore('historicalRecords').clear();
      tx.objectStore('importBatches').clear();
      tx.objectStore('historicalModelAggregates').clear();
      tx.objectStore('metadata').clear();
      await transactionPromise(tx);
      lastSuccessfulTransaction = 'clearAll';
    }

    async function load() {
      const [records, batches] = await Promise.all([getAllRecords(), getImportBatches()]);
      return { version: 1, records, batches, updatedAt: new Date().toISOString() };
    }

    async function previewDifferences(records = []) {
      const existing = await getAllRecords();
      const legacy = createRepository({
        getItem() { return JSON.stringify({ records: existing, batches: [] }); },
        setItem() {},
        removeItem() {}
      });
      return legacy.previewDifferences(records);
    }

    async function metadataEntries() {
      const active = await initialize();
      const rows = await requestPromise(active.transaction('metadata', 'readonly').objectStore('metadata').getAll());
      return Object.fromEntries(rows.map(row => [row.key, row.value]));
    }

    function clearModelAggregates(tx = null) {
      if (tx) {
        tx.objectStore('historicalModelAggregates').clear();
        return Promise.resolve();
      }
      return initialize().then(active => {
        const nextTx = active.transaction(['historicalModelAggregates', 'metadata'], 'readwrite');
        nextTx.objectStore('historicalModelAggregates').clear();
        putMetadata(nextTx.objectStore('metadata'), 'modelStatus', 'stale');
        return transactionPromise(nextTx);
      });
    }

    async function saveModelAggregates(model = {}, version = '') {
      const active = await initialize();
      const tx = active.transaction(['historicalModelAggregates', 'metadata'], 'readwrite');
      const store = tx.objectStore('historicalModelAggregates');
      store.clear();
      const calculatedAt = model.builtAt || new Date().toISOString();
      (model.groups || []).forEach(group => {
        store.put({
          ...group,
          aggregateId: [MODEL_VERSION, group.modelLevel, encodeURIComponent(group.groupKey || '')].join('|'),
          sourceDataVersion: version,
          modelVersion: MODEL_VERSION,
          calculatedAt
        });
      });
      const metadata = tx.objectStore('metadata');
      putMetadata(metadata, 'modelStatus', 'ready');
      putMetadata(metadata, 'modelVersion', MODEL_VERSION);
      putMetadata(metadata, 'modelSourceDataVersion', version);
      putMetadata(metadata, 'modelRecordCount', model.records || 0);
      putMetadata(metadata, 'lastModelRebuild', calculatedAt);
      putMetadata(metadata, 'lastSuccessfulTransaction', { type: 'saveModelAggregates', sourceDataVersion: version, at: new Date().toISOString() });
      await transactionPromise(tx);
      lastSuccessfulTransaction = 'saveModelAggregates';
    }

    async function getPersistedModel(version = '', modelVersion = MODEL_VERSION) {
      const active = await initialize();
      const metadata = await metadataEntries();
      if (metadata.modelVersion !== modelVersion || metadata.modelSourceDataVersion !== version || metadata.modelStatus !== 'ready') return null;
      const groups = await requestPromise(active.transaction('historicalModelAggregates', 'readonly').objectStore('historicalModelAggregates').getAll());
      if (!groups.length && Number(metadata.modelRecordCount || 0) > 0) return null;
      return {
        modelVersion,
        builtAt: metadata.lastModelRebuild || '',
        records: Number(metadata.modelRecordCount || 0),
        sourceDataVersion: version,
        restoredFromPersistence: true,
        groups: groups.map(group => {
          const { aggregateId, sourceDataVersion: _sourceDataVersion, calculatedAt: _calculatedAt, ...rest } = group;
          return rest;
        }),
        backtests: groups.flatMap(group => (group.backtesting?.rows || []).map(row => ({ ...row, confidence: group.confidence })))
      };
    }

    async function storageDiagnostics() {
      const active = await initialize();
      const [recordCount, batches, aggregateCount, metadata, estimate, persistent] = await Promise.all([
        getRecordCount(),
        getImportBatches(),
        requestPromise(active.transaction('historicalModelAggregates', 'readonly').objectStore('historicalModelAggregates').count()),
        metadataEntries(),
        scope?.navigator?.storage?.estimate?.().catch(() => null),
        scope?.navigator?.storage?.persisted?.().catch(() => null)
      ]);
      return {
        databaseName: DB_NAME,
        databaseVersion: active.version,
        objectStores: Array.from(active.objectStoreNames || []),
        historicalRecordCount: recordCount,
        importBatchCount: batches.length,
        aggregateCount,
        storageUsage: estimate?.usage ?? null,
        storageQuota: estimate?.quota ?? null,
        persistentStorageGranted: persistent,
        indexedDbAvailable: true,
        legacyMigrationStatus: migrationStatus,
        lastSuccessfulTransaction,
        lastDatabaseError: lastError,
        metadata
      };
    }

    async function exportBackup() {
      const active = await initialize();
      const [records, importBatches, metadata, modelAggregates] = await Promise.all([
        getAllRecords(),
        getImportBatches(),
        metadataEntries(),
        requestPromise(active.transaction('historicalModelAggregates', 'readonly').objectStore('historicalModelAggregates').getAll())
      ]);
      return { schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), records, importBatches, metadata, modelAggregates };
    }

    async function migrateLegacyLocalStorage() {
      const storage = scope?.localStorage;
      if (!storage?.getItem || !storage?.removeItem) {
        migrationStatus = 'no-local-storage';
        return;
      }
      const active = db;
      const existingMigration = await requestPromise(active.transaction('metadata', 'readonly').objectStore('metadata').get('legacyMigrationStatus'));
      if (existingMigration?.value === 'complete' || existingMigration?.value === 'no-legacy-data') {
        migrationStatus = existingMigration.value;
        return;
      }
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        const tx = active.transaction('metadata', 'readwrite');
        putMetadata(tx.objectStore('metadata'), 'legacyMigrationStatus', 'no-legacy-data');
        await transactionPromise(tx);
        migrationStatus = 'no-legacy-data';
        return;
      }
      let legacy;
      try {
        legacy = JSON.parse(raw);
      } catch (_err) {
        const tx = active.transaction('metadata', 'readwrite');
        putMetadata(tx.objectStore('metadata'), 'legacyMigrationStatus', 'invalid-preserved');
        await transactionPromise(tx);
        migrationStatus = 'invalid-preserved';
        return;
      }
      if (!legacy || !Array.isArray(legacy.records)) {
        const tx = active.transaction('metadata', 'readwrite');
        putMetadata(tx.objectStore('metadata'), 'legacyMigrationStatus', 'unrecognized-preserved');
        await transactionPromise(tx);
        migrationStatus = 'unrecognized-preserved';
        return;
      }
      const records = legacy.records.map(decorateRecord);
      const batch = {
        importBatchId: legacy.batches?.[0]?.importBatchId || `LEGACY-${Date.now()}`,
        filename: legacy.batches?.[0]?.filename || 'Migrated legacy localStorage historical results',
        importedAt: legacy.batches?.[0]?.importedAt || new Date().toISOString(),
        importedBy: legacy.batches?.[0]?.importedBy || '',
        termsIncluded: [...new Set(records.map(record => record.termCode).filter(Boolean))].sort(),
        recordsAdded: records.length,
        validationStatus: 'VALID',
        validationWarnings: ['Migrated from legacy localStorage payload.'],
        importAction: 'legacy-migration',
        modelVersion: MODEL_VERSION
      };
      await saveImportBatch(batch, records);
      const count = await getRecordCount();
      if (count >= records.length) {
        storage.removeItem(STORAGE_KEY);
        const tx = active.transaction('metadata', 'readwrite');
        putMetadata(tx.objectStore('metadata'), 'legacyMigrationStatus', 'complete');
        await transactionPromise(tx);
        migrationStatus = 'complete';
      } else {
        migrationStatus = 'verification-failed-preserved';
      }
    }

    return {
      initialize,
      getAllRecords,
      getRecordsByTerm,
      getRecordsByTerms,
      getRecordsBySubject: subject => getByIndex('subject', normalizeSubject(subject)),
      getRecordsByCourse: course => getByIndex('courseKey', clean(course).toUpperCase()),
      getRecordsByAttendanceMethod: attendance => getByIndex('attendanceMethod', normalizeAttendanceMethod(attendance)),
      getRecordCount,
      saveImportBatch,
      replaceTerms,
      commitImport,
      previewDifferences,
      deleteImportBatch,
      getImportBatches,
      getImportBatch,
      getPersistedModel,
      saveModelAggregates,
      clearModelAggregates,
      clearAll,
      load,
      exportBackup,
      storageDiagnostics,
      databaseName: DB_NAME,
      databaseVersion: DB_VERSION
    };
  }

  function normalizeBlock(block, header, context, diagnostics) {
    const parent = block[0];
    const childRows = block.slice(1).filter(item => !hasIdentity(item.row) && (rowHasAnyFtes(item.row, header.termColumns) || numberValue(item.row.censusEnrollment) != null));
    const sourceRows = childRows.length ? childRows.map(item => ({ ...item, row: inheritRow(parent.row, item.row), detail: 'child-detail-inherited' })) : [{ ...parent, detail: 'explicit' }];
    if (childRows.length) diagnostics.parentRows += 1;
    sourceRows.forEach(item => {
      const row = item.row;
      if (!hasIdentity(row) && !rowHasAnyFtes(row, header.termColumns) && numberValue(row.censusEnrollment) == null) {
        diagnostics.excludedRows += 1;
        return;
      }
      if (!clean(row.crn)) diagnostics.missingCrnRows += 1;
      if (numberValue(row.censusEnrollment) == null) diagnostics.missingEnrollmentRows += 1;
      const termValues = termFtesValues(row, header.termColumns);
      termValues.forEach(termValue => {
        if (termValue.hasNumericFtes) {
          diagnostics.rawTermFtesTotalsMap[termValue.termCode] ||= 0;
          diagnostics.rawTermFtesTotalsMap[termValue.termCode] += termValue.ftes;
        }
      });
      const populatedTermValues = termValues.filter(termValue => termValue.hasMeaningfulFtes);
      diagnostics.sourceRowsWithPopulatedFtes += populatedTermValues.length ? 1 : 0;
      diagnostics.zeroOrBlankFtesCells += termValues.length - populatedTermValues.length;
      if (numberValue(row.censusEnrollment) != null && populatedTermValues.length === header.termColumns.length && header.termColumns.length > 1) {
        diagnostics.rowsWithEnrollmentAllDetectedTerms += 1;
      }
      termValues.forEach(termValue => {
        if (!termValue.hasMeaningfulFtes) {
          if (termValue.hasNumericFtes && termValue.ftes === 0) diagnostics.zeroFtesRows += 1;
          return;
        }
        const hasUsefulIdentity = hasIdentity(row) || numberValue(row.censusEnrollment) != null;
        if (!hasUsefulIdentity) return;
        const record = makeRecord(row, termValue.termCode, termValue.ftes, {
          ...context,
          sourceRowNumber: item.sourceRowNumber,
          hierarchyRole: childRows.length ? 'child' : 'explicit',
          detailClassification: item.detail,
          validationStatus: 'VALID'
        });
        record.recordIdentity = stableRecordIdentity(record);
        if (item.detail === 'child-detail-inherited') diagnostics.inheritedCrnRows += clean(record.crn) ? 1 : 0;
        else if (clean(record.crn)) diagnostics.explicitCrnRows += 1;
        diagnostics.normalizedRecords += 1;
        diagnostics.terms.add(record.termCode);
        diagnostics.subjects.add(record.subject);
        diagnostics.courses.add(record.courseKey);
        diagnostics.attendanceMethods.add(record.attendanceMethod);
        diagnostics.uniqueCrns.add(record.crn);
        recordsPush(diagnostics.records, record);
      });
    });
  }

  function recordsPush(records, record) {
    records.push(record);
  }

  function inspectWorkbookTable(table = [], options = {}) {
    const header = detectHeaderRow(table);
    const ftesTolerance = reconciliationTolerance(options);
    const diagnostics = {
      filename: options.filename || '',
      worksheet: options.worksheet || '',
      reconciliationTolerance: ftesTolerance,
      headerRow: header.rowIndex >= 0 ? header.rowIndex + 1 : null,
      termHeaderRow: header.termHeaderRowIndex >= 0 && header.termColumns.length ? header.termHeaderRowIndex + 1 : null,
      detectedHeaders: header.headers.filter(Boolean),
      detectedTerms: header.termColumns.map(term => term.header),
      detectedFtesColumns: header.termColumns.map(term => ({
        termCode: term.header,
        column: term.index + 1,
        measureHeader: term.measureHeader || term.header
      })),
      requiredFields: REQUIRED_FIELDS,
      missingRequiredFields: REQUIRED_FIELDS.filter(field => header.columnMap[field] == null),
      ambiguousColumns: header.ambiguities,
      rawRows: Math.max(0, (table || []).length - (header.rowIndex + 1)),
      normalizedRecords: 0,
      explicitCrnRows: 0,
      inheritedCrnRows: 0,
      parentRows: 0,
      childDetailRows: 0,
      excludedRows: 0,
      ambiguousRows: 0,
      zeroFtesRows: 0,
      zeroOrBlankFtesCells: 0,
      recordsFromZeroOrBlankFtesCells: 0,
      sourceRowsWithPopulatedFtes: 0,
      rowsWithEnrollmentAllDetectedTerms: 0,
      rowsWithEnrollmentCopiedToUnpopulatedTerms: 0,
      missingEnrollmentRows: 0,
      missingCrnRows: 0,
      terms: new Set(),
      subjects: new Set(),
      courses: new Set(),
      attendanceMethods: new Set(),
      uniqueCrns: new Set(),
      records: [],
      errors: [],
      warnings: []
    };
    diagnostics.rawTermFtesTotalsMap = {};
    header.termColumns.forEach(term => { diagnostics.rawTermFtesTotalsMap[term.header] = 0; });
    if (header.rowIndex < 0) diagnostics.errors.push('Missing header row.');
    if (!header.termColumns.length) diagnostics.errors.push('No term-specific FTES columns were detected.');
    diagnostics.missingRequiredFields.forEach(field => diagnostics.errors.push(`Missing required column: ${field}.`));
    header.ambiguities.forEach(item => diagnostics.errors.push(`Ambiguous column mapping for ${item.field}: ${item.columns.join(', ')}.`));
    if (diagnostics.errors.length) return finalizePreview(diagnostics, []);

    const importBatchId = options.importBatchId || `HIR-${Date.now()}`;
    const importedAt = options.importedAt || new Date().toISOString();
    const rows = (table || []).slice(header.rowIndex + 1).map((values, index) => ({
      row: rowObject(values, header),
      sourceRowNumber: header.rowIndex + index + 2
    }));
    const blocks = [];
    let block = null;
    rows.forEach(item => {
      const identity = hasIdentity(item.row);
      const meaningful = identity || rowHasAnyFtes(item.row, header.termColumns) || numberValue(item.row.censusEnrollment) != null;
      if (!meaningful) {
        diagnostics.excludedRows += 1;
        return;
      }
      if (identity || !block) {
        if (block) blocks.push(block);
        block = [item];
      } else {
        diagnostics.childDetailRows += 1;
        block.push(item);
      }
    });
    if (block) blocks.push(block);
    blocks.forEach(items => normalizeBlock(items, header, {
      originalFilename: options.filename || '',
      importBatchId,
      importedAt
    }, diagnostics));
    diagnostics.rawTermFtesTotals = Object.entries(diagnostics.rawTermFtesTotalsMap)
      .map(([termCode, finalInstitutionalFtes]) => ({ termCode, finalInstitutionalFtes: round(finalInstitutionalFtes) }))
      .sort((a, b) => a.termCode.localeCompare(b.termCode));
    validatePreviewDiagnostics(diagnostics, header, { reconciliationTolerance: ftesTolerance });
    return finalizePreview(diagnostics, diagnostics.records);
  }

  function validatePreviewDiagnostics(diagnostics, header, options = {}) {
    const ftesTolerance = reconciliationTolerance(options);
    const detectedTerms = header.termColumns.map(term => term.header);
    const byTerm = recordTotalsByTerm(diagnostics.records, detectedTerms);
    const termTotals = detectedTerms.map(termCode => byTerm[termCode] || { termCode, censusEnrollment: 0, finalInstitutionalFtes: 0, records: 0 });
    const populatedTermTotals = termTotals.filter(term => term.records > 0);
    if (detectedTerms.length > 1 && populatedTermTotals.length === detectedTerms.length && equalNumericSeries(populatedTermTotals.map(term => term.records), 0)) {
      diagnostics.errors.push('Blocking validation: every detected term has the same normalized record count. This usually indicates row-level data were copied across all term columns.');
    }
    if (detectedTerms.length > 1 && populatedTermTotals.length === detectedTerms.length && equalNumericSeries(populatedTermTotals.map(term => term.censusEnrollment))) {
      diagnostics.errors.push('Blocking validation: every detected term has the same normalized census enrollment total. Verify enrollment was not copied across all term columns.');
    }
    if (diagnostics.recordsFromZeroOrBlankFtesCells > diagnostics.normalizedRecords * 0.5) {
      diagnostics.errors.push('Blocking validation: more than 50% of normalized records were generated from zero or blank FTES cells.');
    }
    if (diagnostics.rowsWithEnrollmentCopiedToUnpopulatedTerms > 0) {
      diagnostics.errors.push('Blocking validation: row-level enrollment was copied to detected terms whose Individual FTES cell was blank or zero.');
    }
    const rawByTerm = new Map((diagnostics.rawTermFtesTotals || []).map(item => [item.termCode, item.finalInstitutionalFtes]));
    diagnostics.ftesReconciliation = termTotals.map(term => {
      const sourceFtes = Number(rawByTerm.get(term.termCode) || 0);
      const normalizedFtes = Number(term.finalInstitutionalFtes || 0);
      return {
        termCode: term.termCode,
        sourceFtes: round(sourceFtes),
        normalizedFtes: round(normalizedFtes),
        variance: round(normalizedFtes - sourceFtes),
        tolerance: ftesTolerance,
        status: Math.abs(normalizedFtes - sourceFtes) <= ftesTolerance ? 'Within Tolerance' : 'Blocking Variance'
      };
    });
    diagnostics.ftesReconciliation.forEach(item => {
      if (Math.abs(item.variance) > ftesTolerance) {
        diagnostics.errors.push(`Blocking validation: normalized FTES for ${item.termCode} differs from the raw workbook term-column total by ${item.variance}, exceeding tolerance ${ftesTolerance}.`);
      }
    });
  }

  function finalizePreview(diagnostics, records) {
    const byTerm = recordTotalsByTerm(records, diagnostics.detectedTerms || []);
    return {
      valid: !diagnostics.errors.length,
      records,
      diagnostics: {
        ...diagnostics,
        terms: [...diagnostics.terms].filter(Boolean).sort(),
        subjects: [...diagnostics.subjects].filter(Boolean).sort(),
        courses: [...diagnostics.courses].filter(Boolean).sort(),
        attendanceMethods: [...diagnostics.attendanceMethods].filter(Boolean).sort(),
        uniqueCrns: [...diagnostics.uniqueCrns].filter(Boolean).sort(),
        totalsByTerm: Object.values(byTerm).sort((a, b) => a.termCode.localeCompare(b.termCode)),
        rawTermFtesTotalsMap: undefined,
        records: undefined
      }
    };
  }

  function createRepository(seedStorage = null) {
    function empty() {
      return { version: 1, records: [], batches: [], updatedAt: '' };
    }
    let currentPayload = empty();
    if (seedStorage?.getItem) {
      try {
        const parsed = JSON.parse(seedStorage.getItem(STORAGE_KEY) || 'null');
        if (parsed && Array.isArray(parsed.records)) currentPayload = { ...empty(), ...parsed };
      } catch (_err) {
        currentPayload = empty();
      }
    }
    function load() {
      return { ...currentPayload, records: [...(currentPayload.records || [])], batches: [...(currentPayload.batches || [])] };
    }
    function save(nextPayload) {
      const next = { ...empty(), ...nextPayload, updatedAt: new Date().toISOString() };
      currentPayload = next;
      return next;
    }
    function previewDifferences(records = []) {
      const existing = load().records || [];
      const existingById = new Map(existing.map(record => [record.recordIdentity || stableRecordIdentity(record), record]));
      let added = 0;
      let changedEnrollment = 0;
      let changedFtes = 0;
      let changedAttendanceMethod = 0;
      let changedContactHours = 0;
      records.forEach(record => {
        const prior = existingById.get(record.recordIdentity || stableRecordIdentity(record));
        if (!prior) {
          added += 1;
          return;
        }
        if (Number(prior.censusEnrollment || 0) !== Number(record.censusEnrollment || 0)) changedEnrollment += 1;
        if (Number(prior.finalInstitutionalFtes || 0) !== Number(record.finalInstitutionalFtes || 0)) changedFtes += 1;
        if ((prior.attendanceMethod || '') !== (record.attendanceMethod || '')) changedAttendanceMethod += 1;
        if (Number(prior.studentContactHours || 0) !== Number(record.studentContactHours || 0)) changedContactHours += 1;
      });
      const newTerms = new Set(records.map(record => record.termCode));
      return {
        existingRecordCount: existing.length,
        newRecordCount: records.length,
        addedRecords: added,
        removedRecords: existing.filter(record => newTerms.has(record.termCode) && !records.some(next => (next.recordIdentity || stableRecordIdentity(next)) === (record.recordIdentity || stableRecordIdentity(record)))).length,
        changedEnrollment,
        changedFtes,
        changedAttendanceMethod,
        changedContactHours,
        changedSectionIdentity: added
      };
    }
    function commitImport(preview, options = {}) {
      if (!preview?.valid) throw new Error('Historical Institutional Results import contains blocking validation errors.');
      const ftesTolerance = reconciliationTolerance({ reconciliationTolerance: preview.diagnostics?.reconciliationTolerance });
      const blockingReconciliation = (preview.diagnostics?.ftesReconciliation || []).filter(item => Math.abs(Number(item.variance || 0)) > ftesTolerance);
      if (blockingReconciliation.length) {
        throw new Error(`Historical Institutional Results import has FTES reconciliation variance beyond tolerance: ${blockingReconciliation.map(item => `${item.termCode} ${item.variance}`).join(', ')}.`);
      }
      const mode = options.mode || 'replace-selected-terms';
      const payload = load();
      const records = (preview.records || []).map(record => ({ ...record, recordIdentity: record.recordIdentity || stableRecordIdentity(record) }));
      const terms = [...new Set(records.map(record => record.termCode))];
      let nextRecords = payload.records || [];
      if (mode === 'cancel') return payload;
      if (mode === 'skip-existing-terms') {
        const existingTerms = new Set(nextRecords.map(record => record.termCode));
        nextRecords = [...nextRecords, ...records.filter(record => !existingTerms.has(record.termCode))];
      } else if (mode === 'new-terms-only') {
        const existingTerms = new Set(nextRecords.map(record => record.termCode));
        nextRecords = [...nextRecords, ...records.filter(record => !existingTerms.has(record.termCode))];
      } else {
        const replaceTerms = new Set(options.terms?.length ? options.terms.map(normalizeTermCode) : terms);
        nextRecords = nextRecords.filter(record => !replaceTerms.has(record.termCode)).concat(records.filter(record => replaceTerms.has(record.termCode)));
      }
      const batch = {
        importBatchId: records[0]?.importBatchId || `HIR-${Date.now()}`,
        filename: preview.diagnostics?.filename || records[0]?.originalFilename || '',
        importedBy: options.importedBy || '',
        importedAt: records[0]?.importedAt || new Date().toISOString(),
        termsIncluded: terms,
        recordsAdded: records.length,
        recordsReplaced: (payload.records || []).filter(record => terms.includes(record.termCode)).length,
        recordsExcluded: preview.diagnostics?.excludedRows || 0,
        validationWarnings: preview.diagnostics?.warnings || [],
        validationStatus: preview.valid ? 'VALID' : 'ERROR',
        totalsByTerm: preview.diagnostics?.totalsByTerm || []
      };
      return save({ ...payload, records: nextRecords, batches: [...(payload.batches || []), batch] });
    }
    return { load, save, previewDifferences, commitImport, storageKey: STORAGE_KEY };
  }

  function groupKey(level, record) {
    const season = record.season || termSeason(record.termCode);
    const attendance = normalizeAttendanceMethod(record.attendanceMethod);
    if (level === 'course') return [season, attendance, record.courseKey].join('|');
    if (level === 'subject') return [season, attendance, record.subject].join('|');
    if (level === 'division') return [season, attendance, record.division].join('|');
    if (level === 'attendanceMethod') return [season, attendance].join('|');
    return [season || 'ALL'].join('|');
  }

  function recordYield(record) {
    return record.censusEnrollment ? Number(record.finalInstitutionalFtes || 0) / Number(record.censusEnrollment || 0) : null;
  }

  function statsForRecords(records = [], level = 'institution', key = '') {
    const eligible = records.filter(record => record.sourceQuality === SOURCE_QUALITY && Number(record.censusEnrollment || 0) > 0 && Number.isFinite(Number(record.finalInstitutionalFtes)));
    const yields = eligible.map(recordYield).filter(Number.isFinite);
    const enrollment = eligible.reduce((sum, record) => sum + Number(record.censusEnrollment || 0), 0);
    const ftes = eligible.reduce((sum, record) => sum + Number(record.finalInstitutionalFtes || 0), 0);
    const weightedYield = enrollment ? ftes / enrollment : null;
    const sd = standardDeviation(yields);
    const avg = average(yields);
    const terms = [...new Set(eligible.map(record => record.termCode))].sort();
    return {
      modelLevel: level,
      groupKey: key,
      observationCount: eligible.length,
      distinctTerms: terms.length,
      terms,
      totalCensusEnrollment: round(enrollment, 3),
      totalInstitutionalFtes: round(ftes, 3),
      weightedYield: round(weightedYield),
      simpleAverageYield: round(avg),
      medianYield: round(median(yields)),
      minimumYield: round(yields.length ? Math.min(...yields) : null),
      maximumYield: round(yields.length ? Math.max(...yields) : null),
      standardDeviation: round(sd),
      coefficientOfVariation: avg ? round(sd / avg) : null,
      mostRecentTerm: terms[terms.length - 1] || '',
      oldestTerm: terms[0] || '',
      dataCoverage: eligible.length ? 'FINAL_INSTITUTIONAL_ACTUAL' : 'INSUFFICIENT',
      backtesting: null,
      confidence: 'INSUFFICIENT_DATA'
    };
  }

  function backtestRecords(records = [], level = 'institution', key = '') {
    const terms = [...new Set(records.map(record => record.termCode))].sort();
    const rows = [];
    terms.forEach(testTerm => {
      const actualRows = records.filter(record => record.termCode === testTerm);
      const trainingRows = records.filter(record => record.termCode < testTerm);
      const training = statsForRecords(trainingRows, level, key);
      const actualEnrollment = actualRows.reduce((sum, record) => sum + Number(record.censusEnrollment || 0), 0);
      const actualFtes = actualRows.reduce((sum, record) => sum + Number(record.finalInstitutionalFtes || 0), 0);
      if (!actualEnrollment || training.weightedYield == null || training.distinctTerms < 2) return;
      const predictedFtes = actualEnrollment * training.weightedYield;
      const error = predictedFtes - actualFtes;
      rows.push({
        testTerm,
        modelLevel: level,
        groupKey: key,
        predictedFtes: round(predictedFtes, 3),
        actualFtes: round(actualFtes, 3),
        signedError: round(error, 3),
        absoluteError: round(Math.abs(error), 3),
        percentError: actualFtes ? round(Math.abs(error) / Math.abs(actualFtes)) : null,
        bias: actualFtes ? round(error / Math.abs(actualFtes)) : null,
        supportingTerms: training.terms.join('; ')
      });
    });
    const absErrors = rows.map(row => row.absoluteError).filter(Number.isFinite);
    const signedErrors = rows.map(row => row.signedError).filter(Number.isFinite);
    const actualTotal = rows.reduce((sum, row) => sum + Number(row.actualFtes || 0), 0);
    const absoluteTotal = rows.reduce((sum, row) => sum + Number(row.absoluteError || 0), 0);
    return {
      rows,
      validBacktests: rows.length,
      meanAbsoluteError: round(average(absErrors), 3),
      rmse: round(Math.sqrt(average(absErrors.map(value => value ** 2)) || 0), 3),
      bias: round(average(signedErrors), 3),
      weightedAbsolutePercentageError: actualTotal ? round(absoluteTotal / Math.abs(actualTotal)) : null,
      coverageRate: terms.length ? round(rows.length / terms.length) : null
    };
  }

  function classifyConfidence(stats = {}) {
    if (!stats.observationCount || !stats.distinctTerms || stats.weightedYield == null) return 'INSUFFICIENT_DATA';
    const wape = stats.backtesting?.weightedAbsolutePercentageError;
    const bias = Math.abs(stats.backtesting?.bias || 0) / Math.max(1, Math.abs(stats.totalInstitutionalFtes || 0));
    if ((stats.coefficientOfVariation || 0) > MODEL_THRESHOLDS.maxHighVarianceCv || (wape != null && wape > MODEL_THRESHOLDS.maxHighVarianceWape)) return 'HIGH_VARIANCE';
    if (stats.distinctTerms >= MODEL_THRESHOLDS.high.minTerms &&
      stats.totalCensusEnrollment >= MODEL_THRESHOLDS.high.minEnrollment &&
      (stats.coefficientOfVariation || 0) <= MODEL_THRESHOLDS.high.maxCv &&
      (wape == null || wape <= MODEL_THRESHOLDS.high.maxWape) &&
      bias <= MODEL_THRESHOLDS.high.maxBias) return 'HIGH';
    if (stats.distinctTerms >= MODEL_THRESHOLDS.medium.minTerms &&
      stats.totalCensusEnrollment >= MODEL_THRESHOLDS.medium.minEnrollment &&
      (stats.coefficientOfVariation || 0) <= MODEL_THRESHOLDS.medium.maxCv &&
      (wape == null || wape <= MODEL_THRESHOLDS.medium.maxWape) &&
      bias <= MODEL_THRESHOLDS.medium.maxBias) return 'MEDIUM';
    if (stats.distinctTerms >= MODEL_THRESHOLDS.low.minTerms && stats.totalCensusEnrollment >= MODEL_THRESHOLDS.low.minEnrollment) return 'LOW';
    return 'INSUFFICIENT_DATA';
  }

  function buildYieldModel(records = []) {
    const eligible = (records || []).filter(record => record.sourceQuality === SOURCE_QUALITY);
    const levels = ['course', 'subject', 'division', 'attendanceMethod', 'institution'];
    const groups = [];
    levels.forEach(level => {
      const map = new Map();
      eligible.forEach(record => {
        const key = groupKey(level, record);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(record);
      });
      map.forEach((groupRows, key) => {
        const stats = statsForRecords(groupRows, level, key);
        stats.backtesting = backtestRecords(groupRows, level, key);
        stats.confidence = classifyConfidence(stats);
        groups.push(stats);
      });
    });
    return {
      modelVersion: MODEL_VERSION,
      builtAt: new Date().toISOString(),
      records: eligible.length,
      groups,
      backtests: groups.flatMap(group => (group.backtesting?.rows || []).map(row => ({ ...row, confidence: group.confidence })))
    };
  }

  function currentSectionEnrollment(row = {}) {
    return numberValue(row.censusEnrollment ?? row.census ?? row.actual ?? row.currentEnrollment ?? row.enrollment ?? row.ACTUAL_ENROLL) || 0;
  }

  function currentSectionTermCode(row = {}) {
    const raw = row.termCode || row.term || row.Term || '';
    return seasonYearTermCode(raw) || normalizeTermCode(raw);
  }

  function firstPresent(...values) {
    return values.find(value => clean(value));
  }

  function currentSectionAttendance(row = {}) {
    const raw = firstPresent(
      row.attendanceAccountingCode,
      row.accountingMethod,
      row.ACCOUNTING_METHOD,
      row['Accounting Method'],
      row.attendanceMethod,
      row.accountingMethodLabel,
      row['Attendance Method'],
      row.ACAM
    );
    return normalizeAttendanceMethod(raw || '', row);
  }

  function attendanceAliasesForSection(row = {}) {
    const primary = currentSectionAttendance(row);
    const aliases = [];
    const add = value => {
      const normalized = normalizeAttendanceMethod(value, row);
      if (normalized && !aliases.includes(normalized)) aliases.push(normalized);
    };
    add(primary);
    if (isWorkExperienceIdentity(row)) {
      ['WORK EXPERIENCE', 'WE', 'I', 'D'].forEach(add);
    }
    return aliases;
  }

  function candidateKeysForSection(row = {}) {
    const term = currentSectionTermCode(row);
    const season = row.season || termSeason(term);
    const subject = normalizeSubject(row.subject || row.Subject || '');
    const course = stableCourseKeyForRow(row);
    const division = clean(row.division || row.Division || '');
    const candidates = [];
    const add = candidate => {
      const key = `${candidate.modelLevel}:${candidate.groupKey}`;
      if (!candidates.some(item => `${item.modelLevel}:${item.groupKey}` === key)) candidates.push(candidate);
    };
    const aliases = attendanceAliasesForSection(row);
    aliases.forEach(attendance => {
      if (course) add({ modelLevel: 'course', groupKey: [season, attendance, course].join('|'), attendanceMethod: attendance });
    });
    aliases.forEach(attendance => {
      if (subject) add({ modelLevel: 'subject', groupKey: [season, attendance, subject].join('|'), attendanceMethod: attendance });
    });
    aliases.forEach(attendance => {
      if (division) add({ modelLevel: 'division', groupKey: [season, attendance, division].join('|'), attendanceMethod: attendance });
    });
    aliases.forEach(attendance => {
      if (attendance) add({ modelLevel: 'attendanceMethod', groupKey: [season, attendance].join('|'), attendanceMethod: attendance });
    });
    add({ modelLevel: 'institution', groupKey: [season || 'ALL'].join('|'), attendanceMethod: '' });
    return candidates;
  }

  function predictionDiagnosticsForSection(row = {}, model = {}) {
    const groups = new Map((model.groups || []).map(group => [`${group.modelLevel}:${group.groupKey}`, group]));
    const attendance = currentSectionAttendance(row);
    const enrollment = currentSectionEnrollment(row);
    const candidates = candidateKeysForSection(row);
    const matchCounts = {
      course: 0,
      subject: 0,
      division: 0,
      attendanceMethod: 0,
      institution: 0
    };
    candidates.forEach(candidate => {
      const group = groups.get(`${candidate.modelLevel}:${candidate.groupKey}`);
      if (group && group.confidence !== 'INSUFFICIENT_DATA') matchCounts[candidate.modelLevel] = (matchCounts[candidate.modelLevel] || 0) + 1;
    });
    const eligible = ELIGIBLE_PENDING_ATTENDANCE.has(attendance) || isWorkExperienceIdentity(row);
    return {
      currentCrn: clean(row.crn || row.CRN),
      subject: normalizeSubject(row.subject || row.Subject),
      courseNumber: normalizeCourse(row.courseNumber || row.course || row.Course),
      normalizedCourseKey: stableCourseKeyForRow(row),
      rawAttendanceMethod: clean(firstPresent(row.attendanceAccountingCode, row.accountingMethod, row.ACCOUNTING_METHOD, row['Accounting Method'], row.attendanceMethod, row.accountingMethodLabel, row['Attendance Method'], row.ACAM) || ''),
      normalizedAttendanceMethod: attendance,
      currentEnrollment: enrollment,
      predictionEligibility: eligible,
      repositoryModelReadiness: (model.groups || []).length ? 'ready' : 'unavailable-or-empty',
      courseLevelMatchCount: matchCounts.course || 0,
      subjectLevelMatchCount: matchCounts.subject || 0,
      divisionLevelMatchCount: matchCounts.division || 0,
      attendanceMethodMatchCount: matchCounts.attendanceMethod || 0,
      institutionLevelMatchCount: matchCounts.institution || 0,
      selectedFallbackLevel: '',
      failureReason: '',
      attendanceMethodAliases: attendanceAliasesForSection(row).join('; '),
      candidates
    };
  }

  function estimateRange(estimate, stats = {}) {
    const variation = Math.max(stats.coefficientOfVariation || 0, stats.backtesting?.weightedAbsolutePercentageError || 0, 0.1);
    const margin = estimate * Math.min(0.5, variation);
    return {
      lowerEstimate: round(Math.max(0, estimate - margin), 3),
      upperEstimate: round(estimate + margin, 3)
    };
  }

  function estimatePendingSection(row = {}, model = buildYieldModel([]), options = {}) {
    const attendance = currentSectionAttendance(row);
    const diagnostics = predictionDiagnosticsForSection(row, model);
    if (!ELIGIBLE_PENDING_ATTENDANCE.has(attendance) && !isWorkExperienceIdentity(row) && !options.allowAllAttendanceMethods) {
      diagnostics.failureReason = 'Attendance population is not configured for historical pending FTES estimation.';
      return { estimated: false, confidence: 'INSUFFICIENT_DATA', reason: diagnostics.failureReason, predictionDiagnostics: diagnostics };
    }
    const enrollment = currentSectionEnrollment(row);
    const groups = new Map((model.groups || []).map(group => [`${group.modelLevel}:${group.groupKey}`, group]));
    const rejected = [];
    let selected = null;
    diagnostics.candidates.some(candidate => {
      const group = groups.get(`${candidate.modelLevel}:${candidate.groupKey}`);
      if (!group) {
        rejected.push({ ...candidate, reason: 'No comparable final institutional history.' });
        return false;
      }
      if (group.confidence === 'INSUFFICIENT_DATA') {
        rejected.push({ ...candidate, reason: 'Insufficient comparable terms, enrollment volume, or final observations.' });
        return false;
      }
      selected = group;
      diagnostics.selectedFallbackLevel = selected.modelLevel;
      return true;
    });
    if (!selected || !enrollment) {
      diagnostics.failureReason = !enrollment ? 'Current census enrollment is unavailable.' : 'No acceptable historical basis was available.';
      return {
        estimated: false,
        termCode: currentSectionTermCode(row),
        crn: clean(row.crn || row.CRN),
        subject: normalizeSubject(row.subject || row.Subject),
        courseNumber: normalizeCourse(row.courseNumber || row.course || row.Course),
        attendanceMethod: attendance,
        currentEnrollment: enrollment,
        confidence: 'INSUFFICIENT_DATA',
        reason: diagnostics.failureReason,
        rejectedCandidateLevels: rejected,
        modelVersion: model.modelVersion || MODEL_VERSION,
        predictionDiagnostics: diagnostics
      };
    }
    const estimatedFtes = enrollment * selected.weightedYield;
    const range = estimateRange(estimatedFtes, selected);
    return {
      estimated: true,
      termCode: currentSectionTermCode(row),
      crn: clean(row.crn || row.CRN),
      subject: normalizeSubject(row.subject || row.Subject),
      courseNumber: normalizeCourse(row.courseNumber || row.course || row.Course),
      attendanceMethod: attendance,
      currentEnrollment: enrollment,
      historicalBasisLevel: selected.modelLevel,
      historicalGroupKey: selected.groupKey,
      historicalTermsUsed: selected.terms.join('; '),
      historicalRecordsUsed: selected.observationCount,
      historicalEnrollment: selected.totalCensusEnrollment,
      historicalFtes: selected.totalInstitutionalFtes,
      weightedHistoricalYield: selected.weightedYield,
      estimatedFtes: round(estimatedFtes, 3),
      ...range,
      confidence: selected.confidence,
      backtestingError: selected.backtesting?.weightedAbsolutePercentageError,
      fallbackReason: rejected.length ? `${rejected[rejected.length - 1].modelLevel} rejected before selecting ${selected.modelLevel}.` : '',
      selectedReason: `${selected.modelLevel} history selected from ${selected.distinctTerms} comparable completed term(s).`,
      rejectedCandidateLevels: rejected,
      modelVersion: model.modelVersion || MODEL_VERSION,
      predictionDiagnostics: diagnostics,
      explanation: explainEstimate(row, selected, estimatedFtes, range)
    };
  }

  function explainEstimate(row = {}, selected = {}, estimatedFtes = 0, range = {}) {
    const enrollment = currentSectionEnrollment(row);
    return [
      `TIMBER used ${selected.modelLevel || 'historical'} final institutional history.`,
      `Comparable terms: ${(selected.terms || []).join(', ') || 'none'}.`,
      `Historical census enrollment: ${selected.totalCensusEnrollment || 0}.`,
      `Historical institutional FTES: ${selected.totalInstitutionalFtes || 0}.`,
      `Weighted historical yield: ${selected.weightedYield || 0} FTES per census enrollment.`,
      `Calculation: ${enrollment} x ${selected.weightedYield || 0} = ${round(estimatedFtes, 3)} FTES.`,
      `Historical estimate range: ${range.lowerEstimate ?? ''} to ${range.upperEstimate ?? ''}.`,
      `Backtesting weighted error: ${selected.backtesting?.weightedAbsolutePercentageError ?? 'not enough completed terms'}.`
    ].join(' ');
  }

  function estimatePendingRows(rows = [], records = []) {
    const model = buildYieldModel(records);
    return (rows || []).map(row => estimatePendingSection(row, model)).filter(result => result.estimated || result.confidence === 'INSUFFICIENT_DATA');
  }

  function modelHealth(estimates = [], model = {}) {
    const byBasis = {};
    const byConfidence = {};
    estimates.forEach(row => {
      byBasis[row.historicalBasisLevel || 'insufficient'] = (byBasis[row.historicalBasisLevel || 'insufficient'] || 0) + 1;
      byConfidence[row.confidence || 'INSUFFICIENT_DATA'] = (byConfidence[row.confidence || 'INSUFFICIENT_DATA'] || 0) + 1;
    });
    const backtests = (model.backtests || []).filter(row => row.percentError != null);
    return {
      estimates: estimates.length,
      byBasis,
      byConfidence,
      weightedBacktestingError: round(average(backtests.map(row => row.percentError))),
      modelBias: round(average(backtests.map(row => row.bias).filter(Number.isFinite))),
      historicalDataFreshness: model.groups?.length ? model.groups.map(group => group.mostRecentTerm).sort().pop() : '',
      weakCoverage: Object.entries(byConfidence).filter(([key]) => ['LOW', 'HIGH_VARIANCE', 'INSUFFICIENT_DATA'].includes(key)).map(([key, count]) => `${key}: ${count}`)
    };
  }

  function exportHistoricalRecords(records = []) {
    return records.map(record => ({ ...record }));
  }

  function exportYieldModel(model = {}) {
    return (model.groups || []).map(group => ({
      modelLevel: group.modelLevel,
      groupKey: group.groupKey,
      terms: group.terms.join('; '),
      observations: group.observationCount,
      enrollment: group.totalCensusEnrollment,
      ftes: group.totalInstitutionalFtes,
      weightedYield: group.weightedYield,
      variation: group.coefficientOfVariation,
      backtestingPerformance: group.backtesting?.weightedAbsolutePercentageError,
      confidence: group.confidence
    }));
  }

  return Object.freeze({
    STORAGE_KEY,
    DB_NAME,
    DB_VERSION,
    MODEL_VERSION,
    SOURCE,
    SOURCE_QUALITY,
    HEADER_ALIASES,
    DEFAULT_RECONCILIATION_TOLERANCE,
    MODEL_THRESHOLDS,
    detectHeaderRow,
    inspectWorkbookTable,
    normalizeTermCode,
    seasonYearTermCode,
    courseKey,
    stableCourseKeyForRow,
    normalizeAttendanceMethod,
    isWorkExperienceIdentity,
    termSeason,
    stableRecordIdentity,
    stableRecordId,
    sourceDataVersion,
    createIndexedDbRepository,
    createRepository,
    buildYieldModel,
    backtestRecords,
    predictionDiagnosticsForSection,
    estimatePendingSection,
    estimatePendingRows,
    modelHealth,
    exportHistoricalRecords,
    exportYieldModel
  });
});
