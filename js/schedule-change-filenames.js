// Shared Schedule Change Form filename generation for browser and Node tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSScheduleChangeFilenames = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const WINDOWS_INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

  function normalizeFilenamePart(value) {
    return String(value ?? '')
      .replace(WINDOWS_INVALID_FILENAME_CHARS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
  }

  function normalizeExtension(extension) {
    const clean = String(extension || '').replace(/^\./, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!clean) throw new Error('Schedule Change export extension is required.');
    return `.${clean}`;
  }

  function scheduleChangeTimestamp(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function generateScheduleChangeFilename(termCode, crn, action, extension, options = {}) {
    const term = normalizeFilenamePart(termCode);
    const crnValue = normalizeFilenamePart(crn);
    const actionValue = normalizeFilenamePart(action);
    if (!term) throw new Error('Schedule Change export term code is required.');
    if (!crnValue) throw new Error('Schedule Change export CRN is required.');
    if (!actionValue) throw new Error('Schedule Change export action is required.');
    const timestamp = options.timestamp ? ` ${scheduleChangeTimestamp(options.date)}` : '';
    return `${term} ${crnValue} ${actionValue}${timestamp}${normalizeExtension(extension)}`;
  }

  return {
    generateScheduleChangeFilename,
    normalizeFilenamePart,
    scheduleChangeTimestamp
  };
});
