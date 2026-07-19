(function (root, factory) {
  const api = factory({
    date: root.COSDateUtils,
    time: root.COSTimeUtils,
    math: root.COSMathUtils,
    validation: root.COSValidationUtils,
    export: root.COSExportUtils
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSUtilsCore = api;
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

  const date = browserModules.date || optionalRequire('./dateUtils.js') || {};
  const time = browserModules.time || optionalRequire('./timeUtils.js') || {};
  const math = browserModules.math || optionalRequire('./mathUtils.js') || {};
  const validation = browserModules.validation || optionalRequire('./validationUtils.js') || {};
  const exportUtils = browserModules.export || optionalRequire('./exportUtils.js') || {};

  return Object.freeze({
    date,
    time,
    math,
    validation,
    export: exportUtils
  });
});
