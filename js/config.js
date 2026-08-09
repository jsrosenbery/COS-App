// Runtime configuration for the static frontend.
// Override window.COS_APP_CONFIG before this script loads to point at another API.
(function () {
  const overrides = window.COS_APP_CONFIG || {};
  const environment = overrides.environment || (
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'development'
      : 'production'
  );

  const defaultBackendBaseUrl = environment === 'development'
    ? 'http://127.0.0.1:3000'
    : 'https://app-backend-docker-fgh0.onrender.com';

  window.COS_APP_CONFIG = {
    ...overrides,
    backendBaseUrl: overrides.backendBaseUrl || defaultBackendBaseUrl,
    environment,
    flags: {
      isDevelopment: environment === 'development',
      isProduction: environment === 'production',
      debug: environment === 'development',
      ...(overrides.flags || {})
    },
    features: {
      enrollmentManagement: true,
      deanDashboardAccess: true,
      enrollmentManagementWorkbench: false,
      scenarioModeling: false,
      scheduleSimulation: false,
      analyticsArchive: true,
      roomCatalogAdmin: true,
      calGetcAdmin: true,
      curriculumCrosswalkAdmin: true,
      scheduleChangeForm: true,
      ...(overrides.features || {})
    }
  };

  window.BACKEND_BASE_URL = window.COS_APP_CONFIG.backendBaseUrl;
})();
