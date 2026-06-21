// Shared browser utilities used by feature modules and gradual app.js extraction.
(function () {
  function backendBaseUrl() {
    return window.BACKEND_BASE_URL || window.COS_APP_CONFIG?.backendBaseUrl || '';
  }

  function featureEnabled(name) {
    return window.COS_APP_CONFIG?.features?.[name] !== false;
  }

  function jsonHeaders(extra = {}) {
    return {
      'Content-Type': 'application/json',
      ...extra
    };
  }

  window.COSUtils = {
    backendBaseUrl,
    featureEnabled,
    jsonHeaders
  };
})();
