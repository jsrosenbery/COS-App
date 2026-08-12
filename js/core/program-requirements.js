(function (root, factory) {
  const api = factory();
  root.COSProgramRequirements = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DB_NAME = 'timber-program-requirements';
  const STORE_PROGRAMS = 'academicPrograms';
  const STORE_BATCHES = 'programImportBatches';
  const STORE_METADATA = 'programMetadata';
  const STORE_CATALOG_SOURCES = 'catalogSources';
  const STORE_CATALOG_PAGES = 'catalogPages';
  const STORE_CATALOG_CANDIDATES = 'catalogProgramCandidates';
  const STORE_CATALOG_DETAILS = 'catalogRequirementDetails';
  const STORE_CATALOG_DECISIONS = 'catalogReviewDecisions';
  const STORE_PROGRAM_REVISIONS = 'programRequirementRevisions';
  const STORE_PROGRAM_ACTIVE_POINTERS = 'programActiveRevisionPointers';
  const STORE_PROGRAM_REVIEW_HISTORY = 'programReviewHistory';
  const DB_VERSION = 5;
  const VALID_GROUP_RULES = new Set(['all', 'choose-count', 'choose-units', 'one-from-each-list', 'or', 'elective']);
  const VALID_REVIEW_STATUSES = new Set(['draft', 'needs-review', 'approved', 'published', 'archived', 'retired']);
  const VALID_SOURCE_TYPES = new Set(['manual', 'json', 'csv', 'catalog-pdf']);

  function compact(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function canon(value) {
    return compact(value).toUpperCase();
  }

  function normalizeCourseKey(value) {
    return canon(value).replace(/[./]/g, '').replace(/\s+/g, ' ');
  }

  function programKey(programId, catalogYear = '') {
    return `${canon(programId)}::${canon(catalogYear)}`;
  }

  function catalogYearSortValue(value) {
    const text = canon(value);
    const years = [...text.matchAll(/20\d{2}/g)].map(match => Number(match[0]));
    if (!years.length) return 0;
    return Math.max(...years);
  }

  function getMostRecentApprovedCatalogYear(programs = []) {
    const years = [...new Set((programs || [])
      .filter(program => program.reviewStatus === 'approved')
      .map(program => compact(program.catalogYear))
      .filter(Boolean))];
    return years.sort((a, b) => catalogYearSortValue(b) - catalogYearSortValue(a) || canon(b).localeCompare(canon(a)))[0] || '';
  }

  function getMostRecentPublishedCatalogYear(programs = []) {
    const years = [...new Set((programs || [])
      .filter(program => program.reviewStatus === 'published' && program.isActiveRevision !== false)
      .map(program => compact(program.catalogYear))
      .filter(Boolean))];
    return years.sort((a, b) => catalogYearSortValue(b) - catalogYearSortValue(a) || canon(b).localeCompare(canon(a)))[0] || '';
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function shortHash(value) {
    const text = JSON.stringify(value ?? null);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function sourceFingerprint(program = {}) {
    return shortHash({
      programId: program.programId,
      catalogYear: program.catalogYear,
      programName: program.programName,
      awardType: program.awardType,
      includeCalGetcRequirements: program.includeCalGetcRequirements === true,
      requirementGroups: program.requirementGroups,
      source: program.source
    });
  }

  function revisionRecord(program = {}, metadata = {}) {
    const normalized = normalizeProgram(program);
    const revisionId = compact(metadata.revisionId || normalized.revisionId) || `revision-${shortHash({ program: normalized, createdAt: metadata.createdAt || Date.now() })}`;
    const record = {
      revisionId,
      programId: normalized.programId,
      catalogYear: normalized.catalogYear,
      previousRevisionId: compact(metadata.previousRevisionId || normalized.previousRevisionId),
      status: normalized.reviewStatus,
      isActive: metadata.isActive === true || normalized.isActiveRevision !== false,
      sourceFingerprint: compact(metadata.sourceFingerprint) || sourceFingerprint(normalized),
      extractionVersion: compact(metadata.extractionVersion || normalized.source?.extractionVersion),
      createdAt: compact(metadata.createdAt) || new Date().toISOString(),
      createdBy: compact(metadata.createdBy),
      reason: compact(metadata.reason),
      programSnapshot: { ...normalized, revisionId, activeRevisionId: revisionId }
    };
    return record;
  }

  function activePointerRecord(revision = {}) {
    return {
      key: programKey(revision.programId, revision.catalogYear),
      programId: revision.programId,
      catalogYear: revision.catalogYear,
      activeRevisionId: revision.revisionId,
      status: revision.status,
      updatedAt: new Date().toISOString()
    };
  }

  function revisionContentFingerprint(revision = {}) {
    const snapshot = revision.programSnapshot || revision.program || revision;
    const normalizedSnapshot = normalizeProgram(snapshot);
    const comparableSnapshot = {
      ...normalizedSnapshot,
      revisionId: '',
      previousRevisionId: '',
      activeRevisionId: '',
      isActiveRevision: true,
      reviewedAt: '',
      publishedAt: '',
      archivedAt: ''
    };
    return shortHash({
      programId: revision.programId || snapshot.programId,
      catalogYear: revision.catalogYear || snapshot.catalogYear,
      status: revision.status || snapshot.reviewStatus,
      sourceFingerprint: revision.sourceFingerprint || sourceFingerprint(normalizedSnapshot),
      programSnapshot: comparableSnapshot
    });
  }

  function matchingRevision(records = [], record = {}) {
    const fingerprint = revisionContentFingerprint(record);
    return records.find(existing => revisionContentFingerprint(existing) === fingerprint) || null;
  }

  function normalizeProgram(program = {}) {
    const normalized = {
      programId: compact(program.programId),
      catalogYear: compact(program.catalogYear),
      programName: compact(program.programName),
      awardType: compact(program.awardType),
      department: compact(program.department),
      division: compact(program.division),
      totalUnitsRequired: numberOrUndefined(program.totalUnitsRequired),
      minimumProgramUnits: numberOrUndefined(program.minimumProgramUnits),
      minimumGrade: program.minimumGrade == null ? null : compact(program.minimumGrade),
      includeCalGetcRequirements: program.includeCalGetcRequirements === true,
      requirementGroups: (program.requirementGroups || []).map(normalizeRequirementGroup),
      source: normalizeSource(program.source),
      reviewStatus: VALID_REVIEW_STATUSES.has(program.reviewStatus) ? program.reviewStatus : 'draft',
      reviewedBy: compact(program.reviewedBy),
      reviewedAt: compact(program.reviewedAt),
      revisionId: compact(program.revisionId),
      previousRevisionId: compact(program.previousRevisionId),
      activeRevisionId: compact(program.activeRevisionId || program.revisionId),
      isActiveRevision: program.isActiveRevision !== false,
      publishedAt: compact(program.publishedAt),
      archivedAt: compact(program.archivedAt)
    };
    normalized.key = programKey(normalized.programId, normalized.catalogYear);
    return normalized;
  }

  function numberOrUndefined(value) {
    if (value == null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function normalizeSource(source = {}) {
    const sourceType = VALID_SOURCE_TYPES.has(source.sourceType) ? source.sourceType : 'manual';
    return {
      sourceType,
      filename: compact(source.filename),
      catalogTitle: compact(source.catalogTitle),
      pageNumbers: Array.isArray(source.pageNumbers) ? source.pageNumbers.map(Number).filter(Number.isFinite) : [],
      originalText: compact(source.originalText),
      importedAt: compact(source.importedAt) || new Date().toISOString()
    };
  }

  function normalizeRequirementGroup(group = {}, index = 0) {
    return {
      groupId: compact(group.groupId) || `group-${index + 1}`,
      label: compact(group.label) || `Requirement Group ${index + 1}`,
      rule: VALID_GROUP_RULES.has(group.rule) ? group.rule : 'all',
      chooseCount: numberOrUndefined(group.chooseCount),
      unitsRequired: numberOrUndefined(group.unitsRequired),
      courses: (group.courses || []).map(normalizeCourseOption).filter(course => course.courseKey),
      subgroups: (group.subgroups || []).map(normalizeRequirementGroup),
      sourceText: compact(group.sourceText),
      pageNumber: numberOrUndefined(group.pageNumber),
      sourceEvidence: Array.isArray(group.sourceEvidence) ? group.sourceEvidence.map(normalizeEvidence).filter(item => item.text || item.pageNumber) : [],
      notes: compact(group.notes)
    };
  }

  function normalizeCourseOption(course = {}) {
    return {
      courseKey: normalizeCourseKey(course.courseKey || course.course || course.label),
      units: numberOrUndefined(course.units),
      minimumGrade: compact(course.minimumGrade),
      prerequisiteCourseKeys: (course.prerequisiteCourseKeys || []).map(normalizeCourseKey).filter(Boolean),
      corequisiteCourseKeys: (course.corequisiteCourseKeys || []).map(normalizeCourseKey).filter(Boolean),
      equivalentCourseKeys: (course.equivalentCourseKeys || []).map(normalizeCourseKey).filter(Boolean),
      recommendedTerm: course.recommendedTerm == null || course.recommendedTerm === '' ? null : Number(course.recommendedTerm),
      sourceCourseKey: compact(course.sourceCourseKey),
      sourceEvidence: Array.isArray(course.sourceEvidence) ? course.sourceEvidence.map(normalizeEvidence).filter(item => item.text || item.pageNumber) : []
    };
  }

  function normalizeEvidence(evidence = {}) {
    return {
      pageNumber: numberOrUndefined(evidence.pageNumber),
      text: compact(evidence.text),
      boundingContext: compact(evidence.boundingContext),
      extractionMethod: compact(evidence.extractionMethod),
      confidence: numberOrUndefined(evidence.confidence)
    };
  }

  function validateProgram(program = {}) {
    const normalized = normalizeProgram(program);
    const errors = [];
    if (!normalized.programId) errors.push('programId is required.');
    if (!normalized.catalogYear) errors.push('catalogYear is required.');
    if (!normalized.programName) errors.push('programName is required.');
    if (!normalized.awardType) errors.push('awardType is required.');
    if (!normalized.requirementGroups.length) errors.push('At least one requirement group is required.');
    normalized.requirementGroups.forEach(group => validateGroup(group, errors, `Requirement group "${group.label}"`));
    return { valid: errors.length === 0, errors, program: normalized };
  }

  function normalizedProgramTitle(value = '') {
    return compact(value).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  function resolveCalGetcRequirements(program = {}, availablePrograms = []) {
    const base = normalizeProgram(program);
    if (!base.includeCalGetcRequirements) return { program: base, included: false, requested: false, sourceProgram: null, warning: '' };
    const expectedTitle = normalizedProgramTitle('Certificate of Achievement in Cal-GETC');
    const candidates = (availablePrograms || [])
      .map(normalizeProgram)
      .filter(item => item.programId !== base.programId
        && normalizedProgramTitle(item.programName) === expectedTitle
        && ['approved', 'published'].includes(String(item.reviewStatus || '').toLowerCase()))
      .sort((left, right) => {
        const leftSameYear = left.catalogYear === base.catalogYear ? 1 : 0;
        const rightSameYear = right.catalogYear === base.catalogYear ? 1 : 0;
        if (leftSameYear !== rightSameYear) return rightSameYear - leftSameYear;
        const yearOrder = catalogYearSortValue(right.catalogYear) - catalogYearSortValue(left.catalogYear);
        if (yearOrder) return yearOrder;
        return Number(right.reviewStatus === 'published') - Number(left.reviewStatus === 'published');
      });
    const sourceProgram = candidates[0] || null;
    if (!sourceProgram) {
      return {
        program: base,
        included: false,
        requested: true,
        sourceProgram: null,
        warning: 'Include CAL-GETC is selected, but no approved or published "Certificate of Achievement in Cal-GETC" could be found.'
      };
    }
    const referencedGroups = sourceProgram.requirementGroups.map(group => ({
      ...group,
      groupId: `cal-getc-${sourceProgram.programId}-${group.groupId}`,
      label: `CAL-GETC: ${group.label}`,
      notes: [group.notes, `Referenced from ${sourceProgram.programName} (${sourceProgram.catalogYear}).`].filter(Boolean).join(' ')
    }));
    return {
      program: {
        ...base,
        requirementGroups: [...base.requirementGroups, ...referencedGroups],
        calGetcRequirementsIncluded: true,
        calGetcSourceProgramId: sourceProgram.programId,
        calGetcSourceProgramName: sourceProgram.programName,
        calGetcSourceCatalogYear: sourceProgram.catalogYear,
        calGetcSourceRevisionId: sourceProgram.activeRevisionId || sourceProgram.revisionId || ''
      },
      included: true,
      requested: true,
      sourceProgram,
      warning: ''
    };
  }

  function validateGroup(group, errors, path) {
    if (!VALID_GROUP_RULES.has(group.rule)) errors.push(`${path} has an unsupported rule.`);
    if ((group.rule === 'choose-count' || group.rule === 'one-from-each-list') && !group.chooseCount && group.rule === 'choose-count') {
      errors.push(`${path} requires chooseCount.`);
    }
    if (group.rule === 'choose-units' && !group.unitsRequired) errors.push(`${path} requires unitsRequired.`);
    if (!group.courses.length && !group.subgroups.length) errors.push(`${path} must contain courses or subgroups.`);
    group.subgroups.forEach(subgroup => validateGroup(subgroup, errors, `${path} > ${subgroup.label}`));
  }

  function parseProgramJson(text, filename = '') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { programs: [], errors: [`Invalid JSON: ${err.message}`] };
    }
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.programs) ? parsed.programs : [parsed];
    const errors = [];
    const programs = [];
    records.forEach((record, index) => {
      const source = { ...(record.source || {}), sourceType: 'json', filename: sourceFilename(record, filename) };
      const result = validateProgram({ ...record, source });
      if (result.valid) programs.push(result.program);
      else errors.push(...result.errors.map(error => `Record ${index + 1}: ${error}`));
    });
    return { programs, errors };
  }

  function sourceFilename(record, fallback) {
    return compact(record?.source?.filename || fallback);
  }

  function createMemoryRepository(initialPrograms = []) {
    const programs = new Map();
    const batches = new Map();
    const metadata = new Map();
    const catalogSources = new Map();
    const catalogPages = new Map();
    const catalogCandidates = new Map();
    const catalogDetails = new Map();
    const catalogDecisions = new Map();
    const revisions = new Map();
    const activePointers = new Map();
    const reviewHistory = new Map();
    function saveRevisionRecord(record) {
      revisions.set(record.revisionId, clone(record));
      const historyKey = `${programKey(record.programId, record.catalogYear)}::${record.revisionId}`;
      reviewHistory.set(historyKey, { ...record, id: historyKey });
      const pointerKey = programKey(record.programId, record.catalogYear);
      if (record.status === 'published') activePointers.set(pointerKey, activePointerRecord(record));
      else if (record.status === 'archived' || record.isActive === false) {
        const pointer = activePointers.get(pointerKey);
        if (pointer?.activeRevisionId === record.revisionId) activePointers.delete(pointerKey);
      }
    }
    initialPrograms.map(normalizeProgram).forEach(program => {
      const revision = revisionRecord(program, { reason: 'Migrated legacy program record.' });
      const snapshot = { ...revision.programSnapshot, isActiveRevision: true, activeRevisionId: revision.revisionId };
      programs.set(snapshot.key, snapshot);
      saveRevisionRecord(revision);
    });
    return {
      async initialize() {},
      async getPrograms() { return [...programs.values()].map(clone); },
      async getProgram(programId, catalogYear = '') {
        const key = catalogYear ? programKey(programId, catalogYear) : [...programs.keys()].find(item => item.startsWith(`${canon(programId)}::`));
        return key && programs.has(key) ? clone(programs.get(key)) : null;
      },
      async saveProgram(program) {
        const result = validateProgram(program);
        if (!result.valid) throw new Error(result.errors.join(' '));
        const prior = programs.get(result.program.key);
        const revision = revisionRecord(result.program, {
          previousRevisionId: prior?.activeRevisionId || prior?.revisionId,
          reason: result.program.reviewStatus === 'published' ? 'Published program revision.' : 'Saved program edit.'
        });
        const snapshot = { ...revision.programSnapshot, isActiveRevision: true, activeRevisionId: revision.revisionId };
        programs.set(snapshot.key, snapshot);
        saveRevisionRecord(revision);
      },
      async savePrograms(records = []) {
        for (const program of records) await this.saveProgram(program);
      },
      async saveImportBatch(batch = {}) {
        const id = compact(batch.id) || `batch-${Date.now()}`;
        const record = { ...clone(batch), id, savedAt: compact(batch.savedAt) || new Date().toISOString() };
        batches.set(id, record);
        return clone(record);
      },
      async getImportBatches() { return [...batches.values()].map(clone); },
      async setMetadata(key, value) {
        const metadataKey = compact(key);
        if (!metadataKey) return;
        metadata.set(metadataKey, { key: metadataKey, value: clone(value), updatedAt: new Date().toISOString() });
      },
      async getMetadata(key) {
        const record = metadata.get(compact(key));
        return record ? clone(record.value) : null;
      },
      async saveCatalogSource(source = {}) {
        const id = compact(source.catalogSourceId) || `catalog-${Date.now()}`;
        const record = { ...clone(source), catalogSourceId: id, savedAt: compact(source.savedAt) || new Date().toISOString() };
        catalogSources.set(id, record);
        return clone(record);
      },
      async getCatalogSources() { return [...catalogSources.values()].map(clone); },
      async saveCatalogPages(catalogSourceId = '', pages = []) {
        const sourceId = compact(catalogSourceId);
        if (!sourceId) throw new Error('catalogSourceId is required for catalog pages.');
        (pages || []).forEach(page => {
          const pageNumber = Number(page.pageNumber || 0);
          catalogPages.set(`${sourceId}::${pageNumber}`, { ...clone(page), catalogSourceId: sourceId, pageNumber });
        });
      },
      async getCatalogPages(catalogSourceId = '') {
        return [...catalogPages.values()].filter(record => !catalogSourceId || record.catalogSourceId === catalogSourceId).sort((a, b) => Number(a.pageNumber) - Number(b.pageNumber)).map(clone);
      },
      async saveCatalogProgramCandidates(records = []) {
        for (const candidate of records) {
          const id = compact(candidate.candidateId) || `candidate-${Date.now()}-${catalogCandidates.size}`;
          catalogCandidates.set(id, { ...clone(candidate), candidateId: id });
        }
      },
      async getCatalogProgramCandidates(catalogSourceId = '') {
        return [...catalogCandidates.values()].filter(record => !catalogSourceId || record.catalogSourceId === catalogSourceId).map(clone);
      },
      async deleteCatalogProgramCandidate(candidateId = '') {
        const id = compact(candidateId);
        if (!id) return false;
        const existed = catalogCandidates.delete(id);
        catalogDetails.delete(id);
        return existed;
      },
      async saveCatalogRequirementDetail(detail = {}) {
        const id = compact(detail.candidateId);
        if (!id) throw new Error('candidateId is required for catalog requirement detail.');
        catalogDetails.set(id, clone(detail));
      },
      async getCatalogRequirementDetail(candidateId) {
        const record = catalogDetails.get(compact(candidateId));
        return record ? clone(record) : null;
      },
      async saveCatalogReviewDecision(decision = {}) {
        const id = compact(decision.id) || `decision-${Date.now()}-${catalogDecisions.size}`;
        const record = { ...clone(decision), id, savedAt: compact(decision.savedAt) || new Date().toISOString() };
        catalogDecisions.set(id, record);
        return clone(record);
      },
      async getCatalogReviewDecisions() { return [...catalogDecisions.values()].map(clone); },
      async saveProgramRequirementRevision(revision = {}) {
        const record = revision.programSnapshot ? clone(revision) : revisionRecord(revision.program || revision.programSnapshot || revision, revision);
        const existing = matchingRevision([...revisions.values()], record);
        if (existing) return clone(existing);
        const id = compact(record.revisionId) || `revision-${Date.now()}-${revisions.size}`;
        record.revisionId = id;
        record.savedAt = compact(record.savedAt) || new Date().toISOString();
        saveRevisionRecord(record);
        return clone(record);
      },
      async getProgramRequirementRevisions(programId = '', catalogYear = '') {
        return [...revisions.values()].filter(record => (!programId || record.programId === programId) && (!catalogYear || record.catalogYear === catalogYear)).map(clone);
      },
      async getProgramActiveRevisionPointers() { return [...activePointers.values()].map(clone); },
      async getProgramReviewHistory(programId = '', catalogYear = '') {
        return [...reviewHistory.values()].filter(record => (!programId || record.programId === programId) && (!catalogYear || record.catalogYear === catalogYear)).map(clone);
      },
      async publishProgramRevision(revisionId, metadata = {}) {
        const revision = revisions.get(compact(revisionId));
        if (!revision) return null;
        const published = { ...clone(revision), status: 'published', isActive: true, publishedAt: new Date().toISOString(), reason: compact(metadata.reason || revision.reason || 'Published revision.') };
        published.programSnapshot = { ...published.programSnapshot, reviewStatus: 'published', publishedAt: published.publishedAt, isActiveRevision: true, activeRevisionId: published.revisionId };
        saveRevisionRecord(published);
        programs.set(published.programSnapshot.key, published.programSnapshot);
        return clone(published);
      },
      async archiveProgramRevision(revisionId, metadata = {}) {
        const revision = revisions.get(compact(revisionId));
        if (!revision) return null;
        const archived = { ...clone(revision), status: 'archived', isActive: false, archivedAt: new Date().toISOString(), reason: compact(metadata.reason || revision.reason || 'Archived revision.') };
        archived.programSnapshot = { ...archived.programSnapshot, reviewStatus: 'archived', archivedAt: archived.archivedAt, isActiveRevision: false };
        saveRevisionRecord(archived);
        return clone(archived);
      },
      async rollbackProgramRevision(revisionId, metadata = {}) {
        const revision = revisions.get(compact(revisionId));
        if (!revision) return null;
        const draft = revisionRecord({ ...revision.programSnapshot, reviewStatus: 'draft' }, {
          previousRevisionId: revision.revisionId,
          createdBy: metadata.createdBy,
          reason: compact(metadata.reason || 'Rollback created as new draft.')
        });
        draft.status = 'draft';
        draft.programSnapshot.reviewStatus = 'draft';
        saveRevisionRecord(draft);
        programs.set(draft.programSnapshot.key, draft.programSnapshot);
        return clone(draft);
      },
      async deleteProgram(programId, catalogYear = '') {
        if (catalogYear) programs.delete(programKey(programId, catalogYear));
        else [...programs.keys()].filter(key => key.startsWith(`${canon(programId)}::`)).forEach(key => programs.delete(key));
      },
      async clearAll() { programs.clear(); batches.clear(); metadata.clear(); catalogSources.clear(); catalogPages.clear(); catalogCandidates.clear(); catalogDetails.clear(); catalogDecisions.clear(); revisions.clear(); activePointers.clear(); reviewHistory.clear(); }
    };
  }

  function createIndexedDbRepository(options = {}) {
    const indexedDBRef = options.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!indexedDBRef) return createMemoryRepository(options.initialPrograms || []);
    let dbPromise = null;

    function openDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDBRef.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_PROGRAMS)) db.createObjectStore(STORE_PROGRAMS, { keyPath: 'key' });
          if (!db.objectStoreNames.contains(STORE_BATCHES)) db.createObjectStore(STORE_BATCHES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_METADATA)) db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
          if (!db.objectStoreNames.contains(STORE_CATALOG_SOURCES)) db.createObjectStore(STORE_CATALOG_SOURCES, { keyPath: 'catalogSourceId' });
          if (!db.objectStoreNames.contains(STORE_CATALOG_PAGES)) db.createObjectStore(STORE_CATALOG_PAGES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_CATALOG_CANDIDATES)) db.createObjectStore(STORE_CATALOG_CANDIDATES, { keyPath: 'candidateId' });
          if (!db.objectStoreNames.contains(STORE_CATALOG_DETAILS)) db.createObjectStore(STORE_CATALOG_DETAILS, { keyPath: 'candidateId' });
          if (!db.objectStoreNames.contains(STORE_CATALOG_DECISIONS)) db.createObjectStore(STORE_CATALOG_DECISIONS, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_PROGRAM_REVISIONS)) db.createObjectStore(STORE_PROGRAM_REVISIONS, { keyPath: 'revisionId' });
          if (!db.objectStoreNames.contains(STORE_PROGRAM_ACTIVE_POINTERS)) db.createObjectStore(STORE_PROGRAM_ACTIVE_POINTERS, { keyPath: 'key' });
          if (!db.objectStoreNames.contains(STORE_PROGRAM_REVIEW_HISTORY)) db.createObjectStore(STORE_PROGRAM_REVIEW_HISTORY, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Program requirements database failed to open.'));
      });
      return dbPromise;
    }

    async function store(mode = 'readonly', storeName = STORE_PROGRAMS) {
      const db = await openDb();
      return db.transaction(storeName, mode).objectStore(storeName);
    }

    function requestPromise(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Program repository request failed.'));
      });
    }

    return {
      async initialize() {
        await openDb();
        await this.migrateLegacyProgramsToRevisions();
      },
      async getPrograms() { return (await requestPromise((await store()).getAll())).map(clone); },
      async getProgram(programId, catalogYear = '') {
        if (catalogYear) {
          const record = await requestPromise((await store()).get(programKey(programId, catalogYear)));
          return record ? clone(record) : null;
        }
        const matches = (await this.getPrograms()).filter(program => canon(program.programId) === canon(programId));
        return matches[0] || null;
      },
      async saveProgram(program) {
        const result = validateProgram(program);
        if (!result.valid) throw new Error(result.errors.join(' '));
        const prior = await requestPromise((await store()).get(result.program.key));
        const revision = revisionRecord(result.program, {
          previousRevisionId: prior?.activeRevisionId || prior?.revisionId,
          reason: result.program.reviewStatus === 'published' ? 'Published program revision.' : 'Saved program edit.'
        });
        const snapshot = { ...revision.programSnapshot, isActiveRevision: true, activeRevisionId: revision.revisionId };
        await requestPromise((await store('readwrite')).put(snapshot));
        await this.saveProgramRequirementRevision(revision);
      },
      async savePrograms(programs = []) {
        for (const program of programs) await this.saveProgram(program);
      },
      async saveImportBatch(batch = {}) {
        const id = compact(batch.id) || `batch-${Date.now()}`;
        const record = { ...clone(batch), id, savedAt: compact(batch.savedAt) || new Date().toISOString() };
        await requestPromise((await store('readwrite', STORE_BATCHES)).put(record));
        return clone(record);
      },
      async getImportBatches() {
        return (await requestPromise((await store('readonly', STORE_BATCHES)).getAll())).map(clone);
      },
      async setMetadata(key, value) {
        const metadataKey = compact(key);
        if (!metadataKey) return;
        await requestPromise((await store('readwrite', STORE_METADATA)).put({ key: metadataKey, value: clone(value), updatedAt: new Date().toISOString() }));
      },
      async getMetadata(key) {
        const record = await requestPromise((await store('readonly', STORE_METADATA)).get(compact(key)));
        return record ? clone(record.value) : null;
      },
      async saveCatalogSource(source = {}) {
        const id = compact(source.catalogSourceId) || `catalog-${Date.now()}`;
        const record = { ...clone(source), catalogSourceId: id, savedAt: compact(source.savedAt) || new Date().toISOString() };
        await requestPromise((await store('readwrite', STORE_CATALOG_SOURCES)).put(record));
        return clone(record);
      },
      async getCatalogSources() {
        return (await requestPromise((await store('readonly', STORE_CATALOG_SOURCES)).getAll())).map(clone);
      },
      async saveCatalogPages(catalogSourceId = '', pages = []) {
        const sourceId = compact(catalogSourceId);
        if (!sourceId) throw new Error('catalogSourceId is required for catalog pages.');
        const pageStore = await store('readwrite', STORE_CATALOG_PAGES);
        for (const page of pages || []) {
          const pageNumber = Number(page.pageNumber || 0);
          await requestPromise(pageStore.put({ ...clone(page), id: `${sourceId}::${pageNumber}`, catalogSourceId: sourceId, pageNumber }));
        }
      },
      async getCatalogPages(catalogSourceId = '') {
        const records = (await requestPromise((await store('readonly', STORE_CATALOG_PAGES)).getAll())).map(clone);
        return records.filter(record => !catalogSourceId || record.catalogSourceId === catalogSourceId).sort((a, b) => Number(a.pageNumber) - Number(b.pageNumber));
      },
      async saveCatalogProgramCandidates(records = []) {
        const catalogStore = await store('readwrite', STORE_CATALOG_CANDIDATES);
        for (const candidate of records) {
          const id = compact(candidate.candidateId) || `candidate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          await requestPromise(catalogStore.put({ ...clone(candidate), candidateId: id }));
        }
      },
      async getCatalogProgramCandidates(catalogSourceId = '') {
        const records = (await requestPromise((await store('readonly', STORE_CATALOG_CANDIDATES)).getAll())).map(clone);
        return records.filter(record => !catalogSourceId || record.catalogSourceId === catalogSourceId);
      },
      async deleteCatalogProgramCandidate(candidateId = '') {
        const id = compact(candidateId);
        if (!id) return false;
        const existing = await requestPromise((await store('readonly', STORE_CATALOG_CANDIDATES)).get(id));
        if (!existing) return false;
        await requestPromise((await store('readwrite', STORE_CATALOG_CANDIDATES)).delete(id));
        await requestPromise((await store('readwrite', STORE_CATALOG_DETAILS)).delete(id));
        return true;
      },
      async saveCatalogRequirementDetail(detail = {}) {
        const id = compact(detail.candidateId);
        if (!id) throw new Error('candidateId is required for catalog requirement detail.');
        await requestPromise((await store('readwrite', STORE_CATALOG_DETAILS)).put(clone(detail)));
      },
      async getCatalogRequirementDetail(candidateId) {
        const record = await requestPromise((await store('readonly', STORE_CATALOG_DETAILS)).get(compact(candidateId)));
        return record ? clone(record) : null;
      },
      async saveCatalogReviewDecision(decision = {}) {
        const id = compact(decision.id) || `decision-${Date.now()}`;
        const record = { ...clone(decision), id, savedAt: compact(decision.savedAt) || new Date().toISOString() };
        await requestPromise((await store('readwrite', STORE_CATALOG_DECISIONS)).put(record));
        return clone(record);
      },
      async getCatalogReviewDecisions() {
        return (await requestPromise((await store('readonly', STORE_CATALOG_DECISIONS)).getAll())).map(clone);
      },
      async saveProgramRequirementRevision(revision = {}) {
        const record = revision.programSnapshot ? clone(revision) : revisionRecord(revision.program || revision.programSnapshot || revision, revision);
        const existing = matchingRevision(await requestPromise((await store('readonly', STORE_PROGRAM_REVISIONS)).getAll()), record);
        if (existing) return clone(existing);
        const id = compact(record.revisionId) || `revision-${Date.now()}`;
        record.revisionId = id;
        record.savedAt = compact(record.savedAt) || new Date().toISOString();
        await requestPromise((await store('readwrite', STORE_PROGRAM_REVISIONS)).put(record));
        await requestPromise((await store('readwrite', STORE_PROGRAM_REVIEW_HISTORY)).put({ ...record, id: `${programKey(record.programId, record.catalogYear)}::${record.revisionId}` }));
        if (record.status === 'published') await requestPromise((await store('readwrite', STORE_PROGRAM_ACTIVE_POINTERS)).put(activePointerRecord(record)));
        else if (record.status === 'archived' || record.isActive === false) {
          const pointerStore = await store('readwrite', STORE_PROGRAM_ACTIVE_POINTERS);
          const pointer = await requestPromise(pointerStore.get(programKey(record.programId, record.catalogYear)));
          if (pointer?.activeRevisionId === record.revisionId) await requestPromise(pointerStore.delete(pointer.key));
        }
        return clone(record);
      },
      async getProgramRequirementRevisions(programId = '', catalogYear = '') {
        const records = (await requestPromise((await store('readonly', STORE_PROGRAM_REVISIONS)).getAll())).map(clone);
        return records.filter(record => (!programId || record.programId === programId) && (!catalogYear || record.catalogYear === catalogYear));
      },
      async getProgramActiveRevisionPointers() {
        return (await requestPromise((await store('readonly', STORE_PROGRAM_ACTIVE_POINTERS)).getAll())).map(clone);
      },
      async getProgramReviewHistory(programId = '', catalogYear = '') {
        const records = (await requestPromise((await store('readonly', STORE_PROGRAM_REVIEW_HISTORY)).getAll())).map(clone);
        return records.filter(record => (!programId || record.programId === programId) && (!catalogYear || record.catalogYear === catalogYear));
      },
      async publishProgramRevision(revisionId, metadata = {}) {
        const revision = await requestPromise((await store('readonly', STORE_PROGRAM_REVISIONS)).get(compact(revisionId)));
        if (!revision) return null;
        const published = { ...clone(revision), status: 'published', isActive: true, publishedAt: new Date().toISOString(), reason: compact(metadata.reason || revision.reason || 'Published revision.') };
        published.programSnapshot = { ...published.programSnapshot, reviewStatus: 'published', publishedAt: published.publishedAt, isActiveRevision: true, activeRevisionId: published.revisionId };
        await this.saveProgramRequirementRevision(published);
        await requestPromise((await store('readwrite')).put(published.programSnapshot));
        return clone(published);
      },
      async archiveProgramRevision(revisionId, metadata = {}) {
        const revision = await requestPromise((await store('readonly', STORE_PROGRAM_REVISIONS)).get(compact(revisionId)));
        if (!revision) return null;
        const archived = { ...clone(revision), status: 'archived', isActive: false, archivedAt: new Date().toISOString(), reason: compact(metadata.reason || revision.reason || 'Archived revision.') };
        archived.programSnapshot = { ...archived.programSnapshot, reviewStatus: 'archived', archivedAt: archived.archivedAt, isActiveRevision: false };
        await this.saveProgramRequirementRevision(archived);
        return clone(archived);
      },
      async rollbackProgramRevision(revisionId, metadata = {}) {
        const revision = await requestPromise((await store('readonly', STORE_PROGRAM_REVISIONS)).get(compact(revisionId)));
        if (!revision) return null;
        const draft = revisionRecord({ ...revision.programSnapshot, reviewStatus: 'draft' }, {
          previousRevisionId: revision.revisionId,
          createdBy: metadata.createdBy,
          reason: compact(metadata.reason || 'Rollback created as new draft.')
        });
        draft.status = 'draft';
        draft.programSnapshot.reviewStatus = 'draft';
        await this.saveProgramRequirementRevision(draft);
        await requestPromise((await store('readwrite')).put(draft.programSnapshot));
        return clone(draft);
      },
      async migrateLegacyProgramsToRevisions() {
        const records = await this.getPrograms();
        for (const program of records) {
          const existing = await this.getProgramRequirementRevisions(program.programId, program.catalogYear);
          if (existing.length) continue;
          await this.saveProgramRequirementRevision(revisionRecord(program, { reason: 'Migrated legacy program record.' }));
        }
      },
      async deleteProgram(programId, catalogYear = '') {
        if (catalogYear) {
          await requestPromise((await store('readwrite')).delete(programKey(programId, catalogYear)));
          return;
        }
        const matches = (await this.getPrograms()).filter(program => canon(program.programId) === canon(programId));
        for (const program of matches) await requestPromise((await store('readwrite')).delete(program.key));
      },
      async clearAll() {
        await requestPromise((await store('readwrite')).clear());
        await requestPromise((await store('readwrite', STORE_BATCHES)).clear());
        await requestPromise((await store('readwrite', STORE_METADATA)).clear());
        await requestPromise((await store('readwrite', STORE_CATALOG_SOURCES)).clear());
        await requestPromise((await store('readwrite', STORE_CATALOG_PAGES)).clear());
        await requestPromise((await store('readwrite', STORE_CATALOG_CANDIDATES)).clear());
        await requestPromise((await store('readwrite', STORE_CATALOG_DETAILS)).clear());
        await requestPromise((await store('readwrite', STORE_CATALOG_DECISIONS)).clear());
        await requestPromise((await store('readwrite', STORE_PROGRAM_REVISIONS)).clear());
        await requestPromise((await store('readwrite', STORE_PROGRAM_ACTIVE_POINTERS)).clear());
        await requestPromise((await store('readwrite', STORE_PROGRAM_REVIEW_HISTORY)).clear());
      }
    };
  }

  async function exportRepositoryData(repo) {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      catalogSources: repo.getCatalogSources ? await repo.getCatalogSources() : [],
      catalogPages: repo.getCatalogPages ? await repo.getCatalogPages() : [],
      catalogProgramCandidates: repo.getCatalogProgramCandidates ? await repo.getCatalogProgramCandidates() : [],
      catalogRequirementDetails: repo.getCatalogProgramCandidates && repo.getCatalogRequirementDetail
        ? (await Promise.all((await repo.getCatalogProgramCandidates()).map(candidate => repo.getCatalogRequirementDetail(candidate.candidateId)))).filter(Boolean)
        : [],
      catalogReviewDecisions: repo.getCatalogReviewDecisions ? await repo.getCatalogReviewDecisions() : [],
      programs: repo.getPrograms ? await repo.getPrograms() : [],
      programRequirementRevisions: repo.getProgramRequirementRevisions ? await repo.getProgramRequirementRevisions() : [],
      programActiveRevisionPointers: repo.getProgramActiveRevisionPointers ? await repo.getProgramActiveRevisionPointers() : [],
      programReviewHistory: repo.getProgramReviewHistory ? await repo.getProgramReviewHistory() : []
    };
  }

  async function importRepositoryData(repo, parsed = {}) {
    for (const source of parsed.catalogSources || []) await repo.saveCatalogSource?.(source);
    for (const source of parsed.catalogSources || []) {
      const pages = (parsed.catalogPages || []).filter(page => page.catalogSourceId === source.catalogSourceId);
      if (pages.length) await repo.saveCatalogPages?.(source.catalogSourceId, pages);
    }
    await repo.saveCatalogProgramCandidates?.(parsed.catalogProgramCandidates || []);
    for (const detail of parsed.catalogRequirementDetails || []) await repo.saveCatalogRequirementDetail?.(detail);
    for (const decision of parsed.catalogReviewDecisions || []) await repo.saveCatalogReviewDecision?.(decision);
    await repo.savePrograms?.(parsed.programs || []);
    for (const revision of parsed.programRequirementRevisions || []) await repo.saveProgramRequirementRevision?.(revision);
  }

  const templatePrograms = Object.freeze([
    {
      programId: 'BUS-AS-TEMPLATE',
      catalogYear: '2026-2027',
      programName: 'Business Administration AS Template',
      awardType: 'AS',
      department: 'Business',
      division: 'Business',
      totalUnitsRequired: 60,
      minimumProgramUnits: 24,
      minimumGrade: 'C',
      reviewStatus: 'needs-review',
      source: { sourceType: 'manual', catalogTitle: 'TIMBER test fixture' },
      requirementGroups: [
        { groupId: 'core', label: 'Required Core', rule: 'all', courses: [
          { courseKey: 'BUS 001', units: 3 },
          { courseKey: 'ACCT 001', units: 4, prerequisiteCourseKeys: ['MATH 010'] },
          { courseKey: 'ECON 001', units: 3 }
        ] },
        { groupId: 'math', label: 'Quantitative Reasoning', rule: 'or', courses: [
          { courseKey: 'MATH 010', units: 3 },
          { courseKey: 'STAT C1000', units: 4 }
        ] },
        { groupId: 'electives', label: 'Business Electives', rule: 'choose-units', unitsRequired: 6, courses: [
          { courseKey: 'BUS 020', units: 3 },
          { courseKey: 'BUS 127', units: 3 },
          { courseKey: 'MKT 001', units: 3 }
        ] }
      ]
    },
    {
      programId: 'IT-CERT-TEMPLATE',
      catalogYear: '2026-2027',
      programName: 'Information Technology Certificate Template',
      awardType: 'Certificate',
      department: 'Computer Science',
      division: 'Industry and Technology',
      totalUnitsRequired: 18,
      minimumProgramUnits: 18,
      minimumGrade: 'C',
      reviewStatus: 'needs-review',
      source: { sourceType: 'manual', catalogTitle: 'TIMBER test fixture' },
      requirementGroups: [
        { groupId: 'foundation', label: 'Foundation', rule: 'all', courses: [
          { courseKey: 'COMP 001', units: 3 },
          { courseKey: 'COMP 005', units: 3, prerequisiteCourseKeys: ['COMP 001'] }
        ] },
        { groupId: 'specialization', label: 'Specialization', rule: 'choose-count', chooseCount: 1, courses: [
          { courseKey: 'COMP 020', units: 3, prerequisiteCourseKeys: ['COMP 005'] },
          { courseKey: 'COMP 030', units: 3, prerequisiteCourseKeys: ['COMP 005'] }
        ] },
        { groupId: 'applications', label: 'Applications', rule: 'one-from-each-list', subgroups: [
          { groupId: 'software', label: 'Software', rule: 'or', courses: [{ courseKey: 'COMP 040', units: 3 }, { courseKey: 'COMP 041', units: 3 }] },
          { groupId: 'systems', label: 'Systems', rule: 'or', courses: [{ courseKey: 'COMP 050', units: 3 }, { courseKey: 'COMP 051', units: 3 }] }
        ] }
      ]
    }
  ].map(normalizeProgram));

  return Object.freeze({
    DB_NAME,
    STORE_PROGRAMS,
    STORE_BATCHES,
    STORE_METADATA,
    STORE_CATALOG_SOURCES,
    STORE_CATALOG_PAGES,
    STORE_CATALOG_CANDIDATES,
    STORE_CATALOG_DETAILS,
    STORE_CATALOG_DECISIONS,
    STORE_PROGRAM_REVISIONS,
    STORE_PROGRAM_ACTIVE_POINTERS,
    STORE_PROGRAM_REVIEW_HISTORY,
    normalizeCourseKey,
    catalogYearSortValue,
    getMostRecentApprovedCatalogYear,
    getMostRecentPublishedCatalogYear,
    normalizeProgram,
    resolveCalGetcRequirements,
    validateProgram,
    parseProgramJson,
    createMemoryRepository,
    createIndexedDbRepository,
    exportRepositoryData,
    importRepositoryData,
    templatePrograms
  });
});
