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
    const analysisSettingsFingerprint = programFeasibility.analysisOptionsFingerprint
      ? programFeasibility.analysisOptionsFingerprint(input.options || {})
      : shortHash(input.options || {});
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

  function evaluateProgram(program, sectionRows = [], options = {}) {
    const result = programFeasibility.evaluateProgramFeasibility
      ? programFeasibility.evaluateProgramFeasibility(program, sectionRows, options)
      : {};
    return attachPlanningMetadata(result, { program, sectionRows, options, analysisType: 'program' });
  }

  function evaluatePortfolio(programs = [], sectionRows = [], options = {}) {
    const scopedPrograms = activeCatalogPrograms(programs, options);
    const solverPrograms = legacySolverPrograms(scopedPrograms);
    const result = programFeasibility.evaluateProgramPortfolio
      ? programFeasibility.evaluateProgramPortfolio(solverPrograms, sectionRows, { ...options, includeLegacyApproved: true })
      : { programResults: [] };
    const recommendations = generateRecommendationObjects(result, scopedPrograms, sectionRows, options);
    return attachPlanningMetadata({ ...result, scoredRecommendations: recommendations }, { programs: scopedPrograms, sectionRows, options, analysisType: 'portfolio' });
  }

  async function evaluatePortfolioAsync(programs = [], sectionRows = [], options = {}) {
    const scopedPrograms = activeCatalogPrograms(programs, options);
    const solverPrograms = legacySolverPrograms(scopedPrograms);
    const result = programFeasibility.evaluateProgramPortfolioAsync
      ? await programFeasibility.evaluateProgramPortfolioAsync(solverPrograms, sectionRows, { ...options, includeLegacyApproved: true })
      : evaluatePortfolio(scopedPrograms, sectionRows, options);
    const recommendations = generateRecommendationObjects(result, scopedPrograms, sectionRows, options);
    return attachPlanningMetadata({ ...result, scoredRecommendations: recommendations }, { programs: scopedPrograms, sectionRows, options, analysisType: 'portfolio' });
  }

  function buildStudentSchedule(sectionRows = [], requests = [], preferences = {}) {
    const result = scheduleBuilder.buildScheduleOptions ? scheduleBuilder.buildScheduleOptions(sectionRows, requests, preferences) : { schedules: [] };
    return {
      ...result,
      planningEngine: 'academic-planning-platform',
      cacheKey: planningCacheKey({ rows: sectionRows, options: preferences }).key
    };
  }

  function simulateScheduleChange(target = {}, sectionRows = [], change = {}, options = {}) {
    if (target?.programId && programFeasibility.simulateScheduleChange) {
      return normalizeSimulationResult(programFeasibility.simulateScheduleChange(target, sectionRows, change, options), change, options);
    }
    if (Array.isArray(target) && programFeasibility.simulatePortfolioRecommendation) {
      return normalizeSimulationResult(programFeasibility.simulatePortfolioRecommendation(legacySolverPrograms(activeCatalogPrograms(target, options)), sectionRows, change, { ...options, includeLegacyApproved: true }), change, options);
    }
    const before = buildStudentSchedule(sectionRows, options.requests || [], options.preferences || {});
    const rowsAfter = applyScheduleChange(sectionRows, change);
    const after = buildStudentSchedule(rowsAfter, options.requests || [], options.preferences || {});
    return normalizeSimulationResult({
      before,
      after,
      configurationsBefore: before.counts?.viableConfigurationCount ?? before.schedules?.length ?? 0,
      configurationsAfter: after.counts?.viableConfigurationCount ?? after.schedules?.length ?? 0,
      configurationsAdded: (after.counts?.viableConfigurationCount ?? after.schedules?.length ?? 0) - (before.counts?.viableConfigurationCount ?? before.schedules?.length ?? 0),
      sourceRowsMutated: false
    }, change, options);
  }

  function evaluateCampusScenario(programOrPrograms, sectionRows = [], scenario = {}, options = {}) {
    const mergedOptions = { ...options, ...scenario };
    if (Array.isArray(programOrPrograms)) return evaluatePortfolio(programOrPrograms, sectionRows, mergedOptions);
    const result = evaluateProgram(programOrPrograms, sectionRows, mergedOptions);
    return {
      scenario,
      result,
      campusScenarios: result.campusScenarios || [],
      confidence: { scheduling: result.confidence || '', portfolio: result.planningConfidence?.portfolio || '' }
    };
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
      const configurationsAdded = Number(simulation?.configurationsAdded || row.configurationsAdded || 0);
      const programsImproved = simulation?.programsImproved || toList(row.programsImproved || row.affectedPrograms);
      const impactScore = Math.max(0, configurationsAdded) + programsImproved.length * 10 + Number(row.blockerFrequency || 0) * 5;
      return {
        recommendationId: `planning-rec-${shortHash({ row, index, change })}`,
        recommendationType: row.proposedCourse ? 'course-offering' : 'portfolio-action',
        title: row.proposedChange || row.recommendedAction || 'Review schedule option',
        proposedChange: row.proposedChange || row.recommendedAction || '',
        impactScore,
        programsImproved,
        estimatedConfigurationsAdded: configurationsAdded,
        campusImprovements: simulation?.singleCampusChanges || toList(row.campusAccessImprovement),
        singleCampusImprovements: Number(simulation?.singleCampusProgramsAfter || 0) - Number(simulation?.singleCampusProgramsBefore || 0),
        confidence: row.confidence || (simulation?.exact ? 'medium' : 'low'),
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

  function normalizeSimulationResult(result = {}, change = {}, options = {}) {
    return {
      ...result,
      simulated: true,
      sourceRowsMutated: false,
      deterministicFingerprint: shortHash({ change, options, configurationsAdded: result.configurationsAdded, programsImproved: result.programsImproved || [] }),
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
    createCatalogRevision,
    transitionCatalogReview,
    activeCatalogPrograms,
    planningCacheKey,
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
    scheduleFingerprint: rows => programFeasibility.scheduleFingerprint ? programFeasibility.scheduleFingerprint(rows) : shortHash(rows || []),
    programRequirementsFingerprint: program => programFeasibility.programRequirementsFingerprint ? programFeasibility.programRequirementsFingerprint(program) : shortHash(program || {}),
    analysisOptionsFingerprint: options => programFeasibility.analysisOptionsFingerprint ? programFeasibility.analysisOptionsFingerprint(options) : shortHash(options || {})
  });
});
