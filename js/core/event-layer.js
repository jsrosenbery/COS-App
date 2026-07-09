(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const sectionModel = root.COSSectionModel || (typeof require === 'function' ? require('./section-model') : null);
  const api = factory(csv, sectionModel);
  root.COSRoomEvents = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv, sectionModel) {
  'use strict';

  if (!csv) throw new Error('COSCsvNormalizer is required before COSRoomEvents.');

  const dayNames = {
    SU: 'Sunday',
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday'
  };
  const eventFields = {
    term: ['Term', 'TERM', 'term', 'Academic Term', 'Event Term'],
    campus: ['Campus', 'CAMPUS', 'Campus Code'],
    building: ['Building', 'BUILDING', 'Bldg', 'Bldg Code', 'Facility Building'],
    room: ['Room', 'ROOM', 'Room Number', 'Facility Room'],
    roomKey: ['Room Key', 'RoomKey', 'Building-Room', 'Bldg-Room', 'Location', 'Facility'],
    eventId: ['Event ID', 'Event ID #', 'EventID', 'ID', 'Reservation ID', 'ReservationID'],
    name: ['Event Description', 'Event Name', 'Description', 'Name', 'Title', 'EVENT_DESCRIPTION', 'EVENT_NAME'],
    days: ['Days', 'DAYS', 'Day(s)', 'Day', 'Meeting Days', 'Event Days'],
    begin: ['Begin Time', 'Start Time', 'STARTTIME', 'START_TIME', 'Start', 'Begin', 'Begins'],
    end: ['End Time', 'Stop Time', 'ENDTIME', 'END_TIME', 'End', 'Stop'],
    startDate: ['Effective Start Date', 'Start Date', 'Begin Date', 'Event Start Date', 'Starts'],
    endDate: ['Effective End Date', 'End Date', 'Stop Date', 'Event End Date', 'Ends'],
    type: ['Event Type', 'Type', 'Category'],
    notes: ['Notes', 'Note', 'Comments', 'Comment']
  };

  function normalizeDayNames(raw, row = {}) {
    const days = sectionModel?.normalizeDays
      ? sectionModel.normalizeDays(raw, row)
      : String(raw || '').toUpperCase().replace(/TH/g, 'R').replace(/[^MTWRFSU]/g, '').split('').map(day => ({ M: 'MO', T: 'TU', W: 'WE', R: 'TH', F: 'FR', S: 'SA', U: 'SU' }[day])).filter(Boolean);
    return days.map(code => dayNames[code]).filter(Boolean);
  }

  function normalizeTime(raw) {
    if (sectionModel?.normalizeTime) return sectionModel.normalizeTime(raw);
    const text = String(raw || '').trim();
    const match = text.match(/(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridian = (match[3] || '').toUpperCase();
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function timeMinutes(value) {
    const normalized = normalizeTime(value);
    const match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function roomKeyFromParts(building, room, explicitRoomKey) {
    const explicit = String(explicitRoomKey || '').trim();
    if (explicit && explicit.includes('-')) return explicit.toUpperCase().replace(/\s+/g, '');
    const b = String(building || '').trim().toUpperCase();
    const r = String(room || '').trim().toUpperCase();
    if (b && r) return `${b}-${r}`;
    if (explicit) return explicit.toUpperCase().replace(/\s+/g, '');
    return '';
  }

  function parseDate(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slash) {
      let year = Number(slash[3]);
      if (year < 100) year += 2000;
      return `${year}-${String(slash[1]).padStart(2, '0')}-${String(slash[2]).padStart(2, '0')}`;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  function dateRangesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return true;
    return startA <= endB && endA >= startB;
  }

  function normalizeEventRow(row, options = {}) {
    const building = csv.canon(csv.extractField(row, eventFields.building));
    const room = csv.canon(csv.extractField(row, eventFields.room));
    const roomKey = roomKeyFromParts(building, room, csv.extractField(row, eventFields.roomKey));
    const start = normalizeTime(csv.extractField(row, eventFields.begin));
    const end = normalizeTime(csv.extractField(row, eventFields.end));
    const startMinutes = timeMinutes(start);
    const endMinutes = timeMinutes(end);
    const days = normalizeDayNames(csv.extractField(row, eventFields.days), row);
    const term = csv.normalizeTermLabel(csv.extractField(row, eventFields.term) || options.term || row?.__sourceTerm || '');
    const eventId = csv.canon(csv.extractField(row, eventFields.eventId)) || `${roomKey}|${days.join(',')}|${start}|${end}|${csv.extractField(row, eventFields.name)}`;
    return {
      term,
      campus: csv.normalizeCampus(csv.extractField(row, eventFields.campus)),
      building,
      room,
      roomKey,
      eventId,
      name: csv.extractField(row, eventFields.name),
      days,
      start,
      end,
      startMinutes,
      endMinutes,
      startDate: parseDate(csv.extractField(row, eventFields.startDate)),
      endDate: parseDate(csv.extractField(row, eventFields.endDate)),
      type: csv.extractField(row, eventFields.type),
      notes: csv.extractField(row, eventFields.notes),
      source: options.source || '',
      importedAt: options.importedAt || new Date().toISOString(),
      raw: row,
      valid: Boolean(roomKey && days.length && start && end && endMinutes != null && startMinutes != null && endMinutes > startMinutes)
    };
  }

  function normalizeEvents(rows, options = {}) {
    return (rows || []).map(row => normalizeEventRow(row, options));
  }

  function storagePayloadByTerm(existing = {}, term, events, mode = 'replace') {
    const normalizedTerm = csv.normalizeTermLabel(term || '');
    const next = { ...(existing || {}) };
    const incoming = (events || []).filter(event => csv.normalizeTermLabel(event.term || normalizedTerm) === normalizedTerm);
    next[normalizedTerm] = mode === 'append' ? [...(next[normalizedTerm] || []), ...incoming] : incoming;
    return next;
  }

  function eventsForTerm(store, term) {
    const normalizedTerm = csv.normalizeTermLabel(term || '');
    return (store?.[normalizedTerm] || []).map(row => normalizeEventRow(row, { term: normalizedTerm, importedAt: row.importedAt || new Date().toISOString() }));
  }

  function eventsForRoom(events, roomKey) {
    const key = String(roomKey || '').toUpperCase();
    return (events || []).filter(event => event.roomKey === key);
  }

  function eventOverlapsRequest(event, days, startMinutes, endMinutes, requestedStart = null, requestedEnd = null) {
    if (!event?.valid) return false;
    if (!event.days.some(day => days.includes(day))) return false;
    if (event.endMinutes <= startMinutes || event.startMinutes >= endMinutes) return false;
    return dateRangesOverlap(event.startDate, event.endDate, requestedStart, requestedEnd);
  }

  function overlappingEvents(events, { roomKey, days, startMinutes, endMinutes, requestedStart = null, requestedEnd = null } = {}) {
    return (events || []).filter(event => {
      if (roomKey && event.roomKey !== String(roomKey).toUpperCase()) return false;
      return eventOverlapsRequest(event, days || [], startMinutes, endMinutes, requestedStart, requestedEnd);
    });
  }

  function summarizeValidation(events) {
    const list = events || [];
    const valid = list.filter(event => event.valid);
    const invalid = list.filter(event => !event.valid);
    const missingRoom = list.filter(event => !event.roomKey).length;
    const missingDays = list.filter(event => !event.days.length).length;
    const missingTime = list.filter(event => !event.start || !event.end || event.endMinutes == null || event.startMinutes == null || event.endMinutes <= event.startMinutes).length;
    const terms = [...new Set(valid.map(event => event.term).filter(Boolean))].sort();
    const roomKeys = [...new Set(valid.map(event => event.roomKey).filter(Boolean))].sort();
    return {
      totalRows: list.length,
      validRows: valid.length,
      invalidRows: invalid.length,
      missingRoom,
      missingDays,
      missingTime,
      terms,
      roomKeys
    };
  }

  function exportRows(events) {
    return (events || []).map(event => ({
      Term: event.term,
      Campus: event.campus,
      Building: event.building,
      Room: event.room,
      'Room Key': event.roomKey,
      'Event ID': event.eventId,
      'Event Name': event.name,
      Days: event.days.join(', '),
      'Begin Time': event.start,
      'End Time': event.end,
      'Effective Start Date': event.startDate,
      'Effective End Date': event.endDate,
      'Event Type': event.type,
      Notes: event.notes,
      Valid: event.valid ? 'TRUE' : 'FALSE',
      Source: event.source,
      ImportedAt: event.importedAt
    }));
  }

  function usageRows(events) {
    const byRoom = new Map();
    (events || []).filter(event => event.valid).forEach(event => {
      const key = event.roomKey;
      if (!byRoom.has(key)) byRoom.set(key, { term: event.term, campus: event.campus, building: event.building, room: event.room, roomKey: key, events: 0, minutes: 0 });
      const row = byRoom.get(key);
      row.events += 1;
      row.minutes += (event.endMinutes - event.startMinutes) * Math.max(1, event.days.length);
    });
    return [...byRoom.values()].map(row => ({
      Term: row.term,
      Campus: row.campus,
      Building: row.building,
      Room: row.room,
      'Room Key': row.roomKey,
      Events: row.events,
      'Event Hours': Math.round((row.minutes / 60) * 10) / 10
    }));
  }

  return {
    eventFields,
    normalizeDayNames,
    normalizeTime,
    timeMinutes,
    roomKeyFromParts,
    parseDate,
    dateRangesOverlap,
    normalizeEventRow,
    normalizeEvents,
    storagePayloadByTerm,
    eventsForTerm,
    eventsForRoom,
    overlappingEvents,
    eventOverlapsRequest,
    summarizeValidation,
    exportRows,
    usageRows
  };
});
