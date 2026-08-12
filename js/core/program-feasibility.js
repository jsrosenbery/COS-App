(function (root, factory) {
  const api = factory(root.COSScheduleBuilder, root.COSProgramRequirements, root.COSFeasibilityTermWindow, root.COSTermUtils, root.COSCampusClassification);
  root.COSProgramFeasibility = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (scheduleBuilder, programRequirements, termWindowUtils, termUtils, campusUtils) {
  'use strict';

  scheduleBuilder = scheduleBuilder || {};
  programRequirements = programRequirements || {};
  termWindowUtils = termWindowUtils || {};
  termUtils = termUtils || {};
  campusUtils = campusUtils || {};

  const DEFAULT_CONFIG = Object.freeze({
    primarySemesterMinUnits: 12,
    primarySemesterTargetUnits: 15,
    primarySemesterMaxUnits: 18,
    summerMaxUnits: 9,
    academicPathwayCap: 25000,
    sectionConfigurationCap: 10000,
    topSchedulesRetained: 50,
    reliabilityBands: { high: 0.75, moderate: 0.4 },
    enforceMinimumLoadAwardTypes: ['AA', 'AS', 'BA', 'BS', 'ADT', 'DEGREE'],
    campusTransitionMinutes: campusUtils.DEFAULT_CAMPUS_TRANSITION_MINUTES || {},
    enableCampusTravelConflictChecking: true,
    healthWeights: { requirementCoverage: 0.2, sequenceViability: 0.15, configurationFlexibility: 0.15, campusAccessibility: 0.15, onlineAccessibility: 0.1, offeringReliability: 0.15, resilience: 0.1 }
  });
  const PHYSICAL_CAMPUSES = campusUtils.PHYSICAL_CAMPUSES || ['Visalia', 'Hanford', 'Tulare'];
  const portfolioResultCache = new Map();

  function normalizeTermLabel(value) {
    if (scheduleBuilder.normalizeTermLabel) return scheduleBuilder.normalizeTermLabel(value);
    if (termUtils.normalizeTermLabel) return termUtils.normalizeTermLabel(value);
    const text = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const year = (text.match(/\b(20\d{2})\b/) || [])[1];
    const season = (text.match(/\b(FALL|SPRING|SUMMER|WINTER)\b/) || [])[1];
    return year && season ? `${season} ${year}` : text;
  }

  function normalizeCourseKey(value) {
    if (programRequirements.normalizeCourseKey) return programRequirements.normalizeCourseKey(value);
    if (scheduleBuilder.normalizeCourseKey) return scheduleBuilder.normalizeCourseKey(value);
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function evaluateProgramFeasibility(program, sectionRows = [], options = {}) {
    const config = { ...DEFAULT_CONFIG, ...(options || {}) };
    const selectedTerm = normalizeTermLabel(options.selectedTerm || options.endingTerm || '');
    const normalizedRows = (sectionRows || []).map(row => ({ ...row, term: normalizeTermLabel(row.term || row.Term), Term: normalizeTermLabel(row.term || row.Term) }));
    const window = termWindowUtils.determineFeasibilityTermWindow
      ? termWindowUtils.determineFeasibilityTermWindow(selectedTerm, normalizedRows)
      : { selectedTerm, standardTerms: [], fullTerms: [], termsAvailableInRepository: [], missingTerms: [] };
    const terms = (options.windowType === 'standard' ? window.standardTerms : window.fullTerms).map(normalizeTermLabel);
    const rowsInWindow = normalizedRows.filter(row => terms.includes(normalizeTermLabel(row.term || row.Term)));
    const sections = (scheduleBuilder.normalizeSections ? scheduleBuilder.normalizeSections(rowsInWindow) : [])
      .map(section => ({ ...section, term: normalizeTermLabel(section.term) }))
      .filter(section => terms.includes(section.term));
    const availability = analyzeAvailability(program, sections, terms, config);
    const unknownCampusDiagnostics = analyzeUnknownCampusData(program, sections);
    const pathwayResult = enumerateAcademicPathways(program, availability, terms, config);
    const counts = countSectionConfigurations(pathwayResult.pathways, rowsInWindow, config, options);
    const analysisScope = analyzeScope(program, pathwayResult);
    const blockers = [...availability.blockers, ...pathwayResult.blockers, ...counts.blockers, ...analysisScope.blockers, ...unknownCampusDiagnostics.blockers];
    const resilience = analyzeResilience(availability, pathwayResult);
    const feasibility = overallFeasibility(availability, pathwayResult, counts, blockers, analysisScope);
    const campusScenarios = evaluateCampusScenarios(pathwayResult.pathways, rowsInWindow, config, options);
    const viabilitySummary = summarizeViability(availability, pathwayResult, counts, blockers, resilience, campusScenarios, analysisScope);
    const requirementsSourceConfidence = requirementsConfidence(program);
    const recommendations = generateRecommendations(program, availability, counts, campusScenarios, blockers, viabilitySummary);
    const health = programHealthComponents(availability, pathwayResult, counts, resilience, campusScenarios, viabilitySummary, config);
    return {
      reportTitle: 'Program Schedule Viability',
      program,
      selectedTerm: window.selectedTerm || selectedTerm,
      termsAnalyzed: terms,
      termWindow: window,
      analysisScope,
      availability,
      requirementCoverage: availability.courseRows,
      pathwayResult,
      configurationCounts: counts,
      campusScenarios,
      unknownCampusDiagnostics,
      viabilitySummary,
      requirementsSourceConfidence,
      recommendations,
      programHealth: health,
      resilience,
      overallFeasibility: feasibility.label,
      confidence: feasibility.confidence,
      blockers,
      limitations: [
        'This report is a schedule-development pulse check. It evaluates whether the current and recent schedule provides sufficient course availability, sequencing, campus access, and conflict-free configurations to support two-year completion of current catalog programs.',
        'It does not model individual completed coursework, transfer credit, placement, unencoded substitutions, counseling recommendations, or guaranteed student graduation.',
        'Campus transition minutes are editable planning assumptions used only for schedule viability conflict checks; they are not official travel standards.',
        'Catalog PDF extraction is intentionally deferred; future imports can populate the same structured program model.'
      ]
    };
  }

  function requirementsConfidence(program = {}) {
    if (program.source?.sourceType !== 'catalog-pdf') return { overall: 'High', programDetection: 'High', requirementParsing: 'High', courseReconciliation: 'High', prerequisiteExtraction: 'Not evaluated' };
    const groups = program.requirementGroups || [];
    const evidenceCount = groups.reduce((sum, group) => sum + (group.pageNumber ? 1 : 0) + (group.sourceText ? 1 : 0), 0);
    const missingUnits = groups.some(group => (group.courses || []).some(course => !Number.isFinite(Number(course.units))));
    const score = Math.max(0, Math.min(1, evidenceCount / Math.max(1, groups.length * 2) - (missingUnits ? 0.25 : 0)));
    const band = score >= 0.75 ? 'High' : score >= 0.45 ? 'Medium' : 'Low';
    return {
      overall: band,
      programDetection: band,
      requirementParsing: missingUnits ? 'Medium' : band,
      courseReconciliation: 'Needs review',
      prerequisiteExtraction: 'Needs review'
    };
  }

  function analyzeAvailability(program, sections, terms, config) {
    const courseOptions = collectProgramCourses(program);
    const courseRows = courseOptions.map(course => {
      const keys = new Set([course.courseKey, ...(course.equivalentCourseKeys || [])].map(normalizeCourseKey));
      const matching = sections.filter(section => keys.has(normalizeCourseKey(section.courseKey)));
      const termsOffered = [...new Set(matching.map(section => normalizeTermLabel(section.term)).filter(Boolean))].sort(compareTerms);
      const reliabilityRatio = terms.length ? termsOffered.length / terms.length : 0;
      const reliability = !matching.length ? 'None' : reliabilityRatio >= config.reliabilityBands.high ? 'High' : reliabilityRatio >= config.reliabilityBands.moderate ? 'Moderate' : 'Low';
      return {
        courseKey: course.courseKey,
        termsOffered,
        sections: matching.length,
        enrollment: matching.reduce((sum, section) => sum + (section.enrollment || 0), 0),
        seats: matching.reduce((sum, section) => sum + (section.seats || 0), 0),
        modalityMix: countBy(matching, section => section.modality || 'Other/Unknown'),
        campusMix: countBy(matching, section => section.campus || 'Unknown'),
        reliability,
        status: matching.length ? 'Available in selected window' : 'Not offered in selected window'
      };
    });
    return {
      courseRows,
      coveragePct: courseRows.length ? courseRows.filter(row => row.sections > 0).length / courseRows.length : 0,
      blockers: []
    };
  }

  function analyzeUnknownCampusData(program, sections = []) {
    const courseOptions = collectProgramCourses(program);
    const requiredKeys = new Set(courseOptions.map(course => normalizeCourseKey(course.courseKey)));
    const unknownSections = sections.filter(section => {
      const campusClass = section.campusClassification || scheduleBuilder.normalizeCampus?.(section) || campusUtils.normalizeCampus?.(section) || {};
      return requiredKeys.has(normalizeCourseKey(section.courseKey)) && !campusClass.isPhysical && !campusClass.isOnline;
    });
    const coursesAffected = [...new Set(unknownSections.map(section => normalizeCourseKey(section.courseKey)).filter(Boolean))];
    const programRequirementsAffected = requirementLabelsForCourses(program, coursesAffected);
    const blockers = coursesAffected.length ? [{
      severity: 'Medium',
      requirement: 'Campus data quality',
      issue: `${unknownSections.length} required-course section(s) have unknown campus data.`,
      effect: 'Campus-specific scenario conclusions may be indeterminate for affected requirements.',
      suggestedAction: 'Correct campus values or verify whether affected sections are physical, online, or excluded.'
    }] : [];
    return {
      sectionsWithUnknownCampus: unknownSections.length,
      unknownCampusSectionCount: unknownSections.length,
      unknownCampusCourseCount: coursesAffected.length,
      unknownCampusRequiredCourseCount: coursesAffected.length,
      coursesAffected,
      programRequirementsAffected,
      affectedPathwayCount: null,
      affectedConfigurationCount: null,
      affectedConfigurationCountExact: false,
      indeterminate: coursesAffected.length > 0,
      conclusion: coursesAffected.length ? 'Campus conclusion indeterminate' : 'Campus conclusion available',
      blockers
    };
  }

  function requirementLabelsForCourses(program, courseKeys = []) {
    const targets = new Set(courseKeys.map(normalizeCourseKey));
    const labels = [];
    function visit(group, inherited = '') {
      const label = group.label || inherited || 'Requirement';
      if ((group.courses || []).some(course => targets.has(normalizeCourseKey(course.courseKey)))) labels.push(label);
      (group.subgroups || []).forEach(subgroup => visit(subgroup, label));
    }
    (program.requirementGroups || []).forEach(group => visit(group));
    return [...new Set(labels)];
  }

  function collectProgramCourses(program) {
    const courses = [];
    function visit(group) {
      (group.courses || []).forEach(course => courses.push({ ...course, courseKey: normalizeCourseKey(course.courseKey) }));
      (group.subgroups || []).forEach(visit);
    }
    (program.requirementGroups || []).forEach(visit);
    const seen = new Set();
    return courses.filter(course => {
      if (!course.courseKey || seen.has(course.courseKey)) return false;
      seen.add(course.courseKey);
      return true;
    });
  }

  function enumerateAcademicPathways(program, availability, terms, config) {
    const blockers = [];
    let exact = true;
    let capped = false;
    let pathways = [{ courses: [], groups: [], units: 0 }];
    for (const group of program.requirementGroups || []) {
      const groupResult = groupPathways(group, availability, config);
      if (!groupResult.choices.length) blockers.push(groupBlocker(group, groupResult.missingCourseKeys));
      const combined = combinePathwaySets(pathways, groupResult.choices, config.academicPathwayCap);
      if (combined.capped) {
        capped = true;
        exact = false;
        pathways = combined.items;
        break;
      }
      pathways = combined.items;
    }
    const sequenced = [];
    for (const pathway of pathways) {
      const assignment = assignTerms(pathway.courses, terms, config, availability, program);
      if (assignment.valid) sequenced.push({ ...pathway, termAssignments: assignment.termAssignments, summerUsed: assignment.summerUsed, loadStatus: assignment.loadStatus });
      else blockers.push(...assignment.blockers);
      if (sequenced.length >= config.academicPathwayCap) {
        capped = true;
        exact = false;
        break;
      }
    }
    return {
      exact,
      cappedAt: capped ? config.academicPathwayCap : undefined,
      pathways: sequenced.slice(0, config.academicPathwayCap),
      count: sequenced.length,
      lowerBound: capped,
      capReached: capped,
      blockers: dedupeBlockers(blockers)
    };
  }

  function groupPathways(group, availability, config) {
    const missingCourseKeys = [];
    const courseChoices = (group.courses || []).map(course => ({
      courses: [{ ...course, courseKey: normalizeCourseKey(course.courseKey) }],
      groups: [group.label],
      units: Number(course.units || 0)
    })).filter(choice => {
      const covered = hasCoverage(choice.courses[0].courseKey, availability);
      if (!covered) missingCourseKeys.push(choice.courses[0].courseKey);
      return covered;
    });
    const subgroupResults = (group.subgroups || []).map(subgroup => groupPathways(subgroup, availability, config));
    const subgroupChoices = subgroupResults.map(result => result.choices);
    subgroupResults.forEach(result => missingCourseKeys.push(...result.missingCourseKeys));
    let choices;
    if (group.rule === 'all') {
      const missingDirectCourse = (group.courses || []).length > courseChoices.length;
      choices = missingDirectCourse ? [] : cartesian([...courseChoices.map(choice => [choice]), ...subgroupChoices], config.academicPathwayCap);
    }
    else if (group.rule === 'or') choices = [...courseChoices, ...subgroupChoices.flat()].slice(0, config.academicPathwayCap);
    else if (group.rule === 'choose-count') choices = combinations(courseChoices, Number(group.chooseCount || 1), config.academicPathwayCap);
    else if (group.rule === 'choose-units') choices = combinationsByUnits(courseChoices, Number(group.unitsRequired || 0), config.academicPathwayCap);
    else if (group.rule === 'one-from-each-list') choices = cartesian(subgroupChoices, config.academicPathwayCap);
    else choices = courseChoices;
    return { choices, missingCourseKeys: [...new Set(missingCourseKeys)] };
  }

  function groupBlocker(group, missingCourseKeys = []) {
    return {
      severity: 'High',
      requirement: group.label,
      issue: `No available course selection can satisfy this requirement group${missingCourseKeys.length ? ` (${missingCourseKeys.join(', ')})` : ''}.`,
      effect: 'No complete academic pathway can be constructed from recent schedule history for this group.',
      suggestedAction: 'Review requirements or add missing course offerings.'
    };
  }

  function hasCoverage(courseKey, availability) {
    return availability.courseRows.some(row => row.courseKey === normalizeCourseKey(courseKey) && row.sections > 0);
  }

  function cartesian(lists, cap) {
    if (!lists.length) return [];
    let results = [{ courses: [], groups: [], units: 0 }];
    for (const list of lists) {
      if (!list.length) return [];
      const next = [];
      for (const left of results) {
        for (const right of list) {
          next.push(mergePathways(left, right));
          if (next.length >= cap) return next;
        }
      }
      results = next;
    }
    return results;
  }

  function combinations(items, count, cap, start = 0, selected = [], output = []) {
    if (selected.length === count) {
      output.push(selected.reduce(mergePathways, { courses: [], groups: [], units: 0 }));
      return output;
    }
    for (let index = start; index < items.length && output.length < cap; index += 1) combinations(items, count, cap, index + 1, [...selected, items[index]], output);
    return output;
  }

  function combinationsByUnits(items, unitsRequired, cap) {
    const output = [];
    function visit(index, selected) {
      const merged = selected.reduce(mergePathways, { courses: [], groups: [], units: 0 });
      if (merged.units >= unitsRequired) {
        output.push(merged);
        return;
      }
      for (let cursor = index; cursor < items.length && output.length < cap; cursor += 1) visit(cursor + 1, [...selected, items[cursor]]);
    }
    visit(0, []);
    return output;
  }

  function mergePathways(left, right) {
    const courses = [...left.courses];
    (right.courses || []).forEach(course => {
      if (!courses.some(existing => existing.courseKey === course.courseKey)) courses.push(course);
    });
    return { courses, groups: [...new Set([...(left.groups || []), ...(right.groups || [])])], units: courses.reduce((sum, course) => sum + Number(course.units || 0), 0) };
  }

  function combinePathwaySets(leftSet, rightSet, cap) {
    const items = [];
    if (!rightSet.length) return { items, capped: false };
    for (const left of leftSet) {
      for (const right of rightSet) {
        items.push(mergePathways(left, right));
        if (items.length >= cap) return { items, capped: true };
      }
    }
    return { items, capped: false };
  }

  function assignTerms(courses, terms, config, availability = {}, program = {}) {
    const canonicalTerms = terms.map(normalizeTermLabel);
    const termLoads = Object.fromEntries(canonicalTerms.map(term => [term, 0]));
    const offeredTermsByCourse = Object.fromEntries((availability.courseRows || []).map(row => [row.courseKey, new Set((row.termsOffered || []).map(normalizeTermLabel))]));
    const courseMap = new Map(courses.map(course => [normalizeCourseKey(course.courseKey), { ...course, courseKey: normalizeCourseKey(course.courseKey) }]));
    const cycle = detectPrerequisiteCycle(courseMap);
    if (cycle.length) {
      return {
        valid: false,
        termAssignments: [],
        summerUsed: false,
        loadStatus: 'Prerequisite cycle detected',
        blockers: [{ severity: 'High', requirement: cycle.join(' -> '), issue: 'Circular prerequisite sequence detected.', effect: 'The pathway cannot be chronologically ordered.', suggestedAction: 'Review encoded prerequisites/corequisites for this program.' }]
      };
    }
    const ordered = topologicalSort(courseMap);
    const termAssignments = [];
    const assignedTermIndex = new Map();
    const blockers = [];
    for (const course of ordered) {
      const prereqs = (course.prerequisiteCourseKeys || []).map(normalizeCourseKey).filter(key => courseMap.has(key));
      const coreqs = (course.corequisiteCourseKeys || []).map(normalizeCourseKey).filter(key => courseMap.has(key));
      const earliestIndex = Math.max(
        0,
        ...prereqs.map(key => (assignedTermIndex.has(key) ? assignedTermIndex.get(key) + 1 : Infinity)),
        ...coreqs.map(key => (assignedTermIndex.has(key) ? assignedTermIndex.get(key) : 0))
      );
      const termsOffered = offeredTermsByCourse[course.courseKey] || new Set(canonicalTerms);
      const termIndex = canonicalTerms.findIndex((candidate, index) => {
        if (index < earliestIndex || !termsOffered.has(candidate)) return false;
        const max = /SUMMER/.test(candidate) ? config.summerMaxUnits : config.primarySemesterMaxUnits;
        return termLoads[candidate] + Number(course.units || 0) <= max;
      });
      if (termIndex < 0) {
        blockers.push({ severity: 'High', requirement: course.courseKey, issue: sequenceIssue(course, prereqs, coreqs, canonicalTerms, termsOffered, assignedTermIndex), effect: 'The pathway cannot be completed in chronological order within the selected window.', suggestedAction: 'Move prerequisite offerings earlier or add additional sections in a later term.' });
        continue;
      }
      const term = canonicalTerms[termIndex];
      termLoads[term] += Number(course.units || 0);
      termAssignments.push({ term, courseKey: course.courseKey, units: Number(course.units || 0) });
      assignedTermIndex.set(course.courseKey, termIndex);
    }
    const valid = blockers.length === 0 && termAssignments.length === courses.length;
    const summerUsed = termAssignments.some(item => /SUMMER/.test(item.term));
    const underloaded = enforceMinimumLoad(program, config) && Object.entries(termLoads).some(([term, units]) => !/SUMMER/.test(term) && units > 0 && units < config.primarySemesterMinUnits);
    return { valid, termAssignments, summerUsed, loadStatus: underloaded ? 'Underloaded term present' : 'Within configured load limits', blockers };
  }

  function sequenceIssue(course, prereqs, coreqs, terms, termsOffered, assignedTermIndex) {
    const offered = [...termsOffered].join(', ') || 'none';
    const prereqText = prereqs.length ? ` Prerequisites must be earlier: ${prereqs.join(', ')}.` : '';
    const coreqText = coreqs.length ? ` Corequisites must be same term or earlier: ${coreqs.join(', ')}.` : '';
    const assigned = [...assignedTermIndex.entries()].map(([key, index]) => `${key}=${terms[index]}`).join('; ');
    return `${course.courseKey} cannot be assigned to a valid term. Offered terms: ${offered}.${prereqText}${coreqText}${assigned ? ` Assigned so far: ${assigned}.` : ''}`;
  }

  function detectPrerequisiteCycle(courseMap) {
    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    function visit(key) {
      if (visiting.has(key)) return stack.slice(stack.indexOf(key)).concat(key);
      if (visited.has(key)) return [];
      visiting.add(key);
      stack.push(key);
      const course = courseMap.get(key) || {};
      for (const dep of [...(course.prerequisiteCourseKeys || []), ...(course.corequisiteCourseKeys || [])].map(normalizeCourseKey)) {
        if (!courseMap.has(dep)) continue;
        const cycle = visit(dep);
        if (cycle.length) return cycle;
      }
      stack.pop();
      visiting.delete(key);
      visited.add(key);
      return [];
    }
    for (const key of courseMap.keys()) {
      const cycle = visit(key);
      if (cycle.length) return cycle;
    }
    return [];
  }

  function topologicalSort(courseMap) {
    const visited = new Set();
    const ordered = [];
    function visit(key) {
      if (visited.has(key)) return;
      visited.add(key);
      const course = courseMap.get(key) || {};
      [...(course.prerequisiteCourseKeys || []), ...(course.corequisiteCourseKeys || [])].map(normalizeCourseKey).filter(dep => courseMap.has(dep)).forEach(visit);
      ordered.push(course);
    }
    [...courseMap.keys()].forEach(visit);
    return ordered;
  }

  function enforceMinimumLoad(program, config) {
    const award = String(program.awardType || '').trim().toUpperCase();
    return (config.enforceMinimumLoadAwardTypes || []).some(item => award.includes(String(item).toUpperCase()));
  }

  function countSectionConfigurations(pathways, sections, config, options = {}) {
    let raw = 0;
    let usingSummer = 0;
    let withoutSummer = 0;
    let exact = true;
    let combinationsVisited = 0;
    let combinationsPruned = 0;
    let capReached = false;
    const patterns = new Set();
    let meaningfulPatternsExact = true;
    let meaningfulPatternCapReached = false;
    const patternHashCap = Number(config.meaningfulPatternCap || config.sectionConfigurationCap) || config.sectionConfigurationCap;
    const blockers = [];
    const topSchedules = [];
    const campusEnumeration = emptyCampusEnumeration();
    for (const pathway of pathways) {
      const assignmentsByTerm = groupBy(pathway.termAssignments || [], item => normalizeTermLabel(item.term));
      let pathwayRaw = 1;
      let pathwayPatterns = [''];
      let pathwayCampusStates = [{ count: 1, campuses: [], sameDayCrossCampus: false, sameTermMultiCampus: false }];
      let blocked = false;
      for (const [term, assignments] of Object.entries(assignmentsByTerm)) {
        const requests = assignments.map(item => ({ course: item.courseKey, required: true }));
        const termRows = (sections || []).filter(row => normalizeTermLabel(row.term || row.Term) === term);
        const termCampusProfiles = [];
        const termPatternHashes = new Set();
        const result = scheduleBuilder.buildScheduleOptions
          ? scheduleBuilder.buildScheduleOptions(termRows, requests, {
            ...options,
            maxResults: config.topSchedulesRetained,
            maxVisited: config.sectionConfigurationCap,
            patternHashCap,
            requireAllRequestedCourses: true,
            countMode: true,
            campusTransitionMinutes: config.campusTransitionMinutes,
            enableCampusTravelConflictChecking: config.enableCampusTravelConflictChecking,
            onViableSchedule: summary => {
              termCampusProfiles.push(campusProfileForSections(summary.sections || []));
              if (termPatternHashes.size < patternHashCap) termPatternHashes.add(`${term}:${meaningfulPatternHash(summary.sections || [])}`);
            }
          })
          : { schedules: [], count: { viableConfigurationCount: 0, exact: true, combinationsVisited: 0, combinationsPruned: 0, capReached: false } };
        const viable = result.count?.viableConfigurationCount ?? result.schedules?.length ?? 0;
        combinationsVisited += result.count?.combinationsVisited || result.visited || 0;
        combinationsPruned += result.count?.combinationsPruned || 0;
        if (!result.count?.exact || result.count?.capReached) {
          exact = false;
          capReached = true;
        }
        if (result.count?.meaningfulPatternCount?.lowerBound) {
          meaningfulPatternsExact = false;
          meaningfulPatternCapReached = true;
        }
        if (!viable) {
          blocked = true;
          break;
        }
        pathwayRaw *= viable;
        pathwayCampusStates = combineCampusStates(pathwayCampusStates, termCampusProfiles.length ? compressCampusProfiles(termCampusProfiles) : [{ count: viable, campuses: [], sameDayCrossCampus: false, sameTermMultiCampus: false }], config.sectionConfigurationCap);
        const termPatterns = [...termPatternHashes];
        if (!termPatterns.length && result.count?.meaningfulPatternCount?.count) meaningfulPatternsExact = false;
        pathwayPatterns = combinePatternHashes(pathwayPatterns, termPatterns, config.sectionConfigurationCap);
        (result.schedules || []).forEach(schedule => {
          if (topSchedules.length < config.topSchedulesRetained) topSchedules.push({ ...schedule, term });
        });
        if (pathwayRaw >= config.sectionConfigurationCap) {
          exact = false;
          capReached = true;
          pathwayRaw = config.sectionConfigurationCap;
          break;
        }
      }
      if (!blocked) {
        raw += pathwayRaw;
        campusEnumeration.scenarioCompatiblePathwayCount += 1;
        addCampusStatesToEnumeration(campusEnumeration, pathwayCampusStates, config.sectionConfigurationCap);
        if (pathway.summerUsed) usingSummer += pathwayRaw;
        else withoutSummer += pathwayRaw;
        pathwayPatterns.forEach(pattern => {
          if (!pattern || patterns.size >= patternHashCap) return;
          patterns.add(pattern);
        });
        if (pathwayPatterns.length >= patternHashCap || patterns.size >= patternHashCap) {
          meaningfulPatternsExact = false;
          meaningfulPatternCapReached = true;
        }
      }
      if (raw >= config.sectionConfigurationCap) {
        exact = false;
        capReached = true;
        raw = config.sectionConfigurationCap;
        break;
      }
    }
    if (!raw && pathways.length) blockers.push({ severity: 'High', requirement: 'Section schedules', issue: 'No conflict-free CRN configurations were found.', effect: 'Academic requirements may be covered historically but not simultaneously schedulable.', suggestedAction: 'Review day/time overlaps or add alternative sections.' });
    return {
      exact,
      count: raw,
      lowerBound: !exact,
      capReached,
      cappedAt: capReached ? config.sectionConfigurationCap : undefined,
      rawCrnConfigurationCount: raw,
      meaningfulPatternCount: patterns.size,
      meaningfulPatternCountDetail: {
        count: patterns.size,
        exact: meaningfulPatternsExact && !meaningfulPatternCapReached,
        lowerBound: !meaningfulPatternsExact || meaningfulPatternCapReached,
        cappedAt: meaningfulPatternCapReached ? patternHashCap : undefined
      },
      configurationsUsingSummer: usingSummer,
      configurationsWithoutSummer: withoutSummer,
      standardLoadConfigurations: pathways.filter(pathway => pathway.loadStatus === 'Within configured load limits').length,
      combinationsVisited,
      combinationsPruned,
      topSchedules,
      campusEnumeration: finalizeCampusEnumeration(campusEnumeration, raw, exact, capReached ? config.sectionConfigurationCap : undefined),
      blockers
    };
  }

  function evaluateCampusScenarios(pathways, sections, config, options = {}) {
    const scenarios = [
      { scenarioId: 'all-campuses-online', label: 'All campuses + online', physicalCampusesAllowed: PHYSICAL_CAMPUSES, maximumPhysicalCampuses: null, onlineMode: 'include' },
      { scenarioId: 'physical-only', label: 'Physical campuses only', physicalCampusesAllowed: PHYSICAL_CAMPUSES, maximumPhysicalCampuses: null, onlineMode: 'exclude' },
      { scenarioId: 'visalia-physical-only', label: 'Visalia physical only', physicalCampusesAllowed: ['Visalia'], maximumPhysicalCampuses: 1, onlineMode: 'exclude' },
      { scenarioId: 'visalia-plus-online', label: 'Visalia + online', physicalCampusesAllowed: ['Visalia'], maximumPhysicalCampuses: 1, onlineMode: 'include' },
      { scenarioId: 'hanford-physical-only', label: 'Hanford physical only', physicalCampusesAllowed: ['Hanford'], maximumPhysicalCampuses: 1, onlineMode: 'exclude' },
      { scenarioId: 'hanford-plus-online', label: 'Hanford + online', physicalCampusesAllowed: ['Hanford'], maximumPhysicalCampuses: 1, onlineMode: 'include' },
      { scenarioId: 'tulare-physical-only', label: 'Tulare physical only', physicalCampusesAllowed: ['Tulare'], maximumPhysicalCampuses: 1, onlineMode: 'exclude' },
      { scenarioId: 'tulare-plus-online', label: 'Tulare + online', physicalCampusesAllowed: ['Tulare'], maximumPhysicalCampuses: 1, onlineMode: 'include' },
      { scenarioId: 'any-single-campus', label: 'Any single physical campus', physicalCampusesAllowed: PHYSICAL_CAMPUSES, maximumPhysicalCampuses: 1, onlineMode: 'exclude' },
      { scenarioId: 'any-single-campus-plus-online', label: 'Any single physical campus + online', physicalCampusesAllowed: PHYSICAL_CAMPUSES, maximumPhysicalCampuses: 1, onlineMode: 'include' },
      { scenarioId: 'maximum-two-campuses', label: 'Maximum two physical campuses', physicalCampusesAllowed: PHYSICAL_CAMPUSES, maximumPhysicalCampuses: 2, onlineMode: 'exclude' },
      { scenarioId: 'maximum-two-campuses-plus-online', label: 'Maximum two physical campuses + online', physicalCampusesAllowed: PHYSICAL_CAMPUSES, maximumPhysicalCampuses: 2, onlineMode: 'include' },
      { scenarioId: 'online-only', label: 'Online only', physicalCampusesAllowed: [], maximumPhysicalCampuses: 0, onlineMode: 'only' }
    ];
    return scenarios.map(scenario => campusScenarioResult(scenario, pathways, sections, config, options));
  }

  function campusScenarioResult(scenario, pathways, sections, config, options = {}) {
    const counts = countSectionConfigurations(pathways, sections, config, {
      ...options,
      onlineMode: scenario.onlineMode,
      allowedPhysicalCampuses: scenario.physicalCampusesAllowed,
      maximumPhysicalCampuses: scenario.maximumPhysicalCampuses,
      campusTransitionMinutes: config.campusTransitionMinutes
    });
    const aggregate = counts.campusEnumeration || emptyCampusEnumeration();
    const comboCounts = aggregate.configurationsByCampusCombination || {};
    const mostCommonCombo = Object.entries(comboCounts).sort((a, b) => b[1] - a[1])[0]?.[0]?.split(' + ').filter(Boolean) || [];
    const coursesPreventingCompletion = scenarioCoursesPreventingCompletion(counts);
    const sameDayExists = aggregate.sameDayCrossCampusConfigurationCount > 0;
    const sameDayAvoidable = aggregate.configurationsWithoutSameDayTravel > 0;
    const sameDayUnavoidable = counts.rawCrnConfigurationCount > 0 && aggregate.sameDayCrossCampusConfigurationCount === counts.rawCrnConfigurationCount;
    return {
      scenarioId: scenario.scenarioId,
      label: scenario.label,
      physicalCampusesAllowed: scenario.physicalCampusesAllowed,
      maximumPhysicalCampuses: scenario.maximumPhysicalCampuses,
      onlineMode: scenario.onlineMode,
      feasible: counts.rawCrnConfigurationCount > 0,
      totalAcademicPathways: pathways.length,
      scenarioCompatiblePathwayCount: aggregate.scenarioCompatiblePathwayCount || 0,
      scenarioBlockedPathwayCount: Math.max(0, pathways.length - (aggregate.scenarioCompatiblePathwayCount || 0)),
      academicPathwayCount: aggregate.scenarioCompatiblePathwayCount || 0,
      rawConfigurationCount: counts.rawCrnConfigurationCount,
      meaningfulPatternCount: counts.meaningfulPatternCount,
      minimumPhysicalCampusesRequired: aggregate.minimumPhysicalCampusCount,
      maximumPhysicalCampusesUsed: aggregate.maximumPhysicalCampusCount,
      configurationsByCampusCount: aggregate.configurationsByCampusCount,
      configurationsByCampusCombination: aggregate.configurationsByCampusCombination,
      campusesUsed: Object.keys(comboCounts).map(key => key.split(' + ').filter(Boolean)),
      mostCommonCampusCombination: mostCommonCombo,
      coursesPreventingCompletion,
      coursesForcingCampusTravel: coursesForcingCampusTravel(pathways, sections, scenario),
      sameDayCrossCampusConfigurationsExist: sameDayExists,
      sameDayCrossCampusCanBeAvoided: sameDayAvoidable,
      sameDayCrossCampusUnavoidable: sameDayUnavoidable,
      sameDayCrossCampusRequired: sameDayUnavoidable,
      multipleCampusesRequiredWithinOneTerm: counts.rawCrnConfigurationCount > 0 && aggregate.sameTermMultiCampusConfigurationCount === counts.rawCrnConfigurationCount,
      campusesUsedOnlyInSeparateTerms: aggregate.crossTermOnlyMultiCampusConfigurationCount > 0,
      crossCampusTerms: [],
      exact: counts.exact,
      lowerBound: counts.lowerBound ? counts.rawCrnConfigurationCount : undefined,
      cappedAt: counts.cappedAt,
      campusBurden: {
        minimumCampusCount: aggregate.minimumPhysicalCampusCount,
        campusCombination: mostCommonCombo,
        sameDayCrossCampusConflicts: sameDayExists ? ['At least one viable configuration uses multiple physical campuses on the same day.'] : [],
        burdenLevel: sameDayUnavoidable ? 'critical' : sameDayExists ? 'moderate' : aggregate.multiCampusConfigurations ? 'low' : 'none'
      }
    };
  }

  function emptyCampusEnumeration() {
    return {
      viableConfigurationCount: 0,
      scenarioCompatiblePathwayCount: 0,
      minimumPhysicalCampusCount: null,
      maximumPhysicalCampusCount: null,
      configurationsByCampusCount: {},
      configurationsByCampusCombination: {},
      noPhysicalCampusConfigurations: 0,
      singleCampusConfigurations: 0,
      multiCampusConfigurations: 0,
      sameDayCrossCampusConfigurationCount: 0,
      sameTermMultiCampusConfigurationCount: 0,
      crossTermOnlyMultiCampusConfigurationCount: 0,
      configurationsWithoutSameDayTravel: 0,
      exact: true,
      lowerBound: false
    };
  }

  function campusProfileForSections(sections = []) {
    const campuses = physicalCampusesForSections(sections);
    return {
      count: 1,
      campuses,
      sameDayCrossCampus: sameDayCampusConflicts(sections).length > 0,
      sameTermMultiCampus: campuses.length > 1
    };
  }

  function compressCampusProfiles(profiles = []) {
    const map = new Map();
    profiles.forEach(profile => {
      const key = [profile.campuses.join('+'), profile.sameDayCrossCampus ? 'same-day' : 'no-same-day', profile.sameTermMultiCampus ? 'same-term-multi' : 'same-term-single'].join('|');
      const existing = map.get(key) || { ...profile, count: 0 };
      existing.count += profile.count || 1;
      map.set(key, existing);
    });
    return [...map.values()];
  }

  function combineCampusStates(states = [], profiles = [], cap = Infinity) {
    const map = new Map();
    for (const state of states) {
      for (const profile of profiles) {
        const campuses = [...new Set([...(state.campuses || []), ...(profile.campuses || [])])].sort();
        const combined = {
          count: Math.min(cap, (state.count || 0) * (profile.count || 0)),
          campuses,
          sameDayCrossCampus: Boolean(state.sameDayCrossCampus || profile.sameDayCrossCampus),
          sameTermMultiCampus: Boolean(state.sameTermMultiCampus || profile.sameTermMultiCampus)
        };
        const key = [campuses.join('+'), combined.sameDayCrossCampus ? 1 : 0, combined.sameTermMultiCampus ? 1 : 0].join('|');
        const existing = map.get(key) || { ...combined, count: 0 };
        existing.count = Math.min(cap, existing.count + combined.count);
        map.set(key, existing);
      }
    }
    return [...map.values()];
  }

  function addCampusStatesToEnumeration(aggregate, states = [], cap = Infinity) {
    states.forEach(state => {
      const count = Number(state.count || 0);
      const campuses = [...new Set(state.campuses || [])].sort();
      const campusCount = campuses.length;
      const combo = campuses.join(' + ') || 'No physical campus';
      aggregate.viableConfigurationCount = Math.min(cap, aggregate.viableConfigurationCount + count);
      aggregate.minimumPhysicalCampusCount = aggregate.minimumPhysicalCampusCount == null ? campusCount : Math.min(aggregate.minimumPhysicalCampusCount, campusCount);
      aggregate.maximumPhysicalCampusCount = aggregate.maximumPhysicalCampusCount == null ? campusCount : Math.max(aggregate.maximumPhysicalCampusCount, campusCount);
      aggregate.configurationsByCampusCount[String(campusCount)] = (aggregate.configurationsByCampusCount[String(campusCount)] || 0) + count;
      aggregate.configurationsByCampusCombination[combo] = (aggregate.configurationsByCampusCombination[combo] || 0) + count;
      if (campusCount === 0) aggregate.noPhysicalCampusConfigurations += count;
      if (campusCount === 1) aggregate.singleCampusConfigurations += count;
      if (campusCount > 1) aggregate.multiCampusConfigurations += count;
      if (state.sameDayCrossCampus) aggregate.sameDayCrossCampusConfigurationCount += count;
      else aggregate.configurationsWithoutSameDayTravel += count;
      if (state.sameTermMultiCampus) aggregate.sameTermMultiCampusConfigurationCount += count;
      if (campusCount > 1 && !state.sameTermMultiCampus) aggregate.crossTermOnlyMultiCampusConfigurationCount += count;
    });
  }

  function finalizeCampusEnumeration(aggregate, total, exact, cappedAt) {
    return {
      ...aggregate,
      viableConfigurationCount: total,
      exact,
      lowerBound: !exact,
      cappedAt
    };
  }

  function physicalCampusesForSections(sections = []) {
    return [...new Set((sections || []).map(section => section.physicalCampus || scheduleBuilder.normalizeCampus?.(section)?.physicalCampus || campusUtils.normalizeCampus?.(section)?.physicalCampus || '').filter(Boolean))].sort();
  }

  function campusBurden(schedules = []) {
    const best = schedules.map(schedule => {
      const byTerm = groupBy(schedule.sections || [], section => section.term || schedule.term || 'Unassigned');
      const campusByTerm = Object.entries(byTerm).map(([term, sections]) => ({ term, campuses: physicalCampusesForSections(sections) }));
      const combination = physicalCampusesForSections(schedule.sections || []);
      const termsUsingMultipleCampuses = campusByTerm.filter(item => item.campuses.length > 1).map(item => item.term);
      const sameDayCrossCampusConflicts = sameDayCampusConflicts(schedule.sections || []);
      const burdenLevel = sameDayCrossCampusConflicts.length ? 'critical' : termsUsingMultipleCampuses.length ? 'moderate' : combination.length > 1 ? 'low' : 'none';
      return { minimumCampusCount: combination.length || 0, campusCombination: combination, campusChangesAcrossTerms: countCampusChanges(campusByTerm), termsUsingMultipleCampuses, sameDayCrossCampusConflicts, burdenLevel };
    }).sort((a, b) => burdenRank(a.burdenLevel) - burdenRank(b.burdenLevel) || a.minimumCampusCount - b.minimumCampusCount)[0];
    return best || { minimumCampusCount: null, campusCombination: [], campusChangesAcrossTerms: 0, termsUsingMultipleCampuses: [], sameDayCrossCampusConflicts: [], burdenLevel: 'none' };
  }

  function sameDayCampusConflicts(sections = []) {
    const conflicts = [];
    for (let i = 0; i < sections.length; i += 1) {
      for (let j = i + 1; j < sections.length; j += 1) {
        const leftCampus = sections[i].physicalCampus || scheduleBuilder.normalizeCampus?.(sections[i])?.physicalCampus || '';
        const rightCampus = sections[j].physicalCampus || scheduleBuilder.normalizeCampus?.(sections[j])?.physicalCampus || '';
        if (!leftCampus || !rightCampus || leftCampus === rightCampus) continue;
        (sections[i].meetings || []).forEach(left => (sections[j].meetings || []).forEach(right => {
          if (!left.timed || !right.timed || !left.days.some(day => right.days.includes(day))) return;
          conflicts.push({ leftCourse: sections[i].courseKey, rightCourse: sections[j].courseKey, day: left.days.find(day => right.days.includes(day)), leftCampus, rightCampus });
        }));
      }
    }
    return conflicts;
  }

  function countCampusChanges(campusByTerm = []) {
    let changes = 0;
    for (let index = 1; index < campusByTerm.length; index += 1) {
      if ((campusByTerm[index - 1].campuses || []).join('|') !== (campusByTerm[index].campuses || []).join('|')) changes += 1;
    }
    return changes;
  }

  function burdenRank(value) {
    return { none: 0, low: 1, moderate: 2, critical: 3 }[value] ?? 9;
  }

  function scenarioCoursesPreventingCompletion(counts) {
    return [...new Set((counts.blockers || []).flatMap(blocker => String(blocker.requirement || blocker.issue || '').match(/[A-Z]{2,5}\s+\w+/g) || []))];
  }

  function coursesForcingCampusTravel(pathways = [], sections = [], scenario = {}) {
    if (!scenario.physicalCampusesAllowed || scenario.maximumPhysicalCampuses !== 1) return [];
    const allowed = new Set((scenario.physicalCampusesAllowed || []).map(String));
    const normalized = scheduleBuilder.normalizeSections ? scheduleBuilder.normalizeSections(sections) : [];
    const byCourse = groupBy(normalized, section => normalizeCourseKey(section.courseKey));
    const details = [];
    const seen = new Set();
    (pathways || []).forEach(pathway => (pathway.courses || []).forEach(course => {
      const key = normalizeCourseKey(course.courseKey);
      if (seen.has(key)) return;
      const courseSections = byCourse[key] || [];
      const physical = courseSections.filter(section => section.physicalCampus);
      const online = courseSections.filter(section => !section.physicalCampus && (section.campusClassification?.isOnline || scheduleBuilder.normalizeCampus?.(section)?.isOnline));
      const offeredCampuses = [...new Set(physical.map(section => section.physicalCampus))].sort();
      const campusCompatible = offeredCampuses.some(campus => allowed.has(campus));
      const onlineCompatible = scenario.onlineMode !== 'exclude' && online.length > 0;
      if (courseSections.length && !campusCompatible && !onlineCompatible) {
        seen.add(key);
        details.push({
          courseKey: key,
          requirementGroup: (course.groups || pathway.groups || []).join('; ') || 'Program requirement',
          termsOffered: [...new Set(courseSections.map(section => normalizeTermLabel(section.term)).filter(Boolean))].sort(compareTerms).join('; '),
          campusesOffered: offeredCampuses.join('; ') || 'No known physical campus',
          onlineAvailability: online.length ? 'Available online' : 'No online section in selected window',
          alternativeSatisfiesRequirement: false
        });
      }
    }));
    return details;
  }

  function scenarioById(scenarios, id) {
    return (scenarios || []).find(scenario => scenario.scenarioId === id) || {};
  }

  function summarizeViability(availability, pathwayResult, counts, blockers, resilience, scenarios, analysisScope) {
    const visalia = scenarioById(scenarios, 'visalia-physical-only');
    const hanford = scenarioById(scenarios, 'hanford-physical-only');
    const tulare = scenarioById(scenarios, 'tulare-physical-only');
    const anySingle = scenarioById(scenarios, 'any-single-campus');
    const anySingleOnline = scenarioById(scenarios, 'any-single-campus-plus-online');
    const onlineOnly = scenarioById(scenarios, 'online-only');
    const physicalOnly = scenarioById(scenarios, 'physical-only');
    const includeOnline = scenarioById(scenarios, 'all-campuses-online');
    const status = !availability.courseRows.length ? 'insufficient-data'
      : blockers.some(blocker => blocker.severity === 'High') && !counts.rawCrnConfigurationCount ? 'not-viable'
      : counts.rawCrnConfigurationCount >= 25 && anySingle.feasible ? 'healthy'
      : counts.rawCrnConfigurationCount > 0 ? 'moderate-risk'
      : 'high-risk';
    const minimumPhysicalCampusesRequired = (scenarios || []).filter(scenario => scenario.feasible && scenario.minimumPhysicalCampusesRequired != null)
      .map(scenario => scenario.minimumPhysicalCampusesRequired).sort((a, b) => a - b)[0] ?? null;
    const onlineDependency = onlineOnly.feasible && !physicalOnly.feasible ? 'Required' : onlineOnly.feasible ? 'Optional' : 'None';
    return {
      overallStatus: status,
      requirementCoveragePct: availability.coveragePct,
      sequenceViable: pathwayResult.count > 0,
      standardLoadViable: pathwayResult.pathways.some(pathway => pathway.loadStatus === 'Within configured load limits'),
      academicPathwayCount: pathwayResult.count,
      sectionConfigurationCount: counts.rawCrnConfigurationCount,
      meaningfulPatternCount: counts.meaningfulPatternCount,
      singleCampusViable: Boolean(anySingle.feasible),
      completeEntirelyAtOnePhysicalCampus: Boolean(anySingle.feasible),
      completeWithoutMultipleCampusesWhenOnlineAllowed: Boolean(anySingleOnline.feasible),
      minimumPhysicalCampusesRequired,
      onlineOnlyViable: Boolean(onlineOnly.feasible),
      onlineDependency,
      onlineDependencyBoolean: includeOnline.feasible && !physicalOnly.feasible,
      visaliaOnlyViable: Boolean(visalia.feasible),
      hanfordOnlyViable: Boolean(hanford.feasible),
      tulareOnlyViable: Boolean(tulare.feasible),
      sameDayTravelRisk: (scenarios || []).some(scenario => scenario.sameDayCrossCampusConfigurationsExist),
      sameDayTravelUnavoidable: (scenarios || []).some(scenario => scenario.sameDayCrossCampusUnavoidable),
      primaryBlockers: blockers.slice(0, 5),
      confidence: counts.exact && analysisScope.fullAwardAnalysis ? 'high' : counts.rawCrnConfigurationCount > 0 ? 'medium' : 'low',
      resilience: resilience.resilience
    };
  }

  function programHealthComponents(availability, pathwayResult, counts, resilience, scenarios, summary, config) {
    const components = {
      requirementCoverage: Math.round((availability.coveragePct || 0) * 100),
      sequenceViability: pathwayResult.count > 0 ? 100 : 0,
      configurationFlexibility: Math.min(100, counts.meaningfulPatternCount * 10),
      campusAccessibility: summary.singleCampusViable ? 100 : summary.minimumPhysicalCampusesRequired === 2 ? 60 : summary.minimumPhysicalCampusesRequired ? 35 : 0,
      onlineAccessibility: summary.onlineOnlyViable ? 100 : summary.onlineDependency === 'Optional' ? 80 : 40,
      offeringReliability: reliabilityScore(availability.courseRows),
      resilience: { High: 100, Moderate: 60, Low: 30, None: 0 }[resilience.resilience] || 0
    };
    const weights = config.healthWeights || {};
    const score = Object.entries(components).reduce((sum, [key, value]) => sum + value * (weights[key] ?? 0), 0);
    return { components, weights, score: Math.round(score) };
  }

  function reliabilityScore(rows = []) {
    if (!rows.length) return 0;
    const scores = { High: 100, Moderate: 65, Low: 35, None: 0 };
    return Math.round(rows.reduce((sum, row) => sum + (scores[row.reliability] || 0), 0) / rows.length);
  }

  function generateRecommendations(program, availability, counts, scenarios, blockers, summary) {
    const recommendations = [];
    blockers.filter(blocker => blocker.severity === 'High').slice(0, 8).forEach(blocker => {
      const course = (String(blocker.issue || blocker.requirement || '').match(/[A-Z]{2,5}\s+\w+/) || [blocker.requirement || ''])[0];
      recommendations.push(recommendation('add-course-offering', course, program, summary, counts, `Offer ${course || 'the missing requirement'} in the two-year window to remove a blocking requirement.`));
    });
    ['visalia-physical-only', 'hanford-physical-only', 'tulare-physical-only'].forEach(id => {
      const scenario = scenarioById(scenarios, id);
      if (!scenario.feasible) {
        const campus = scenario.physicalCampusesAllowed?.[0] || scenario.label.replace(' physical only', '');
        recommendations.push(recommendation('add-campus-offering', scenario.coursesPreventingCompletion[0] || '', program, summary, counts, `Add or rotate a required course at ${campus} to improve single-campus completion.`, campus));
      }
    });
    if (!scenarioById(scenarios, 'online-only').feasible) {
      recommendations.push(recommendation('add-online-offering', '', program, summary, counts, 'Add online options for one or more blocking requirements if online completion is an institutional goal.', '', 'online'));
    }
    return recommendations.slice(0, 12);
  }

  function recommendation(actionType, courseKey, program, summary, counts, explanation, campus = '', onlineMode = '') {
    return {
      actionType,
      courseKey,
      proposedCampus: campus,
      proposedOnlineMode: onlineMode,
      programsImproved: [program.programName || program.programId],
      simulated: false,
      currentViabilityStatus: summary.overallStatus,
      projectedViabilityStatus: '',
      configurationsBefore: '',
      configurationsAfter: '',
      configurationsAdded: '',
      meaningfulPatternsBefore: '',
      meaningfulPatternsAfter: '',
      campusEffect: campus ? `Potential ${campus} access improvement` : '',
      onlineEffect: onlineMode ? 'Potential online-completion improvement' : '',
      confidence: 'low',
      explanation
    };
  }

  function simulateScheduleChange(program, sectionRows = [], change = {}, options = {}) {
    const before = evaluateProgramFeasibility(program, sectionRows, options);
    const cloned = JSON.parse(JSON.stringify(sectionRows || []));
    if (change.action === 'add-section') cloned.push({ ...change.section, simulated: true });
    if (change.action === 'remove-section') {
      const target = String(change.crn || '');
      for (let index = cloned.length - 1; index >= 0; index -= 1) if (String(cloned[index].crn || cloned[index].CRN || '') === target) cloned.splice(index, 1);
    }
    if (change.action === 'change-section') {
      const target = String(change.crn || '');
      cloned.forEach(row => {
        if (String(row.crn || row.CRN || '') === target) Object.assign(row, change.patch || {});
      });
    }
    const after = evaluateProgramFeasibility(program, cloned, options);
    return {
      before,
      after,
      sourceRowsMutated: false,
      configurationsBefore: before.configurationCounts.rawCrnConfigurationCount,
      configurationsAfter: after.configurationCounts.rawCrnConfigurationCount,
      configurationsAdded: after.configurationCounts.rawCrnConfigurationCount - before.configurationCounts.rawCrnConfigurationCount,
      meaningfulPatternsBefore: before.configurationCounts.meaningfulPatternCount,
      meaningfulPatternsAfter: after.configurationCounts.meaningfulPatternCount,
      programsImproved: after.configurationCounts.rawCrnConfigurationCount > before.configurationCounts.rawCrnConfigurationCount ? [program.programName || program.programId] : [],
      singleCampusChanges: before.viabilitySummary.singleCampusViable !== after.viabilitySummary.singleCampusViable ? [`Single-campus viability changed from ${before.viabilitySummary.singleCampusViable ? 'Yes' : 'No'} to ${after.viabilitySummary.singleCampusViable ? 'Yes' : 'No'}.`] : [],
      onlineViabilityChanges: before.viabilitySummary.onlineOnlyViable !== after.viabilitySummary.onlineOnlyViable ? [`Online-only viability changed from ${before.viabilitySummary.onlineOnlyViable ? 'Yes' : 'No'} to ${after.viabilitySummary.onlineOnlyViable ? 'Yes' : 'No'}.`] : [],
      exact: before.configurationCounts.exact && after.configurationCounts.exact,
      lowerBound: before.configurationCounts.lowerBound || after.configurationCounts.lowerBound,
      assumptions: ['Simulation is non-mutating and uses the current schedule-builder constraints and campus transition assumptions.']
    };
  }

  function evaluateProgramPortfolio(programs = [], sectionRows = [], options = {}) {
    const { approvedYear, activePrograms } = activePortfolioPrograms(programs);
    const programResults = activePrograms.map(program => evaluateProgramFeasibility(program, sectionRows, options));
    return summarizePortfolioResult(approvedYear, programResults);
  }

  async function evaluateProgramPortfolioAsync(programs = [], sectionRows = [], options = {}) {
    const { approvedYear, activePrograms } = activePortfolioPrograms(programs);
    const cache = options.cache || portfolioResultCache;
    const scheduleVersion = options.scheduleVersion || scheduleFingerprint(sectionRows);
    const optionVersion = analysisOptionsFingerprint(options);
    const programResults = [];
    const cap = Number(options.portfolioProgramCap || activePrograms.length) || activePrograms.length;
    for (let index = 0; index < activePrograms.length && index < cap; index += 1) {
      if (typeof options.shouldCancel === 'function' && options.shouldCancel()) break;
      const program = activePrograms[index];
      const key = [approvedYear, program.programId, program.catalogYear, programRequirementsFingerprint(program), scheduleVersion, optionVersion].join('|');
      let result = cache.get(key);
      if (!result) {
        result = evaluateProgramFeasibility(program, sectionRows, options);
        cache.set(key, result);
      }
      programResults.push(result);
      if (typeof options.onProgress === 'function') options.onProgress({ evaluated: index + 1, total: activePrograms.length, program });
      if ((index + 1) % Number(options.portfolioYieldEvery || 3) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const summary = summarizePortfolioResult(approvedYear, programResults);
    summary.programsRequested = activePrograms.length;
    summary.cancelled = programResults.length < activePrograms.length && typeof options.shouldCancel === 'function' && options.shouldCancel();
    summary.cappedAt = activePrograms.length > cap ? cap : undefined;
    return summary;
  }

  function activePortfolioPrograms(programs = []) {
    const approvedYear = programRequirements.getMostRecentApprovedCatalogYear
      ? programRequirements.getMostRecentApprovedCatalogYear(programs)
      : [...new Set((programs || []).filter(program => String(program.reviewStatus || '').toLowerCase() === 'approved').map(program => program.catalogYear).filter(Boolean))].sort().pop();
    const activePrograms = (programs || []).filter(program => String(program.reviewStatus || '').toLowerCase() === 'approved' && String(program.catalogYear || '') === String(approvedYear || ''));
    return { approvedYear: approvedYear || '', activePrograms };
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

  function scheduleFingerprint(rows = []) {
    return shortHash((rows || []).map(row => ({
      term: normalizeTermLabel(row.term || row.Term),
      crn: row.crn || row.CRN,
      subject: row.subject || row.Subject || row.SUBJECT,
      course: row.course || row.Course || row.COURSE,
      campus: row.campus || row.Campus,
      modality: row.modality || row.Modality || row.instructionalMethod || row.INSTRUCTIONAL_METHOD,
      days: row.days || row.Days,
      start: row.start || row.startTime || row['Start Time'],
      end: row.end || row.endTime || row['End Time'],
      cap: row.cap ?? row.sectionCap ?? row.Capacity,
      enrollment: row.census ?? row.actual ?? row.Enrollment
    })));
  }

  function programRequirementsFingerprint(program = {}) {
    return shortHash({
      programId: program.programId,
      catalogYear: program.catalogYear,
      programName: program.programName,
      awardType: program.awardType,
      totalUnitsRequired: program.totalUnitsRequired,
      minimumProgramUnits: program.minimumProgramUnits,
      includeCalGetcRequirements: program.includeCalGetcRequirements === true,
      calGetcSourceRevisionId: program.calGetcSourceRevisionId || '',
      reviewStatus: program.reviewStatus,
      requirementGroups: program.requirementGroups || [],
      source: program.source || {}
    });
  }

  function analysisOptionsFingerprint(options = {}) {
    return shortHash({
      selectedTerm: normalizeTermLabel(options.selectedTerm || options.endingTerm || ''),
      windowType: options.windowType || 'full',
      onlineMode: options.onlineMode || 'include',
      campusTransitionMinutes: options.campusTransitionMinutes || {},
      enableCampusTravelConflictChecking: options.enableCampusTravelConflictChecking !== false,
      sectionConfigurationCap: options.sectionConfigurationCap,
      academicPathwayCap: options.academicPathwayCap,
      topSchedulesRetained: options.topSchedulesRetained,
      meaningfulPatternCap: options.meaningfulPatternCap,
      includeFullSections: options.includeFullSections === true,
      includeWaitlistedSections: options.includeWaitlistedSections === true,
      includeUnknownSeatStatus: options.includeUnknownSeatStatus === true,
      preferredCampuses: options.preferredCampuses || [],
      allowedPhysicalCampuses: options.allowedPhysicalCampuses || [],
      allowedModalities: options.allowedModalities || [],
      maximumPhysicalCampuses: options.maximumPhysicalCampuses
    });
  }

  function summarizePortfolioResult(approvedYear, programResults = []) {
    const statusCount = status => programResults.filter(result => result.viabilitySummary?.overallStatus === status).length;
    const sharedCourseBlockers = sharedBlockerAnalysis(programResults);
    const sharedTimeConflicts = sharedTimeConflictAnalysis(programResults);
    return {
      activeCatalogYear: approvedYear || '',
      programsEvaluated: programResults.length,
      healthyPrograms: statusCount('healthy'),
      moderateRiskPrograms: statusCount('moderate-risk'),
      highRiskPrograms: statusCount('high-risk'),
      notViablePrograms: statusCount('not-viable'),
      insufficientDataPrograms: statusCount('insufficient-data'),
      singleCampusViablePrograms: programResults.filter(result => result.viabilitySummary?.singleCampusViable).length,
      multiCampusRequiredPrograms: programResults.filter(result => Number(result.viabilitySummary?.minimumPhysicalCampusesRequired || 0) > 1).length,
      onlineOnlyViablePrograms: programResults.filter(result => result.viabilitySummary?.onlineOnlyViable).length,
      onlineDependentPrograms: programResults.filter(result => result.viabilitySummary?.onlineDependency === 'Required').length,
      campusResultIndeterminatePrograms: programResults.filter(result => result.unknownCampusDiagnostics?.indeterminate).length,
      programResults,
      sharedCourseBlockers,
      sharedTimeConflicts,
      candidateRecommendations: sharedCourseBlockers.slice(0, 10).map((blocker, index) => ({
        priority: index + 1,
        proposedChange: blocker.recommendedAction,
        programsImproved: blocker.programsAffected,
        affectedPrograms: blocker.programNames,
        blockerFrequency: blocker.programsAffected,
        proposedCourse: blocker.course,
        proposedTerm: '',
        proposedCampus: '',
        proposedModality: '',
        qualitativeRationale: `Addresses a blocker affecting ${blocker.programsAffected} program(s).`,
        simulated: false,
        configurationsAdded: '',
        campusAccessImprovement: blocker.campusesOffered || '',
        onlineAccessImprovement: blocker.onlineAvailability || '',
        confidence: blocker.confidence
      })),
      priorityRecommendations: sharedCourseBlockers.slice(0, 10).map((blocker, index) => ({
        priority: index + 1,
        proposedChange: blocker.recommendedAction,
        programsImproved: blocker.programsAffected,
        configurationsAdded: '',
        campusAccessImprovement: blocker.campusesOffered || '',
        onlineAccessImprovement: blocker.onlineAvailability || '',
        confidence: blocker.confidence,
        simulated: false
      })),
      simulatedRecommendations: []
    };
  }

  function simulatePortfolioRecommendation(programs = [], sectionRows = [], change = {}, options = {}) {
    const before = evaluateProgramPortfolio(programs, sectionRows, options);
    const cloned = JSON.parse(JSON.stringify(sectionRows || []));
    if (change.action === 'add-section') cloned.push({ ...change.section, simulated: true });
    if (change.action === 'remove-section') {
      const target = String(change.crn || '');
      for (let index = cloned.length - 1; index >= 0; index -= 1) if (String(cloned[index].crn || cloned[index].CRN || '') === target) cloned.splice(index, 1);
    }
    if (change.action === 'change-section' || change.action === 'change-campus' || change.action === 'change-modality' || change.action === 'change-day-time') {
      const target = String(change.crn || '');
      cloned.forEach(row => {
        if (String(row.crn || row.CRN || '') === target) Object.assign(row, change.patch || {});
      });
    }
    const after = evaluateProgramPortfolio(programs, cloned, options);
    const beforeByProgram = new Map((before.programResults || []).map(result => [result.program?.programId, result]));
    const programsImproved = [];
    const programsWorsened = [];
    const programsUnchanged = [];
    (after.programResults || []).forEach(result => {
      const prior = beforeByProgram.get(result.program?.programId);
      const beforeCount = prior?.configurationCounts?.rawCrnConfigurationCount || 0;
      const afterCount = result.configurationCounts?.rawCrnConfigurationCount || 0;
      const name = result.program?.programName || result.program?.programId || 'Program';
      if (afterCount > beforeCount) programsImproved.push(name);
      else if (afterCount < beforeCount) programsWorsened.push(name);
      else programsUnchanged.push(name);
    });
    const sum = (portfolio, getter) => (portfolio.programResults || []).reduce((total, result) => total + Number(getter(result) || 0), 0);
    return {
      simulated: true,
      programsEvaluated: after.programsEvaluated,
      programsImproved,
      programsWorsened,
      programsUnchanged,
      configurationsBefore: sum(before, result => result.configurationCounts?.rawCrnConfigurationCount),
      configurationsAfter: sum(after, result => result.configurationCounts?.rawCrnConfigurationCount),
      configurationsAdded: sum(after, result => result.configurationCounts?.rawCrnConfigurationCount) - sum(before, result => result.configurationCounts?.rawCrnConfigurationCount),
      meaningfulPatternsBefore: sum(before, result => result.configurationCounts?.meaningfulPatternCount),
      meaningfulPatternsAfter: sum(after, result => result.configurationCounts?.meaningfulPatternCount),
      singleCampusProgramsBefore: before.singleCampusViablePrograms,
      singleCampusProgramsAfter: after.singleCampusViablePrograms,
      onlineDependentProgramsBefore: before.onlineDependentPrograms,
      onlineDependentProgramsAfter: after.onlineDependentPrograms,
      blockersResolved: (before.sharedCourseBlockers || []).filter(blocker => !(after.sharedCourseBlockers || []).some(afterBlocker => afterBlocker.course === blocker.course)).map(blocker => blocker.course),
      conflictsIntroduced: (after.sharedTimeConflicts || []).filter(conflict => !(before.sharedTimeConflicts || []).some(beforeConflict => beforeConflict.courseKeys.join('|') === conflict.courseKeys.join('|'))).map(conflict => conflict.courseKeys.join(' + ')),
      exact: (after.programResults || []).every(result => result.configurationCounts?.exact),
      lowerBound: (after.programResults || []).some(result => result.configurationCounts?.lowerBound),
      assumptions: ['Portfolio simulation is non-mutating and uses the current Program Schedule Viability options.']
    };
  }

  function sharedBlockerAnalysis(programResults = []) {
    const byCourse = new Map();
    programResults.forEach(result => {
      (result.blockers || []).forEach(blocker => {
        const blockerText = [blocker.requirement, blocker.issue, blocker.effect, blocker.suggestedAction].map(value => String(value || '')).join(' ');
        if (!/No available course selection|Not offered|missing/i.test(blockerText)) return;
        if (/No conflict-free CRN configurations/i.test(blockerText)) return;
        const courses = blockerText.match(/[A-Z]{2,5}\s+\w+/g) || [];
        courses.forEach(course => {
          const key = normalizeCourseKey(course);
          const entry = byCourse.get(key) || {
            course: key,
            programs: new Set(),
            requirementGroups: new Set(),
            termsOffered: new Set(),
            campusesOffered: new Set(),
            onlineAvailability: 'Unknown',
            currentSectionCount: 0,
            severity: blocker.severity || 'Medium',
            confidence: 'medium'
          };
          entry.programs.add(result.program?.programName || result.program?.programId || 'Program');
          entry.requirementGroups.add(blocker.requirement || 'Requirement');
          const coverage = (result.requirementCoverage || []).find(row => row.courseKey === key);
          (coverage?.termsOffered || []).forEach(term => entry.termsOffered.add(term));
          Object.keys(coverage?.campusMix || {}).forEach(campus => entry.campusesOffered.add(campus));
          entry.currentSectionCount += Number(coverage?.sections || 0);
          byCourse.set(key, entry);
        });
      });
    });
    return [...byCourse.values()].map(entry => ({
      course: entry.course,
      programsAffected: entry.programs.size,
      programNames: [...entry.programs].join('; '),
      requirementGroupsAffected: [...entry.requirementGroups].join('; '),
      termsOffered: [...entry.termsOffered].join('; ') || 'Not offered in selected window',
      campusesOffered: [...entry.campusesOffered].join('; ') || 'Unknown',
      onlineAvailability: entry.onlineAvailability,
      currentSectionCount: entry.currentSectionCount,
      recommendedAction: `Add or rotate ${entry.course} in a term/campus pattern that restores the most blocked program pathways.`,
      severity: entry.severity,
      confidence: entry.confidence
    })).sort((a, b) => b.programsAffected - a.programsAffected || b.currentSectionCount - a.currentSectionCount);
  }

  function sharedTimeConflictAnalysis(programResults = []) {
    const conflicts = new Map();
    programResults.forEach(result => {
      const coverageComplete = (result.availability?.coveragePct || 0) >= 1;
      const sequenceFits = (result.pathwayResult?.count || 0) > 0;
      const noConfigurations = (result.configurationCounts?.rawCrnConfigurationCount || 0) === 0;
      const hasMissing = (result.blockers || []).some(blocker => /No available course selection|Not offered|missing/i.test(`${blocker.issue || ''} ${blocker.effect || ''}`));
      if (!coverageComplete || !sequenceFits || !noConfigurations || hasMissing) return;
      (result.pathwayResult.pathways || []).slice(0, 10).forEach(pathway => {
        const courseKeys = (pathway.courses || []).map(course => normalizeCourseKey(course.courseKey)).sort();
        const key = courseKeys.join('|') || result.program?.programId || '';
        if (!key) return;
        const entry = conflicts.get(key) || {
          courseKeys,
          programsAffected: new Set(),
          termsAffected: new Set(),
          campusesAffected: new Set(),
          currentSectionCrns: new Set(),
          recurringDayTimePattern: 'Overlapping required-course section bundle',
          avoidableWithExistingAlternatives: false,
          suggestedAction: 'Add a non-overlapping section option or rotate one required course to another day/time.',
          confidence: result.configurationCounts?.exact ? 'high' : 'medium'
        };
        entry.programsAffected.add(result.program?.programName || result.program?.programId || 'Program');
        (pathway.termAssignments || []).forEach(item => entry.termsAffected.add(item.term));
        (result.configurationCounts?.topSchedules || []).flatMap(schedule => schedule.sections || []).forEach(section => {
          if (section.campus) entry.campusesAffected.add(section.campus);
          if (section.crn) entry.currentSectionCrns.add(section.crn);
        });
        conflicts.set(key, entry);
      });
    });
    return [...conflicts.values()].map(entry => ({
      courseKeys: entry.courseKeys,
      programsAffected: [...entry.programsAffected],
      termsAffected: [...entry.termsAffected],
      recurringDayTimePattern: entry.recurringDayTimePattern,
      campusesAffected: [...entry.campusesAffected],
      currentSectionCrns: [...entry.currentSectionCrns],
      avoidableWithExistingAlternatives: entry.avoidableWithExistingAlternatives,
      suggestedAction: entry.suggestedAction,
      confidence: entry.confidence
    })).sort((a, b) => b.programsAffected.length - a.programsAffected.length || b.courseKeys.length - a.courseKeys.length);
  }

  function analyzeScope(program, pathwayResult) {
    const structuredUnitsRepresented = Math.max(0, ...((pathwayResult.pathways || []).map(pathway => Number(pathway.units || 0))), 0);
    const awardTotalUnitsRequired = Number(program.totalUnitsRequired || program.minimumProgramUnits || structuredUnitsRepresented || 0);
    const unmodeledUnits = Math.max(0, awardTotalUnitsRequired - structuredUnitsRepresented);
    const fullAwardAnalysis = awardTotalUnitsRequired > 0 && structuredUnitsRepresented >= awardTotalUnitsRequired;
    const blockers = fullAwardAnalysis || !awardTotalUnitsRequired ? [] : [{
      severity: 'Medium',
      requirement: 'Analysis scope',
      issue: `Only ${structuredUnitsRepresented} of ${awardTotalUnitsRequired} award units are represented in structured requirements.`,
      effect: 'The report can evaluate program-major requirements but should not be read as full degree completion feasibility.',
      suggestedAction: 'Add GE, elective, or remaining award requirements before using this as a full-award feasibility finding.'
    }];
    return {
      structuredUnitsRepresented,
      awardTotalUnitsRequired,
      unmodeledUnits,
      generalEducationIncluded: program.calGetcRequirementsIncluded === true,
      generalEducationSource: program.calGetcSourceProgramName || '',
      generalEducationCatalogYear: program.calGetcSourceCatalogYear || '',
      programOnlyAnalysis: !fullAwardAnalysis,
      fullAwardAnalysis,
      blockers
    };
  }

  function groupBy(items, getKey) {
    return (items || []).reduce((acc, item) => {
      const key = getKey(item) || 'Unassigned';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function combinePatternHashes(left, right, cap) {
    if (!right.length) return left;
    const output = [];
    for (const a of left) {
      for (const b of right) {
        output.push([a, b].filter(Boolean).join('||'));
        if (output.length >= cap) return output;
      }
    }
    return output;
  }

  function meaningfulPatternHash(sections = []) {
    return sections.map(section => [
      section.courseKey,
      section.modality,
      section.campus,
      ...(section.meetings || []).map(meeting => `${(meeting.days || []).join('')}:${meeting.startMinutes}-${meeting.endMinutes}`)
    ].join('|')).sort().join('||');
  }

  function analyzeResilience(availability, pathwayResult) {
    const weakest = [...availability.courseRows].filter(row => row.sections > 0).sort((a, b) => reliabilityRank(a.reliability) - reliabilityRank(b.reliability) || a.sections - b.sections)[0];
    if (!weakest) return { courseKey: '', resilience: 'None', note: 'No offered courses were available for resilience analysis.' };
    const impacted = pathwayResult.pathways.filter(pathway => pathway.courses.some(course => course.courseKey === weakest.courseKey)).length;
    const remaining = Math.max(0, pathwayResult.pathways.length - impacted);
    return {
      courseKey: weakest.courseKey,
      baselinePathways: pathwayResult.pathways.length,
      pathwaysIfUnavailable: remaining,
      reduction: impacted,
      resilience: remaining === 0 ? 'Low' : remaining < pathwayResult.pathways.length / 2 ? 'Moderate' : 'High',
      note: 'Diagnostic approximation: removes the least reliable selected course from feasible pathway coverage.'
    };
  }

  function reliabilityRank(label) {
    return { None: 0, Low: 1, Moderate: 2, High: 3 }[label] || 0;
  }

  function overallFeasibility(availability, pathwayResult, counts, blockers, analysisScope) {
    if (!availability.courseRows.length || blockers.some(blocker => blocker.severity === 'High') && !counts.rawCrnConfigurationCount) return { label: 'Not Feasible', confidence: 'Low' };
    if (analysisScope.programOnlyAnalysis) return { label: 'Program Requirements Feasible - Partial Scope', confidence: counts.exact ? 'Moderate' : 'Low' };
    if (availability.coveragePct >= 0.95 && counts.meaningfulPatternCount >= 10) return { label: 'Moderate', confidence: 'Moderate' };
    if (availability.coveragePct >= 0.75 && counts.meaningfulPatternCount > 0) return { label: 'Fragile', confidence: 'Low' };
    return { label: 'Not Feasible', confidence: 'Low' };
  }

  function countBy(items, getKey) {
    return items.reduce((acc, item) => {
      const key = getKey(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function compareTerms(a, b) {
    if (termUtils.termSortValue) return termUtils.termSortValue(a) - termUtils.termSortValue(b);
    return String(a).localeCompare(String(b));
  }

  function dedupeBlockers(blockers) {
    const seen = new Set();
    return blockers.filter(blocker => {
      const key = [blocker.severity, blocker.requirement, blocker.issue].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function flexibilityRating(count) {
    if (count <= 0) return 'Not Feasible';
    if (count <= 2) return 'Extremely Fragile';
    if (count <= 9) return 'Low Flexibility';
    if (count <= 49) return 'Moderate Flexibility';
    return 'High Flexibility';
  }

  return Object.freeze({
    DEFAULT_CONFIG,
    PHYSICAL_CAMPUSES,
    normalizeTermLabel,
    evaluateProgramFeasibility,
    analyzeAvailability,
    enumerateAcademicPathways,
    assignTerms,
    countSectionConfigurations,
    evaluateCampusScenarios,
    evaluateProgramPortfolio,
    evaluateProgramPortfolioAsync,
    simulatePortfolioRecommendation,
    simulateScheduleChange,
    scheduleFingerprint,
    programRequirementsFingerprint,
    analysisOptionsFingerprint,
    meaningfulPatternHash,
    flexibilityRating
  });
});
