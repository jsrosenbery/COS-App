(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.COSTheme = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'cos-app-theme';

  function normalizeTheme(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, options) {
    const next = normalizeTheme(theme);
    const settings = options || {};
    const doc = settings.document || (typeof document !== 'undefined' ? document : null);
    const storage = settings.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (doc && doc.documentElement) doc.documentElement.dataset.theme = next;
    if (storage && settings.persist !== false) {
      try { storage.setItem(STORAGE_KEY, next); } catch (error) { /* Storage may be unavailable. */ }
    }
    return next;
  }

  function syncToggle(theme, doc) {
    if (!doc) return;
    const button = doc.getElementById('theme-toggle');
    if (!button) return;
    const isDark = theme === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    const label = button.querySelector('.theme-toggle-label');
    if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
  }

  function initialize(options) {
    const settings = options || {};
    const doc = settings.document || (typeof document !== 'undefined' ? document : null);
    if (!doc) return 'light';
    let theme = normalizeTheme(doc.documentElement.dataset.theme);
    syncToggle(theme, doc);
    const button = doc.getElementById('theme-toggle');
    if (button) {
      button.addEventListener('click', function () {
        theme = applyTheme(theme === 'dark' ? 'light' : 'dark', settings);
        syncToggle(theme, doc);
      });
    }
    return theme;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initialize(); });
    else initialize();
  }

  return { STORAGE_KEY, normalizeTheme, applyTheme, syncToggle, initialize };
}));
