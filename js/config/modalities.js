(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimberModalities = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const REPORTABLE_MODALITY_LABELS = Object.freeze(['In-Person', 'Hybrid', 'Online']);
  const PHYSICAL_MODALITY_LABELS = Object.freeze(['In-Person', 'Hybrid']);
  const MODALITY_BALANCE_CATEGORY_ORDER = Object.freeze(['In-Person', 'Hybrid', 'Online', 'Dual Enrollment']);
  const FACULTY_MODALITY_COLORS = Object.freeze({
    'In-Person': '#1f7aa8',
    Hybrid: '#f59e0b',
    Online: '#7c3aed'
  });
  const MODALITY_BALANCE_COLORS = Object.freeze({
    'In-Person': '#1d4f8f',
    Online: '#7c3aed',
    Hybrid: '#f59e0b',
    'Dual Enrollment': '#0f766e',
    Unknown: '#64748b'
  });

  return Object.freeze({
    REPORTABLE_MODALITY_LABELS,
    PHYSICAL_MODALITY_LABELS,
    MODALITY_BALANCE_CATEGORY_ORDER,
    FACULTY_MODALITY_COLORS,
    MODALITY_BALANCE_COLORS
  });
});
