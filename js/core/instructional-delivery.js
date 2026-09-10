(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSInstructionalDelivery = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const clean = value => String(value ?? '').trim().toUpperCase();
  const key = parts => JSON.stringify(parts);
  const rounded = value => Math.round(value * 100) / 100;
  const usableGroup = value => Boolean(value && !['Y', 'YES', 'TRUE', '1', 'N', 'NO', 'FALSE', '0', 'NONE', 'NULL', 'N/A'].includes(value));
  const usableEvidence = value => Boolean(value && !['TBA', 'UNKNOWN', 'NONE', 'NULL', 'N/A', 'NA'].includes(value));
  function minutes(value) {
    const match = clean(value).match(/^(\d{1,2}):(\d{2})(?::00)?\s*(AM|PM)?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || hour > 23 || (match[3] && (hour < 1 || hour > 12))) return null;
    if (match[3]) hour = hour % 12 + (match[3] === 'PM' ? 12 : 0);
    return hour * 60 + minute;
  }
  function date(value) {
    const text = String(value || '').trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!iso && !us) return '';
    const [year, month, day] = iso ? iso.slice(1).map(Number) : [Number(us[3]), Number(us[1]), Number(us[2])];
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d.toISOString().slice(0, 10) : '';
  }
  function componentType(value) {
    const code = clean(value);
    return ({ '2': 'Lecture', LEC: 'Lecture', LECTURE: 'Lecture', '4': 'Lab', LAB: 'Lab', XX: 'Activity', ACTIVITY: 'Activity' })[code] || code;
  }
  function analyze(rows = []) {
    const sections = new Map();
    const components = new Map();
    let missingIdentityRows = 0;
    for (const row of rows) {
      const term = clean(row.term), crn = clean(row.crn);
      if (!term || !crn) { missingIdentityRows++; continue; }
      const sectionId = key([term, crn]);
      if (!sections.has(sectionId)) sections.set(sectionId, { term, crn, course: clean(`${row.subject || ''} ${row.course || ''}`), hours: 0, shared: 0, unknown: false });
      const section = sections.get(sectionId);
      if (usableGroup(clean(row.crossList))) section.hasGroupId = true;
      const days = [...new Set((Array.isArray(row.days) ? row.days : []).map(clean))].sort();
      const start = minutes(row.start), end = minutes(row.end);
      if (/ONLINE\/TBA|WORK EXPERIENCE/.test(clean(row.timeBlock)) || !days.length || days.some(day => !['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(day)) || start === null || end === null || end <= start) {
        section.unknown = true;
        continue;
      }
      const type = componentType(row.scheduleType);
      const startDate = date(row.startDate), endDate = date(row.endDate);
      const location = key([clean(row.campus), clean(row.room)]);
      const instructor = clean(row.instructor);
      const crossList = clean(row.crossList);
      const pattern = [term, days, start, end, startDate, endDate, location, type];
      const id = key([sectionId, pattern]);
      if (components.has(id)) {
        const existing = components.get(id);
        if (existing.crossList !== crossList || existing.instructor !== instructor) existing.ambiguous = true;
        continue;
      }
      const hours = (end - start) * days.length / 60;
      section.hours += hours;
      components.set(id, { id, sectionId, term, crn, course: section.course, pattern, type, days: days.join('/'), start: row.start, end: row.end, startDate, endDate, location, room: clean(row.room), instructor, crossList, hours,
        complete: Boolean(usableEvidence(clean(type)) && startDate && endDate && endDate >= startDate && usableEvidence(clean(row.room)) && usableEvidence(instructor)), ambiguous: false });
    }
    const buckets = new Map();
    for (const component of components.values()) {
      const groupKey = key([component.pattern, component.instructor]);
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey).push(component);
    }
    const confirmed = [];
    const possible = [];
    for (const bucket of buckets.values()) {
      const explicit = new Map();
      for (const c of bucket) {
        if (!usableGroup(c.crossList) || !c.complete || c.ambiguous) continue;
        if (!explicit.has(c.crossList)) explicit.set(c.crossList, []);
        explicit.get(c.crossList).push(c);
      }
      const used = new Set();
      for (const group of explicit.values()) {
        if (new Set(group.map(c => c.sectionId)).size < 2) continue;
        confirmed.push(group);
        group.forEach(c => { used.add(c.id); sections.get(c.sectionId).shared += c.hours; });
      }
      if (new Set(bucket.map(c => c.sectionId)).size > 1 && bucket.some(c => !used.has(c.id))) possible.push(bucket);
    }
    const parent = new Map();
    function find(id) { if (!parent.has(id)) parent.set(id, id); if (parent.get(id) !== id) parent.set(id, find(parent.get(id))); return parent.get(id); }
    confirmed.forEach(group => group.forEach(c => parent.set(find(c.sectionId), find(group[0].sectionId))));
    const stacked = new Set(confirmed.flatMap(group => group.map(c => c.sectionId)));
    const sharedIds = new Set(confirmed.flatMap(group => group.map(c => c.id)));
    const possibleIds = new Set(possible.flatMap(group => group.map(c => c.id)));
    const sharedPartners = new Map();
    confirmed.forEach(group => group.forEach(c => sharedPartners.set(c.id, group.filter(other => other.id !== c.id).map(other => other.crn).join(', '))));
    const sectionHours = [...sections.values()].reduce((sum, s) => sum + s.hours, 0);
    const consolidated = confirmed.reduce((sum, group) => sum + group[0].hours * (group.length - 1), 0);
    const detail = [...components.values()].map(c => ({ term: c.term, crn: c.crn, course: c.course, component: c.type || 'Unknown', days: c.days, start: c.start, end: c.end, startDate: c.startDate || 'Unknown', endDate: c.endDate || 'Unknown', room: c.room, crossList: c.crossList,
      sharedWith: sharedPartners.get(c.id) || '',
      status: sharedIds.has(c.id) ? 'Confirmed shared' : possibleIds.has(c.id) ? 'Possible sharing — review' : c.crossList ? 'Cross-list present — component not confirmed shared' : 'Not confirmed shared', weeklyHours: rounded(c.hours) }));
    const sectionDetails = [...sections.values()].map(s => ({ term: s.term, crn: s.crn, course: s.course, weeklyHours: rounded(s.hours), sharedWeeklyHours: rounded(s.shared), sharedPercent: s.hours && !s.unknown ? `${rounded(s.shared / s.hours * 100)}%` : 'Incomplete meeting data', coverage: s.unknown ? 'Some hours unavailable' : 'Fixed meetings available' }));
    return { summary: { registrationSections: sections.size, sectionsWithGroupId: [...sections.values()].filter(s => s.hasGroupId).length, stackedSections: stacked.size, stackGroups: new Set([...stacked].map(find)).size,
      sharedComponents: confirmed.length, separateComponents: components.size - sharedIds.size, deliveredComponents: components.size - sharedIds.size + confirmed.length,
      sectionWeeklyHours: rounded(sectionHours), deliveredWeeklyHours: rounded(sectionHours - consolidated), consolidatedWeeklyHours: rounded(consolidated),
      possibleSharedGroups: possible.length, unverifiedComponents: [...components.values()].filter(c => !c.complete || c.ambiguous).length, incompleteSections: [...sections.values()].filter(s => s.unknown).length, missingIdentityRows }, detail, sectionDetails };
  }
  return { analyze };
});
