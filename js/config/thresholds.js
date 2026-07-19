(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimberThresholds = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ROOM_UTILIZATION = Object.freeze({
    weights: Object.freeze({
      overall: 0.4,
      prime: 0.25,
      distribution: 0.2,
      fragmentation: 0.15
    }),
    veryEfficientMinimum: 0.65,
    distributionMinimum: 0.45,
    highOpportunityMinimum: 0.65,
    primeOpportunityMinimum: 0.5,
    lowOverallMaximum: 0.35,
    unknownCapacityFactor: 0.85,
    smallRoomCapacityMaximum: 30,
    smallRoomCapacityFactor: 0.55,
    underutilizedRoomCapacityShare: 0.7
  });

  const ENROLLMENT = Object.freeze({
    chronicLowFillThreshold: 0.75,
    demandHighFillThreshold: 0.9,
    demandModerateFillThreshold: 0.75
  });

  return Object.freeze({
    ROOM_UTILIZATION,
    ENROLLMENT
  });
});
