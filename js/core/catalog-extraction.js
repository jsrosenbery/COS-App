(function (root, factory) {
  const api = factory(root.COSProgramRequirements, root.COSScheduleBuilder);
  root.COSCatalogExtraction = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (programRequirements, scheduleBuilder) {
  'use strict';

  programRequirements = programRequirements || {};
  scheduleBuilder = scheduleBuilder || {};

  const CATALOG_EXTRACTION_VERSION = 'catalog-pilot-2026-2027-v2';
  const CATALOG_AWARD_TYPES = Object.freeze([
    'AS-T',
    'AA-T',
    'AS',
    'AA',
    'Certificate of Achievement',
    'Skill Certificate',
    'Certificate of Competency',
    'Certificate of Completion',
    'Other Credential'
  ]);
  const PILOT_PROGRAM_TARGETS = Object.freeze([
    { programName: 'Business Administration for Transfer 2.0', awardType: 'AS-T' },
    { programName: 'Business', awardType: 'AS' },
    { programName: 'Business', awardType: 'Certificate of Achievement' },
    { programName: 'Business Financial Recordkeeping', awardType: 'Certificate of Achievement' }
  ]);

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

  function delayFrame() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function throwIfCancelled(signal) {
    if (signal?.aborted) throw Object.assign(new Error('Catalog extraction cancelled.'), { name: 'AbortError', cancelled: true });
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
      sourceFingerprint,
      extractionVersion: compact(source.extractionVersion) || CATALOG_EXTRACTION_VERSION,
      warnings: Array.isArray(source.warnings) ? source.warnings.map(compact).filter(Boolean) : []
    };
  }

  function pageTextRecord(pageNumber, text) {
    return { pageNumber: Number(pageNumber) || 0, text: String(text ?? '').replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim() };
  }

  async function ingestCatalogPdf(file, options = {}) {
    const started = Date.now();
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const signal = options.signal;
    const filename = compact(file?.name || options.filename || 'catalog.pdf');
    const warnings = [];
    if (!file && !options.pageTexts) throw new Error('Select a catalog PDF before extraction.');
    if (file && !/\.pdf$/i.test(filename)) throw new Error('Catalog source must be a PDF file.');
    throwIfCancelled(signal);
    onProgress({ state: 'Reading PDF', pagesProcessed: 0, pageCount: 0 });
    let pageTexts = [];
    let pageCount = 0;
    let sourceFingerprint = '';
    if (options.pageTexts) {
      const inputPages = options.pageTexts || [];
      const chunkSize = Number(options.chunkSize || 10) || 10;
      pageCount = Number(options.pageCount || inputPages.length);
      for (let index = 0; index < inputPages.length; index += 1) {
        throwIfCancelled(signal);
        const page = inputPages[index];
        pageTexts.push(pageTextRecord(page.pageNumber || index + 1, page.text));
        if ((index + 1) % chunkSize === 0) {
          onProgress({ state: 'Extracting page text', pagesProcessed: index + 1, pageCount });
          await delayFrame();
        }
      }
      sourceFingerprint = fingerprint({ filename, pageCount, pages: pageTexts.map(page => [page.pageNumber, page.text.length, fingerprint(page.text)]) });
    } else if (typeof file.text === 'function' && /\.txt$/i.test(filename)) {
      const text = await file.text();
      pageTexts = text.split(/\f/g).map((page, index) => pageTextRecord(index + 1, page));
      pageCount = pageTexts.length;
      sourceFingerprint = fingerprint({ filename, pageCount, text });
    } else {
      const pdfjs = options.pdfjsLib || (typeof root !== 'undefined' ? root.pdfjsLib : null);
      if (!pdfjs?.getDocument) {
        return {
          state: 'Extraction failed',
          filename,
          catalogYear: compact(options.catalogYear),
          pageCount: 0,
          pagesExtracted: 0,
          pagesWithNoText: 0,
          sourceFingerprint: '',
          durationMs: Date.now() - started,
          warnings: ['Browser PDF text extraction is unavailable because pdfjsLib is not loaded.'],
          pageTexts: []
        };
      }
      const buffer = await file.arrayBuffer();
      sourceFingerprint = fingerprint({ filename, byteLength: buffer.byteLength, sample: Array.from(new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 4096)))) });
      onProgress({ state: 'Extracting page text', pagesProcessed: 0, pageCount: 0 });
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      pageCount = Number(pdf.numPages || 0);
      const chunkSize = Number(options.chunkSize || 10) || 10;
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        throwIfCancelled(signal);
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = (content.items || []).map(item => item.str || '').join(' ');
        pageTexts.push(pageTextRecord(pageNumber, text));
        if (pageNumber % chunkSize === 0) {
          onProgress({ state: 'Extracting page text', pagesProcessed: pageNumber, pageCount });
          await delayFrame();
        }
      }
    }
    throwIfCancelled(signal);
    onProgress({ state: 'Indexing pages', pagesProcessed: pageTexts.length, pageCount });
    const pagesWithNoText = pageTexts.filter(page => !compact(page.text)).length;
    const state = pagesWithNoText && pagesWithNoText < pageTexts.length ? 'Partial extraction' : pageTexts.length ? 'Ready for inventory extraction' : 'Extraction failed';
    return {
      state,
      filename,
      catalogYear: compact(options.catalogYear),
      pageCount,
      pagesExtracted: pageTexts.length,
      pagesWithNoText,
      sourceFingerprint,
      durationMs: Date.now() - started,
      warnings,
      pageTexts
    };
  }

  function extractProgramInventory(pageTexts = [], source = {}) {
    const catalogYear = compact(source.catalogYear) || '2026-2027';
    const candidates = [];
    const seen = new Map();
    (pageTexts || []).forEach(page => {
      const lines = String(page.text || '').split(/\r?\n/).map(compact).filter(Boolean);
      lines.forEach((line, index) => {
        const contextLines = lines.slice(index, Math.min(lines.length, index + 4));
        const heading = parseAwardHeading(contextLines.join(' '));
        if (!heading) return;
        const { programName, awardType, originalAwardText, ambiguousAwardType } = heading;
        const key = canon(`${programName}|${awardType}|${catalogYear}`);
        const context = lines.slice(Math.max(0, index - 2), index + 8).join(' | ');
        const likelyRequirementPage = /Program|Required|Core|Units|List A|List B|Electives/i.test(context);
        const evidenceType = likelyRequirementPage ? 'detailed-page' : /contents/i.test(context) ? 'table-of-contents' : 'award-list';
        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.sourceEvidence.push(createEvidence(page.pageNumber, line, evidenceType, likelyRequirementPage ? 0.9 : 0.78, context));
          if (evidenceType === 'table-of-contents') existing.tocEvidence.push(existing.sourceEvidence[existing.sourceEvidence.length - 1]);
          else if (evidenceType === 'detailed-page') existing.detailedPageEvidence.push(existing.sourceEvidence[existing.sourceEvidence.length - 1]);
          else existing.awardListEvidence.push(existing.sourceEvidence[existing.sourceEvidence.length - 1]);
          if (likelyRequirementPage && !existing.detailedSourceFound) {
            existing.likelyStartPage = Number(page.pageNumber || existing.likelyStartPage || 0);
            const range = detectProgramPageRange(existing, pageTexts);
            existing.likelyEndPage = range.endPage;
            existing.pageRange = range;
            existing.confidence = 0.9;
            existing.detailedSourceFound = true;
          }
          return;
        }
        const range = likelyRequirementPage ? detectProgramPageRange({ likelyStartPage: page.pageNumber }, pageTexts) : { startPage: Number(page.pageNumber || 0), endPage: Number(page.pageNumber || 0), pages: [Number(page.pageNumber || 0)], boundaryConfidence: 0.45, boundaryWarnings: ['Detailed award page not confirmed.'] };
        const evidence = createEvidence(page.pageNumber, line, evidenceType, likelyRequirementPage ? 0.9 : 0.78, context);
        const candidate = {
          candidateId: `candidate-${fingerprint(key)}`,
          catalogYear,
          programName,
          awardType,
          awardTypeEnum: CATALOG_AWARD_TYPES.includes(awardType) ? awardType : 'Other Credential',
          originalAwardText,
          ambiguousAwardType,
          areaOfStudy: inferAreaOfStudy(lines, index),
          likelyStartPage: Number(page.pageNumber || 0),
          likelyEndPage: range.endPage,
          pageRange: range,
          sourceText: line,
          sourceEvidence: [evidence],
          tocEvidence: evidenceType === 'table-of-contents' ? [evidence] : [],
          awardListEvidence: evidenceType === 'award-list' ? [evidence] : [],
          detailedPageEvidence: evidenceType === 'detailed-page' ? [evidence] : [],
          detailedSourceFound: evidenceType === 'detailed-page',
          confidence: likelyRequirementPage ? 0.9 : 0.78,
          warnings: ambiguousAwardType ? ['Ambiguous award type.'] : [],
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

  function parseAwardHeading(text = '') {
    const source = compact(text).replace(/\uFFFD/g, '-').replace(/[–—]/g, '-');
    const patterns = [
      { re: /Associate\s+(?:in|of)\s+Science\s+in\s+(.+?)\s*\(?\s*AS-?T\s*\)?/i, awardType: 'AS-T', prefix: 'Associate in Science in ' },
      { re: /Associate\s+(?:in|of)\s+Arts?\s+in\s+(.+?)\s*\(?\s*AA-?T\s*\)?/i, awardType: 'AA-T', prefix: 'Associate in Arts in ' },
      { re: /Associate\s+(?:in|of)\s+Science\s+in\s+(.+?)\s*\(?\s*AS\s*\)?/i, awardType: 'AS', prefix: 'Associate of Science in ' },
      { re: /Associate\s+(?:in|of)\s+Arts?\s+in\s+(.+?)\s*\(?\s*AA\s*\)?/i, awardType: 'AA', prefix: 'Associate of Arts in ' },
      { re: /Certificate\s+of\s+Achievement\s+in\s+(.+)/i, awardType: 'Certificate of Achievement', prefix: 'Certificate of Achievement in ' },
      { re: /Skill\s+Certificate\s+in\s+(.+)/i, awardType: 'Skill Certificate', prefix: 'Skill Certificate in ' },
      { re: /Certificate\s+of\s+Competency\s+in\s+(.+)/i, awardType: 'Certificate of Competency', prefix: 'Certificate of Competency in ' },
      { re: /Certificate\s+of\s+Completion\s+in\s+(.+)/i, awardType: 'Certificate of Completion', prefix: 'Certificate of Completion in ' },
      { re: /^(.+?)\s+(AS-T|AA-T|Certificate of Achievement|Skill Certificate|Noncredit Certificate|AS|AA)\b/i, legacy: true }
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern.re);
      if (!match) continue;
      const rawProgram = compact(match[1])
        .replace(/\s*\((?:AS-?T|AA-?T|AS|AA)\)\s*$/i, '')
        .replace(/\s+(?:Program(?:\s+total|:)?|Required Core|List [A-Z]|BUS|ACCT|ECON|MATH|STAT)\b.*$/i, '');
      const awardType = pattern.legacy ? normalizeAwardType(match[2]) : pattern.awardType;
      return {
        programName: rawProgram,
        awardType,
        originalAwardText: pattern.legacy ? source : `${pattern.prefix}${rawProgram}`,
        ambiguousAwardType: awardType === 'Other Credential'
      };
    }
    return null;
  }

  function normalizeAwardType(value = '') {
    const text = canon(value).replace(/\s+/g, ' ');
    if (/AS\s*-?\s*T/.test(text)) return 'AS-T';
    if (/AA\s*-?\s*T/.test(text)) return 'AA-T';
    if (text === 'AS') return 'AS';
    if (text === 'AA') return 'AA';
    if (/CERTIFICATE OF ACHIEVEMENT/.test(text)) return 'Certificate of Achievement';
    if (/SKILL CERTIFICATE/.test(text)) return 'Skill Certificate';
    if (/COMPETENCY/.test(text)) return 'Certificate of Competency';
    if (/COMPLETION/.test(text)) return 'Certificate of Completion';
    return 'Other Credential';
  }

  function detectProgramPageRange(candidate = {}, pageTexts = []) {
    const startPage = Number(candidate.likelyStartPage || candidate.startPage || 0);
    const sortedPages = [...(pageTexts || [])].sort((a, b) => Number(a.pageNumber) - Number(b.pageNumber));
    const startIndex = sortedPages.findIndex(page => Number(page.pageNumber) === startPage);
    if (startIndex < 0) return { startPage, endPage: startPage, pages: [startPage].filter(Boolean), boundaryConfidence: 0.25, boundaryWarnings: ['Detailed source page not found in extracted text.'] };
    const pages = [];
    const warnings = [];
    for (let index = startIndex; index < sortedPages.length; index += 1) {
      const page = sortedPages[index];
      if (index > startIndex && firstAwardHeadingOnPage(page)) break;
      pages.push(Number(page.pageNumber));
      if (index > startIndex + 5) {
        warnings.push('Program range exceeded six pages; boundary may need review.');
        break;
      }
    }
    return {
      startPage,
      endPage: pages[pages.length - 1] || startPage,
      pages,
      boundaryConfidence: warnings.length ? 0.62 : pages.length ? 0.82 : 0.25,
      boundaryWarnings: warnings
    };
  }

  function firstAwardHeadingOnPage(page = {}) {
    const lines = String(page.text || '').split(/\r?\n/).map(compact).filter(Boolean).slice(0, 8);
    return lines.some((line, index) => Boolean(parseAwardHeading(lines.slice(index, index + 3).join(' '))));
  }

  function selectPilotCandidates(candidates = []) {
    const pilots = [];
    PILOT_PROGRAM_TARGETS.forEach(targetSpec => {
      const target = canon(targetSpec.programName);
      const match = candidates.find(candidate => {
        return canon(candidate.programName) === target && candidate.awardType === targetSpec.awardType;
      }) || candidates.find(candidate => {
        const label = canon(`${candidate.programName} ${candidate.awardType}`);
        return !pilots.some(pilot => pilot.candidateId === candidate.candidateId) && candidate.awardType === targetSpec.awardType && (canon(candidate.programName).includes(target) || label.includes(target));
      });
      if (match) pilots.push(match);
    });
    return pilots.slice(0, 4);
  }

  function parseRequirementDetail(candidate = {}, pageTexts = [], options = {}) {
    const sourcePages = (pageTexts || []).filter(page => Number(page.pageNumber) >= Number(candidate.likelyStartPage || 0) && Number(page.pageNumber) <= Number(candidate.likelyEndPage || candidate.likelyStartPage || 0));
    const text = sourcePages.map(page => page.text).join('\n');
    const requirementRows = parseRequirementTableRows(sourcePages);
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
    const unitReconciliation = reconcileUnits(program);
    return {
      candidateId: candidate.candidateId,
      program,
      pageRange: candidate.pageRange || detectProgramPageRange(candidate, pageTexts),
      requirementRows,
      unitReconciliation,
      requirementEvidence: groups.flatMap(group => [
        createEvidence(group.pageNumber, group.sourceText || group.label, 'requirement-group', 0.7),
        ...(group.courses || []).flatMap(course => course.sourceEvidence || [])
      ]),
      confidence: confidenceFromWarnings(warnings, groups),
      warnings,
      extractionStatus: 'needs-review'
    };
  }

  function parseRequirementTableRows(pages = []) {
    const rows = [];
    (pages || []).forEach(page => {
      const headingPath = [];
      String(page.text || '').split(/\r?\n/).map(compact).filter(Boolean).forEach((line, index) => {
        if (/^(Required Core|List [A-Z]|Electives|Additional Requirements|Select|Choose|One of the following)/i.test(line)) {
          headingPath.length = 0;
          headingPath.push(line);
          return;
        }
        const courseMatch = line.match(/\b([A-Z]{2,6})\s+([A-Z]?\d{1,4}[A-Z]?|C\d{4}[A-Z]?)\b/);
        if (!courseMatch) {
          if (/units?|or\b/i.test(line)) rows.push({ pageNumber: page.pageNumber, rowIndex: index, headingPath: [...headingPath], courseCodeText: '', courseTitleText: '', unitsText: '', notesText: '', rawText: line, confidence: 0.35 });
          return;
        }
        const units = (line.match(/(\d+(?:\.\d+)?)\s*(?:units?|unit\b)/i) || [])[1] || '';
        const afterCode = compact(line.slice(line.indexOf(courseMatch[0]) + courseMatch[0].length));
        rows.push({
          pageNumber: page.pageNumber,
          rowIndex: index,
          headingPath: [...headingPath],
          courseCodeText: courseMatch[0],
          courseTitleText: compact(afterCode.replace(/(\d+(?:\.\d+)?)\s*(?:units?|unit\b).*/i, '')),
          unitsText: units,
          notesText: /\*/.test(line) ? 'Footnote marker' : '',
          rawText: line,
          confidence: units ? 0.78 : 0.48
        });
      });
    });
    return rows;
  }

  function reconcileUnits(program = {}) {
    const groups = program.requirementGroups || [];
    const groupRange = group => {
      const courseUnits = (group.courses || []).map(course => Number(course.units || 0)).filter(Number.isFinite);
      if (group.rule === 'or' || group.rule === 'choose-count') {
        const count = group.rule === 'choose-count' ? Number(group.chooseCount || 1) : 1;
        const sorted = [...courseUnits].sort((a, b) => a - b);
        return { min: sorted.slice(0, count).reduce((a, b) => a + b, 0), max: sorted.slice(-count).reduce((a, b) => a + b, 0) };
      }
      if (group.rule === 'choose-units') {
        const units = Number(group.unitsRequired || 0);
        return { min: units, max: Math.max(units, courseUnits.reduce((a, b) => a + b, 0)) };
      }
      return { min: courseUnits.reduce((a, b) => a + b, 0), max: courseUnits.reduce((a, b) => a + b, 0) };
    };
    const ranges = groups.map(groupRange);
    const parsedMinimumUnits = ranges.reduce((sum, range) => sum + range.min, 0);
    const parsedMaximumUnits = ranges.reduce((sum, range) => sum + range.max, 0);
    const stated = Number(program.totalUnitsRequired || program.minimumProgramUnits || 0);
    const variance = stated ? parsedMinimumUnits - stated : 0;
    return {
      catalogStatedUnits: stated,
      parsedMinimumUnits,
      parsedMaximumUnits,
      variance,
      status: !stated ? 'Missing catalog stated units' : Math.abs(variance) <= 0.01 ? 'Reconciled' : 'Variance requires review'
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

  function buildCourseDescriptionIndex(courseDescriptionPages = [], courseKeys = []) {
    const desired = new Set((courseKeys || []).flatMap(equivalentCourseKeys).map(normalizeCatalogCourseKey));
    return extractPrerequisites(courseDescriptionPages).filter(row => !desired.size || desired.has(row.courseKey) || equivalentCourseKeys(row.courseKey).some(key => desired.has(key))).map(row => ({
      ...row,
      hiddenPrerequisiteDependency: (row.prerequisiteCourseKeys || []).length > 0
    }));
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
    if (!candidate.detailedSourceFound && !(detail.pageRange?.boundaryConfidence >= 0.75)) warnings.push('No detailed source page confirmed.');
    if (!program.totalUnitsRequired) warnings.push('Missing stated program-unit total.');
    if (detail.unitReconciliation?.status === 'Variance requires review') warnings.push('Unit variance beyond tolerance.');
    (program.requirementGroups || []).forEach(group => {
      if (!group.sourceText && !group.pageNumber) warnings.push(`Missing page reference for ${group.label}.`);
      if (group.rule === 'choose-units' && !group.unitsRequired) warnings.push(`Missing choose-units value for ${group.label}.`);
    });
    const highSeverity = warnings.filter(warning => /Ambiguous|Missing|unmatched|cycle|variance|No detailed/i.test(warning));
    return { valid: warnings.length === 0 && highSeverity.length === 0, warnings };
  }

  function approveExtractedProgram(detail = {}, reviewer = '', options = {}) {
    const validation = validateExtractionCandidate({ catalogYear: detail.program?.catalogYear, detailedSourceFound: detail.pageRange?.boundaryConfidence >= 0.75 }, detail);
    if (!validation.valid && !compact(options.overrideReason)) {
      const error = new Error('Program extraction cannot be approved until review blockers are resolved or an administrator override reason is supplied.');
      error.validation = validation;
      throw error;
    }
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
        overrideReason: compact(options.overrideReason),
        sourceEvidencePreserved: true
      },
      revision: createProgramRequirementRevision(program, {
        createdBy: compact(reviewer),
        sourceFingerprint: detail.sourceFingerprint || detail.program?.source?.sourceFingerprint || '',
        previousRevisionId: options.previousRevisionId,
        changeSummary: options.changeSummary || 'Approved catalog extraction pilot record.'
      })
    };
  }

  function createProgramRequirementRevision(program = {}, options = {}) {
    return {
      revisionId: `revision-${fingerprint({ programId: program.programId, catalogYear: program.catalogYear, createdAt: Date.now(), sourceFingerprint: options.sourceFingerprint })}`,
      programId: program.programId,
      catalogYear: program.catalogYear,
      createdAt: new Date().toISOString(),
      createdBy: compact(options.createdBy),
      sourceFingerprint: compact(options.sourceFingerprint),
      extractionVersion: CATALOG_EXTRACTION_VERSION,
      previousRevisionId: compact(options.previousRevisionId),
      changeSummary: compact(options.changeSummary),
      programSnapshot: JSON.parse(JSON.stringify(program))
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
    CATALOG_EXTRACTION_VERSION,
    CATALOG_AWARD_TYPES,
    normalizeCatalogSource,
    normalizeCatalogCourseKey,
    equivalentCourseKeys,
    createEvidence,
    pageTextRecord,
    ingestCatalogPdf,
    extractProgramInventory,
    parseAwardHeading,
    detectProgramPageRange,
    selectPilotCandidates,
    parseRequirementTableRows,
    parseRequirementDetail,
    reconcileUnits,
    reconcileCourseKeys,
    extractPrerequisites,
    buildCourseDescriptionIndex,
    validateExtractionCandidate,
    approveExtractedProgram,
    createProgramRequirementRevision,
    createMemoryCatalogRepository,
    fingerprint
  });
});
