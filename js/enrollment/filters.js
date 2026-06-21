(function () {
  'use strict';

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function valueMatchesSelection(value, selectedValues) {
    if (!selectedValues || !selectedValues.length) return true;
    const normalized = canon(value);
    return selectedValues.map(canon).some(selected => normalized === selected);
  }

  function filterRowsByDivision(rows, selectedDivisions) {
    return (rows || []).filter(row => valueMatchesSelection(row.division, selectedDivisions));
  }

  function divisionFilterLabel(selectedDivisions) {
    const values = (selectedDivisions || []).map(canon).filter(Boolean);
    return values.length ? values.join(', ') : 'All divisions';
  }

  window.COSEnrollmentFilters = {
    canon,
    valueMatchesSelection,
    filterRowsByDivision,
    divisionFilterLabel
  };
})();
