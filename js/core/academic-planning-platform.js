(function (root, factory) {
  const api = factory(root.COSScheduleBuilder, root.COSProgramFeasibility, root.COSProgramRequirements, root.COSCatalogExtraction);
  root.COSAcademicPlanningPlatform = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (scheduleBuilder, programFeasibility, programRequirements, catalogExtraction) {
  'use strict';

  scheduleBuilder = scheduleBuilder || {};
  programFeasibility = programFeasibility || {};
  programRequirements = programRequirements || {};
  catalogExtraction = catalogExtraction || {};

  const REVIEW_WORKFLOW = Object.freeze(['draft', 'needs-review', 'approved', 'published', 'archived']);
  const FUTURE_EXTENSION_POINTS = Object.freeze([
    'ge-pattern-evaluation',
    'csu-uc-transfer-patterns',
    'guided-pathways',
    'student-education-plans',
    'ai-assisted-schedule-recommendations'
  ]);
  const PLANNING_ENGINE = 'academic-planning-platform';
  const planningResultCache = new Map();

  function compact(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function stableStringify(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function shortHash(value) {
    const text = typeof value === 'string' ? value : stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function normalizeReviewStatus(value) {
    const status = compact(value).toLowerCase().replace(/\s+/g, '-');
    return REVIEW_WORKFLOW.includes(status) ? status : 'draft';
  }

  function normalizeCatalogYear(value) {
    return compact(value);
  }

  function normalizeAward(value) {
    return {
      awardType: compact(value.awardType || value.type || value),
      displayName: compact(value.displayName || value.awardName || value.awardType || value.type || value),
      totalUnitsRequired: numberOrUndefined(value.totalUnitsRequired),
      minimumProgramUnits: numberOrUndefined(value.minimumProgramUnits)
    };
  }

  function normalizeRequirementRule(value) {
    const text = compact(value).toLowerCase();
    return ['all', 'choose-count', 'choose-units', 'one-from-each-list', 'or', 'elective'].includes(text) ? text : 'all';
  }

  function normalizeRequirementGroup(group = {}, index = 0) {
    const normalized = programRequirements.normalizeProgram
      ? programRequirements.normalizeProgram({ programId: 'TEMP', catalogYear: 'TEMP', programName: 'TEMP', awardType: 'TEMP', requirementGroups: [group] }).requirementGroups[0]
      : {
          groupId: compact(group.groupId) || `group-${index + 1}`,
          label: compact(group.label) || `Requirement Group ${index + 1}`,
          rule: normalizeRequirementRule(group.rule),
          courses: (group.courses || []).map(normalizeCourse),
          subgroups: (group.subgroups || []).map(normalizeRequirementGroup)
        };
    return {
      ...normalized,
      rule: normalizeRequirementRule(normalized.rule),
      sourceEvidence: normalizeEvidenceList(group.sourceEvidence || normalized.sourceEvidence),
      confidence: normalizeConfidence(group.confidence)
    };
  }

  function normalizeCourse(course = {}) {
    const courseKey = programRequirements.normalizeCourseKey
      ? programRequirements.normalizeCourseKey(course.courseKey || course.course || course.label)
      : compact(course.courseKey || course.course || course.label).toUpperCase();
    return {
      courseKey,
      units: numberOrUndefined(course.units),
      prerequisiteCourseKeys: (course.prerequisiteCourseKeys || []).map(key => programRequirements.normalizeCourseKey ? programRequirements.normalizeCourseKey(key) : compact(key).toUpperCase()).filter(Boolean),
      corequisiteCourseKeys: (course.corequisiteCourseKeys || []).map(key => programRequirements.normalizeCourseKey ? programRequirements.normalizeCourseKey(key) : compact(key).toUpperCase()).filter(Boolean),
      equivalentCourseKeys: (course.equivalentCourseKeys || []).map(key => programRequirements.normalizeCourseKey ? programRequirements.normalizeCourseKey(key) : compact(key).toUpperCase()).filter(Boolean),
      sourceEvidence: normalizeEvidenceList(course.sourceEvidence),
      confidence: normalizeConfidence(course.confidence)
    };
  }

  function normalizeEvidenceList(evidence = []) {
    return (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean).map(item => ({
      pageNumber: numberOrUndefined(item.pageNumber),
      text: compact(item.text),
      boundingContext: compact(item.boundingContext),
      extractionMethod: compact(item.extractionMethod),
      confidence: normalizeConfidence(item.confidence)
    }));
  }

  function normalizeConfidence(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : compact(value);
  }

  function numberOrUndefined(value) {
    if (value == null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function normalizeCatalogProgram(program = {}) {
    const normalized = programRequirements.normalizeProgram ? programRequirements.normalizeProgram(program) : clone(program);
    const revisionId = compact(program.revisionId || normalized.revisionId) || `revision-${shortHash({ programId: normalized.programId, catalogYear: normalized.catalogYear, status: normalized.reviewStatus, groups: normalized.requirementGroups })}`;
    return {
      ...normalized,
      catalogYear: normalizeCatalogYear(normalized.catalogYear),
      award: normalizeAward(normalized),
      reviewStatus: normalizeReviewStatus(normalized.reviewStatus),
      revisionId,
      activeRevisionId: compact(program.activeRevisionId || normalized.activeRevisionId || revisionId),
      isActiveRevision: program.isActiveRevision !== false,
      reviewHistory: Array.isArray(program.reviewHistory) ? clone(program.reviewHistory) : [],
      sourceEvidence: normalizeEvidenceList(program.sourceEvidence),
      confidence: {
        extraction: normalizeConfidence(program.confidence?.extraction ?? program.extractionConfidence),
        reconciliation: normalizeConfidence(program.confidence?.reconciliation ?? program.reconciliationConfidence),
        scheduling: normalizeConfidence(program.confidence?.scheduling),
        portfolio: normalizeConfidence(program.confidence?.portfolio),
        recommendation: normalizeConfidence(program.confidence?.recommendation)
      }
    };
  }

  function createCatalogRevision(program = {}, changes = {}, metadata = {}) {
    const previous = normalizeCatalogProgram(program);
    const next = normalizeCatalogProgram({
      ...previous,
      ...changes,
      source: { ...(previous.source || {}), ...(changes.source || {}) },
      requirementGroups: changes.requirementGroups || previous.requirementGroups,
      reviewStatus: normalizeReviewStatus(changes.reviewStatus || previous.reviewStatus)
    });
    const revisionId = `revision-${shortHash({ previousRevisionId: previous.revisionId, next, createdAt: metadata.createdAt || Date.now() })}`;
    return {
      ...next,
      revisionId,
      activeRevisionId: revisionId,
      previousRevisionId: previous.revisionId,
      isActiveRevision: true,
      revisionCreatedAt: compact(metadata.createdAt) || new Date().toISOString(),
      revisionCreatedBy: compact(metadata.createdBy),
      revisionReason: compact(metadata.reason || metadata.changeSummary),
      reviewHistory: [
        ...(previous.reviewHistory || []),
        {
          status: next.reviewStatus,
          at: compact(metadata.createdAt) || new Date().toISOString(),
          by: compact(metadata.createdBy),
          reason: compact(metadata.reason || metadata.changeSummary)
        }
      ]
    };
  }

  function transitionCatalogReview(program = {}, nextStatus = '', metadata = {}) {
    const status = normalizeReviewStatus(nextStatus);
    return createCatalogRevision(program, {
      reviewStatus: status,
      reviewedBy: compact(metadata.reviewedBy || metadata.actor),
      reviewedAt: new Date().toISOString(),
      publishedAt: status === 'published' ? new Date().toISOString() : program.publishedAt,
      archivedAt: status === 'archived' ? new Date().toISOString() : program.archivedAt
    }, {
      createdBy: metadata.actor || metadata.reviewedBy,
      reason: metadata.reason || `Review status changed to ${status}.`
    });
  }

  function activeCatalogPrograms(programs = [], options = {}) {
    const includeLegacyApproved = options.includeLegacyApproved === true;
    const eligibleStatuses = includeLegacyApproved ? new Set(['published', 'approved']) : new Set(['published']);
    const active = (programs || [])
      .map(normalizeCatalogProgram)
      .filter(program => program.isActiveRevision !== false && eligibleStatuses.has(program.reviewStatus));
    const years = [...new Set(active.map(program => program.catalogYear).filter(Boolean))]
      .sort((a, b) => catalogYearSortValue(b) - catalogYearSortValue(a) || String(b).localeCompare(String(a)));
    const activeCatalogYear = compact(options.catalogYear) || years[0] || '';
    return active.filter(program => !activeCatalogYear || program.catalogYear === activeCatalogYear);
  }

  function legacySolverPrograms(programs = []) {
    return (programs || []).map(program => {
      if (program.reviewStatus !== 'published') return program;
      return { ...program, reviewStatus: 'approved' };
    });
  }

  function catalogYearSortValue(value) {
    if (programRequirements.catalogYearSortValue) return programRequirements.catalogYearSortValue(value);
    const years = [...compact(value).matchAll(/20\d{2}/g)].map(match => Number(match[0]));
    return years.length ? Math.max(...years) : 0;
  }

  function planningCacheKey(input = {}) {
    const catalogRevisionFingerprint = shortHash((input.programs || [input.program]).filter(Boolean).map(program => ({
      programId: program.programId,
      catalogYear: program.catalogYear,
      revisionId: program.revisionId,
      activeRevisionId: program.activeRevisionId,
      reviewStatus: program.reviewStatus,
      requirementGroups: program.requirementGroups
    })));
    const scheduleFingerprint = programFeasibility.scheduleFingerprint
      ? programFeasibility.scheduleFingerprint(input.sectionRows || input.rows || [])
      : shortHash(input.sectionRows || input.rows || []);
    const analysisSettingsFingerprint = shortHash({
      legacyFingerprint: programFeasibility.analysisOptionsFingerprint
        ? programFeasibility.analysisOptionsFingerprint(input.options || {})
        : shortHash(input.options || {}),
      includeLegacyApproved: input.options?.includeLegacyApproved === true
    });
    const campusConstraintsFingerprint = shortHash({
      campusTransitionMinutes: input.options?.campusTransitionMinutes || {},
      allowedPhysicalCampuses: input.options?.allowedPhysicalCampuses || [],
      preferredCampuses: input.options?.preferredCampuses || [],
      maximumPhysicalCampuses: input.options?.maximumPhysicalCampuses
    });
    const termWindowFingerprint = shortHash({
      selectedTerm: input.options?.selectedTerm || input.options?.endingTerm || '',
      windowType: input.options?.windowType || 'full'
    });
    return {
      key: [catalogRevisionFingerprint, scheduleFingerprint, analysisSettingsFingerprint, campusConstraintsFingerprint, termWindowFingerprint].join('|'),
      catalogRevisionFingerprint,
      scheduleFingerprint,
      analysisSettingsFingerprint,
      campusConstraintsFingerprint,
      termWindowFingerprint
    };
  }

  function normalizeTerm(value) {
    if (programFeasibility.normalizeTermLabel) return programFeasibility.normalizeTermLabel(value);
    if (scheduleBuilder.normalizeTermLabel) return scheduleBuilder.normalizeTermLabel(value);
    return compact(value).toUpperCase();
  }

  function normalizeCourseKey(value) {
    if (scheduleBuilder.normalizeCourseKey) return scheduleBuilder.normalizeCourseKey(value);
    if (programRequirements.normalizeCourseKey) return programRequirements.normalizeCourseKey(value);
    return compact(value).toUpperCase();
  }

  function normalizeCampus(value) {
    if (scheduleBuilder.normalizeCampus) return scheduleBuilder.normalizeCampus(value);
    return compact(value).toUpperCase();
  }

  function normalizeOnlineMode(value) {
    const mode = compact(value).toLowerCase();
    return ['include', 'exclude', 'only'].includes(mode) ? mode : 'include';
  }

  function normalizeMinutes(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeSolveRequest(input = {}, sectionRowsArg, optionsArg) {
    if (Array.isArray(input) || input?.programId || sectionRowsArg) {
      return normalizeSolveRequest({
        analysisType: input?.programId ? 'program' : 'manual-schedule',
        program: input?.programId ? input : undefined,
        sectionRows: sectionRowsArg || [],
        constraints: optionsArg || {},
        limits: optionsArg || {},
        selectedTerm: optionsArg?.selectedTerm || optionsArg?.endingTerm || ''
      });
    }
    const constraints = input.constraints || input.options || {};
    const limits = input.limits || input.options || {};
    const requestedCourses = (input.requestedCourses || input.requests || []).map(course => ({
      ...course,
      courseKey: normalizeCourseKey(course.courseKey || course.course || course.query || course),
      course: compact(course.course || course.query || course.courseKey || course),
      required: course.required !== false && !course.optional
    }));
    return {
      analysisType: compact(input.analysisType) || 'manual-schedule',
      selectedTerm: normalizeTerm(input.selectedTerm || input.endingTerm || constraints.selectedTerm || constraints.endingTerm),
      termWindowType: compact(input.termWindowType || input.windowType || constraints.windowType || 'full') === 'standard' ? 'standard' : 'full',
      sectionRows: clone(input.sectionRows || input.rows || []),
      programs: (input.programs || []).map(normalizeCatalogProgram),
      program: input.program ? normalizeCatalogProgram(input.program) : undefined,
      requestedCourses,
      constraints: {
        onlineMode: normalizeOnlineMode(constraints.onlineMode),
        allowedPhysicalCampuses: (constraints.allowedPhysicalCampuses || []).map(normalizeCampus).filter(Boolean),
        preferredCampuses: (constraints.preferredCampuses || constraints.campuses || []).map(normalizeCampus).filter(Boolean),
        maximumPhysicalCampuses: normalizeMinutes(constraints.maximumPhysicalCampuses),
        allowedModalities: (constraints.allowedModalities || []).map(compact).filter(Boolean),
        allowedDays: (constraints.allowedDays || []).map(compact).filter(Boolean),
        excludedDays: (constraints.excludedDays || []).map(compact).filter(Boolean),
        earliestStartMinutes: normalizeMinutes(constraints.earliestStartMinutes),
        latestEndMinutes: normalizeMinutes(constraints.latestEndMinutes),
        earliestStart: constraints.earliestStart,
        latestEnd: constraints.latestEnd,
        includeFullSections: constraints.includeFullSections === true,
        includeWaitlistedSections: constraints.includeWaitlistedSections !== false,
        includeUnknownSeatStatus: constraints.includeUnknownSeatStatus !== false,
        includeLegacyApproved: constraints.includeLegacyApproved === true,
        campusTransitionMinutes: clone(constraints.campusTransitionMinutes || {}),
        enableCampusTravelConflictChecking: constraints.enableCampusTravelConflictChecking !== false,
        primarySemesterMinUnits: normalizeMinutes(constraints.primarySemesterMinUnits),
        primarySemesterMaxUnits: normalizeMinutes(constraints.primarySemesterMaxUnits),
        summerMaxUnits: normalizeMinutes(constraints.summerMaxUnits)
      },
      limits: {
        maxVisited: normalizeMinutes(limits.maxVisited),
        maxResults: normalizeMinutes(limits.maxResults || limits.topSchedulesRetained),
        pathwayCap: normalizeMinutes(limits.pathwayCap || limits.academicPathwayCap),
        configurationCap: normalizeMinutes(limits.configurationCap || limits.sectionConfigurationCap),
        meaningfulPatternCap: normalizeMinutes(limits.meaningfulPatternCap)
      },
      sourceVersions: clone(input.sourceVersions || {})
    };
  }

  function compactLegacyOptions(options = {}) {
    return Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== null && value !== undefined && value !== '')
    );
  }

  function legacyOptionsFromSolveRequest(request, extra = {}) {
    return compactLegacyOptions({
      ...request.constraints,
      ...extra,
      selectedTerm: request.selectedTerm,
      endingTerm: request.selectedTerm,
      windowType: request.termWindowType,
      academicPathwayCap: request.limits.pathwayCap ?? extra.academicPathwayCap,
      sectionConfigurationCap: request.limits.configurationCap ?? extra.sectionConfigurationCap,
      meaningfulPatternCap: request.limits.meaningfulPatternCap ?? extra.meaningfulPatternCap,
      maxVisited: request.limits.maxVisited ?? extra.maxVisited,
      maxResults: request.limits.maxResults ?? extra.maxResults
    });
  }

  function solveResultEnvelope(raw = {}, request = {}, startedAt = Date.now(), extra = {}) {
    const cache = planningCacheKey({ program: request.program, programs: request.programs, sectionRows: request.sectionRows, options: legacyOptionsFromSolveRequest(request) });
    const counts = raw.configurationCounts || raw.count || {};
    const meaningful = counts.meaningfulPatternCount;
    return {
      planningEngine: PLANNING_ENGINE,
      analysisType: request.analysisType,
      exact: extra.exact ?? counts.exact ?? raw.exact ?? true,
      lowerBound: extra.lowerBound ?? counts.lowerBound ?? raw.lowerBound ?? false,
      cappedAt: counts.cappedAt ?? raw.cappedAt,
      scheduleFingerprint: request.sourceVersions.scheduleFingerprint || cache.scheduleFingerprint,
      catalogRevisionFingerprint: request.sourceVersions.catalogRevisionFingerprint || cache.catalogRevisionFingerprint,
      analysisOptionsFingerprint: cache.analysisSettingsFingerprint,
      programsEvaluated: raw.programsEvaluated,
      academicPathwayCount: raw.pathwayResult?.count,
      rawConfigurationCount: counts.rawCrnConfigurationCount ?? counts.viableConfigurationCount,
      meaningfulPatternCount: typeof meaningful === 'object' ? meaningful.count : meaningful,
      topSchedules: counts.topSchedules || raw.schedules,
      campusSummary: raw.campusScenarios || raw.campusSummary,
      blockers: raw.blockers || raw.sharedCourseBlockers || [],
      recommendations: raw.scoredRecommendations || raw.recommendations || raw.candidateRecommendations || [],
      confidence: {
        extraction: raw.planningConfidence?.extraction ?? raw.requirementsSourceConfidence?.programDetection ?? null,
        reconciliation: raw.planningConfidence?.reconciliation ?? raw.requirementsSourceConfidence?.courseReconciliation ?? null,
        scheduling: raw.planningConfidence?.scheduling ?? raw.confidence ?? null,
        portfolio: raw.planningConfidence?.portfolio ?? null,
        recommendation: raw.planningConfidence?.recommendations ?? null
      },
      diagnostics: {
        combinationsVisited: counts.combinationsVisited,
        combinationsPruned: counts.combinationsPruned,
        elapsedMilliseconds: Date.now() - startedAt,
        warnings: [...(raw.diagnostics || []), ...(raw.warnings || [])].filter(Boolean)
      },
      simulationFingerprint: extra.simulationFingerprint,
      raw
    };
  }

  function attachSolveResult(raw = {}, request = {}, startedAt = Date.now(), extra = {}) {
    const solveResult = solveResultEnvelope(raw, request, startedAt, extra);
    return {
      ...raw,
      planningEngine: PLANNING_ENGINE,
      cache: planningCacheKey({ program: request.program, programs: request.programs, sectionRows: request.sectionRows, options: legacyOptionsFromSolveRequest(request) }),
      planningSolveRequest: request,
      planningSolveResult: solveResult,
      planningConfidence: solveResult.confidence
    };
  }

  function cacheKeyForRequest(request) {
    return planningCacheKey({ program: request.program, programs: request.programs, sectionRows: request.sectionRows, options: legacyOptionsFromSolveRequest(request) }).key;
  }

  function getCachedResult(keyOrRequest) {
    const key = typeof keyOrRequest === 'string' ? keyOrRequest : cacheKeyForRequest(normalizeSolveRequest(keyOrRequest));
    const entry = planningResultCache.get(key);
    return entry ? clone(entry) : null;
  }

  function setCachedResult(keyOrRequest, result) {
    if (!result || result.cancelled || result.failed || result.partial === true) return null;
    const key = typeof keyOrRequest === 'string' ? keyOrRequest : cacheKeyForRequest(normalizeSolveRequest(keyOrRequest));
    const record = clone(result);
    planningResultCache.set(key, record);
    return clone(record);
  }

  function invalidateByScheduleFingerprint(fingerprint) {
    const needle = compact(fingerprint);
    for (const [key, value] of planningResultCache.entries()) {
      if (key.includes(needle) || value?.planningSolveResult?.scheduleFingerprint === needle) planningResultCache.delete(key);
    }
  }

  function invalidateByCatalogRevision(fingerprint) {
    const needle = compact(fingerprint);
    for (const [key, value] of planningResultCache.entries()) {
      if (key.includes(needle) || value?.planningSolveResult?.catalogRevisionFingerprint === needle) planningResultCache.delete(key);
    }
  }

  function clearPlanningCache() {
    planningResultCache.clear();
  }

  function evaluateProgram(program, sectionRows = [], options = {}) {
    const startedAt = Date.now();
    const request = program?.analysisType ? normalizeSolveRequest(program) : normalizeSolveRequest({ analysisType: 'program', program, sectionRows, constraints: options, limits: options, selectedTerm: options.selectedTerm || options.endingTerm });
    const legacyOptions = legacyOptionsFromSolveRequest(request, options);
    const result = programFeasibility.evaluateProgramFeasibility
      ? programFeasibility.evaluateProgramFeasibility(request.program, request.sectionRows, legacyOptions)
      : {};
    return attachSolveResult(attachPlanningMetadata(result, { program: request.program, sectionRows: request.sectionRows, options: legacyOptions, analysisType: 'program' }), request, startedAt);
  }

  function evaluatePortfolio(programs = [], sectionRows = [], options = {}) {
    const startedAt = Date.now();
    const request = programs?.analysisType ? normalizeSolveRequest(programs) : normalizeSolveRequest({ analysisType: 'portfolio', programs, sectionRows, constraints: options, limits: options, selectedTerm: options.selectedTerm || options.endingTerm });
    const legacyOptions = legacyOptionsFromSolveRequest(request, options);
    const cached = getCachedResult(request);
    if (cached) return cached;
    const scopedPrograms = activeCatalogPrograms(request.programs, legacyOptions);
    const solverPrograms = legacySolverPrograms(scopedPrograms);
    const result = programFeasibility.evaluateProgramPortfolio
      ? programFeasibility.evaluateProgramPortfolio(solverPrograms, request.sectionRows, { ...legacyOptions, includeLegacyApproved: true })
      : { programResults: [] };
    const recommendations = generateRecommendationObjects(result, scopedPrograms, request.sectionRows, legacyOptions);
    const finalResult = attachSolveResult(attachPlanningMetadata({ ...result, scoredRecommendations: recommendations }, { programs: scopedPrograms, sectionRows: request.sectionRows, options: legacyOptions, analysisType: 'portfolio' }), { ...request, programs: scopedPrograms }, startedAt);
    setCachedResult(request, finalResult);
    return finalResult;
  }

  async function evaluatePortfolioAsync(programs = [], sectionRows = [], options = {}) {
    const startedAt = Date.now();
    const request = programs?.analysisType ? normalizeSolveRequest(programs) : normalizeSolveRequest({ analysisType: 'portfolio', programs, sectionRows, constraints: options, limits: options, selectedTerm: options.selectedTerm || options.endingTerm });
    const legacyOptions = legacyOptionsFromSolveRequest(request, options);
    const cached = getCachedResult(request);
    if (cached) return cached;
    const scopedPrograms = activeCatalogPrograms(request.programs, legacyOptions);
    const solverPrograms = legacySolverPrograms(scopedPrograms);
    const result = programFeasibility.evaluateProgramPortfolioAsync
      ? await programFeasibility.evaluateProgramPortfolioAsync(solverPrograms, request.sectionRows, { ...legacyOptions, includeLegacyApproved: true })
      : evaluatePortfolio({ ...request, programs: scopedPrograms });
    const recommendations = generateRecommendationObjects(result, scopedPrograms, request.sectionRows, legacyOptions);
    const finalResult = attachSolveResult(attachPlanningMetadata({ ...result, scoredRecommendations: recommendations }, { programs: scopedPrograms, sectionRows: request.sectionRows, options: legacyOptions, analysisType: 'portfolio' }), { ...request, programs: scopedPrograms }, startedAt);
    if (!legacyOptions.shouldCancel || !legacyOptions.shouldCancel()) setCachedResult(request, finalResult);
    return finalResult;
  }

  function buildStudentSchedule(sectionRows = [], requests = [], preferences = {}) {
    const startedAt = Date.now();
    const request = sectionRows?.analysisType ? normalizeSolveRequest(sectionRows) : normalizeSolveRequest({ analysisType: 'manual-schedule', sectionRows, requestedCourses: requests, constraints: preferences, limits: preferences, selectedTerm: preferences.selectedTerm || preferences.endingTerm });
    const legacyOptions = legacyOptionsFromSolveRequest(request, preferences);
    const result = scheduleBuilder.buildScheduleOptions ? scheduleBuilder.buildScheduleOptions(request.sectionRows, request.requestedCourses, legacyOptions) : { schedules: [] };
    return attachSolveResult({ ...result, cacheKey: cacheKeyForRequest(request) }, request, startedAt);
  }

  function simulateScheduleChange(target = {}, sectionRows = [], change = {}, options = {}) {
    const startedAt = Date.now();
    const request = target?.analysisType ? normalizeSolveRequest(target) : normalizeSolveRequest({
      analysisType: 'simulation',
      program: target?.programId ? target : undefined,
      programs: Array.isArray(target) ? target : [],
      sectionRows,
      constraints: options,
      limits: options,
      selectedTerm: options.selectedTerm || options.endingTerm,
      requestedCourses: options.requests || options.requestedCourses || []
    });
    const legacyOptions = legacyOptionsFromSolveRequest(request, options);
    const simulationFingerprint = shortHash({
      scheduleFingerprint: planningCacheKey({ sectionRows: request.sectionRows, options: legacyOptions }).scheduleFingerprint,
      catalogRevisionFingerprint: planningCacheKey({ program: request.program, programs: request.programs, sectionRows: request.sectionRows, options: legacyOptions }).catalogRevisionFingerprint,
      constraints: request.constraints,
      change
    });
    if (request.program?.programId && programFeasibility.simulateScheduleChange) {
      const result = normalizeSimulationResult(programFeasibility.simulateScheduleChange(request.program, request.sectionRows, change, legacyOptions), change, legacyOptions, simulationFingerprint);
      return attachSolveResult(result, request, startedAt, { simulationFingerprint, exact: result.exact, lowerBound: result.lowerBound });
    }
    if (request.programs?.length && programFeasibility.simulatePortfolioRecommendation) {
      const result = normalizeSimulationResult(programFeasibility.simulatePortfolioRecommendation(legacySolverPrograms(activeCatalogPrograms(request.programs, legacyOptions)), request.sectionRows, change, { ...legacyOptions, includeLegacyApproved: true }), change, legacyOptions, simulationFingerprint);
      return attachSolveResult(result, request, startedAt, { simulationFingerprint, exact: result.exact, lowerBound: result.lowerBound });
    }
    const before = buildStudentSchedule(request.sectionRows, request.requestedCourses, legacyOptions);
    const rowsAfter = applyScheduleChange(request.sectionRows, change);
    const after = buildStudentSchedule(rowsAfter, request.requestedCourses, legacyOptions);
    const result = normalizeSimulationResult({
      before,
      after,
      configurationsBefore: before.count?.viableConfigurationCount ?? before.schedules?.length ?? 0,
      configurationsAfter: after.count?.viableConfigurationCount ?? after.schedules?.length ?? 0,
      configurationsAdded: (after.count?.viableConfigurationCount ?? after.schedules?.length ?? 0) - (before.count?.viableConfigurationCount ?? before.schedules?.length ?? 0),
      sourceRowsMutated: false
    }, change, legacyOptions, simulationFingerprint);
    return attachSolveResult(result, request, startedAt, { simulationFingerprint, exact: result.exact, lowerBound: result.lowerBound });
  }

  function evaluateCampusScenario(programOrPrograms, sectionRows = [], scenario = {}, options = {}) {
    const startedAt = Date.now();
    const mergedOptions = { ...options, ...scenario };
    if (Array.isArray(programOrPrograms)) return evaluatePortfolio({ analysisType: 'campus-scenario', programs: programOrPrograms, sectionRows, constraints: mergedOptions, limits: mergedOptions, selectedTerm: mergedOptions.selectedTerm || mergedOptions.endingTerm });
    const result = evaluateProgram(programOrPrograms, sectionRows, mergedOptions);
    return attachSolveResult({
      scenario,
      result,
      campusScenarios: result.campusScenarios || [],
      confidence: { scheduling: result.confidence || '', portfolio: result.planningConfidence?.portfolio || '' }
    }, normalizeSolveRequest({ analysisType: 'campus-scenario', program: programOrPrograms, sectionRows, constraints: mergedOptions, limits: mergedOptions, selectedTerm: mergedOptions.selectedTerm || mergedOptions.endingTerm }), startedAt);
  }

  function applyScheduleChange(sectionRows = [], change = {}) {
    const cloned = clone(sectionRows || []);
    if (change.action === 'add-section') cloned.push({ ...(change.section || {}), simulated: true });
    if (change.action === 'remove-section') {
      const target = String(change.crn || '');
      for (let index = cloned.length - 1; index >= 0; index -= 1) if (String(cloned[index].crn || cloned[index].CRN || '') === target) cloned.splice(index, 1);
    }
    if (['change-section', 'change-campus', 'change-modality', 'change-day-time'].includes(change.action)) {
      const target = String(change.crn || '');
      cloned.forEach(row => {
        if (String(row.crn || row.CRN || '') === target) Object.assign(row, change.patch || {});
      });
    }
    return cloned;
  }

  function attachPlanningMetadata(result = {}, input = {}) {
    return {
      ...result,
      planningEngine: 'academic-planning-platform',
      cache: planningCacheKey(input),
      planningConfidence: {
        extraction: result.requirementsSourceConfidence?.programDetection || '',
        reconciliation: result.requirementsSourceConfidence?.courseReconciliation || '',
        scheduling: result.confidence || '',
        portfolio: result.programsEvaluated != null ? portfolioConfidence(result) : '',
        recommendations: (result.scoredRecommendations || result.recommendations || []).some(item => String(item.confidence || '').toLowerCase() === 'low') ? 'Low' : ''
      }
    };
  }

  function portfolioConfidence(result = {}) {
    if (!result.programsEvaluated) return 'Low';
    if ((result.insufficientDataPrograms || 0) > 0) return 'Medium';
    return 'High';
  }

  function generateRecommendationObjects(portfolio = {}, programs = [], sectionRows = [], options = {}) {
    const rows = portfolio.candidateRecommendations || portfolio.priorityRecommendations || [];
    return rows.map((row, index) => {
      const change = recommendationToChange(row, options);
      const simulation = change ? simulateScheduleChange(programs, sectionRows, change, options) : null;
      const configurationsAdded = simulation ? Number(simulation.configurationsAdded || 0) : null;
      const programsImproved = simulation?.programsImproved || toList(row.programsImproved || row.affectedPrograms);
      const impactScore = simulation ? Math.max(0, configurationsAdded || 0) + programsImproved.length * 10 + Number(row.blockerFrequency || 0) * 5 : null;
      return {
        recommendationId: `planning-rec-${shortHash({ row, index, change })}`,
        status: simulation ? 'simulated' : 'candidate',
        actionType: row.proposedCourse ? 'add-section' : 'portfolio-action',
        recommendationType: row.proposedCourse ? 'course-offering' : 'portfolio-action',
        title: row.proposedChange || row.recommendedAction || 'Review schedule option',
        proposedChangeObject: change,
        proposedChange: row.proposedChange || row.recommendedAction || '',
        impactScore,
        programsAffected: programsImproved,
        programsImproved,
        estimatedConfigurationsAdded: configurationsAdded,
        configurationsBefore: simulation?.configurationsBefore,
        configurationsAfter: simulation?.configurationsAfter,
        configurationsAdded: simulation?.configurationsAdded,
        meaningfulPatternsBefore: simulation?.meaningfulPatternsBefore,
        meaningfulPatternsAfter: simulation?.meaningfulPatternsAfter,
        singleCampusProgramsBefore: simulation?.singleCampusProgramsBefore,
        singleCampusProgramsAfter: simulation?.singleCampusProgramsAfter,
        campusImprovements: simulation?.singleCampusChanges || toList(row.campusAccessImprovement),
        singleCampusImprovements: Number(simulation?.singleCampusProgramsAfter || 0) - Number(simulation?.singleCampusProgramsBefore || 0),
        confidence: row.confidence || (simulation?.exact ? 'medium' : 'low'),
        evidence: [row].filter(Boolean),
        assumptions: simulation?.assumptions || [],
        supportingEvidence: {
          sourceRecommendation: row,
          simulationSummary: simulation ? {
            configurationsBefore: simulation.configurationsBefore,
            configurationsAfter: simulation.configurationsAfter,
            configurationsAdded: simulation.configurationsAdded,
            exact: simulation.exact,
            lowerBound: simulation.lowerBound
          } : null
        },
        executableChange: change,
        simulation
      };
    }).sort((a, b) => b.impactScore - a.impactScore || a.recommendationId.localeCompare(b.recommendationId));
  }

  function recommendationToChange(row = {}, options = {}) {
    if (!row.proposedCourse) return null;
    const [subject, course] = compact(row.proposedCourse).split(/\s+/, 2);
    return {
      action: 'add-section',
      section: {
        term: row.proposedTerm || options.selectedTerm || options.endingTerm || '',
        crn: `SIM-${shortHash(row).slice(0, 6)}`,
        subject,
        course,
        courseCode: row.proposedCourse,
        campus: row.proposedCampus || options.defaultCampus || 'COS',
        modality: row.proposedModality || 'In-Person',
        days: row.proposedDays || 'TU',
        start: row.proposedStart || '09:00',
        end: row.proposedEnd || '10:15',
        cap: Number(row.proposedCap || 35),
        actual: 0
      }
    };
  }

  function normalizeSimulationResult(result = {}, change = {}, options = {}, simulationFingerprint = '') {
    return {
      ...result,
      simulated: true,
      sourceRowsMutated: false,
      deterministicFingerprint: simulationFingerprint || shortHash({ change, options, configurationsAdded: result.configurationsAdded, programsImproved: result.programsImproved || [] }),
      simulationFingerprint: simulationFingerprint || shortHash({ change, options, configurationsAdded: result.configurationsAdded, programsImproved: result.programsImproved || [] }),
      confidence: {
        scheduling: result.exact === false ? 'low' : 'medium',
        portfolio: result.programsEvaluated ? 'medium' : '',
        recommendations: result.lowerBound ? 'low' : 'medium'
      }
    };
  }

  function toList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return compact(value) ? compact(value).split(/\s*;\s*/).filter(Boolean) : [];
  }

  function validationDiagnostics(input = {}) {
    const programs = (input.programs || []).map(normalizeCatalogProgram);
    const details = input.catalogRequirementDetails || [];
    const candidates = input.catalogProgramCandidates || [];
    const revisions = input.revisions || [];
    const activeRevisionKeys = new Set(programs.map(program => `${program.programId}|${program.catalogYear}|${program.activeRevisionId}`));
    const orphanedRequirements = details.filter(detail => !programs.some(program => program.programId === detail.program?.programId && program.catalogYear === detail.program?.catalogYear));
    return {
      unresolvedCatalogWarnings: [
        ...candidates.flatMap(candidate => candidate.warnings || []),
        ...details.flatMap(detail => detail.warnings || [])
      ].filter(Boolean),
      unmatchedCourses: details.flatMap(detail => detail.courseReconciliation || []).filter(row => row.status === 'not-found'),
      ambiguousRequirements: details.flatMap(detail => detail.warnings || []).filter(warning => /Ambiguous/i.test(warning)),
      prerequisiteGaps: details.flatMap(detail => detail.prerequisiteRows || []).filter(row => (row.prerequisiteCourseKeys || []).length && row.status === 'not-found'),
      staleCatalogRevisions: revisions.filter(revision => !activeRevisionKeys.has(`${revision.programId}|${revision.catalogYear}|${revision.revisionId}`)),
      inactiveApprovedPrograms: programs.filter(program => program.reviewStatus === 'approved' && program.isActiveRevision === false),
      orphanedRequirements,
      extensionPoints: FUTURE_EXTENSION_POINTS
    };
  }

  return Object.freeze({
    REVIEW_WORKFLOW,
    FUTURE_EXTENSION_POINTS,
    normalizeCatalogYear,
    normalizeCatalogProgram,
    normalizeAward,
    normalizeRequirementGroup,
    normalizeRequirementRule,
    normalizeCourse,
    normalizeEvidenceList,
    normalizeSolveRequest,
    normalizeCourseKey,
    normalizeTerm,
    normalizeCampus,
    normalizeOnlineMode,
    createCatalogRevision,
    transitionCatalogReview,
    activeCatalogPrograms,
    planningCacheKey,
    getCachedResult,
    setCachedResult,
    invalidateByScheduleFingerprint,
    invalidateByCatalogRevision,
    clearPlanningCache,
    evaluateProgram,
    evaluateProgramFeasibility: evaluateProgram,
    evaluatePortfolio,
    evaluateProgramPortfolio: evaluatePortfolio,
    evaluatePortfolioAsync,
    evaluateProgramPortfolioAsync: evaluatePortfolioAsync,
    buildStudentSchedule,
    buildScheduleOptions: buildStudentSchedule,
    simulateScheduleChange,
    simulatePortfolioRecommendation: (programs, sectionRows, change, options) => simulateScheduleChange(programs, sectionRows, change, options),
    evaluateCampusScenario,
    generateRecommendationObjects,
    validationDiagnostics,
    normalizeSections: rows => scheduleBuilder.normalizeSections ? scheduleBuilder.normalizeSections(rows) : [],
    sectionEligible: (section, preferences) => scheduleBuilder.sectionEligible ? scheduleBuilder.sectionEligible(section, preferences) : { eligible: true, reasons: [] },
    sectionsConflict: (a, b, preferences) => scheduleBuilder.sectionsConflict ? scheduleBuilder.sectionsConflict(a, b, preferences) : { conflict: false },
    countScheduleConfigurations: (rows, requests, preferences = {}) => buildStudentSchedule(rows, requests, { ...preferences, countMode: true }).count,
    buildScheduleExamples: (rows, requests, preferences = {}) => buildStudentSchedule(rows, requests, preferences).schedules || [],
    normalizeProgramRequirements: normalizeCatalogProgram,
    enumerateAcademicPathways: (program, options) => programFeasibility.enumerateAcademicPathways ? programFeasibility.enumerateAcademicPathways(program, options) : [],
    assignPathwayTerms: (pathway, terms, options) => programFeasibility.assignTerms ? programFeasibility.assignTerms(pathway, terms, options) : [],
    evaluateProgramCoverage: (program, rows, options) => programFeasibility.analyzeAvailability ? programFeasibility.analyzeAvailability(program, rows, options) : {},
    scheduleFingerprint: rows => programFeasibility.scheduleFingerprint ? programFeasibility.scheduleFingerprint(rows) : shortHash(rows || []),
    programRequirementsFingerprint: program => programFeasibility.programRequirementsFingerprint ? programFeasibility.programRequirementsFingerprint(program) : shortHash(program || {}),
    analysisOptionsFingerprint: options => programFeasibility.analysisOptionsFingerprint ? programFeasibility.analysisOptionsFingerprint(options) : shortHash(options || {})
  });
});
