(function (root, factory) {
  const api = factory();
  root.COSDomUtils = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function resetSelect(select, options, allLabel = 'All', allValue = 'All') {
    if (!select) return;
    select.replaceChildren();
    if (!select.multiple) select.appendChild(new Option(allLabel, allValue));
    (options || []).forEach(option => {
      if (option && typeof option === 'object') {
        select.appendChild(new Option(option.label, option.value));
      } else {
        select.appendChild(new Option(option, option));
      }
    });
  }

  function selectedValues(select) {
    if (!select) return [];
    if (select.multiple) return Array.from(select.selectedOptions).map(option => option.value).filter(Boolean);
    return select.value ? [select.value] : [];
  }

  function preserveSelected(select, values) {
    if (!select) return;
    const wanted = new Set((values || []).filter(Boolean));
    if (select.multiple) {
      Array.from(select.options).forEach(option => { option.selected = wanted.has(option.value); });
      return;
    }
    if (wanted.has(select.value)) return;
    const first = [...wanted].find(value => Array.from(select.options).some(option => option.value === value));
    if (first) select.value = first;
  }

  function valueMatchesAny(value, selected) {
    return !selected?.length || selected.includes(value);
  }

  function appendLine(parent, text, bold = false) {
    if (!parent || typeof document === 'undefined') return;
    const span = document.createElement('span');
    span.textContent = text ?? '';
    if (bold) span.style.fontWeight = 'bold';
    parent.appendChild(span);
    parent.appendChild(document.createElement('br'));
  }

  function setTooltipLines(tooltip, lines) {
    if (!tooltip) return;
    tooltip.replaceChildren();
    (lines || []).forEach(({ text, bold = false }) => {
      if (text === undefined || text === null || text === '') return;
      appendLine(tooltip, text, bold);
    });
  }

  return {
    escapeHTML,
    resetSelect,
    selectedValues,
    preserveSelected,
    valueMatchesAny,
    appendLine,
    setTooltipLines
  };
});
