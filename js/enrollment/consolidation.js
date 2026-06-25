(function () {
  'use strict';

  const metrics = window.COSEnrollmentMetrics;
  if (!metrics) throw new Error('COSEnrollmentMetrics must load before consolidation analytics.');

  const {
    censusEnrollment,
    finalEnrollment,
    safeDiv,
    average,
    expectedEnrollment,
    expectedFillRate,
    expectedOpenSeats
  } = metrics;

  function group(rows, keyer) {
    const map = new Map();
    (rows || []).forEach(row => {
      const key = keyer(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function sum(rows, key) {
    return (rows || []).reduce((total, row) => total + (Number(row?.[key]) || 0), 0);
  }

  function median(values) {
    const sorted = (values || []).filter(value => value > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted[Math.floor(sorted.length / 2)];
  }

  function courseKey(section) {
    return `${section.subject} ${section.course}`;
  }

  function sectionIdentity(section, index = 0) {
    if (section?.crn) return `${section.term || 'UNKNOWN'}|${section.crn}`;
    return [section?.term, section?.subject, section?.course, section?.section, section?.modality, section?.campus, index].filter(Boolean).join('|');
  }

  function dedupeSections(rows) {
    const map = new Map();
    (rows || []).forEach((row, index) => {
      const key = sectionIdentity(row, index);
      if (!map.has(key)) map.set(key, row);
    });
    return [...map.values()];
  }

  function patternKey(section) {
    return [section.subject, section.course, section.campus, section.modality, section.dayPattern, section.start, section.end].join('-');
  }

  function isOnlineSection(row) {
    return row.modality === 'ONLINE';
  }

  function isTbaSection(row) {
    return row.dayPattern === 'TBA' || !row.start || row.start === '00:00';
  }

  function consolidationType(row) {
    if (row.modality === 'HYBRID') return 'Hybrid Consolidation';
    return 'In-Person Consolidation';
  }

  function enrollmentForBasis(row, basis = 'census') {
    if (basis === 'actual') return finalEnrollment(row);
    return censusEnrollment(row);
  }

  function historicalDemandMap(rows, basis = 'census') {
    const maps = { pattern: new Map(), course: new Map() };
    (rows || []).forEach(row => {
      addDemandSample(maps.pattern, patternKey(row), row, basis);
      addDemandSample(maps.course, courseKey(row), row, basis);
    });
    return {
      pattern: finalizeDemandMap(maps.pattern),
      course: finalizeDemandMap(maps.course)
    };
  }

  function addDemandSample(map, key, row, basis) {
    const enrollment = enrollmentForBasis(row, basis);
    const item = map.get(key) || { enrollments: [], fillRates: [], terms: new Set() };
    item.enrollments.push(enrollment);
    if (row.cap > 0) item.fillRates.push(enrollment / row.cap);
    item.terms.add(row.term || 'UNKNOWN');
    map.set(key, item);
  }

  function finalizeDemandMap(map) {
    const finalized = new Map();
    map.forEach((item, key) => {
      finalized.set(key, {
        enrollment: Math.round(average(item.enrollments)),
        fillRate: average(item.fillRates),
        terms: item.terms.size
      });
    });
    return finalized;
  }

  function withHistoricalEstimate(section, demand) {
    const exact = demand.pattern.get(patternKey(section));
    const fallback = demand.course.get(courseKey(section));
    const estimate = exact || fallback;
    if (!estimate || !estimate.terms) return null;
    const enrollment = Math.min(section.cap || estimate.enrollment, estimate.enrollment);
    return {
      ...section,
      actual: enrollment,
      finalEnrollment: finalEnrollment(section),
      expectedEnrollment: enrollment,
      expectedFinalEnrollment: finalEnrollment(section),
      expectedFillRate: section.cap > 0 ? enrollment / section.cap : estimate.fillRate,
      fillRate: section.cap > 0 ? enrollment / section.cap : estimate.fillRate,
      expectedOpenSeats: Math.max(0, (section.cap || 0) - enrollment),
      historicalEstimate: estimate,
      historicalEstimateType: exact ? 'exact pattern' : 'course average',
      projectionSource: exact ? `Historical Average (${estimate.terms} terms)` : `Course Historical Average (${estimate.terms} terms)`
    };
  }

  function consolidationGroupKey(section, options = {}) {
    return [
      courseKey(section),
      section.modality,
      options.sameCampus ? section.campus : 'ANY CAMPUS',
      section.dayPattern || 'TBA',
      section.start || 'TBA',
      section.end || 'TBA'
    ].join('|');
  }

  function consolidationGroupRows(course, sections, history, lowFill, lowEnroll, options = {}) {
    const output = [];
    group(sections, section => consolidationGroupKey(section, options)).forEach((groupSections) => {
      if (groupSections.length < 2) return;
      const lowSections = groupSections
        .filter(section => isLowEnrollmentSection(section, lowFill, lowEnroll))
        .sort((a, b) => expectedEnrollment(a) - expectedEnrollment(b));
      if (!lowSections.length) return;

      const removalPlans = [];
      let requiredSeats = 0;
      lowSections.forEach((source) => {
        const receivingPool = groupSections
          .filter(target => target !== source && !removalPlans.some(plan => plan.section === target))
          .filter(target => !options.sameCampus || target.campus === source.campus)
          .filter(target => !options.sameModality || target.modality === source.modality)
          .filter(target => dayWindowMatches(source, target, options.dayMatch))
          .filter(target => timeWindowMatches(source, target, options.timeWindowHours));
        const sourceRequiredSeats = Math.ceil(expectedEnrollment(source) * options.absorbPct);
        const poolOpenSeats = receivingPool.reduce((total, target) => total + expectedOpenSeats(target), 0);
        if (poolOpenSeats < sourceRequiredSeats) return;
        removalPlans.push({ section: source, requiredSeats: sourceRequiredSeats });
        requiredSeats += sourceRequiredSeats;
      });

      let removed = removalPlans.map(plan => plan.section);
      let receivingSections = groupSections.filter(section => !removed.includes(section));
      let finalReceivingCapacity = receivingSections.reduce((total, section) => total + expectedOpenSeats(section), 0);
      while (removalPlans.length && finalReceivingCapacity < requiredSeats) {
        const last = removalPlans.pop();
        requiredSeats -= last.requiredSeats;
        removed = removalPlans.map(plan => plan.section);
        receivingSections = groupSections.filter(section => !removed.includes(section));
        finalReceivingCapacity = receivingSections.reduce((total, section) => total + expectedOpenSeats(section), 0);
      }
      if (!removed.length) return;

      const representative = removed[0];
      const tba = groupSections.some(isTbaSection);
      const hist = history.get(patternKey(representative)) || { terms: 0, low: 0 };
      const score = consolidationGroupScore(groupSections, removed, hist, options, tba);
      const expectedEnroll = groupSections.reduce((total, section) => total + expectedEnrollment(section), 0);
      const potentialSeatsRecovered = sum(removed, 'cap');
      const netAvailableCapacity = Math.max(0, finalReceivingCapacity - requiredSeats);
      const historicalTerms = hist.terms || Math.max(0, ...groupSections.map(section => section.historicalEstimate?.terms || 0));
      const finalContextValues = removed
        .map(section => section.expectedFinalEnrollment ?? section.finalEnrollment ?? finalEnrollment(section))
        .filter(value => Number.isFinite(value) && value > 0);
      output.push({
        type: consolidationType(representative),
        score,
        label: historicalTerms < (options.minHist ?? 3) ? 'Limited History Review' : score >= 75 ? 'High Review Priority' : score >= 55 ? 'Review Candidate' : 'Lower Confidence Review',
        confidenceLevel: historicalTerms < (options.minHist ?? 3) ? 'Limited History' : score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low',
        course,
        sectionsReviewed: groupSections.length,
        potentialSectionsRemoved: removed.length,
        availableReceivingCapacity: finalReceivingCapacity,
        netAvailableCapacity,
        expectedEnrollment: expectedEnroll,
        potentialSeatsRecovered,
        freedSeats: potentialSeatsRecovered,
        removedSections: removed,
        receivingSections,
        requiredSeats,
        projectionSource: projectionSourceLabel(groupSections),
        finalEnrollmentContext: finalContextValues.length ? finalContextValues.join(', ') : 'N/A',
        matchReason: `${removed.length} low-enrollment section(s) can be reviewed as one ${tba ? 'lower-confidence TBA' : 'meeting-pattern'} scenario; ${netAvailableCapacity} net receiving seats after ${requiredSeats} projected redistribution seats`,
        historicalTerms,
        chronicLowFill: hist.terms && safeDiv(hist.low, hist.terms) >= (options.chronicThreshold ?? 0.75) ? 'Yes' : 'No',
        tba
      });
    });
    return output;
  }

  function isLowEnrollmentSection(section, lowFill, lowEnroll) {
    if (lowEnroll != null) return expectedEnrollment(section) <= lowEnroll;
    return expectedFillRate(section) <= lowFill;
  }

  function dayWindowMatches(source, target, mode) {
    if (mode === 'any') return true;
    if (mode === 'overlap') {
      const sourceDays = new Set(source.days || []);
      return (target.days || []).some(day => sourceDays.has(day));
    }
    return source.dayPattern === target.dayPattern;
  }

  function minutesFromTime(time) {
    if (!time) return null;
    const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function timeWindowMatches(source, target, windowHours) {
    if (windowHours == null) return true;
    const sourceStart = minutesFromTime(source.start);
    const targetStart = minutesFromTime(target.start);
    if (sourceStart == null || targetStart == null) return source.timeBlock === target.timeBlock;
    return Math.abs(sourceStart - targetStart) <= windowHours * 60;
  }

  function consolidationGroupScore(groupSections, removedSections, hist, options, tba) {
    let score = 45;
    if (groupSections.every(section => section.campus === groupSections[0].campus)) score += 10;
    if (groupSections.every(section => section.modality === groupSections[0].modality)) score += 10;
    if (groupSections.every(section => section.dayPattern === groupSections[0].dayPattern && section.start === groupSections[0].start)) score += 15;
    if (removedSections.length > 1) score += 5;
    if (hist.terms >= (options.minHist ?? 3) && safeDiv(hist.low, hist.terms) >= (options.chronicThreshold ?? 0.75)) score += 10;
    if (options.sameCampus) score += 3;
    if (options.sameModality) score += 2;
    return Math.min(tba ? 70 : 100, score);
  }

  function projectionSourceLabel(sections) {
    const terms = Math.max(0, ...sections.map(section => section.historicalEstimate?.terms || 0));
    if (terms > 0) return `Historical Average (${terms} terms)`;
    return 'N/A';
  }

  function onlineReductionRows(rows, historicalRows, options = {}) {
    const byOnlineCourse = group(dedupeSections(rows), row => `${row.term || ''}||${row.subject} ${row.course}`);
    const historicalByCourse = group(dedupeSections(historicalRows), row => `${row.subject} ${row.course}`);
    const output = [];
    const onlineMinSections = 2;
    byOnlineCourse.forEach((sections, key) => {
      if (sections.length < onlineMinSections) return;
      const course = key.split('||')[1] || key;
      const historicalSections = historicalByCourse.get(course) || [];
      const historicalByTerm = group(historicalSections, row => row.term || 'UNKNOWN');
      if (!historicalByTerm.size) return;
      const totalCap = sum(sections, 'cap');
      const historicalEnrollmentValues = [];
      const historicalVacancyValues = [];
      historicalByTerm.forEach(termRows => {
        const termEnrollment = termRows.reduce((total, row) => total + enrollmentForBasis(row, options.vacancyBasis), 0);
        const termVacancies = termRows.reduce((total, row) => total + Math.max(0, row.cap - enrollmentForBasis(row, options.vacancyBasis)), 0);
        historicalEnrollmentValues.push(termEnrollment);
        historicalVacancyValues.push(termVacancies);
      });
      const enrollment = Math.round(average(historicalEnrollmentValues));
      const historicalVacancies = Math.round(average(historicalVacancyValues));
      const decisionVacancies = Math.max(0, totalCap - enrollment);
      const vacancies = decisionVacancies;
      const sectionCap = median(sections.map(row => row.cap));
      const possibleReductions = sectionCap > 0 ? Math.floor(vacancies / sectionCap) : 0;
      if (possibleReductions < 1) return;
      const recommendedReductions = possibleReductions > 1 ? possibleReductions - 1 : possibleReductions;
      const historicalTermCount = historicalByTerm.size;
      output.push({
        type: 'Online Reduction',
        score: Math.min(100, 55 + Math.min(35, possibleReductions * 10)),
        label: historicalTermCount < (options.minHist ?? 3) ? 'Limited History Review' : recommendedReductions >= 2 ? 'High Review Priority' : 'Review Candidate',
        confidenceLevel: historicalTermCount < (options.minHist ?? 3) ? 'Limited History' : recommendedReductions >= 2 ? 'High' : 'Medium',
        course,
        sections: sections.length,
        sectionsReviewed: sections.length,
        source: null,
        target: null,
        sourceEnroll: enrollment,
        sourceFill: totalCap > 0 ? enrollment / totalCap : 0,
        targetOpenSeats: '',
        vacancies,
        sectionCap,
        possibleReductions,
        recommendedReductions,
        potentialSectionsRemoved: recommendedReductions,
        availableReceivingCapacity: vacancies,
        expectedEnrollment: enrollment,
        historicalAverageEnrollment: enrollment,
        historicalAverageVacancies: historicalVacancies,
        decisionVacancies,
        potentialSeatsRecovered: recommendedReductions * sectionCap,
        projectionSource: `Historical Average (${historicalTermCount} terms)`,
        finalEnrollmentContext: 'N/A',
        freedSeats: recommendedReductions * sectionCap,
        matchReason: `${vacancies} expected decision-term vacant seats across ${sections.length} online sections using ${historicalTermCount} historical term(s) and ${options.vacancyBasis === 'actual' ? 'final/current' : 'census'} enrollment`,
        historicalTerms: historicalTermCount,
        chronicLowFill: ''
      });
    });
    return output;
  }

  window.COSConsolidationAnalytics = {
    courseKey,
    patternKey,
    isOnlineSection,
    isTbaSection,
    consolidationType,
    enrollmentForBasis,
    expectedEnrollment,
    expectedFillRate,
    expectedOpenSeats,
    isLowEnrollmentSection,
    historicalDemandMap,
    withHistoricalEstimate,
    consolidationGroupRows,
    consolidationGroupScore,
    projectionSourceLabel,
    onlineReductionRows
  };
})();
