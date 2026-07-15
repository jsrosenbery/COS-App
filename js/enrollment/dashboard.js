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

  function ftes(row) {
    return Number(row?.ftes) || 0;
  }

  function canon(value) {
    return String(value || '').trim().toUpperCase();
  }

  function hasValidScheduledMeetingTime(row) {
    const start = String(row?.start || '').trim();
    const end = String(row?.end || '').trim();
    const timeBlock = canon(row?.timeBlock);
    const dayPattern = canon(row?.dayPattern);
    const days = Array.isArray(row?.days) ? row.days.filter(Boolean) : [];
    if (!start || !end || !days.length) return false;
    if (timeBlock === 'ONLINE/TBA' || dayPattern === 'TBA') return false;
    if (start === '00:00' || end === '00:00') return false;
    if (start >= '00:00' && start <= '00:59') return false;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false;
    return true;
  }

  function asyncTbaCategory(row) {
    const modality = canon(row?.modality);
    const timeBlock = canon(row?.timeBlock);
    const dayPattern = canon(row?.dayPattern);
    if (modality === 'ONLINE' && !hasValidScheduledMeetingTime(row)) return 'Online (Asynchronous)';
    if (modality === 'TBA' || dayPattern === 'TBA' || timeBlock === 'ONLINE/TBA') return 'TBA';
    return 'Unknown Meeting Time';
  }

  function rowField(row, names) {
    const source = row?.raw && typeof row.raw === 'object' ? { ...row.raw, ...row } : row || {};
    const normalize = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const direct = names.find(name => source[name] !== undefined && source[name] !== null && String(source[name]).trim() !== '');
    if (direct) return source[direct];
    const lookup = Object.entries(source).reduce((acc, [key, value]) => {
      const normalized = normalize(key);
      if (normalized && acc[normalized] === undefined) acc[normalized] = value;
      return acc;
    }, {});
    for (const name of names) {
      const value = lookup[normalize(name)];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  }

  function parseDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const serial = Number(text);
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 24 * 60 * 60 * 1000);
    }
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return new Date(parsed);
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) return null;
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = new Date(year, Number(match[1]) - 1, Number(match[2]));
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function dateSpanDays(start, end) {
    if (!start || !end || end < start) return 0;
    return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
  }

  function termDateRange(rows = [], term = '') {
    const matching = (rows || []).filter(row => !term || String(row.term || '').toUpperCase() === String(term || '').toUpperCase());
    const explicit = matching.map(row => ({
      start: parseDate(rowField(row, ['Term Start', 'TERM START', 'Term_Start', 'Term Begin Date', 'TERM_BEGIN_DATE'])),
      end: parseDate(rowField(row, ['Term End', 'TERM END', 'Term_End', 'Term Stop Date', 'TERM_END_DATE']))
    })).find(range => range.start && range.end && range.end >= range.start);
    if (explicit) return explicit;
    const dates = matching.flatMap(row => [
      parseDate(row.startDate || rowField(row, ['Start_Date', 'Start Date', 'CLASS START DATE', 'Meeting Start Date'])),
      parseDate(row.endDate || rowField(row, ['End_Date', 'End Date', 'CLASS END DATE', 'Meeting End Date']))
    ]).filter(Boolean);
    if (dates.length >= 2) {
      return { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) };
    }
    return null;
  }

  function meetingFrequencyFactor(row, options = {}) {
    const fullTermWeeks = Number(options.fullTermWeeks) || 17.5;
    const dayCount = Math.max(1, (row?.days || []).filter(Boolean).length || 1);
    const meetingCount = Number(rowField(row, ['Number of Meetings', 'Meeting Count', 'Meetings', 'NUM_MEETINGS', 'MEETING_COUNT']));
    if (Number.isFinite(meetingCount) && meetingCount > 0) {
      const expectedMeetings = fullTermWeeks * dayCount;
      const factor = Math.max(0, Math.min(1, meetingCount / expectedMeetings));
      return { factor, source: 'meeting count', warning: '' };
    }
    const weeks = Number(rowField(row, ['Weeks', 'Session Weeks', 'SESSION_WEEKS', 'Meeting Weeks']));
    if (Number.isFinite(weeks) && weeks > 0) {
      const factor = Math.max(0, Math.min(1, weeks / fullTermWeeks));
      return { factor, source: 'session weeks', warning: '' };
    }
    const start = parseDate(row.startDate || rowField(row, ['Start_Date', 'Start Date', 'CLASS START DATE', 'Meeting Start Date']));
    const end = parseDate(row.endDate || rowField(row, ['End_Date', 'End Date', 'CLASS END DATE', 'Meeting End Date']));
    if (start && end && end >= start) {
      const termRange = options.termRanges?.get?.(String(row.term || '').toUpperCase()) || termDateRange(options.sourceRows || [], row.term || '');
      const termDays = termRange ? dateSpanDays(termRange.start, termRange.end) : Math.round(fullTermWeeks * 7);
      const factor = Math.max(0, Math.min(1, dateSpanDays(start, end) / Math.max(1, termDays)));
      const source = termRange ? 'meeting date span / term date span' : 'meeting date span / default full-term weeks';
      return { factor, source, warning: termRange ? '' : 'Term date span unavailable; used default full-term weeks.' };
    }
    return { factor: 1, source: 'frequency unknown', warning: 'Frequency unknown; defaulted to 1.00.' };
  }

  function presenceMode(options = {}) {
    return options.presenceMode === 'expected' ? 'expected' : 'nominal';
  }

  function presenceEnrollment(row, options = {}) {
    const nominal = enrollment(row);
    const frequency = meetingFrequencyFactor(row, options);
    const factor = presenceMode(options) === 'expected' ? frequency.factor : 1;
    return {
      enrollment: nominal * factor,
      nominalEnrollment: nominal,
      expectedEnrollment: nominal * frequency.factor,
      frequency
    };
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
    const expected = expectedTotalEnrollment(historicalRows);
    const expectedEnrollment = expected?.value ?? null;
    const previous = previousLikeTermEnrollment(historicalRows);
    const previousEnrollment = previous?.value ?? null;
    return {
      currentEnrollment,
      expectedEnrollment,
      expectedEnrollmentMethod: expected?.method || 'No comparable historical terms',
      expectedEnrollmentBasis: expected?.basis || '',
      variance: expectedEnrollment == null ? null : currentEnrollment - expectedEnrollment,
      expectedVariance: expectedEnrollment == null ? null : currentEnrollment - expectedEnrollment,
      previousLikeTermEnrollment: previousEnrollment,
      previousLikeTerm: previous?.term || '',
      previousLikeTermVariance: previousEnrollment == null ? null : currentEnrollment - previousEnrollment,
      previousLikeTermVariancePct: previousEnrollment ? (currentEnrollment - previousEnrollment) / previousEnrollment : null,
      coursesReviewed: group(rows, courseKey).size,
      sectionsReviewed: rows.length,
      ftes: sum(rows, 'ftes'),
      ftesByAccountingMethod: ftesByAccountingMethod(rows),
      lifecycle: enrollmentLifecycle(rows)
    };
  }

  function expectedTotalEnrollment(historicalRows) {
    const byTerm = group(historicalRows, row => row.term || 'UNKNOWN');
    if (!byTerm.size) return null;
    const series = [...byTerm.entries()]
      .map(([term, termRows]) => ({ term, value: termRows.reduce((total, row) => total + enrollment(row), 0) }))
      .sort((a, b) => termValue(a.term) - termValue(b.term));
    return growthAdjustedExpected(series, true);
  }

  function previousLikeTermEnrollment(historicalRows) {
    const byTerm = group(historicalRows, row => row.term || 'UNKNOWN');
    if (!byTerm.size) return null;
    const series = [...byTerm.entries()]
      .map(([term, termRows]) => ({ term, value: termRows.reduce((total, row) => total + enrollment(row), 0) }))
      .sort((a, b) => termValue(a.term) - termValue(b.term));
    return series[series.length - 1] || null;
  }

  function growthAdjustedExpected(series, roundValues = true) {
    const usable = (series || [])
      .filter(item => item && Number.isFinite(Number(item.value)))
      .map(item => ({ term: item.term || 'UNKNOWN', value: Number(item.value) }))
      .sort((a, b) => termValue(a.term) - termValue(b.term));
    if (!usable.length) return null;
    const latest = usable[usable.length - 1];
    if (usable.length === 1) {
      return {
        value: roundValues ? Math.round(latest.value) : latest.value,
        method: 'Single comparable term fallback',
        basis: `${latest.term}: ${latest.value}`
      };
    }
    const growthRates = [];
    for (let index = 1; index < usable.length; index += 1) {
      const previous = usable[index - 1].value;
      const current = usable[index].value;
      if (previous > 0) growthRates.push((current - previous) / previous);
    }
    if (!growthRates.length) {
      const fallback = average(usable.map(item => item.value));
      return {
        value: roundValues ? Math.round(fallback) : fallback,
        method: 'Average fallback; growth unavailable',
        basis: usable.map(item => `${item.term}: ${item.value}`).join('; ')
      };
    }
    const avgGrowth = average(growthRates);
    const projected = Math.max(0, latest.value * (1 + avgGrowth));
    return {
      value: roundValues ? Math.round(projected) : projected,
      method: `Same-season growth-adjusted projection (${(avgGrowth * 100).toFixed(1)}% average growth)`,
      basis: usable.map(item => `${item.term}: ${item.value}`).join('; ')
    };
  }

  function ftesAccountingLabel(row) {
    if (row?.isWorkExperience || String(row?.modality || '').toUpperCase() === 'WORK EXPERIENCE') return 'Work Experience';
    return row?.accountingMethodLabel || row?.accountingCategory || row?.accountingMethod || 'Unknown / Not Provided';
  }

  function ftesByAccountingMethod(rows = []) {
    return [...group(rows, ftesAccountingLabel).entries()]
      .map(([accountingMethod, methodRows]) => ({
        accountingMethod,
        rows: methodRows.length,
        classOfferings: distinctCrnCount(methodRows),
        enrollment: methodRows.reduce((total, row) => total + enrollment(row), 0),
        ftes: methodRows.reduce((total, row) => total + ftes(row), 0),
        directFtesRows: methodRows.filter(row => row.hasDirectFtesData).length,
        estimatedFtesRows: methodRows.filter(row => !row.hasDirectFtesData && row.hasFtesData).length,
        unavailableFtesRows: methodRows.filter(row => row.ftesUnavailable).length
      }))
      .sort((a, b) => b.ftes - a.ftes || b.enrollment - a.enrollment);
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
    const scheduledRows = (rows || []).filter(hasValidScheduledMeetingTime);
    const historicalScheduledRows = (historicalRows || []).filter(hasValidScheduledMeetingTime);
    const asyncRows = (rows || []).filter(row => !hasValidScheduledMeetingTime(row));
    const historicalAsyncRows = (historicalRows || []).filter(row => !hasValidScheduledMeetingTime(row));
    const dimensions = [
      ['Campus', row => row.campus || 'UNKNOWN'],
      ['Modality', row => row.modality || 'UNKNOWN'],
      ['Time Block', row => row.timeBlock || 'UNKNOWN', scheduledRows, historicalScheduledRows],
      ['Day Pattern', row => row.dayPattern || 'TBA'],
      ['Division', row => row.division || 'UNKNOWN'],
      ['Asynchronous/TBA', asyncTbaCategory, asyncRows, historicalAsyncRows]
    ];
    return dimensions.flatMap(([dimension, keyer, currentScope = rows, historicalScope = historicalRows]) => paceRowsForDimension(currentScope, historicalScope, dimension, keyer))
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }

  function paceRowsForDimension(rows, historicalRows, dimension, keyer) {
    const current = group(rows, keyer);
    const historical = expectedByGroup(historicalRows, keyer);
    return [...current.entries()].map(([name, groupRows]) => {
      const currentEnrollment = groupRows.reduce((total, row) => total + enrollment(row), 0);
      const expectedEnrollment = historical.get(name) ?? null;
      const variance = expectedEnrollment == null ? null : currentEnrollment - expectedEnrollment;
      const variancePct = expectedEnrollment ? variance / expectedEnrollment : null;
      const currentFtes = groupRows.reduce((total, row) => total + ftes(row), 0);
      const expectedFtes = expectedByGroup(historicalRows, keyer, ftes, false).get(name) ?? null;
      const estimatedFtesImpact = expectedFtes == null ? null : currentFtes - expectedFtes;
      return {
        dimension,
        name,
        currentEnrollment,
        expectedEnrollment,
        variance,
        variancePct,
        estimatedFtesImpact,
        status: paceStatus(variancePct)
      };
    });
  }

  function expectedByGroup(rows, keyer, valueGetter = enrollment, roundValues = true) {
    const byTerm = group(rows, row => row.term || 'UNKNOWN');
    const samples = new Map();
    byTerm.forEach(termRows => {
      group(termRows, keyer).forEach((groupRows, key) => {
        if (!samples.has(key)) samples.set(key, []);
        samples.get(key).push({ term: termRows[0]?.term || 'UNKNOWN', value: groupRows.reduce((total, row) => total + valueGetter(row), 0) });
      });
    });
    const out = new Map();
    samples.forEach((series, key) => {
      const expected = growthAdjustedExpected(series, roundValues);
      if (expected) out.set(key, expected.value);
    });
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

  function studentPresence(rows, options = {}) {
    const physicalRows = (rows || []).filter(row => isPhysicalPresenceRow(row, options));
    const context = { ...options, sourceRows: physicalRows, termRanges: buildTermRanges(physicalRows) };
    const buckets = new Map();
    physicalRows.forEach(row => {
      presenceHalfHourSlots(row).forEach(hour => {
        (row.days || []).forEach(day => {
          if (!dayOrder.includes(day)) return;
          const key = [row.campus || 'UNKNOWN', day, hour].join('|');
          const item = buckets.get(key) || presenceBucket({ campus: row.campus || 'UNKNOWN', day, hour });
          addPresenceRow(item, { ...row, __presenceDay: day }, context);
          buckets.set(key, item);
        });
      });
    });
    const rowsOut = [...buckets.values()].map(finalizePresenceBucket).sort((a, b) => b.studentsPresent - a.studentsPresent);
    return {
      rows: rowsOut.slice(0, 12),
      peak: rowsOut[0] || null,
      lightest: rowsOut.length ? rowsOut[rowsOut.length - 1] : null
    };
  }

  function studentPresenceReport(rows, groupBy = 'campusDayHour', options = {}) {
    const physicalRows = (rows || []).filter(row => isPhysicalPresenceRow(row, options));
    const context = { ...options, sourceRows: physicalRows, termRanges: buildTermRanges(physicalRows) };
    const buckets = new Map();
    physicalRows.forEach(row => {
      presenceHalfHourSlots(row).forEach(hour => {
        (row.days || []).filter(day => dayOrder.includes(day)).forEach(day => {
          const key = presenceGroupKey(row, groupBy, day, hour);
          const item = buckets.get(key) || {
            ...presenceBucket(),
            group: key,
            campus: row.campus || 'UNKNOWN',
            building: row.building || '',
            room: row.roomOnly || row.room || '',
            day,
            hour
          };
          addPresenceRow(item, { ...row, __presenceDay: day }, context);
          buckets.set(key, item);
        });
      });
    });
    const rowsOut = [...buckets.values()].map(finalizePresenceBucket).sort((a, b) => b.studentsPresent - a.studentsPresent);
    return {
      rows: rowsOut,
      metrics: studentPresenceMetrics(rowsOut, physicalRows, context)
    };
  }

  function buildTermRanges(rows = []) {
    const terms = [...new Set((rows || []).map(row => String(row.term || '').toUpperCase()).filter(Boolean))];
    return new Map(terms.map(term => [term, termDateRange(rows, term)]).filter(([, range]) => range));
  }

  function presenceBucket(base = {}) {
    return {
      studentsPresent: 0,
      nominalStudentsPresent: 0,
      expectedStudentsPresent: 0,
      sectionsActive: 0,
      distinctCrns: 0,
      instructionalMeetings: 0,
      meetingRowsIncluded: 0,
      frequencyFactorTotal: 0,
      frequencyFactorCount: 0,
      unknownFrequencyRows: 0,
      hybridRowsFrequencyAdjusted: 0,
      availableRoomCapacity: 0,
      seatsScheduled: 0,
      fillRate: 0,
      _crns: new Set(),
      _meetings: new Set(),
      ...base
    };
  }

  function presenceCrn(row) {
    return String(row?.crn || [row?.term, row?.subject, row?.course, row?.section, row?.instructor, row?.start, row?.end].filter(Boolean).join('|') || Math.random()).trim();
  }

  function presenceMeetingKey(row) {
    const crn = presenceCrn(row);
    return [
      row?.term || '',
      crn,
      row?.__presenceDay || row?.day || row?.dayCode || row?.days?.join?.(',') || row?.dayPattern || '',
      row?.start || row?.startTime || '',
      row?.end || row?.endTime || ''
    ].join('|');
  }

  function addPresenceRow(item, row, options = {}) {
    item.meetingRowsIncluded += 1;
    const meetingKey = presenceMeetingKey(row);
    if (item._meetings.has(meetingKey)) return;
    item._meetings.add(meetingKey);
    const crn = presenceCrn(row);
    item._crns.add(crn);
    const presence = presenceEnrollment(row, options);
    const enrolled = presence.enrollment;
    item.studentsPresent += enrolled;
    item.nominalStudentsPresent += presence.nominalEnrollment;
    item.expectedStudentsPresent += presence.expectedEnrollment;
    item.sectionsActive += 1;
    item.instructionalMeetings += 1;
    item.frequencyFactorTotal += presence.frequency.factor;
    item.frequencyFactorCount += 1;
    if (presence.frequency.source === 'frequency unknown') item.unknownFrequencyRows += 1;
    if (String(row?.modality || '').toUpperCase() === 'HYBRID' && presence.frequency.factor < 1) item.hybridRowsFrequencyAdjusted += 1;
    item.seatsScheduled += Number(row.cap) || 0;
    item.availableRoomCapacity += Math.max(0, (Number(row.cap) || 0) - enrolled);
  }

  function finalizePresenceBucket(item) {
    const { _crns, _meetings, ...bucket } = item;
    return {
      ...bucket,
      distinctCrns: _crns?.size || bucket.sectionsActive || 0,
      instructionalMeetings: _meetings?.size || bucket.instructionalMeetings || bucket.sectionsActive || 0,
      averageMeetingFrequencyFactor: safeDiv(bucket.frequencyFactorTotal, bucket.frequencyFactorCount),
      averageFillRate: safeDiv(bucket.studentsPresent, bucket.seatsScheduled)
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

  function studentPresenceMetrics(rows, sourceRows = [], options = {}) {
    const totalStudents = rows.reduce((total, row) => total + row.studentsPresent, 0);
    const totalNominal = rows.reduce((total, row) => total + (row.nominalStudentsPresent ?? row.studentsPresent ?? 0), 0);
    const totalExpected = rows.reduce((total, row) => total + (row.expectedStudentsPresent ?? row.studentsPresent ?? 0), 0);
    const totalSections = sourceRows.length ? distinctCrnCount(sourceRows) : distinctBucketCrnCount(rows);
    const unduplicatedEnrollment = sumEnrollmentByDistinctCrn(sourceRows);
    const totalMeetingRows = sourceRows.length
      ? sourceRows.length
      : rows.reduce((total, row) => total + (row.meetingRowsIncluded || row.sectionsActive || 0), 0);
    const totalSeats = rows.reduce((total, row) => total + row.seatsScheduled, 0);
    const totalOpen = rows.reduce((total, row) => total + row.availableRoomCapacity, 0);
    return {
      totalStudents,
      totalNominalStudents: totalNominal,
      totalExpectedStudents: totalExpected,
      presenceMode: presenceMode(options),
      totalSections,
      distinctCrns: totalSections,
      unduplicatedEnrollment,
      meetingRowsIncluded: totalMeetingRows,
      averageMeetingFrequencyFactor: safeDiv(rows.reduce((total, row) => total + (row.averageMeetingFrequencyFactor || 0) * (row.frequencyFactorCount || 0), 0), rows.reduce((total, row) => total + (row.frequencyFactorCount || 0), 0)),
      unknownFrequencyRows: rows.reduce((total, row) => total + (row.unknownFrequencyRows || 0), 0),
      hybridRowsFrequencyAdjusted: rows.reduce((total, row) => total + (row.hybridRowsFrequencyAdjusted || 0), 0),
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
      const item = map.get(key) || { group: key, studentsPresent: 0, sectionsActive: 0, meetingRowsIncluded: 0 };
      item.studentsPresent += row.studentsPresent;
      item.sectionsActive += row.sectionsActive;
      item.meetingRowsIncluded += row.meetingRowsIncluded || row.sectionsActive || 0;
      map.set(key, item);
    });
    return [...map.values()];
  }

  function presenceHalfHourSlots(row) {
    const start = minutesFromTime(row?.start);
    const end = minutesFromTime(row?.end);
    if (start == null || end == null || end <= start) return [];
    const slots = [];
    for (let minute = Math.floor(start / 30) * 30; minute < end; minute += 30) {
      if (minute + 30 <= start) continue;
      slots.push(formatHalfHour(minute));
    }
    return slots;
  }

  function formatHalfHour(minutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function distinctCrnCount(rows) {
    const crns = new Set();
    (rows || []).forEach(row => crns.add(presenceCrn(row)));
    return crns.size;
  }

  function sumEnrollmentByDistinctCrn(rows) {
    const seen = new Set();
    return (rows || []).reduce((total, row) => {
      const crn = presenceCrn(row);
      if (seen.has(crn)) return total;
      seen.add(crn);
      return total + enrollment(row);
    }, 0);
  }

  function distinctBucketCrnCount(rows) {
    return (rows || []).reduce((total, row) => total + (row.distinctCrns || row.sectionsActive || 0), 0);
  }

  function isPhysicalPresenceRow(row, options = {}) {
    const modality = String(row?.modality || '').toUpperCase();
    const campus = String(row?.campus || '').toUpperCase();
    const start = String(row?.start || '').trim();
    const end = String(row?.end || '').trim();
    const days = row?.days || [];
    const defaultPhysicalCampuses = ['COS', 'TCC', 'TCCB', 'HAC', 'HACE', 'HACEDU', 'VIS', 'VISALIA', 'TUL', 'TULARE', 'HAN', 'HANFORD'];
    const allowedCampuses = options.physicalCampuses || defaultPhysicalCampuses;
    if (modality === 'DUAL ENROLLMENT' && !options.includeDualEnrollment) return false;
    if (!options.includeOtherModalities && !options.includeDualEnrollment && !['IN PERSON', 'HYBRID'].includes(modality)) return false;
    if (!options.includeOtherModalities && options.includeDualEnrollment && !['IN PERSON', 'HYBRID', 'DUAL ENROLLMENT'].includes(modality)) return false;
    if (allowedCampuses.length && !allowedCampuses.includes(campus)) return false;
    if (/ONLINE|WEB|VIRTUAL|TBA/.test(campus)) return false;
    if (!start || !end || start === '00:00' || end === '00:00') return false;
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
    add('Enrollment Health', 'Expected Enrollment (Growth-Adjusted)', 'All Selected Rows', health.expectedEnrollment == null ? 'N/A' : health.expectedEnrollment);
    add('Enrollment Health', 'Expected Enrollment Method', 'All Selected Rows', health.expectedEnrollmentMethod || 'N/A', health.expectedEnrollmentBasis || '');
    add('Enrollment Health', 'Variance vs Expected Enrollment', 'All Selected Rows', health.expectedVariance == null ? 'N/A' : health.expectedVariance);
    add('Enrollment Health', 'Previous Like-Term Enrollment', health.previousLikeTerm || 'Most Recent Comparable Term', health.previousLikeTermEnrollment == null ? 'N/A' : health.previousLikeTermEnrollment);
    add('Enrollment Health', 'Variance vs Previous Like-Term', health.previousLikeTerm || 'Most Recent Comparable Term', health.previousLikeTermVariance == null ? 'N/A' : health.previousLikeTermVariance, health.previousLikeTermVariancePct == null ? 'N/A' : `${(health.previousLikeTermVariancePct * 100).toFixed(1)}%`);
    add('Enrollment Health', 'Courses Reviewed', 'All Selected Rows', health.coursesReviewed);
    add('Enrollment Health', 'Sections Reviewed', 'All Selected Rows', health.sectionsReviewed);
      add('Enrollment Health', 'FTES', 'All Selected Rows', health.ftes);
    (health.ftesByAccountingMethod || []).forEach(row => {
      add('Enrollment Health', 'FTES by Attendance Accounting Method', row.accountingMethod, row.ftes, `Enrollment: ${row.enrollment}; Class offerings: ${row.classOfferings}`, `Direct FTES rows: ${row.directFtesRows}; Estimated FTES rows: ${row.estimatedFtesRows}; Unavailable FTES rows: ${row.unavailableFtesRows}`);
    });
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
    meetingFrequencyFactor,
    buildTermRanges,
    presenceEnrollment,
    isPhysicalPresenceRow,
    scheduleStructure,
    rotationRows,
    dashboardSummary,
    dashboardSummaryExportRows
  };
})();
