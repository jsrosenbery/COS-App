// Shared read-only trend projection engine for forecasting presentation and planning comparisons.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.COSTrendProjection = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function safeDiv(a, b) {
    return b ? a / b : 0;
  }

  function round(value, places = 2) {
    const factor = 10 ** places;
    return Math.round(num(value) * factor) / factor;
  }

  function defaultTermSortValue(term) {
    const text = String(term || '').toUpperCase();
    const year = Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0);
    const season = (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0];
    const order = { WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 };
    return year * 10 + (order[season] || 0);
  }

  function normalizeTermTotals(termTotals = [], options = {}) {
    const sortValue = options.termSortValue || defaultTermSortValue;
    return (termTotals || [])
      .map(row => ({
        ...row,
        term: String(row.term || '').trim(),
        sortValue: num(row.sortValue || sortValue(row.term)),
        enrollment: num(row.enrollment ?? row.censusEnrollment ?? row.census),
        censusEnrollment: num(row.censusEnrollment ?? row.census ?? row.enrollment),
        actualEnrollment: num(row.actualEnrollment ?? row.actual ?? row.final ?? row.enrollment),
        seatsOffered: num(row.seatsOffered ?? row.seats ?? row.capacity),
        scheduledClassOfferings: num(row.scheduledClassOfferings ?? row.sections),
        instructionalMeetings: num(row.instructionalMeetings ?? row.meetings ?? row.sections),
        waitlist: num(row.waitlist),
        ftes: num(row.ftes),
        studentPresence: num(row.studentPresence),
        fillRateNumber: num(row.fillRateNumber ?? row.fillRate),
        enrollmentPerClassOffering: num(row.enrollmentPerClassOffering),
        seatsPerOffering: num(row.seatsPerOffering)
      }))
      .filter(row => row.term)
      .sort((a, b) => a.sortValue - b.sortValue);
  }

  function recencyWeights(length, floor = 0.35) {
    if (length <= 0) return [];
    if (length === 1) return [1];
    return Array.from({ length }, (_row, index) => {
      const position = index / Math.max(1, length - 1);
      return round(Math.max(floor, floor + position * (1 - floor)), 4);
    });
  }

  function weightedAverage(values = [], weights = []) {
    const denominator = values.reduce((total, _value, index) => total + num(weights[index]), 0);
    if (!denominator) return values.length ? values.reduce((total, value) => total + num(value), 0) / values.length : 0;
    return values.reduce((total, value, index) => total + num(value) * num(weights[index]), 0) / denominator;
  }

  function growthRows(values = [], terms = []) {
    const rows = [];
    for (let index = 1; index < values.length; index += 1) {
      const previous = num(values[index - 1]);
      const current = num(values[index]);
      rows.push({
        fromTerm: terms[index - 1] || '',
        toTerm: terms[index] || '',
        previous,
        current,
        delta: current - previous,
        rate: previous ? (current - previous) / Math.abs(previous) : 0
      });
    }
    return rows;
  }

  function volatility(values = []) {
    if (values.length < 2) return 0;
    const changes = growthRows(values).map(row => row.rate);
    const mean = changes.reduce((total, value) => total + value, 0) / Math.max(1, changes.length);
    return Math.sqrt(changes.reduce((total, value) => total + ((value - mean) ** 2), 0) / Math.max(1, changes.length));
  }

  function confidenceLabel(termCount, volatilityValue, missingFields = 0) {
    if (termCount >= 4 && volatilityValue <= 0.08 && missingFields === 0) return 'High';
    if (termCount >= 2 && volatilityValue <= 0.2) return 'Moderate';
    return 'Low';
  }

  function projectMetric(termTotals, metric, options = {}) {
    const rows = normalizeTermTotals(termTotals, options);
    const values = rows.map(row => num(row[metric]));
    const terms = rows.map(row => row.term);
    const weights = recencyWeights(values.length, options.weightFloor ?? 0.35);
    const baseline = values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    const recent = values[values.length - 1] || 0;
    const growth = growthRows(values, terms);
    const weightedGrowth = weightedAverage(growth.map(row => row.rate), weights.slice(1));
    const trendProjection = Math.max(0, recent * (1 + weightedGrowth));
    const vol = volatility(values);
    const rangeWidth = Math.max(Math.abs(trendProjection) * vol, Math.abs(trendProjection) * 0.03);
    const growthWeights = weights.slice(1);
    const growthDiagnostics = growth.map((row, index) => ({
      ...row,
      weight: growthWeights[index] || 0,
      weightedRateContribution: row.rate * (growthWeights[index] || 0)
    }));
    const totalGrowthWeight = growthWeights.reduce((total, value) => total + num(value), 0);
    return {
      metric,
      terms,
      termTotals: rows.map(row => ({ term: row.term, value: num(row[metric]) })),
      baseline,
      recent,
      growth,
      recencyWeights: rows.map((row, index) => ({ term: row.term, weight: weights[index] })),
      recencyWeightedGrowth: weightedGrowth,
      trendProjection,
      audit: {
        metric,
        selectedGrowthSeries: options.selectedGrowthSeries || options.forecastScopeLabel || 'Provided comparable series',
        terms,
        termTotals: rows.map(row => ({ term: row.term, value: num(row[metric]) })),
        baseline,
        mostRecentValue: recent,
        growthRows: growthDiagnostics,
        growthWeights,
        totalGrowthWeight,
        finalGrowthRateUsed: weightedGrowth,
        formula: 'mostRecentValue * (1 + finalGrowthRateUsed)',
        projectionBeforeScheduleAdjustment: trendProjection
      },
      expectedRange: {
        low: Math.max(0, trendProjection - rangeWidth),
        mostLikely: trendProjection,
        high: trendProjection + rangeWidth
      },
      volatility: vol,
      confidence: confidenceLabel(rows.length, vol, values.filter(value => value == null).length)
    };
  }

  function scheduleAdjustmentFactor(currentTotals = {}, historical = {}) {
    const currentOfferings = num(currentTotals.scheduledClassOfferings);
    const currentSeats = num(currentTotals.seatsOffered);
    const historicalOfferings = num(historical.scheduledClassOfferings);
    const historicalSeats = num(historical.seatsOffered);
    const offeringFactor = historicalOfferings > 0 && currentOfferings > 0 ? currentOfferings / historicalOfferings : 1;
    const seatFactor = historicalSeats > 0 && currentSeats > 0 ? currentSeats / historicalSeats : 1;
    return {
      offeringFactor,
      seatFactor,
      combinedFactor: (offeringFactor * 0.55) + (seatFactor * 0.45)
    };
  }

  function buildProjection(config = {}) {
    const rows = normalizeTermTotals(config.termTotals || [], config);
    const enrollment = projectMetric(rows, 'enrollment', config);
    const ftes = projectMetric(rows, 'ftes', config);
    const seats = projectMetric(rows, 'seatsOffered', config);
    const offerings = projectMetric(rows, 'scheduledClassOfferings', config);
    const baselineTotals = {
      enrollment: enrollment.baseline,
      ftes: ftes.baseline,
      seatsOffered: seats.baseline,
      scheduledClassOfferings: offerings.baseline
    };
    const adjustment = scheduleAdjustmentFactor(config.currentTotals || {}, baselineTotals);
    const growthModifier = num(config.growthModifier);
    const scheduleAdjustedEnrollment = enrollment.trendProjection * adjustment.combinedFactor;
    const finalExpectedEnrollment = scheduleAdjustedEnrollment * (1 + growthModifier);
    const scheduleAdjustedFtes = ftes.trendProjection * adjustment.combinedFactor;
    const finalExpectedFtes = scheduleAdjustedFtes * (1 + growthModifier);
    const confidence = confidenceLabel(rows.length, enrollment.volatility, 0);
    const audit = {
      method: 'Trend Projection',
      selectedGrowthSeries: config.selectedGrowthSeries || config.forecastScopeLabel || 'Provided comparable series',
      termsIncluded: rows.map(row => row.term),
      warning: 'Growth is calculated from one selected comparable series only. Single-term scopes use like-term history only; academic-year scopes use annual FY/AY totals.',
      enrollment: {
        ...enrollment.audit,
        scheduleAdjustmentFactor: adjustment.combinedFactor,
        scheduleAdjustedProjection: scheduleAdjustedEnrollment,
        manualGrowthModifier: growthModifier,
        finalExpectedProjection: finalExpectedEnrollment
      },
      ftes: {
        ...ftes.audit,
        scheduleAdjustmentFactor: adjustment.combinedFactor,
        scheduleAdjustedProjection: scheduleAdjustedFtes,
        manualGrowthModifier: growthModifier,
        finalExpectedProjection: finalExpectedFtes
      },
      seatsOffered: seats.audit,
      scheduledClassOfferings: offerings.audit
    };
    return {
      method: 'Trend Projection',
      termsIncluded: rows.map(row => row.term),
      termCount: rows.length,
      historicalBaseline: baselineTotals,
      metrics: { enrollment, ftes, seatsOffered: seats, scheduledClassOfferings: offerings },
      yearOverYearGrowth: enrollment.growth,
      recencyWeights: enrollment.recencyWeights,
      recencyWeightedGrowth: enrollment.recencyWeightedGrowth,
      trendProjection: {
        enrollment: enrollment.trendProjection,
        ftes: ftes.trendProjection,
        seatsOffered: seats.trendProjection,
        scheduledClassOfferings: offerings.trendProjection
      },
      scheduleAdjustment: adjustment,
      scheduleAdjustedProjection: {
        enrollment: scheduleAdjustedEnrollment,
        ftes: scheduleAdjustedFtes
      },
      finalExpectedProjection: {
        enrollment: finalExpectedEnrollment,
        ftes: finalExpectedFtes
      },
      expectedRange: {
        low: Math.max(0, enrollment.expectedRange.low * adjustment.combinedFactor * (1 + growthModifier)),
        mostLikely: finalExpectedEnrollment,
        high: enrollment.expectedRange.high * adjustment.combinedFactor * (1 + growthModifier)
      },
      expectedFtesRange: {
        low: Math.max(0, ftes.expectedRange.low * adjustment.combinedFactor * (1 + growthModifier)),
        mostLikely: finalExpectedFtes,
        high: ftes.expectedRange.high * adjustment.combinedFactor * (1 + growthModifier)
      },
      audit,
      confidence,
      currentVariance: num(config.currentTotals?.enrollment) - enrollment.trendProjection,
      projectedVariance: finalExpectedEnrollment - enrollment.trendProjection
    };
  }

  return Object.freeze({
    recencyWeights,
    growthRows,
    projectMetric,
    buildProjection,
    scheduleAdjustmentFactor,
    confidenceLabel
  });
});
