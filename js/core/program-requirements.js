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
  const DB_VERSION = 1;
  const VALID_GROUP_RULES = new Set(['all', 'choose-count', 'choose-units', 'one-from-each-list', 'or', 'elective']);
  const VALID_REVIEW_STATUSES = new Set(['draft', 'needs-review', 'approved', 'retired']);
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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
      requirementGroups: (program.requirementGroups || []).map(normalizeRequirementGroup),
      source: normalizeSource(program.source),
      reviewStatus: VALID_REVIEW_STATUSES.has(program.reviewStatus) ? program.reviewStatus : 'draft',
      reviewedBy: compact(program.reviewedBy),
      reviewedAt: compact(program.reviewedAt)
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
      recommendedTerm: course.recommendedTerm == null || course.recommendedTerm === '' ? null : Number(course.recommendedTerm)
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
    initialPrograms.map(normalizeProgram).forEach(program => programs.set(program.key, program));
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
        programs.set(result.program.key, result.program);
      },
      async savePrograms(records = []) {
        for (const program of records) await this.saveProgram(program);
      },
      async deleteProgram(programId, catalogYear = '') {
        if (catalogYear) programs.delete(programKey(programId, catalogYear));
        else [...programs.keys()].filter(key => key.startsWith(`${canon(programId)}::`)).forEach(key => programs.delete(key));
      },
      async clearAll() { programs.clear(); }
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
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Program requirements database failed to open.'));
      });
      return dbPromise;
    }

    async function store(mode = 'readonly') {
      const db = await openDb();
      return db.transaction(STORE_PROGRAMS, mode).objectStore(STORE_PROGRAMS);
    }

    function requestPromise(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Program repository request failed.'));
      });
    }

    return {
      async initialize() { await openDb(); },
      async getPrograms() { return (await requestPromise((await store()).getAll())).map(clone); },
      async getProgram(programId, catalogYear = '') {
        if (catalogYear) return clone(await requestPromise((await store()).get(programKey(programId, catalogYear))));
        const matches = (await this.getPrograms()).filter(program => canon(program.programId) === canon(programId));
        return matches[0] || null;
      },
      async saveProgram(program) {
        const result = validateProgram(program);
        if (!result.valid) throw new Error(result.errors.join(' '));
        await requestPromise((await store('readwrite')).put(result.program));
      },
      async savePrograms(programs = []) {
        for (const program of programs) await this.saveProgram(program);
      },
      async deleteProgram(programId, catalogYear = '') {
        if (catalogYear) {
          await requestPromise((await store('readwrite')).delete(programKey(programId, catalogYear)));
          return;
        }
        const matches = (await this.getPrograms()).filter(program => canon(program.programId) === canon(programId));
        for (const program of matches) await requestPromise((await store('readwrite')).delete(program.key));
      },
      async clearAll() { await requestPromise((await store('readwrite')).clear()); }
    };
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
    normalizeCourseKey,
    normalizeProgram,
    validateProgram,
    parseProgramJson,
    createMemoryRepository,
    createIndexedDbRepository,
    templatePrograms
  });
});
