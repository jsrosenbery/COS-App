(function (root, factory) {
  const api = factory(root.COSProgramRequirements, root.COSScheduleBuilder);
  root.COSCatalogExtraction = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (programRequirements, scheduleBuilder) {
  'use strict';

  programRequirements = programRequirements || {};
  scheduleBuilder = scheduleBuilder || {};

  const PILOT_PROGRAM_NAMES = [
    'Business Administration for Transfer 2.0',
    'Business',
    'Business Certificate of Achievement'
  ];

  function compact(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function canon(value) {
    return compact(value).toUpperCase();
  }

  function stableStringify(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function fingerprint(value) {
    const text = typeof value === 'string' ? value : stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function normalizeCatalogCourseKey(value) {
    const text = canon(value).replace(/[./]/g, ' ').replace(/\s+/g, ' ');
    const match = text.match(/\b([A-Z]{2,6})\s+([A-Z]?\d{1,4}[A-Z]?|C\d{4}[A-Z]?)\b/);
    if (!match) return text;
    const subject = match[1];
    const number = match[2].startsWith('C') ? match[2] : match[2].replace(/^0+(\d)/, '$1');
    return `${subject} ${number}`;
  }

  function equivalentCourseKeys(value) {
    const normalized = normalizeCatalogCourseKey(value);
    const match = normalized.match(/^([A-Z]{2,6})\s+([A-Z]?)(\d+)([A-Z]?)$/);
    if (!match || match[2] === 'C') return [normalized];
    const [, subject, prefix, number, suffix] = match;
    const padded = `${subject} ${prefix}${number.padStart(3, '0')}${suffix}`;
    return [...new Set([normalized, padded])];
  }

  function createEvidence(pageNumber, text, extractionMethod = 'catalog-text-preview', confidence = 0.7, boundingContext = '') {
    return { pageNumber: Number(pageNumber) || 0, text: compact(text), boundingContext: compact(boundingContext), extractionMethod, confidence };
  }

  function normalizeCatalogSource(source = {}) {
    const catalogYear = compact(source.catalogYear);
    const filename = compact(source.filename);
    const sourceFingerprint = compact(source.sourceFingerprint) || fingerprint({ catalogYear, filename, pageCount: source.pageCount, title: source.catalogTitle });
    return {
      catalogSourceId: compact(source.catalogSourceId) || `catalog-${catalogYear || 'unknown'}-${sourceFingerprint}`,
      catalogYear,
      catalogTitle: compact(source.catalogTitle),
      filename,
      pageCount: Number(source.pageCount || 0),
      importedAt: compact(source.importedAt) || new Date().toISOString(),
      status: compact(source.status) || 'uploaded',
      sourceFingerprint
    };
  }

  function pageTextRecord(pageNumber, text) {
    return { pageNumber: Number(pageNumber) || 0, text: String(text ?? '').replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim() };
  }

  function extractProgramInventory(pageTexts = [], source = {}) {
    const catalogYear = compact(source.catalogYear) || '2026-2027';
    const candidates = [];
    const seen = new Map();
    (pageTexts || []).forEach(page => {
      const lines = String(page.text || '').split(/\r?\n/).map(compact).filter(Boolean);
      lines.forEach((line, index) => {
        const match = line.match(/^(.+?),?\s+(AS-T|AA-T|Certificate of Achievement|Skill Certificate|Noncredit Certificate|AS|AA|BS|BA)\b/i);
        if (!match) return;
        const programName = compact(match[1].replace(/\s+Program$/i, ''));
        const awardType = compact(match[2]);
        const key = canon(`${programName}|${awardType}|${catalogYear}`);
        const context = lines.slice(Math.max(0, index - 2), index + 8).join(' | ');
        const likelyRequirementPage = /Program|Required|Core|Units/i.test(context);
        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.sourceEvidence.push(createEvidence(page.pageNumber, line, 'inventory-heading', likelyRequirementPage ? 0.86 : 0.78, context));
          if (likelyRequirementPage && !/Program|Required|Core|Units/i.test(existing.sourceEvidence[0]?.boundingContext || '')) {
            existing.likelyStartPage = Number(page.pageNumber || existing.likelyStartPage || 0);
            existing.likelyEndPage = Number(page.pageNumber || existing.likelyStartPage || 0) + 2;
            existing.confidence = 0.86;
          }
          return;
        }
        const candidate = {
          candidateId: `candidate-${fingerprint(key)}`,
          catalogYear,
          programName,
          awardType,
          areaOfStudy: inferAreaOfStudy(lines, index),
          likelyStartPage: Number(page.pageNumber || 0),
          likelyEndPage: Number(page.pageNumber || 0) + 2,
          sourceText: line,
          sourceEvidence: [createEvidence(page.pageNumber, line, 'inventory-heading', likelyRequirementPage ? 0.86 : 0.78, context)],
          confidence: likelyRequirementPage ? 0.86 : 0.78,
          warnings: [],
          extractionStatus: 'detected',
          reviewStatus: 'needs-review'
        };
        seen.set(key, candidate);
        candidates.push(candidate);
      });
    });
    return candidates;
  }

  function inferAreaOfStudy(lines, index) {
    for (let cursor = index - 1; cursor >= 0 && cursor >= index - 6; cursor -= 1) {
      if (/^[A-Z][A-Za-z &/-]+$/.test(lines[cursor]) && !/(AS|AA|Certificate|Units)/i.test(lines[cursor])) return lines[cursor];
    }
    return '';
  }

  function selectPilotCandidates(candidates = []) {
    const pilots = [];
    PILOT_PROGRAM_NAMES.forEach(name => {
      const target = canon(name);
      const match = candidates.find(candidate => {
        const label = canon(`${candidate.programName} ${candidate.awardType}`);
        return canon(candidate.programName) === target || label === target;
      }) || candidates.find(candidate => {
        const label = canon(`${candidate.programName} ${candidate.awardType}`);
        return !pilots.some(pilot => pilot.candidateId === candidate.candidateId) && (canon(candidate.programName).includes(target) || label.includes(target));
      });
      if (match) pilots.push(match);
    });
    const skill = candidates.find(candidate => /SKILL CERTIFICATE/i.test(candidate.awardType));
    if (skill && !pilots.some(candidate => candidate.candidateId === skill.candidateId)) pilots.push(skill);
    return pilots.slice(0, 4);
  }

  function parseRequirementDetail(candidate = {}, pageTexts = [], options = {}) {
    const sourcePages = (pageTexts || []).filter(page => Number(page.pageNumber) >= Number(candidate.likelyStartPage || 0) && Number(page.pageNumber) <= Number(candidate.likelyEndPage || candidate.likelyStartPage || 0));
    const text = sourcePages.map(page => page.text).join('\n');
    const lines = text.split(/\r?\n/).map(compact).filter(Boolean);
    const warnings = [];
    const groups = [];
    let current = { groupId: 'required-core', label: 'Required Core', rule: 'all', courses: [], sourceText: '', pageNumber: candidate.likelyStartPage };
    lines.forEach(line => {
      if (/choose\s+one|select\s+one/i.test(line)) {
        if (current.courses.length) groups.push(current);
        current = { groupId: `choice-${groups.length + 1}`, label: line, rule: 'or', courses: [], sourceText: line, pageNumber: pageForLine(sourcePages, line) };
        return;
      }
      const chooseUnits = line.match(/(?:select|choose).{0,30}?(\d+(?:\.\d+)?)\s+units/i);
      if (chooseUnits) {
        if (current.courses.length) groups.push(current);
        current = { groupId: `elective-${groups.length + 1}`, label: line, rule: 'choose-units', unitsRequired: Number(chooseUnits[1]), courses: [], sourceText: line, pageNumber: pageForLine(sourcePages, line) };
        return;
      }
      if (/\bor\b/i.test(line) && /\b[A-Z]{2,6}\s+\d/.test(line)) warnings.push(`Ambiguous OR language: ${line}`);
      if (/\*/.test(line)) warnings.push(`Footnote marker needs review: ${line}`);
      const courseMatches = [...line.matchAll(/\b([A-Z]{2,6})\s+([A-Z]?\d{1,4}[A-Z]?|C\d{4}[A-Z]?)\b/g)];
      courseMatches.forEach(match => {
        const courseKey = normalizeCatalogCourseKey(`${match[1]} ${match[2]}`);
        const unitMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:units?|unit\b)/i) || line.match(/\b(\d+(?:\.\d+)?)$/);
        if (!unitMatch) warnings.push(`Missing unit value for ${courseKey}: ${line}`);
        current.courses.push({
          courseKey,
          sourceCourseKey: `${match[1]} ${match[2]}`,
          units: unitMatch ? Number(unitMatch[1]) : undefined,
          equivalentCourseKeys: equivalentCourseKeys(courseKey),
          sourceEvidence: [createEvidence(pageForLine(sourcePages, line), line, 'requirement-line', unitMatch ? 0.76 : 0.45)]
        });
      });
    });
    if (current.courses.length) groups.push(current);
    const program = programRequirements.normalizeProgram ? programRequirements.normalizeProgram({
      programId: `${candidate.programName}-${candidate.awardType}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase(),
      catalogYear: candidate.catalogYear,
      programName: candidate.programName,
      awardType: candidate.awardType,
      department: candidate.areaOfStudy,
      division: candidate.areaOfStudy,
      totalUnitsRequired: extractTotalUnits(text),
      minimumProgramUnits: extractTotalUnits(text),
      requirementGroups: groups,
      source: {
        sourceType: 'catalog-pdf',
        filename: options.filename || '',
        catalogTitle: options.catalogTitle || 'College of the Sequoias 2026-2027 Catalog',
        pageNumbers: sourcePages.map(page => page.pageNumber),
        originalText: text,
        importedAt: new Date().toISOString()
      },
      reviewStatus: 'needs-review'
    }) : {};
    return {
      candidateId: candidate.candidateId,
      program,
      requirementEvidence: groups.flatMap(group => [
        createEvidence(group.pageNumber, group.sourceText || group.label, 'requirement-group', 0.7),
        ...(group.courses || []).flatMap(course => course.sourceEvidence || [])
      ]),
      confidence: confidenceFromWarnings(warnings, groups),
      warnings,
      extractionStatus: 'needs-review'
    };
  }

  function pageForLine(pages = [], line = '') {
    const found = pages.find(page => String(page.text || '').includes(line));
    return Number(found?.pageNumber || pages[0]?.pageNumber || 0);
  }

  function extractTotalUnits(text = '') {
    const match = text.match(/(?:total|program).{0,25}?(\d+(?:\.\d+)?)\s+units/i);
    return match ? Number(match[1]) : undefined;
  }

  function confidenceFromWarnings(warnings = [], groups = []) {
    if (!groups.length) return 0.2;
    return Math.max(0.3, Math.min(0.9, 0.82 - warnings.length * 0.08));
  }

  function reconcileCourseKeys(extractedCourseKeys = [], scheduleRows = [], catalogCourseDescriptions = []) {
    const scheduleKeys = [...new Set((scheduleRows || []).map(row => scheduleBuilder.normalizeCourseKey ? scheduleBuilder.normalizeCourseKey([row.subject || row.Subject, row.course || row.Course].filter(Boolean).join(' ')) : normalizeCatalogCourseKey([row.subject || row.Subject, row.course || row.Course].filter(Boolean).join(' '))).filter(Boolean))];
    const descriptionKeys = new Set((catalogCourseDescriptions || []).map(normalizeCatalogCourseKey));
    return (extractedCourseKeys || []).map(source => {
      const normalizedCourseKey = normalizeCatalogCourseKey(source);
      const equivalents = equivalentCourseKeys(source);
      const matchedScheduleCourseKeys = scheduleKeys.filter(key => equivalents.includes(normalizeCatalogCourseKey(key)) || equivalents.includes(key));
      const matchedCatalogCourseDescription = equivalents.some(key => descriptionKeys.has(key));
      const status = matchedScheduleCourseKeys.length > 1 ? 'ambiguous' : matchedScheduleCourseKeys.length || matchedCatalogCourseDescription ? 'matched' : 'not-found';
      return {
        extractedCourseKey: source,
        normalizedCourseKey,
        matchedScheduleCourseKeys,
        matchedCatalogCourseDescription,
        status,
        warnings: status === 'not-found' ? ['No schedule or catalog course-description match found.'] : status === 'ambiguous' ? ['Multiple schedule course keys matched.'] : []
      };
    });
  }

  function extractPrerequisites(courseDescriptionPages = []) {
    const rows = [];
    (courseDescriptionPages || []).forEach(page => {
      const lines = String(page.text || '').split(/\r?\n/).map(compact).filter(Boolean);
      lines.forEach(line => {
        const heading = line.match(/^([A-Z]{2,6}\s+(?:[A-Z]?\d{1,4}[A-Z]?|C\d{4}[A-Z]?))\b/);
        if (!heading) return;
        rows.push({
          courseKey: normalizeCatalogCourseKey(heading[1]),
          prerequisiteCourseKeys: extractCourseListAfter(line, /Prerequisite(?:s)?:/i),
          corequisiteCourseKeys: extractCourseListAfter(line, /Corequisite(?:s)?:/i),
          recommendedPreparationCourseKeys: extractCourseListAfter(line, /Recommended Preparation:/i),
          sourceEvidence: [createEvidence(page.pageNumber, line, 'course-description-prerequisite', 0.7)]
        });
      });
    });
    return rows;
  }

  function extractCourseListAfter(line, labelPattern) {
    if (!labelPattern.test(line)) return [];
    const after = (line.split(labelPattern)[1] || '').split(/Prerequisite(?:s)?:|Corequisite(?:s)?:|Recommended Preparation:/i)[0] || '';
    return [...after.matchAll(/\b[A-Z]{2,6}\s+(?:[A-Z]?\d{1,4}[A-Z]?|C\d{4}[A-Z]?)\b/g)].map(match => normalizeCatalogCourseKey(match[0]));
  }

  function validateExtractionCandidate(candidate = {}, detail = {}) {
    const warnings = [...(candidate.warnings || []), ...(detail.warnings || [])];
    const program = detail.program || {};
    if (!candidate.catalogYear || program.catalogYear !== candidate.catalogYear) warnings.push('Catalog year mismatch.');
    if (!program.requirementGroups?.length) warnings.push('No requirement groups parsed.');
    if (!program.totalUnitsRequired) warnings.push('Missing stated program-unit total.');
    (program.requirementGroups || []).forEach(group => {
      if (!group.sourceText && !group.pageNumber) warnings.push(`Missing page reference for ${group.label}.`);
      if (group.rule === 'choose-units' && !group.unitsRequired) warnings.push(`Missing choose-units value for ${group.label}.`);
    });
    return { valid: warnings.length === 0, warnings };
  }

  function approveExtractedProgram(detail = {}, reviewer = '') {
    const program = programRequirements.normalizeProgram ? programRequirements.normalizeProgram({
      ...(detail.program || {}),
      reviewStatus: 'approved',
      reviewedBy: compact(reviewer),
      reviewedAt: new Date().toISOString()
    }) : detail.program;
    return {
      program,
      reviewDecision: {
        candidateId: detail.candidateId,
        decision: 'approved',
        reviewedBy: compact(reviewer),
        reviewedAt: new Date().toISOString(),
        sourceEvidencePreserved: true
      }
    };
  }

  function createMemoryCatalogRepository() {
    const sources = new Map();
    const candidates = new Map();
    const details = new Map();
    const batches = new Map();
    const decisions = new Map();
    return {
      async saveCatalogSource(source) {
        const record = normalizeCatalogSource(source);
        sources.set(record.catalogSourceId, record);
        return JSON.parse(JSON.stringify(record));
      },
      async getCatalogSources() { return [...sources.values()].map(record => JSON.parse(JSON.stringify(record))); },
      async saveProgramCandidates(records = []) {
        records.forEach(record => candidates.set(record.candidateId, JSON.parse(JSON.stringify(record))));
      },
      async getProgramCandidates(catalogSourceId = '') {
        const values = [...candidates.values()];
        return values.filter(record => !catalogSourceId || record.catalogSourceId === catalogSourceId).map(record => JSON.parse(JSON.stringify(record)));
      },
      async saveRequirementDetail(detail) {
        details.set(detail.candidateId, JSON.parse(JSON.stringify(detail)));
      },
      async getRequirementDetail(candidateId) {
        const detail = details.get(candidateId);
        return detail ? JSON.parse(JSON.stringify(detail)) : null;
      },
      async saveExtractionBatch(batch = {}) {
        const id = compact(batch.id) || `catalog-batch-${Date.now()}`;
        const record = { ...batch, id, savedAt: new Date().toISOString() };
        batches.set(id, record);
        return JSON.parse(JSON.stringify(record));
      },
      async getExtractionBatches() { return [...batches.values()].map(record => JSON.parse(JSON.stringify(record))); },
      async saveReviewDecision(decision = {}) {
        const id = compact(decision.id) || `decision-${decision.candidateId || Date.now()}`;
        const record = { ...decision, id, savedAt: new Date().toISOString() };
        decisions.set(id, record);
        return JSON.parse(JSON.stringify(record));
      },
      async getReviewDecisions() { return [...decisions.values()].map(record => JSON.parse(JSON.stringify(record))); }
    };
  }

  return Object.freeze({
    normalizeCatalogSource,
    normalizeCatalogCourseKey,
    equivalentCourseKeys,
    createEvidence,
    pageTextRecord,
    extractProgramInventory,
    selectPilotCandidates,
    parseRequirementDetail,
    reconcileCourseKeys,
    extractPrerequisites,
    validateExtractionCandidate,
    approveExtractedProgram,
    createMemoryCatalogRepository,
    fingerprint
  });
});
