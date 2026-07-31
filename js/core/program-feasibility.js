(function (root, factory) {
  const api = factory(root.COSScheduleBuilder, root.COSProgramRequirements, root.COSFeasibilityTermWindow);
  root.COSProgramFeasibility = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (scheduleBuilder, programRequirements, termWindowUtils) {
  'use strict';

  scheduleBuilder = scheduleBuilder || {};
  programRequirements = programRequirements || {};
  termWindowUtils = termWindowUtils || {};
  const DEFAULT_CONFIG = Object.freeze({
    primarySemesterMinUnits: 12,
    primarySemesterTargetUnits: 15,
    primarySemesterMaxUnits: 18,
    summerMaxUnits: 9,
    academicPathwayCap: 25000,
    sectionConfigurationCap: 10000,
    topSchedulesRetained: 50,
    reliabilityBands: { high: 0.75, moderate: 0.4 }
  });

  function normalizeCourseKey(value) {
    if (programRequirements.normalizeCourseKey) return programRequirements.normalizeCourseKey(value);
    if (scheduleBuilder.normalizeCourseKey) return scheduleBuilder.normalizeCourseKey(value);
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function evaluateProgramFeasibility(program, sectionRows = [], options = {}) {
    const config = { ...DEFAULT_CONFIG, ...(options || {}) };
    const selectedTerm = options.selectedTerm || options.endingTerm || '';
    const window = termWindowUtils.determineFeasibilityTermWindow
      ? termWindowUtils.determineFeasibilityTermWindow(selectedTerm, sectionRows)
      : { selectedTerm, standardTerms: [], fullTerms: [], termsAvailableInRepository: [], missingTerms: [] };
    const terms = options.windowType === 'standard' ? window.standardTerms : window.fullTerms;
    const rowsInWindow = (sectionRows || []).filter(row => terms.includes(row.term || row.Term));
    const sections = (scheduleBuilder.normalizeSections ? scheduleBuilder.normalizeSections(rowsInWindow) : []).filter(section => terms.includes(section.term));
    const availability = analyzeAvailability(program, sections, terms, config);
    const pathwayResult = enumerateAcademicPathways(program, availability, terms, config);
    const counts = countSectionConfigurations(pathwayResult.pathways, rowsInWindow, config, options);
    const blockers = [...availability.blockers, ...pathwayResult.blockers, ...counts.blockers];
    const resilience = analyzeResilience(availability, pathwayResult, sections, config, options);
    const feasibility = overallFeasibility(availability, pathwayResult, counts, blockers);
    return {
      reportTitle: 'Two-Year Completion Feasibility Based on Recent Scheduling History',
      program,
      selectedTerm: window.selectedTerm || selectedTerm,
      termsAnalyzed: terms,
      termWindow: window,
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
      const termsOffered = [...new Set(matching.map(section => section.term).filter(Boolean))];
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
    const blockers = courseRows.filter(row => row.reliability === 'None').map(row => ({
      severity: 'High',
      requirement: row.courseKey,
      issue: `${row.courseKey} was not offered in the selected two-year window.`,
      effect: 'A pathway requiring this course is blocked unless an alternative satisfies the group.',
      suggestedAction: 'Review rotation history or schedule a section in the next two-year cycle.'
    }));
    return {
      courseRows,
      coveragePct: courseRows.length ? courseRows.filter(row => row.sections > 0).length / courseRows.length : 0,
      blockers
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
      const groupChoices = groupPathways(group, availability, config);
      if (!groupChoices.length) {
        blockers.push({
          severity: 'High',
          requirement: group.label,
          issue: 'No available course selection can satisfy this requirement group.',
          effect: 'No complete academic pathway can be constructed from recent schedule history.',
          suggestedAction: 'Review requirements or add missing course offerings.'
        });
      }
      pathways = combinePathwaySets(pathways, groupChoices, config.academicPathwayCap);
      if (pathways.capped) {
        capped = true;
        exact = false;
        pathways = pathways.items;
        break;
      }
      pathways = pathways.items || pathways;
    }
    const sequenced = [];
    for (const pathway of pathways) {
      const assignment = assignTerms(pathway.courses, terms, config, availability);
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
      lowerBound: sequenced.length,
      blockers
    };
  }

  function groupPathways(group, availability, config) {
    const courseChoices = (group.courses || []).map(course => ({
      courses: [{ ...course, courseKey: normalizeCourseKey(course.courseKey) }],
      groups: [group.label],
      units: Number(course.units || 0)
    })).filter(choice => hasCoverage(choice.courses[0].courseKey, availability));
    const subgroupChoices = (group.subgroups || []).map(subgroup => groupPathways(subgroup, availability, config));
    if (group.rule === 'all') return cartesian([...courseChoices.map(choice => [choice]), ...subgroupChoices], config.academicPathwayCap);
    if (group.rule === 'or') return [...courseChoices, ...subgroupChoices.flat()].slice(0, config.academicPathwayCap);
    if (group.rule === 'choose-count') return combinations(courseChoices, Number(group.chooseCount || 1), config.academicPathwayCap);
    if (group.rule === 'choose-units') return combinationsByUnits(courseChoices, Number(group.unitsRequired || 0), config.academicPathwayCap);
    if (group.rule === 'one-from-each-list') return cartesian(subgroupChoices, config.academicPathwayCap);
    return courseChoices;
  }

  function hasCoverage(courseKey, availability) {
    return availability.courseRows.some(row => row.courseKey === normalizeCourseKey(courseKey) && row.sections > 0);
  }

  function cartesian(lists, cap) {
    if (!lists.length) return [];
    let results = [{ courses: [], groups: [], units: 0 }];
    for (const list of lists) {
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
    for (let index = start; index < items.length && output.length < cap; index += 1) {
      combinations(items, count, cap, index + 1, [...selected, items[index]], output);
    }
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
    for (const left of leftSet) {
      for (const right of rightSet) {
        items.push(mergePathways(left, right));
        if (items.length >= cap) return { items, capped: true };
      }
    }
    return { items, capped: false };
  }

  function assignTerms(courses, terms, config, availability = {}) {
    const termLoads = Object.fromEntries(terms.map(term => [term, 0]));
    const offeredTermsByCourse = Object.fromEntries((availability.courseRows || []).map(row => [row.courseKey, new Set(row.termsOffered || [])]));
    const termAssignments = [];
    const assigned = new Set();
    const blockers = [];
    let safety = courses.length * courses.length + 1;
    while (assigned.size < courses.length && safety > 0) {
      safety -= 1;
      let progressed = false;
      for (const course of courses) {
        if (assigned.has(course.courseKey)) continue;
        const prereqs = (course.prerequisiteCourseKeys || []).map(normalizeCourseKey).filter(key => courses.some(item => item.courseKey === key));
        if (!prereqs.every(key => assigned.has(key))) continue;
        const termsOffered = offeredTermsByCourse[course.courseKey] || new Set(terms);
        const term = terms.find(candidate => {
          const max = /SUMMER/.test(candidate) ? config.summerMaxUnits : config.primarySemesterMaxUnits;
          return termsOffered.has(candidate) && termLoads[candidate] + Number(course.units || 0) <= max;
        });
        if (!term) {
          blockers.push({ severity: 'High', requirement: course.courseKey, issue: 'No term has enough remaining unit capacity.', effect: 'Pathway exceeds configured load limits.', suggestedAction: 'Increase unit limit or add summer/off-cycle offering.' });
          continue;
        }
        termLoads[term] += Number(course.units || 0);
        termAssignments.push({ term, courseKey: course.courseKey, units: Number(course.units || 0) });
        assigned.add(course.courseKey);
        progressed = true;
      }
      if (!progressed) break;
    }
    const unassigned = courses.filter(course => !assigned.has(course.courseKey));
    unassigned.forEach(course => blockers.push({ severity: 'High', requirement: course.courseKey, issue: 'Prerequisite sequence could not be resolved.', effect: 'A required sequence may be circular or missing explicit prerequisite coverage.', suggestedAction: 'Review encoded prerequisites and course offering order.' }));
    const summerUsed = termAssignments.some(item => /SUMMER/.test(item.term));
    const underloaded = Object.entries(termLoads).some(([term, units]) => !/SUMMER/.test(term) && units > 0 && units < config.primarySemesterMinUnits);
    return { valid: unassigned.length === 0, termAssignments, summerUsed, loadStatus: underloaded ? 'Underloaded term present' : 'Within configured load limits', blockers };
  }

  function countSectionConfigurations(pathways, sections, config, options = {}) {
    let raw = 0;
    const patterns = new Set();
    const blockers = [];
    const topSchedules = [];
    for (const pathway of pathways) {
      const assignmentsByTerm = groupBy(pathway.termAssignments || [], item => item.term);
      let pathwayRaw = 1;
      let pathwayPatterns = [''];
      let blocked = false;
      for (const [term, assignments] of Object.entries(assignmentsByTerm)) {
        const requests = assignments.map(item => ({ course: item.courseKey, required: true }));
        const termRows = (sections || []).filter(row => (row.term || row.Term) === term);
        const result = scheduleBuilder.buildScheduleOptions
          ? scheduleBuilder.buildScheduleOptions(termRows, requests, { ...options, maxResults: config.topSchedulesRetained, maxVisited: config.sectionConfigurationCap, requireAllRequestedCourses: true })
          : { schedules: [] };
        if (!result.schedules.length) {
          blocked = true;
          break;
        }
        pathwayRaw *= result.schedules.length;
        const termPatterns = result.schedules.map(schedule => `${term}:${meaningfulPatternHash(schedule.sections || [])}`);
        pathwayPatterns = combinePatternHashes(pathwayPatterns, termPatterns, config.sectionConfigurationCap);
        result.schedules.forEach(schedule => {
          if (topSchedules.length < config.topSchedulesRetained) topSchedules.push({ ...schedule, term });
        });
        if (result.pruned || pathwayRaw >= config.sectionConfigurationCap) break;
      }
      if (!blocked) {
        raw += pathwayRaw;
        pathwayPatterns.forEach(pattern => {
          if (pattern) patterns.add(pattern);
        });
      }
      if (raw >= config.sectionConfigurationCap) break;
    }
    if (!raw && pathways.length) blockers.push({ severity: 'High', requirement: 'Section schedules', issue: 'No conflict-free CRN configurations were found.', effect: 'Academic requirements may be covered historically but not simultaneously schedulable.', suggestedAction: 'Review day/time overlaps or add alternative sections.' });
    return {
      exact: raw < config.sectionConfigurationCap,
      count: raw,
      lowerBound: raw,
      cappedAt: raw >= config.sectionConfigurationCap ? config.sectionConfigurationCap : undefined,
      rawCrnConfigurationCount: raw,
      meaningfulPatternCount: patterns.size,
      configurationsUsingSummer: pathways.filter(pathway => pathway.summerUsed).length,
      configurationsWithoutSummer: pathways.filter(pathway => !pathway.summerUsed).length,
      standardLoadConfigurations: pathways.filter(pathway => pathway.loadStatus === 'Within configured load limits').length,
      topSchedules,
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

  function overallFeasibility(availability, pathwayResult, counts, blockers) {
    if (!availability.courseRows.length || blockers.some(blocker => blocker.severity === 'High') && !counts.rawCrnConfigurationCount) return { label: 'Not Feasible', confidence: 'Low' };
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

  function flexibilityRating(count) {
    if (count <= 0) return 'Not Feasible';
    if (count <= 2) return 'Extremely Fragile';
    if (count <= 9) return 'Low Flexibility';
    if (count <= 49) return 'Moderate Flexibility';
    return 'High Flexibility';
  }

  return Object.freeze({
    DEFAULT_CONFIG,
    evaluateProgramFeasibility,
    analyzeAvailability,
    enumerateAcademicPathways,
    meaningfulPatternHash,
    flexibilityRating
  });
});
