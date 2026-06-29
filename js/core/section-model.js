(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const api = factory(csv);
  root.COSSectionModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv) {
  'use strict';

  if (!csv) throw new Error('COSCsvNormalizer is required before COSSectionModel.');

  const dayOrder = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayLabels = { MO: 'M', TU: 'T', WE: 'W', TH: 'R', FR: 'F', SA: 'S', SU: 'U' };
  const modalityGroups = {
    online: new Set(['ONL', '71', '72', 'O1', 'OL', 'ONN', 'ONS', 'OO', 'OS', 'OSS', 'OT', 'OTS', 'ON', 'OSL']),
    inPerson: new Set(['IP', '02', '22', '022', '02H', '02O', '02S', '02T', '02N', '04', '06', '07', '08', '09', '12', 'XX', 'YY']),
    hybrid: new Set(['HYB', 'OH', 'OHF', 'FLX', 'OHS']),
    omitted: new Set(['CPL', 'DE', 'CBE', '98', '20'])
  };
  const tutoringOpenLabCourses = new Set(['MATH 400', 'ENGL 400', 'LA 425']);

  function normalizeDayArray(days) {
    const aliases = {
      MONDAY: 'MO',
      TUESDAY: 'TU',
      WEDNESDAY: 'WE',
      THURSDAY: 'TH',
      FRIDAY: 'FR',
      SATURDAY: 'SA',
      SUNDAY: 'SU',
      M: 'MO',
      T: 'TU',
      W: 'WE',
      R: 'TH',
      F: 'FR',
      S: 'SA',
      U: 'SU',
      MO: 'MO',
      TU: 'TU',
      WE: 'WE',
      TH: 'TH',
      FR: 'FR',
      SA: 'SA',
      SU: 'SU'
    };
    const normalized = (days || []).map(day => aliases[csv.canon(day)]).filter(Boolean);
    return dayOrder.filter(day => normalized.includes(day));
  }

  function normalizeDays(raw, row = {}) {
    if (Array.isArray(row.Days) && row.Days.length) return normalizeDayArray(row.Days);
    if (Array.isArray(row.days) && row.days.length) return normalizeDayArray(row.days);
    const dayFlags = [
      ['MONDAY', 'MO'],
      ['TUESDAY', 'TU'],
      ['WEDNESDAY', 'WE'],
      ['THURSDAY', 'TH'],
      ['FRIDAY', 'FR'],
      ['SATURDAY', 'SA'],
      ['SUNDAY', 'SU']
    ].filter(([column]) => String(row[column] || '').trim()).map(([, code]) => code);
    if (dayFlags.length) return dayFlags;
    const text = csv.canon(raw);
    if (!text || /ONLINE|TBA/.test(text)) return [];
    const longDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const found = longDays.filter(day => text.includes(day)).map(day => day.slice(0, 2));
    if (found.length) return normalizeDayArray(found);
    const map = { M: 'MO', T: 'TU', W: 'WE', R: 'TH', F: 'FR', S: 'SA', U: 'SU' };
    return normalizeDayArray(text.replace(/TH/g, 'R').replace(/[^MTWRFSU]/g, '').split('').map(day => map[day]));
  }

  function dayPattern(days) {
    const normalized = normalizeDayArray(days || []);
    return normalized.length ? normalized.map(day => dayLabels[day]).join('') : 'TBA';
  }

  function normalizeTime(raw) {
    const text = String(raw || '').trim();
    if (!text || /TBA|ONLINE/i.test(text)) return '';
    const match = text.match(/(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridian = (match[3] || '').toUpperCase();
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function normalizeTimes(row) {
    const combined = csv.extractField(row, csv.fields.time);
    let start = csv.extractField(row, csv.fields.start);
    let end = csv.extractField(row, csv.fields.end);
    if ((!start || !end) && combined) {
      const parts = combined.split(/\s*-\s*|\s+to\s+/i).map(part => part.trim());
      if (parts.length === 2) {
        start = start || parts[0];
        end = end || parts[1];
      }
    }
    return { start: normalizeTime(start), end: normalizeTime(end) };
  }

  function normalizeModality(method, row = {}) {
    const raw = csv.canon(method || csv.extractField(row, csv.fields.instructionalMethod));
    const code = csv.canon(csv.extractField(row, ['INSTRUCTIONAL_METHOD_CODE', 'Instructional Method Code', 'Method Code']) || raw);
    if (code === 'DE' || /DUAL\s*ENROLL/.test(raw)) return 'DUAL ENROLLMENT';
    if (modalityGroups.omitted.has(code)) return 'OMIT';
    if (modalityGroups.online.has(code)) return 'ONLINE';
    if (modalityGroups.inPerson.has(code)) return 'IN PERSON';
    if (modalityGroups.hybrid.has(code)) return 'HYBRID';
    if (/ONLINE|WEB|ASYNC|REMOTE|VIRTUAL/.test(raw)) return 'ONLINE';
    if (/HYBRID|PARTIAL/.test(raw)) return 'HYBRID';
    if (/TBA/.test(raw)) return 'TBA';
    return raw || 'IN PERSON';
  }

  function isOnlinePlaceholderTime(row) {
    const modality = csv.canon(row?.modality || row?.Modality || '');
    const start = csv.canon(row?.start || row?.Start_Time || '');
    const end = csv.canon(row?.end || row?.End_Time || '');
    const block = csv.canon(row?.timeBlock || row?.TimeBlock || row?.['Time Block'] || '');
    const isOnline = modality === 'ONLINE' || /\b(ONLINE|ONL|OL|ONN|ONS|O1|WEB|REMOTE|VIRTUAL|TBA)\b/.test(modality);
    if (!isOnline) return false;
    if (!start || !end) return true;
    if (/^0?0:00(?:\s*-\s*0?0:(?:00|59))?$/.test(block)) return true;
    if (start >= '00:00' && start <= '00:59') return true;
    return start === '00:00' && (end === '00:00' || end === '00:59');
  }

  function timeBlock(start, modality) {
    if (!start || modality === 'ONLINE' || modality === 'TBA') return 'ONLINE/TBA';
    const hour = Number(start.slice(0, 2));
    if (!Number.isFinite(hour)) return 'ONLINE/TBA';
    return `${String(hour).padStart(2, '0')}:00-${String(hour).padStart(2, '0')}:59`;
  }

  function sectionIdentity(section, index = 0) {
    if (section?.crn) return `${section.term || 'UNKNOWN'}|CRN:${section.crn}`;
    return [section?.term, section?.subject, section?.course, section?.section, section?.modality, section?.campus, index].filter(Boolean).join('|');
  }

  function dedupeSectionsByCrn(rows) {
    const map = new Map();
    (rows || []).forEach((row, index) => {
      const section = row?.canonical ? row : normalizeSection(row);
      const key = sectionIdentity(section, index);
      if (!map.has(key)) map.set(key, section);
    });
    return [...map.values()];
  }

  function enrollmentForSection(section) {
    const row = section?.canonical ? section : normalizeSection(section);
    return row.census == null ? row.actual || 0 : row.census;
  }

  function sumEnrollmentByCrn(rows) {
    return dedupeSectionsByCrn(rows).reduce((total, row) => total + enrollmentForSection(row), 0);
  }

  function normalizeSection(row, options = {}) {
    if (row?.canonical) return row;
    const base = csv.normalizeCsvRow(row, options);
    const times = normalizeTimes(row);
    const modality = options.modality || normalizeModality(base.instructionalMethod, row);
    const days = normalizeDays(csv.extractField(row, csv.fields.days), row);
    const timeBlockValue = isOnlinePlaceholderTime({ modality, start: times.start, end: times.end, timeBlock: csv.extractField(row, ['Time Block', 'Time_Block', 'TIME_BLOCK']) })
      ? 'ONLINE/TBA'
      : timeBlock(times.start, modality);
    return {
      ...base,
      canonical: true,
      modality,
      days,
      dayPattern: dayPattern(days),
      start: times.start,
      end: times.end,
      timeBlock: timeBlockValue,
      room: csv.canon([base.building, base.roomOnly].filter(Boolean).join(' ')),
      isOnline: modality === 'ONLINE',
      isPhysical: Boolean(days.length && times.start && times.end && modality !== 'ONLINE' && modality !== 'TBA'),
      isTutoringOpenLab: tutoringOpenLabCourses.has(base.courseCode)
    };
  }

  function normalizeSections(rows, options = {}) {
    return (rows || []).map(row => normalizeSection(row, options));
  }

  return {
    modalityGroups,
    tutoringOpenLabCourses,
    normalizeDayArray,
    normalizeDays,
    dayPattern,
    normalizeTime,
    normalizeTimes,
    normalizeModality,
    isOnlinePlaceholderTime,
    timeBlock,
    normalizeSection,
    normalizeSections,
    sectionIdentity,
    dedupeSectionsByCrn,
    enrollmentForSection,
    sumEnrollmentByCrn
  };
});
