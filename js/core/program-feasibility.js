(function (root, factory) {
  const api = factory(root.COSScheduleBuilder, root.COSProgramRequirements, root.COSFeasibilityTermWindow, root.COSTermUtils);
  root.COSProgramFeasibility = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (scheduleBuilder, programRequirements, termWindowUtils, termUtils) {
  'use strict';

  scheduleBuilder = scheduleBuilder || {};
  programRequirements = programRequirements || {};
  termWindowUtils = termWindowUtils || {};
  termUtils = termUtils || {};

  const DEFAULT_CONFIG = Object.freeze({
    primarySemesterMinUnits: 12,
    primarySemesterTargetUnits: 15,
    primarySemesterMaxUnits: 18,
    summerMaxUnits: 9,
    academicPathwayCap: 25000,
    sectionConfigurationCap: 10000,
    topSchedulesRetained: 50,
    reliabilityBands: { high: 0.75, moderate: 0.4 },
    enforceMinimumLoadAwardTypes: ['AA', 'AS', 'BA', 'BS', 'ADT', 'DEGREE']
  });

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
    const pathwayResult = enumerateAcademicPathways(program, availability, terms, config);
    const counts = countSectionConfigurations(pathwayResult.pathways, rowsInWindow, config, options);
    const analysisScope = analyzeScope(program, pathwayResult);
    const blockers = [...availability.blockers, ...pathwayResult.blockers, ...counts.blockers, ...analysisScope.blockers];
    const resilience = analyzeResilience(availability, pathwayResult);
    const feasibility = overallFeasibility(availability, pathwayResult, counts, blockers, analysisScope);
    return {
      reportTitle: 'Two-Year Completion Feasibility Based on Recent Scheduling History',
      program,
      selectedTerm: window.selectedTerm || selectedTerm,
      termsAnalyzed: terms,
      termWindow: window,
      analysisScope,
      availability,
      requirementCoverage: availability.courseRows,
      pathwayResult,
      configurationCounts: counts,
      resilience,
      overallFeasibility: feasibility.label,
      confidence: feasibility.confidence,
      blockers,
      limitations: [
        'This v1 model uses reviewed structured requirements and recent Section Seating history.',
        'It does not model individual completed coursework, transfer credit, placement, unencoded substitutions, or guaranteed future schedules.',
        'Catalog PDF extraction is intentionally deferred; future imports can populate the same structured program model.'
      ]
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
    if (group.rule === 'all') choices = cartesian([...courseChoices.map(choice => [choice]), ...subgroupChoices], config.academicPathwayCap);
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
    const blockers = [];
    const topSchedules = [];
    for (const pathway of pathways) {
      const assignmentsByTerm = groupBy(pathway.termAssignments || [], item => normalizeTermLabel(item.term));
      let pathwayRaw = 1;
      let pathwayPatterns = [''];
      let blocked = false;
      for (const [term, assignments] of Object.entries(assignmentsByTerm)) {
        const requests = assignments.map(item => ({ course: item.courseKey, required: true }));
        const termRows = (sections || []).filter(row => normalizeTermLabel(row.term || row.Term) === term);
        const result = scheduleBuilder.buildScheduleOptions
          ? scheduleBuilder.buildScheduleOptions(termRows, requests, { ...options, maxResults: config.topSchedulesRetained, maxVisited: config.sectionConfigurationCap, requireAllRequestedCourses: true, countMode: true })
          : { schedules: [], count: { viableConfigurationCount: 0, exact: true, combinationsVisited: 0, combinationsPruned: 0, capReached: false } };
        const viable = result.count?.viableConfigurationCount ?? result.schedules?.length ?? 0;
        combinationsVisited += result.count?.combinationsVisited || result.visited || 0;
        combinationsPruned += result.count?.combinationsPruned || 0;
        if (!result.count?.exact || result.count?.capReached) {
          exact = false;
          capReached = true;
        }
        if (!viable) {
          blocked = true;
          break;
        }
        pathwayRaw *= viable;
        const termPatterns = (result.schedules || []).map(schedule => `${term}:${meaningfulPatternHash(schedule.sections || [])}`);
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
        if (pathway.summerUsed) usingSummer += pathwayRaw;
        else withoutSummer += pathwayRaw;
        pathwayPatterns.forEach(pattern => { if (pattern) patterns.add(pattern); });
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
      configurationsUsingSummer: usingSummer,
      configurationsWithoutSummer: withoutSummer,
      standardLoadConfigurations: pathways.filter(pathway => pathway.loadStatus === 'Within configured load limits').length,
      combinationsVisited,
      combinationsPruned,
      topSchedules,
      blockers
    };
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
    normalizeTermLabel,
    evaluateProgramFeasibility,
    analyzeAvailability,
    enumerateAcademicPathways,
    assignTerms,
    countSectionConfigurations,
    meaningfulPatternHash,
    flexibilityRating
  });
});
