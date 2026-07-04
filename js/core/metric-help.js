// Presentation-only metric help controls. This never changes report data or calculations.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root.MetricDefinitionRegistry || require('./metric-definitions.js'));
  else root.MetricHelpProvider = factory(root.MetricDefinitionRegistry);
})(typeof window !== 'undefined' ? window : globalThis, function (registry) {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function metricHelpId(metricId) {
    const normalized = registry?.normalizeMetricId?.(metricId) || String(metricId || 'metric').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `metric-help-${normalized}`;
  }

  function renderMetricHelpContent(definition) {
    if (!definition) return '';
    return `
      <strong>${escapeHtml(definition.displayName)}</strong>
      <span><b>Definition:</b> ${escapeHtml(definition.shortDefinition)}</span>
      <span><b>Calculation:</b> ${escapeHtml(definition.calculation)}</span>
      <span><b>Interpretation:</b> ${escapeHtml(definition.interpretation)}</span>
      <span><b>Planning Guidance:</b> ${escapeHtml(definition.planningGuidance)}</span>`;
  }

  function close(popover) {
    if (!popover) return;
    popover.hidden = true;
    const trigger = popover.previousElementSibling;
    trigger?.setAttribute?.('aria-expanded', 'false');
  }

  function closeAll(rootNode = document) {
    rootNode.querySelectorAll?.('.metric-help-popover').forEach(close);
  }

  function attach(card, metricId, options = {}) {
    if (!card || !registry?.get) return null;
    const definition = registry.get(metricId);
    if (!definition) return null;
    const doc = card.ownerDocument || document;
    const trigger = doc.createElement('button');
    const popover = doc.createElement('div');
    const popoverId = options.id || metricHelpId(definition.id);
    trigger.type = 'button';
    trigger.className = 'metric-help-trigger';
    trigger.textContent = 'i';
    trigger.setAttribute('aria-label', `Explain ${definition.displayName}`);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', popoverId);
    popover.id = popoverId;
    popover.className = 'metric-help-popover';
    popover.setAttribute('role', 'tooltip');
    popover.hidden = true;
    popover.innerHTML = renderMetricHelpContent(definition);
    const open = event => {
      event?.stopPropagation?.();
      closeAll(doc);
      popover.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };
    const toggle = event => {
      event?.stopPropagation?.();
      if (popover.hidden) open(event);
      else close(popover);
    };
    trigger.addEventListener('mouseenter', open);
    trigger.addEventListener('focus', open);
    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close(popover);
        trigger.focus?.();
      }
    });
    popover.addEventListener('mouseenter', open);
    popover.addEventListener('mouseleave', () => close(popover));
    card.addEventListener?.('mouseleave', () => close(popover));
    card.classList?.add('metric-help-card');
    card.append(trigger, popover);
    return { trigger, popover, definition };
  }

  return Object.freeze({ attach, close, closeAll });
});
