(function () {
  'use strict';

  function censusEnrollment(row) {
    return row?.census == null ? row?.actual || 0 : row.census;
  }

  function finalEnrollment(row) {
    return row?.actual || 0;
  }

  function safeDiv(a, b) {
    return b ? a / b : 0;
  }

  function average(values) {
    const usable = (values || []).filter(value => Number.isFinite(value));
    return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : 0;
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
    expectedEnrollment,
    expectedFillRate,
    expectedOpenSeats
  };
})();
