(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimberCampuses = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CAMPUS_CODES = Object.freeze(['COS', 'TCC', 'HAC', 'ONT', 'ONH', 'ONC']);
  const PHYSICAL_CAMPUS_CODES = Object.freeze(['COS', 'TCC', 'HAC']);
  const SCHEDULE_BUILDER_DEFAULT_CAMPUS_CODES = Object.freeze(['ONC', 'ONT', 'ONH', 'HAC', 'TCC', 'COS']);
  const CAMPUS_NAMES = Object.freeze({
    COS: 'College of the Sequoias',
    TCC: 'Tulare College Center',
    HAC: 'Hanford Educational Center',
    ONC: 'Online Course',
    ONT: 'Online TBA',
    ONH: 'Online Hybrid'
  });

  return Object.freeze({
    CAMPUS_CODES,
    PHYSICAL_CAMPUS_CODES,
    SCHEDULE_BUILDER_DEFAULT_CAMPUS_CODES,
    CAMPUS_NAMES
  });
});
