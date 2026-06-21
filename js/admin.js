// Admin feature namespace for config-backed admin gates.
(function () {
  function featureEnabled(name) {
    return window.COS_APP_CONFIG?.features?.[name] !== false;
  }

  window.COSAdmin = {
    featureEnabled,
    roomCatalogEnabled: () => featureEnabled('roomCatalogAdmin'),
    calGetcEnabled: () => featureEnabled('calGetcAdmin'),
    curriculumCrosswalkEnabled: () => featureEnabled('curriculumCrosswalkAdmin')
  };
})();
