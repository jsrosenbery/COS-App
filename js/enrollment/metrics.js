(function () {
  'use strict';

  function censusEnrollment(row) {
    return row?.census == null ? row?.actual || 0 : row.census;
  }

  function finalEnrollment(row) {
    if (row?.finalEnrollment !== null && row?.finalEnrollment !== undefined && row?.finalEnrollment !== '') {
      const finalValue = Number(row.finalEnrollment);
      if (Number.isFinite(finalValue)) return finalValue;
    }
    return row?.actual || 0;
  }

  function safeDiv(a, b) {
    return b ? a / b : 0;
  }

  function average(values) {
    const usable = (values || []).filter(value => Number.isFinite(value));
    return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : 0;
  }

  function numeric(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function ftesStatus(row, options = {}) {
    const includePredicted = Boolean(options.includePredicted);
    const includeUnavailableRaw = Boolean(options.includeUnavailableRaw);
    const direct = numeric(row?.sourceFtes ?? row?.directFtes ?? row?.sourceFtesValue);
    const calculated = numeric(row?.ftes ?? row?.estimatedFtes ?? row?.calculatedFtes ?? row?.standardizedFtes);
    const predicted = numeric(row?.predictedFtes ?? row?.historicalPredictedFtes);
    const unavailable = Boolean(row?.ftesUnavailable);
    const hasExplicitAvailability = row && (
      Object.prototype.hasOwnProperty.call(row, 'hasDirectFtesData') ||
      Object.prototype.hasOwnProperty.call(row, 'hasFtesData') ||
      Object.prototype.hasOwnProperty.call(row, 'ftesUnavailable')
    );
    const provenance = String(row?.ftesProvenance || '').trim().toUpperCase();
    const maturity = provenance === 'UNAVAILABLE' || unavailable
      ? 'UNAVAILABLE'
      : provenance === 'PREDICTED'
        ? 'PREDICTED'
        : /CONFIRMED|FINAL/.test(String(row?.ftesMaturity || '').toUpperCase()) ? 'CONFIRMED' : 'ESTIMATED';

    if (unavailable && !includeUnavailableRaw) {
      if (includePredicted && predicted != null) {
        return { value: predicted, source: 'Predicted', provenance: 'PREDICTED', maturity: 'PREDICTED', unavailable: false, direct: false, estimated: false, predictedOnly: true };
      }
      return { value: 0, source: 'Unavailable', provenance: 'UNAVAILABLE', maturity: 'UNAVAILABLE', unavailable: true, direct: false, estimated: false, predictedOnly: false };
    }

    if (row?.hasDirectFtesData && (direct != null || calculated != null)) {
      return { value: direct ?? calculated, source: 'Direct', provenance: provenance || 'DIRECT', maturity, unavailable: false, direct: true, estimated: false, predictedOnly: false };
    }

    if (row?.hasFtesData && calculated != null) {
      return { value: calculated, source: row?.hasDirectFtesData ? 'Direct' : 'Estimated', provenance: provenance || (row?.hasDirectFtesData ? 'DIRECT' : 'CALCULATED_LEGACY'), maturity, unavailable: false, direct: Boolean(row?.hasDirectFtesData), estimated: !row?.hasDirectFtesData, predictedOnly: false };
    }

    if (!hasExplicitAvailability && calculated != null) {
      return { value: calculated, source: 'Legacy FTES', provenance: provenance || 'CALCULATED_LEGACY', maturity, unavailable: false, direct: false, estimated: false, predictedOnly: false };
    }

    if (includePredicted && predicted != null) {
      return { value: predicted, source: 'Predicted', provenance: 'PREDICTED', maturity: 'PREDICTED', unavailable: false, direct: false, estimated: false, predictedOnly: true };
    }

    return { value: 0, source: 'Unavailable', provenance: 'UNAVAILABLE', maturity: 'UNAVAILABLE', unavailable: true, direct: false, estimated: false, predictedOnly: false };
  }

  function ftesValue(row, options = {}) {
    return ftesStatus(row, options).value;
  }

  function sumFtes(rows, options = {}) {
    return (rows || []).reduce((total, row) => total + ftesValue(row, options), 0);
  }

  function expectedEnrollment(row) {
    return row?.expectedEnrollment ?? censusEnrollment(row);
  }

  function expectedFillRate(row) {
    return row?.expectedFillRate ?? row?.fillRate ?? safeDiv(expectedEnrollment(row), row?.cap || 0);
  }

  function expectedOpenSeats(row) {
    return Math.max(0, (row?.cap || 0) - expectedEnrollment(row));
  }

  window.COSEnrollmentMetrics = {
    censusEnrollment,
    finalEnrollment,
    safeDiv,
    average,
    ftesStatus,
    ftesValue,
    sumFtes,
    expectedEnrollment,
    expectedFillRate,
    expectedOpenSeats
  };
})();
