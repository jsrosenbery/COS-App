(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const modality = root.COSModalityNormalizer || (typeof require === 'function' ? require('./modality-normalizer') : null);
  const api = factory(csv, modality);
  root.COSPhysicalTime = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv, modalityNormalizer) {
  'use strict';

  function canon(value) {
    if (csv?.canon) return csv.canon(value);
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function minutesFromTime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function rowInstructionModality(row) {
    const direct = row?.modality || row?.Modality || row?.instructionalMethod || row?.INSTRUCTIONAL_METHOD ||
      row?.INSM_CODE_SSBSECT || row?.raw?.INSTRUCTIONAL_METHOD || row?.raw?.INSM_CODE_SSBSECT || '';
    if (modalityNormalizer?.normalize) return canon(modalityNormalizer.normalize(direct, row));
    const raw = canon(direct);
    if (/\b(ONLINE|ONL|OL|ONN|ONS|O1|WEB|REMOTE|VIRTUAL)\b/.test(raw)) return 'ONLINE';
    if (/\b(HYBRID|HYB|FLX)\b/.test(raw)) return 'HYBRID';
    if (/\b(IP|IN PERSON|FACE TO FACE|ON CAMPUS)\b/.test(raw)) return 'IN PERSON';
    return raw || 'UNKNOWN';
  }

  function isPhysicalInstructionModality(row) {
    const modality = rowInstructionModality(row);
    return modality === 'IN PERSON' || modality === 'HYBRID';
  }

  function isOnlineInstructionModality(row) {
    return rowInstructionModality(row) === 'ONLINE';
  }

  function isOnlinePlaceholderTime(row) {
    const modality = canon(row?.modality || row?.Modality || '');
    const start = canon(row?.start || row?.startTime || row?.Start_Time || row?.Start || '');
    const end = canon(row?.end || row?.endTime || row?.End_Time || row?.End || '');
    const block = canon(row?.timeBlock || row?.TimeBlock || row?.['Time Block'] || '');
    const isOnline = modality === 'ONLINE' || /\b(ONLINE|ONL|OL|ONN|ONS|O1|WEB|REMOTE|VIRTUAL|TBA)\b/.test(modality);
    if (!isOnline) return false;
    if (!start || !end || start === 'INVALID' || end === 'INVALID') return true;
    if (/^0?0:00(?:\s*-\s*0?0:(?:00|59))?$/.test(block)) return true;
    if (start >= '00:00' && start <= '00:59') return true;
    return start === '00:00' && (end === '00:00' || end === '00:59');
  }

  function isMidnightPlaceholderInterval(row) {
    const start = minutesFromTime(row?.start || row?.startTime);
    const end = minutesFromTime(row?.end || row?.endTime);
    const block = canon(row?.timeBlock || row?.TimeBlock || row?.['Time Block'] || '');
    if (start == null || end == null) return false;
    if (/^0?0:00(?:\s*-\s*0?0:(?:00|59))?$/.test(block)) return true;
    if (start === 0 && end >= 6 * 60) return true;
    return start === 0 && end <= 59;
  }

  function hasUsablePhysicalInterval(row) {
    const start = minutesFromTime(row?.start || row?.startTime);
    const end = minutesFromTime(row?.end || row?.endTime);
    if (!Array.isArray(row?.days) || !row.days.length) return false;
    if (start == null || end == null || end <= start) return false;
    if (canon(row?.timeBlock) === 'ONLINE/TBA') return false;
    if (isMidnightPlaceholderInterval(row)) return false;
    if (isOnlinePlaceholderTime(row)) return false;
    return true;
  }

  function physicalIntervalRows(rows, options = {}) {
    const treatment = options.onlineTreatment || (options.includeOnline === true ? 'scheduled-online' : 'physical');
    const includeOnline = treatment === 'scheduled-online' || treatment === 'all-online' || options.includeOnline === true;
    return (rows || []).filter(row => {
      if (!hasUsablePhysicalInterval(row)) return false;
      if (isPhysicalInstructionModality(row)) return true;
      return includeOnline && isOnlineInstructionModality(row);
    });
  }

  return {
    minutesFromTime,
    rowInstructionModality,
    isPhysicalInstructionModality,
    isOnlineInstructionModality,
    isOnlinePlaceholderTime,
    isMidnightPlaceholderInterval,
    hasUsablePhysicalInterval,
    physicalIntervalRows
  };
});
