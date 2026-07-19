(function (root, factory) {
  const api = factory({
    campuses: root.COSTimberCampuses,
    reports: root.COSTimberReports,
    scheduling: root.COSTimberScheduling,
    thresholds: root.COSTimberThresholds,
    modalities: root.COSTimberModalities
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimberConfig = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserModules) {
  'use strict';

  function optionalRequire(path) {
    if (typeof require !== 'function') return null;
    try {
      return require(path);
    } catch (err) {
      return null;
    }
  }

  const campuses = browserModules.campuses || optionalRequire('./campuses.js') || {};
  const reports = browserModules.reports || optionalRequire('./reports.js') || {};
  const scheduling = browserModules.scheduling || optionalRequire('./scheduling.js') || {};
  const thresholds = browserModules.thresholds || optionalRequire('./thresholds.js') || {};
  const modalities = browserModules.modalities || optionalRequire('./modalities.js') || {};

  return Object.freeze({
    campuses,
    reports,
    scheduling,
    thresholds,
    modalities
  });
});
