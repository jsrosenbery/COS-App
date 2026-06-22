(function () {
  'use strict';

  const metrics = window.COSEnrollmentMetrics;
  const filterUtils = window.COSEnrollmentFilters;
  if (!metrics || !filterUtils) throw new Error('Dashboard analytics requires enrollment metrics and filters.');

  const { censusEnrollment, finalEnrollment, safeDiv, average } = metrics;
  const { valueMatchesSelection } = filterUtils;
  const dayOrder = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

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

  function enrollment(row) {
    return censusEnrollment(row);
  }

  function courseKey(row) {
    return `${row.subject || 'UNKNOWN'} ${row.course || ''}`.trim();
  }

  function termValue(term) {
    const text = String(term || '').toUpperCase();
    const year = Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0);
    const season = (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0];
    const seasonOrder = { WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 };
    return year * 10 + (seasonOrder[season] || 0);
  }

  function applyDashboardFilters(rows, filters = {}) {
    return (rows || []).filter(row => {
      if (!valueMatchesSelection(row.division, filters.division || [])) return false;
      if (!valueMatchesSelection(row.campus, filters.campus || [])) return false;
      if (!valueMatchesSelection(row.modality, filters.modality || [])) return false;
      return true;
    });
  }

  function enrollmentHealth(rows, historicalRows = []) {
    const currentEnrollment = sum(rows.map(row => ({ value: enrollment(row) })), 'value');
    const expectedEnrollment = expectedTotalEnrollment(historicalRows);
    return {
      currentEnrollment,
      expectedEnrollment,
      variance: expectedEnrollment == null ? null : currentEnrollment - expectedEnrollment,
      coursesReviewed: group(rows, courseKey).size,
      sectionsReviewed: rows.length,
      ftes: sum(rows, 'ftes'),
      lifecycle: enrollmentLifecycle(rows)
    };
  }

  function expectedTotalEnrollment(historicalRows) {
    const byTerm = group(historicalRows, row => row.term || 'UNKNOWN');
    if (!byTerm.size) return null;
    return Math.round(average([...byTerm.values()].map(termRows => termRows.reduce((total, row) => total + enrollment(row), 0))));
  }

  function enrollmentLifecycle(rows) {
    const milestones = [
      ['First Day', 'firstDay'],
      ['Census 1', 'census1'],
      ['Census 2', 'census2'],
      ['Final', 'finalEnrollment']
    ];
    return milestones.map(([label, key]) => {
      const values = rows.map(row => {
        if (key === 'finalEnrollment') return finalEnrollment(row);
        return Number(row?.[key]);
      }).filter(Number.isFinite);
      return { label, value: values.length ? values.reduce((total, value) => total + value, 0) : null };
    });
  }

  function registrationPace(rows, historicalRows = []) {
    const dimensions = [
      ['Course', courseKey],
      ['Division', row => row.division || 'UNKNOWN'],
      ['Modality', row => row.modality || 'UNKNOWN'],
      ['Campus', row => row.campus || 'UNKNOWN'],
      ['Day Pattern', row => row.dayPattern || 'TBA'],
      ['Time Block', row => row.timeBlock || 'ONLINE/TBA']
    ];
    return dimensions.flatMap(([dimension, keyer]) => paceRowsForDimension(rows, historicalRows, dimension, keyer))
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 12);
  }

  function paceRowsForDimension(rows, historicalRows, dimension, keyer) {
    const current = group(rows, keyer);
    const historical = expectedByGroup(historicalRows, keyer);
    return [...current.entries()].map(([name, groupRows]) => {
      const currentEnrollment = groupRows.reduce((total, row) => total + enrollment(row), 0);
      const expectedEnrollment = historical.get(name) ?? null;
      const variance = expectedEnrollment == null ? null : currentEnrollment - expectedEnrollment;
      const variancePct = expectedEnrollment ? variance / expectedEnrollment : null;
      return {
        dimension,
        name,
        currentEnrollment,
        expectedEnrollment,
        variance,
        variancePct,
        status: paceStatus(variancePct)
      };
    });
  }

  function expectedByGroup(rows, keyer) {
    const byTerm = group(rows, row => row.term || 'UNKNOWN');
    const samples = new Map();
    byTerm.forEach(termRows => {
      group(termRows, keyer).forEach((groupRows, key) => {
        if (!samples.has(key)) samples.set(key, []);
        samples.get(key).push(groupRows.reduce((total, row) => total + enrollment(row), 0));
      });
    });
    const out = new Map();
    samples.forEach((values, key) => out.set(key, Math.round(average(values))));
    return out;
  }

  function paceStatus(variancePct) {
    if (variancePct == null) return 'N/A';
    if (variancePct >= 0.05) return 'Ahead of Pace';
    if (variancePct <= -0.05) return 'Behind Pace';
    return 'On Pace';
  }

  function growthOpportunities(rows) {
    const byCourse = group(rows, courseKey);
    return [...byCourse.entries()].map(([course, courseRows]) => {
      const waitlist = sum(courseRows, 'waitlist');
      const openSeats = courseRows.reduce((total, row) => total + Math.max(0, (row.cap || 0) - enrollment(row)), 0);
      const enrollmentTotal = courseRows.reduce((total, row) => total + enrollment(row), 0);
      const fillRate = safeDiv(enrollmentTotal, sum(courseRows, 'cap'));
      const action = waitlist > 0 && openSeats < waitlist ? 'Consider Added Capacity' : 'Use Existing Seats First';
      return { course, waitlist, openSeats, enrollment: enrollmentTotal, fillRate, action };
    }).filter(row => row.waitlist > 0 || row.fillRate >= 0.95)
      .sort((a, b) => (b.waitlist - b.openSeats) - (a.waitlist - a.openSeats))
      .slice(0, 8);
  }

  function studentPresence(rows) {
    const physicalRows = (rows || []).filter(isPhysicalPresenceRow);
    const buckets = new Map();
    physicalRows.forEach(row => {
      const hour = row.start ? `${String(row.start).slice(0, 2)}:00` : 'TBA';
      (row.days || []).forEach(day => {
        const key = [row.campus || 'UNKNOWN', day, hour].join('|');
        const item = buckets.get(key) || { campus: row.campus || 'UNKNOWN', day, hour, studentsPresent: 0, sectionsActive: 0, availableRoomCapacity: 0 };
        item.studentsPresent += enrollment(row);
        item.sectionsActive += 1;
        item.availableRoomCapacity += Math.max(0, (row.cap || 0) - enrollment(row));
        buckets.set(key, item);
      });
    });
    const rowsOut = [...buckets.values()].sort((a, b) => b.studentsPresent - a.studentsPresent);
    return {
      rows: rowsOut.slice(0, 12),
      peak: rowsOut[0] || null,
      lightest: rowsOut.length ? rowsOut[rowsOut.length - 1] : null
    };
  }

  function isPhysicalPresenceRow(row) {
    const modality = String(row?.modality || '').toUpperCase();
    const campus = String(row?.campus || '').toUpperCase();
    const start = String(row?.start || '').trim();
    const days = row?.days || [];
    if (modality === 'ONLINE' || modality === 'TBA') return false;
    if (/ONLINE|WEB|VIRTUAL|TBA/.test(campus)) return false;
    if (!start || start === '00:00') return false;
    if (!days.length || days.includes('TBA')) return false;
    return days.some(day => dayOrder.includes(day));
  }

  function scheduleStructure(rows) {
    const primeRows = (rows || []).filter(isPrimeTime);
    const offPeakRows = (rows || []).filter(row => !isPrimeTime(row));
    const modality = [...group(rows, row => row.modality || 'UNKNOWN').entries()].map(([name, groupRows]) => ({
      modality: name,
      sections: groupRows.length,
      enrollment: groupRows.reduce((total, row) => total + enrollment(row), 0)
    })).sort((a, b) => b.enrollment - a.enrollment);
    return {
      primeSections: primeRows.length,
      primeEnrollment: primeRows.reduce((total, row) => total + enrollment(row), 0),
      offPeakSections: offPeakRows.length,
      offPeakEnrollment: offPeakRows.reduce((total, row) => total + enrollment(row), 0),
      modality
    };
  }

  function isPrimeTime(row) {
    const hour = Number(String(row.start || '').slice(0, 2));
    if (!Number.isFinite(hour) || hour < 9 || hour >= 15) return false;
    return (row.days || []).some(day => ['MO', 'TU', 'WE', 'TH'].includes(day));
  }

  function rotationRows(rows) {
    const allTerms = [...new Set((rows || []).map(row => row.term).filter(Boolean))]
      .sort((a, b) => termValue(a) - termValue(b));
    return [...group(rows, courseKey).entries()].map(([course, courseRows]) => {
      const terms = [...new Set(courseRows.map(row => row.term).filter(Boolean))]
        .sort((a, b) => termValue(a) - termValue(b));
      const gaps = terms.slice(1).map((term, index) => Math.max(1, allTerms.indexOf(term) - allTerms.indexOf(terms[index])));
      const avgGap = gaps.length ? average(gaps) : null;
      const cycle = rotationCycle(terms.length, avgGap);
      return {
        course,
        courseTitle: courseRows.find(row => row.title)?.title || '',
        division: courseRows.find(row => row.division)?.division || '',
        department: courseRows.find(row => row.department)?.department || courseRows.find(row => row.subject)?.subject || '',
        termsOffered: terms.join(', '),
        termsOfferedCount: terms.length,
        averageGap: avgGap == null ? null : Math.round(avgGap * 10) / 10,
        rotationCycle: cycle,
        lastOffered: terms[terms.length - 1] || '',
        expectedNextOffering: expectedNextTerm(terms[terms.length - 1], avgGap, allTerms),
        rotationStatus: rotationStatus(cycle)
      };
    }).sort((a, b) => a.course.localeCompare(b.course, undefined, { numeric: true }));
  }

  function rotationCycle(count, avgGap) {
    if (count < 2 || avgGap == null) return 'Insufficient History';
    if (avgGap <= 1.25) return 'Every term';
    if (avgGap <= 2.25) return 'Once per academic year';
    if (avgGap <= 3.25) return 'Every 3 terms';
    if (avgGap <= 4.25) return 'Every 4 terms';
    return 'Irregular';
  }

  function expectedNextTerm(lastTerm, avgGap, allTerms) {
    if (!lastTerm || avgGap == null || !allTerms.length) return '';
    const index = allTerms.indexOf(lastTerm);
    const next = allTerms[index + Math.round(avgGap)];
    return next || '';
  }

  function rotationStatus(cycle) {
    if (cycle === 'Insufficient History') return 'Insufficient History';
    if (cycle === 'Irregular') return 'Irregular';
    return 'On Cycle';
  }

  function dashboardSummary(rows, historicalRows = [], consolidationRows = []) {
    return {
      health: enrollmentHealth(rows, historicalRows),
      pace: registrationPace(rows, historicalRows),
      growth: growthOpportunities(rows),
      reduction: (consolidationRows || []).slice(0, 8),
      presence: studentPresence(rows),
      structure: scheduleStructure(rows),
      rotation: rotationRows([...(historicalRows || []), ...(rows || [])])
    };
  }

  window.COSEnrollmentDashboard = {
    applyDashboardFilters,
    enrollmentHealth,
    registrationPace,
    growthOpportunities,
    studentPresence,
    isPhysicalPresenceRow,
    scheduleStructure,
    rotationRows,
    dashboardSummary
  };
})();
