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
      const values = rows.map(row => Number(row?.[key])).filter(Number.isFinite);
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

  function growthOpportunities(rows, options = {}) {
    const timeWindowHours = Number.isFinite(Number(options.timeWindowHours)) ? Number(options.timeWindowHours) : 2;
    const byCourse = group(rows, courseKey);
    return [...byCourse.entries()].map(([course, courseRows]) => {
      const waitlist = sum(courseRows, 'waitlist');
      const demandSections = courseRows.filter(isDemandPressureSection);
      const openSeatRows = courseRows
        .map(row => ({ row, openSeats: openSeatsForRow(row) }))
        .filter(item => item.openSeats > 0);
      const openSeats = openSeatRows.reduce((total, item) => total + item.openSeats, 0);
      const sameModalitySeats = seatsMatching(openSeatRows, demandSections, sameModality);
      const onlineSeats = openSeatRows
        .filter(item => isOnline(item.row))
        .reduce((total, item) => total + item.openSeats, 0);
      const sameCampusSeats = seatsMatching(openSeatRows, demandSections, sameCampus);
      const timeWindowSeats = seatsMatching(openSeatRows, demandSections, (open, demand) => withinTimeWindow(open, demand, timeWindowHours));
      const compatibleDaySeats = seatsMatching(openSeatRows, demandSections, compatibleDays);
      const viableOpenSeats = seatsMatching(openSeatRows, demandSections, (open, demand) => viableOpenSection(open, demand, timeWindowHours));
      const enrollmentTotal = courseRows.reduce((total, row) => total + enrollment(row), 0);
      const fillRate = safeDiv(enrollmentTotal, sum(courseRows, 'cap'));
      const demandNeed = waitlist || (demandSections.length ? 1 : 0);
      const recommendation = demandNeed > 0 && viableOpenSeats < demandNeed ? 'Consider Added Capacity' : 'Use Existing Seats First';
      return {
        course,
        waitlist,
        openSeats,
        viableOpenSeats,
        sameModalitySeats,
        onlineSeats,
        sameCampusSeats,
        timeWindowSeats,
        compatibleDaySeats,
        enrollment: enrollmentTotal,
        fillRate,
        recommendation
      };
    }).filter(row => row.waitlist > 0 || row.fillRate >= 0.95)
      .sort((a, b) => (b.waitlist - b.viableOpenSeats) - (a.waitlist - a.viableOpenSeats))
      .slice(0, 8);
  }

  function isDemandPressureSection(row) {
    return (Number(row?.waitlist) || 0) > 0 || safeDiv(enrollment(row), Number(row?.cap) || 0) >= 0.95;
  }

  function openSeatsForRow(row) {
    return Math.max(0, (Number(row?.cap) || 0) - enrollment(row));
  }

  function seatsMatching(openSeatRows, demandSections, matcher) {
    const counted = new Set();
    return openSeatRows.reduce((total, item, index) => {
      if (!demandSections.some(demand => matcher(item.row, demand))) return total;
      if (counted.has(index)) return total;
      counted.add(index);
      return total + item.openSeats;
    }, 0);
  }

  function viableOpenSection(open, demand, timeWindowHours) {
    if (isOnline(demand)) return isOnline(open);
    return !isOnline(open) &&
      sameModality(open, demand) &&
      sameCampus(open, demand) &&
      withinTimeWindow(open, demand, timeWindowHours) &&
      compatibleDays(open, demand);
  }

  function sameModality(open, demand) {
    return String(open?.modality || '') === String(demand?.modality || '');
  }

  function isOnline(row) {
    return String(row?.modality || '').toUpperCase() === 'ONLINE';
  }

  function sameCampus(open, demand) {
    return String(open?.campus || '') === String(demand?.campus || '');
  }

  function withinTimeWindow(open, demand, hours) {
    if (isOnline(open) && isOnline(demand)) return true;
    const openMinutes = minutesFromTime(open?.start);
    const demandMinutes = minutesFromTime(demand?.start);
    if (openMinutes == null || demandMinutes == null) return false;
    return Math.abs(openMinutes - demandMinutes) <= hours * 60;
  }

  function compatibleDays(open, demand) {
    if (isOnline(open) && isOnline(demand)) return true;
    const openDays = new Set((open?.days || []).filter(day => dayOrder.includes(day)));
    const demandDays = (demand?.days || []).filter(day => dayOrder.includes(day));
    if (!openDays.size || !demandDays.length) return false;
    return demandDays.some(day => openDays.has(day));
  }

  function minutesFromTime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour === 0 && minute === 0) return null;
    return hour * 60 + minute;
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

  function studentPresenceReport(rows, groupBy = 'campusDayHour') {
    const physicalRows = (rows || []).filter(isPhysicalPresenceRow);
    const buckets = new Map();
    physicalRows.forEach(row => {
      const hour = row.start ? `${String(row.start).slice(0, 2)}:00` : 'TBA';
      (row.days || []).filter(day => dayOrder.includes(day)).forEach(day => {
        const key = presenceGroupKey(row, groupBy, day, hour);
        const item = buckets.get(key) || {
          group: key,
          campus: row.campus || 'UNKNOWN',
          building: row.building || '',
          room: row.roomOnly || row.room || '',
          day,
          hour,
          studentsPresent: 0,
          sectionsActive: 0,
          availableRoomCapacity: 0,
          seatsScheduled: 0,
          fillRate: 0
        };
        const enrolled = enrollment(row);
        item.studentsPresent += enrolled;
        item.sectionsActive += 1;
        item.seatsScheduled += Number(row.cap) || 0;
        item.availableRoomCapacity += Math.max(0, (Number(row.cap) || 0) - enrolled);
        buckets.set(key, item);
      });
    });
    const rowsOut = [...buckets.values()].map(row => ({
      ...row,
      averageFillRate: safeDiv(row.studentsPresent, row.seatsScheduled)
    })).sort((a, b) => b.studentsPresent - a.studentsPresent);
    return {
      rows: rowsOut,
      metrics: studentPresenceMetrics(rowsOut)
    };
  }

  function presenceGroupKey(row, groupBy, day, hour) {
    const campus = row.campus || 'UNKNOWN';
    const building = row.building || 'UNKNOWN';
    const room = row.roomOnly || row.room || 'UNKNOWN';
    const map = {
      all: 'All Campuses',
      campus: campus,
      building: building,
      room: room,
      day: day,
      hour: hour,
      campusDayHour: [campus, day, hour].join(' / '),
      buildingDayHour: [building, day, hour].join(' / '),
      roomDayHour: [room, day, hour].join(' / ')
    };
    return map[groupBy] || map.campusDayHour;
  }

  function studentPresenceMetrics(rows) {
    const totalStudents = rows.reduce((total, row) => total + row.studentsPresent, 0);
    const totalSections = rows.reduce((total, row) => total + row.sectionsActive, 0);
    const totalSeats = rows.reduce((total, row) => total + row.seatsScheduled, 0);
    const totalOpen = rows.reduce((total, row) => total + row.availableRoomCapacity, 0);
    return {
      totalStudents,
      totalSections,
      totalSeats,
      totalOpen,
      averageFillRate: safeDiv(totalStudents, totalSeats),
      peakHour: peakBy(rows, row => row.hour),
      lightestHour: lightestBy(rows, row => row.hour),
      peakCampus: peakBy(rows, row => row.campus),
      peakBuilding: peakBy(rows.filter(row => row.building), row => row.building),
      peakRoom: peakBy(rows.filter(row => row.room), row => row.room)
    };
  }

  function peakBy(rows, keyer) {
    return aggregatePresence(rows, keyer).sort((a, b) => b.studentsPresent - a.studentsPresent)[0] || null;
  }

  function lightestBy(rows, keyer) {
    return aggregatePresence(rows, keyer).sort((a, b) => a.studentsPresent - b.studentsPresent)[0] || null;
  }

  function aggregatePresence(rows, keyer) {
    const map = new Map();
    rows.forEach(row => {
      const key = keyer(row) || 'UNKNOWN';
      const item = map.get(key) || { group: key, studentsPresent: 0, sectionsActive: 0 };
      item.studentsPresent += row.studentsPresent;
      item.sectionsActive += row.sectionsActive;
      map.set(key, item);
    });
    return [...map.values()];
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

  function dashboardSummaryExportRows(summary, context = {}) {
    const rows = [];
    const add = (section, metric, group, value, secondaryValue = '', notes = '') => {
      rows.push({
        Section: section,
        Metric: metric,
        Group: group,
        Value: value ?? '',
        'Secondary Value': secondaryValue ?? '',
        Notes: notes ?? ''
      });
    };
    add('Context', 'Prepared using', 'All Selected Rows', 'TIMBER Enrollment Analytics');
    add('Context', 'Methodology Version', 'All Selected Rows', context.methodologyVersion || 'Methodology Version 1.2');
    add('Context', 'Export Date/Time', 'All Selected Rows', context.exportedAt || new Date().toISOString());
    add('Context', 'Selected Term', 'All Selected Rows', context.selectedTerm || 'All loaded terms');
    add('Context', 'Selected Division Filter', 'All Selected Rows', context.divisionFilter || 'All divisions');
    add('Context', 'Selected Campus Filter', 'All Selected Rows', context.campusFilter || 'All campuses');
    add('Context', 'Selected Modality Filter', 'All Selected Rows', context.modalityFilter || 'All modalities');
    add('Context', 'Selected Discipline/Course Filters', 'All Selected Rows', context.disciplineCourseFilter || 'All disciplines/courses');
    add('Context', 'Data Source Note', 'All Selected Rows', context.dataSourceNote || 'Currently loaded schedule rows');
    add('Context', 'Milestone Availability Note', 'All Selected Rows', milestoneAvailabilityNote(summary?.health?.lifecycle || []));

    const health = summary?.health || {};
    add('Enrollment Health', 'Current Enrollment', 'All Selected Rows', health.currentEnrollment);
    add('Enrollment Health', 'Expected Enrollment', 'All Selected Rows', health.expectedEnrollment == null ? 'N/A' : health.expectedEnrollment);
    add('Enrollment Health', 'Variance', 'All Selected Rows', health.variance == null ? 'N/A' : health.variance);
    add('Enrollment Health', 'Courses Reviewed', 'All Selected Rows', health.coursesReviewed);
    add('Enrollment Health', 'Sections Reviewed', 'All Selected Rows', health.sectionsReviewed);
    add('Enrollment Health', 'FTES', 'All Selected Rows', health.ftes);
    (health.lifecycle || []).forEach(item => add('Enrollment Health', item.label, 'Lifecycle Milestone', item.value == null ? 'N/A' : item.value));

    (summary?.pace || []).slice(0, 12).forEach(row => {
      add('Registration Pace Monitor', row.dimension, row.name, row.currentEnrollment, row.expectedEnrollment == null ? 'N/A' : row.expectedEnrollment, `Variance: ${row.variance ?? 'N/A'}; Status: ${row.status}`);
    });

    (summary?.growth || []).slice(0, 12).forEach(row => {
      const notes = row.recommendation === 'Consider Added Capacity'
        ? 'Waitlist/high demand exceeds viable open seats'
        : 'Review existing viable seats before adding capacity';
      add('Growth Opportunities', 'Recommendation', row.course, row.recommendation, `Viable seats: ${row.viableOpenSeats}; Waitlist: ${row.waitlist}`, notes);
      add('Growth Opportunities', 'Seat Buckets', row.course, `Total open: ${row.openSeats}`, `Same modality: ${row.sameModalitySeats}; Same campus: ${row.sameCampusSeats}`, `Online: ${row.onlineSeats}; +/- hour: ${row.timeWindowSeats}; Compatible days: ${row.compatibleDaySeats}`);
    });

    (summary?.reduction || []).slice(0, 12).forEach(row => {
      add('Reduction Opportunities', 'Recommendation', row.course || row.label || 'Grouped Opportunity', row.recommendation || row.type, `Potential reductions: ${row.potentialSectionsRemoved || row.recommendedReductions || 'N/A'}`, `Type: ${row.type || 'N/A'}; Available capacity: ${row.availableReceivingCapacity ?? 'N/A'}`);
    });

    const presence = summary?.presence || {};
    if (presence.peak) add('Student Presence Analytics', 'Peak Student Presence', presenceGroup(presence.peak), presence.peak.studentsPresent, `Sections active: ${presence.peak.sectionsActive}`, `Available room capacity: ${presence.peak.availableRoomCapacity}`);
    if (presence.lightest) add('Student Presence Analytics', 'Lightest Student Presence', presenceGroup(presence.lightest), presence.lightest.studentsPresent, `Sections active: ${presence.lightest.sectionsActive}`, `Available room capacity: ${presence.lightest.availableRoomCapacity}`);
    (presence.rows || []).slice(0, 12).forEach(row => {
      add('Student Presence Analytics', 'Presence Bucket', presenceGroup(row), row.studentsPresent, `Sections active: ${row.sectionsActive}`, `Available room capacity: ${row.availableRoomCapacity}`);
    });

    const structure = summary?.structure || {};
    add('Schedule Structure', 'Prime Sections', 'Prime Time', structure.primeSections, `Enrollment: ${structure.primeEnrollment}`);
    add('Schedule Structure', 'Off-Peak Sections', 'Off-Peak', structure.offPeakSections, `Enrollment: ${structure.offPeakEnrollment}`);
    (structure.modality || []).forEach(row => add('Schedule Structure', 'Modality Mix', row.modality, row.sections, `Enrollment: ${row.enrollment}`));

    const rotation = summary?.rotation || [];
    add('Rotation Health Summary', 'Courses Reviewed', 'All Selected Rows', rotation.length);
    group(rotation, row => row.rotationStatus || 'Unknown').forEach((statusRows, status) => {
      add('Rotation Health Summary', 'Rotation Status Count', status, statusRows.length);
    });
    rotation.filter(row => row.rotationStatus !== 'On Cycle').slice(0, 12).forEach(row => {
      add('Rotation Health Summary', 'Review Course Rotation', row.course, row.rotationStatus, `Last offered: ${row.lastOffered || 'N/A'}`, `Expected next: ${row.expectedNextOffering || 'N/A'}; Cycle: ${row.rotationCycle || 'N/A'}`);
    });
    return rows;
  }

  function milestoneAvailabilityNote(lifecycle) {
    if (!lifecycle.length) return 'No lifecycle milestone fields were available in the selected rows.';
    const available = lifecycle.filter(item => item.value != null).map(item => item.label);
    const missing = lifecycle.filter(item => item.value == null).map(item => item.label);
    return `Available: ${available.join(', ') || 'None'}; Missing: ${missing.join(', ') || 'None'}`;
  }

  function presenceGroup(row) {
    return [row.campus || 'N/A', row.day || 'N/A', row.hour || 'N/A'].join(' / ');
  }

  window.COSEnrollmentDashboard = {
    applyDashboardFilters,
    enrollmentHealth,
    registrationPace,
    growthOpportunities,
    studentPresence,
    studentPresenceReport,
    isPhysicalPresenceRow,
    scheduleStructure,
    rotationRows,
    dashboardSummary,
    dashboardSummaryExportRows
  };
})();
