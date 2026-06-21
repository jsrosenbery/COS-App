// Availability feature namespace. The main app owns rendering until the
// stateful app.js closure is fully extracted.
(function () {
  window.COSAvailability = {
    enabled: () => window.COS_APP_CONFIG?.features?.roomCatalogAdmin !== false
  };
})();
