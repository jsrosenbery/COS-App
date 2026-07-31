(function (root, factory) {
  const api = factory();
  root.COSCampusClassification = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function compact(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function canon(value) {
    return compact(value).toUpperCase().replace(/[._-]+/g, ' ');
  }

  function modalityText(section = {}) {
    return canon(section.modality || section.Modality || section.instructionalMethod || section.INSTRUCTIONAL_METHOD || section.INSM_CODE || section.raw?.INSM_CODE || '');
  }

  function normalizeCampus(section = {}) {
    const modality = modalityText(section);
    const rawCampus = compact(section.campus || section.Campus || section.raw?.Campus || section.raw?.CAMPUS || '');
    const raw = canon(rawCampus);
    const fullyOnline = isFullyOnline(section);
    if (fullyOnline) return { campus: 'Online', physicalCampus: '', isOnline: true, isPhysical: false, rawCampus };
    if (['COS', 'VISALIA', 'VISALIA CAMPUS', 'MAIN CAMPUS'].includes(raw)) return physical('Visalia', rawCampus);
    if (['HAC', 'HANFORD', 'HANFORD CAMPUS'].includes(raw)) return physical('Hanford', rawCampus);
    if (['TCC', 'TULARE', 'TULARE CAMPUS'].includes(raw)) return physical('Tulare', rawCampus);
    if (['ONC', 'ONT', 'ONH', 'ONLINE', 'ONLINE CAMPUS', 'WEB'].includes(raw)) return { campus: 'Online', physicalCampus: '', isOnline: true, isPhysical: false, rawCampus };
    if (/ONLINE|ASYNC|ONL|WEB/.test(modality) && !/HYBRID|HYB/.test(modality)) return { campus: 'Online', physicalCampus: '', isOnline: true, isPhysical: false, rawCampus };
    return { campus: 'Other / Unknown', physicalCampus: '', isOnline: false, isPhysical: false, rawCampus };
  }

  function physical(campus, rawCampus) {
    return { campus, physicalCampus: campus, isOnline: false, isPhysical: true, rawCampus };
  }

  function isFullyOnline(section = {}) {
    const modality = modalityText(section);
    if (/HYBRID|HYB/.test(modality)) return false;
    if (/ASYNCHRONOUS ONLINE|SYNCHRONOUS ONLINE|ONLINE|ONL|WEB|^OL$|^ONN$|^ONS$|^OO$/.test(modality)) return true;
    const rawCampus = canon(section.campus || section.Campus || '');
    return ['ONC', 'ONT', 'ONH', 'ONLINE', 'ONLINE CAMPUS', 'WEB'].includes(rawCampus);
  }

  function campusTransitionKey(a, b) {
    const left = compact(a);
    const right = compact(b);
    return [left, right].sort().join('|');
  }

  const DEFAULT_CAMPUS_TRANSITION_MINUTES = Object.freeze({
    [campusTransitionKey('Visalia', 'Hanford')]: 60,
    [campusTransitionKey('Visalia', 'Tulare')]: 45,
    [campusTransitionKey('Hanford', 'Tulare')]: 75
  });

  return Object.freeze({
    normalizeCampus,
    isFullyOnline,
    campusTransitionKey,
    DEFAULT_CAMPUS_TRANSITION_MINUTES,
    PHYSICAL_CAMPUSES: Object.freeze(['Visalia', 'Hanford', 'Tulare'])
  });
});
