(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimeUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseHour(value) {
    if (!value) return null;
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3] ? match[3].toUpperCase() : null;
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return hour + minutes / 60;
  }

  function minutesFromTime(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function parseTimeToMinutes(value) {
    if (!value) return null;
    const parts = String(value).split(':').map(Number);
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  }

  function buildHalfHourSlots(minHour, maxHour) {
    const slots = [];
    for (let hour = minHour; hour < maxHour; hour += 0.5) {
      slots.push(Number(hour.toFixed(1)));
    }
    return slots;
  }

  function formatHourLabel(hour) {
    const totalMinutes = Math.round(hour * 60);
    const hour24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hour24 < 12 ? 'AM' : 'PM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  function formatMinutesAsHourLabel(minutes) {
    return formatHourLabel((Number(minutes) || 0) / 60);
  }

  function overlapMinutes(startMin, endMin, windowStart, windowEnd) {
    return Math.max(0, Math.min(endMin, windowEnd) - Math.max(startMin, windowStart));
  }

  function intervalsOverlap(start, end, slotStart, slotEnd) {
    return end > slotStart && start < slotEnd;
  }

  return Object.freeze({
    parseHour,
    minutesFromTime,
    parseTimeToMinutes,
    buildHalfHourSlots,
    formatHourLabel,
    formatMinutesAsHourLabel,
    overlapMinutes,
    intervalsOverlap
  });
});
