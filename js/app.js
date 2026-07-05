// COS-App js/app.js

// -- CAL-GETC Mapping integration --
// Be sure to include <script src="cal_getc_mapping.js"></script> before this file in your HTML!

let hmRaw = [];
let hmTable;
let hmChoices;
let lineCourseChoices;
let lineChartInstance;
let fullCalendarInstance;
let heatmapCellFilter = null;
let heatmapDataTableFilterRegistered = false;

const hmDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ROOM_CATALOG_BACKUP_KEY = 'cos-room-catalog-backup-v1';
const CAL_GETC_BACKUP_KEY = 'cos-cal-getc-mapping-backup-v1';
const CURRICULUM_CROSSWALK_BACKUP_KEY = 'cos-curriculum-crosswalk-backup-v1';

// --- Official Term Start Dates ---
const termStartDates = {
  'Summer 2026': '2026-06-01',
  'Fall 2026': '2026-08-10',
  'Spring 2027': '2027-01-19',
  'Summer 2027': '2027-06-07',
  'Fall 2027': '2027-08-10',
  'Spring 2028': '2028-01-18',
  'Summer 2028': '2028-06-05',
  'Fall 2028': '2028-08-14',
  'Spring 2029': '2029-01-16',
  'Summer 2029': '2029-06-04',
  'Fall 2029': '2029-08-13',
  'Spring 2030': '2030-01-14',
  'Summer 2030': '2030-06-03',
  'Fall 2030': '2030-08-12'
};

// --- Holiday Dates (all in ISO YYYY-MM-DD format) ---
const holidayRanges = [
  // [start, end] inclusive dates
  ['2025-06-19','2025-06-19'],
  ['2025-07-04','2025-07-04'],
  ['2025-09-01','2025-09-01'],
  ['2025-11-11','2025-11-11'],
  ['2025-11-24','2025-11-28'],
  ['2025-12-24','2025-12-31'],
  ['2026-01-01','2026-01-01'],
  ['2026-01-19','2026-01-19'],
  ['2026-02-13','2026-02-13'],
  ['2026-02-16','2026-02-16'],
  ['2026-03-30','2026-03-31'],
  ['2026-04-01','2026-04-03'],
  ['2026-05-25','2026-05-25'],
  ['2026-06-19','2026-06-19'],
  ['2026-07-03','2026-07-03'],
  ['2026-09-07','2026-09-07'],
  ['2026-11-11','2026-11-11'],
  ['2026-11-23','2026-11-27'],
  ['2026-12-24','2026-12-31'],
  ['2027-01-01','2027-01-01'],
  ['2027-01-18','2027-01-18'],
  ['2027-02-12','2027-02-15'],
  ['2027-03-22','2027-03-26'],
  ['2027-05-31','2027-05-31'],
  ['2027-06-18','2027-06-18'],
  ['2027-07-05','2027-07-05'],
  ['2027-09-06','2027-09-06'],
  ['2027-11-11','2027-11-11'],
  ['2027-11-22','2027-11-26'],
  ['2027-12-23','2027-12-31'],
  ['2028-01-17','2028-01-17'],
  ['2028-02-18','2028-02-21'],
  ['2028-04-10','2028-04-14'],
  ['2028-05-29','2028-05-29'],
];

// Set of all holiday ISO dates for fast lookup
const holidaySet = (() => {
  const out = new Set();
  for (const [start, end] of holidayRanges) {
    let d = new Date(start);
    const endD = new Date(end);
    while (d <= endD) {
      out.add(d.toISOString().slice(0,10));
      d.setDate(d.getDate() + 1);
    }
  }
  return out;
})();

function parseHour(t) {
  if (!t) return null;
  t = t.trim();
  let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1],10);
  const min = parseInt(m[2],10);
  const ampm = m[3] ? m[3].toUpperCase() : null;
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else if (ampm === "PM") {
    if (h !== 12) h += 12;
  }
  return h + min/60;
}

function getTimeRangeFromData(data) {
  let min = 24, max = 0;
  data.forEach(r => {
    const s = parseHour(r.Start_Time);
    const e = parseHour(r.End_Time);
    if (typeof s === "number" && s < min) min = Math.floor(s * 2) / 2;
    if (typeof e === "number" && e > max) max = Math.ceil(e * 2) / 2;
  });
  if (min >= max) { min = 6; max = 22; }
  if (max < 22) max = 22;
  if (min > 6) min = 6;
  return [min, max];
}

function buildHalfHourSlots(minHour, maxHour) {
  const slots = [];
  for (let h = minHour; h < maxHour; h += 0.5) {
    slots.push(Number(h.toFixed(1)));
  }
  return slots;
}

function formatHourLabel(hour) {
  const totalMinutes = Math.round(hour * 60);
  const h24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ap = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${ap}`;
}

function formatHeatmapTimeHeader(hour) {
  const [time, period] = formatHourLabel(hour).split(' ');
  return `<span class="heatmap-time-label"><span>${escapeHTML(time)}</span><span>${escapeHTML(period || '')}</span></span>`;
}

function extractField(r, keys) {
  if (!r || typeof r !== 'object') return '';
  for (const k of keys) {
    if (r[k] && typeof r[k] === 'string' && r[k].trim()) return r[k].trim();
    if (r[k.toLowerCase()] && typeof r[k.toLowerCase()] === 'string' && r[k.toLowerCase()].trim()) return r[k.toLowerCase()].trim();
    if (r[k.toUpperCase()] && typeof r[k.toUpperCase()] === 'string' && r[k.toUpperCase()].trim()) return r[k.toUpperCase()].trim();
    if (r[k.replace(/\s+/g, '_')] && typeof r[k.replace(/\s+/g, '_')] === 'string' && r[k.replace(/\s+/g, '_')].trim()) return r[k.replace(/\s+/g, '_')].trim();
    if (r[k.replace(/\s+/g, '_').toLowerCase()] && typeof r[k.replace(/\s+/g, '_').toLowerCase()] === 'string' && r[k.replace(/\s+/g, '_').toLowerCase()].trim()) return r[k.replace(/\s+/g, '_').toLowerCase()].trim();
    if (r[k.replace(/\s+/g, '_').toUpperCase()] && typeof r[k.replace(/\s+/g, '_').toUpperCase()] === 'string' && r[k.replace(/\s+/g, '_').toUpperCase()].trim()) return r[k.replace(/\s+/g, '_').toUpperCase()].trim();
  }
  const normalizedLookup = Object.entries(r).reduce((acc, [key, value]) => {
    const normalizedKey = normalizeHeaderKey(key);
    if (normalizedKey && acc[normalizedKey] === undefined) acc[normalizedKey] = value;
    return acc;
  }, {});
  for (const k of keys) {
    const value = normalizedLookup[normalizeHeaderKey(k)];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeHeaderKey(key) {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isValidRoom(building, room) {
  if (!room) return false;
  const r = room.toUpperCase();
  if (r === '' || r === 'N/A' || r === 'LIVE') return false;
  if (building && building.toUpperCase() === 'ONLINE') return false;
  return true;
}

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
  select.replaceChildren();
  if (!select.multiple) select.appendChild(new Option(allLabel, allValue));
  options.forEach(option => {
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
  const wantedKeys = new Set([...wanted].map(normalizeFilterKey));
  if (select.multiple) {
    Array.from(select.options).forEach(option => { option.selected = wanted.has(option.value) || wantedKeys.has(normalizeFilterKey(option.value)); });
  } else if (wanted.has(select.value) || wantedKeys.has(normalizeFilterKey(select.value))) {
    return;
  } else {
    const first = Array.from(select.options).find(option => wanted.has(option.value) || wantedKeys.has(normalizeFilterKey(option.value)));
    if (first) select.value = first.value;
  }
}

function valueMatchesAny(value, selected) {
  return !selected?.length || selected.includes(value);
}

function normalizeFilterLabel(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeFilterKey(value) {
  return normalizeFilterLabel(value).toUpperCase();
}

function uniqueFilterOptions(values) {
  const byKey = new Map();
  (values || []).forEach(value => {
    const label = normalizeFilterLabel(value);
    const key = normalizeFilterKey(label);
    if (label && !byKey.has(key)) byKey.set(key, label);
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function filterMatchesAny(value, selected) {
  if (!selected?.length) return true;
  const valueKey = normalizeFilterKey(value);
  return selected.map(normalizeFilterKey).includes(valueKey);
}

function appendLine(parent, text, bold = false) {
  const span = document.createElement('span');
  span.textContent = text ?? '';
  if (bold) span.style.fontWeight = 'bold';
  parent.appendChild(span);
  parent.appendChild(document.createElement('br'));
}

function setTooltipLines(tooltip, lines) {
  tooltip.replaceChildren();
  lines.forEach(({ text, bold = false }) => {
    if (text === undefined || text === null || text === '') return;
    appendLine(tooltip, text, bold);
  });
}

function getUniqueCampuses(data) {
  const campuses = new Set();
  data.forEach(r => {
    const campus = extractField(r, ['Campus', 'campus', 'CAMPUS']);
    if (campus) campuses.add(campus);
  });
  return Array.from(campuses).sort();
}

function getCourseParts(section) {
  const subjectCourse = extractField(section, ['Subject_Course', 'Subject Course', 'Course', 'Course ID', 'Course Number']);
  const discipline = extractField(section, ['Discipline', 'DISCIPLINE', 'Subject', 'SUBJECT', 'Subject Code']) ||
    (subjectCourse.match(/^([A-Za-z]+)/)?.[1] || '');
  const courseNumber = extractField(section, ['Course_Number', 'Course Number', 'COURSE', 'Course_No', 'Course No']) ||
    (subjectCourse.match(/[A-Za-z]+\s*([0-9]{1,4}[A-Za-z]?)/)?.[1] || '');
  return {
    subjectCourse,
    discipline: discipline.toUpperCase(),
    courseNumber: normalizeCourseNumber(courseNumber)
  };
}

function normalizeCourseNumber(courseNumber) {
  const value = String(courseNumber || '').trim().toUpperCase();
  const match = value.match(/^(\d{1,2})([A-Z]?)$/);
  return match ? `${match[1].padStart(3, '0')}${match[2]}` : value;
}

function getCourseKey(section) {
  const { subjectCourse, discipline, courseNumber } = getCourseParts(section);
  if (discipline && courseNumber) return `${discipline} ${courseNumber}`.trim();
  return String(subjectCourse || '').trim();
}

const TUTORING_OPEN_LAB_CONFIG = {
  label: 'Tutoring / Open Lab Sections',
  defaultExcludedCourses: ['MATH 400', 'ENGL 400', 'LA 425']
};
const tutoringOpenLabCourseSet = new Set(TUTORING_OPEN_LAB_CONFIG.defaultExcludedCourses.map(value => String(value).trim().toUpperCase()));

function isTutoringOpenLabSection(section) {
  return tutoringOpenLabCourseSet.has(getCourseKey(section).toUpperCase());
}

function getCourseLevel(courseNumber) {
  const match = String(courseNumber || '').match(/\d+/);
  if (!match) return 'Unspecified';
  const number = Number(match[0]);
  if (number < 100) return 'Below 100';
  if (number < 200) return '100 Level';
  if (number < 300) return '200 Level';
  if (number < 400) return '300 Level';
  return '400+ Level';
}

const DEFAULT_MODALITY_DEFINITIONS = [
  { code: 'ONL', modality: 'Online', omitted: false },
  { code: '71', modality: 'Online', omitted: false },
  { code: '72', modality: 'Online', omitted: false },
  { code: 'O1', modality: 'Online', omitted: false },
  { code: 'OL', modality: 'Online', omitted: false },
  { code: 'ONN', modality: 'Online', omitted: false },
  { code: 'ONS', modality: 'Online', omitted: false },
  { code: 'OO', modality: 'Online', omitted: false },
  { code: 'OS', modality: 'Online', omitted: false },
  { code: 'OSS', modality: 'Online', omitted: false },
  { code: 'OT', modality: 'Online', omitted: false },
  { code: 'OTS', modality: 'Online', omitted: false },
  { code: 'ON', modality: 'Online', omitted: false },
  { code: 'OSL', modality: 'Online', omitted: false },
  { code: 'IP', modality: 'In-Person', omitted: false },
  { code: '02', modality: 'In-Person', omitted: false },
  { code: '22', modality: 'In-Person', omitted: false },
  { code: '022', modality: 'In-Person', omitted: false },
  { code: '02H', modality: 'In-Person', omitted: false },
  { code: '02O', modality: 'In-Person', omitted: false },
  { code: '02S', modality: 'In-Person', omitted: false },
  { code: '02T', modality: 'In-Person', omitted: false },
  { code: '02N', modality: 'In-Person', omitted: false },
  { code: '04', modality: 'In-Person', omitted: false },
  { code: '06', modality: 'In-Person', omitted: false },
  { code: '07', modality: 'In-Person', omitted: false },
  { code: '08', modality: 'In-Person', omitted: false },
  { code: '09', modality: 'In-Person', omitted: false },
  { code: '12', modality: 'In-Person', omitted: false },
  { code: 'XX', modality: 'In-Person', omitted: false },
  { code: 'YY', modality: 'In-Person', omitted: false },
  { code: 'HYB', modality: 'Hybrid', omitted: false },
  { code: 'OH', modality: 'Hybrid', omitted: false },
  { code: 'OHF', modality: 'Hybrid', omitted: false },
  { code: 'FLX', modality: 'Hybrid', omitted: false },
  { code: 'OHS', modality: 'Hybrid', omitted: false },
  { code: 'CPL', modality: 'Omitted from modality analysis', omitted: true },
  { code: 'DE', modality: 'Omitted from modality analysis', omitted: true },
  { code: 'CBE', modality: 'Omitted from modality analysis', omitted: true },
  { code: '98', modality: 'Omitted from modality analysis', omitted: true },
  { code: '20', modality: 'Omitted from modality analysis', omitted: true }
];
let modalityDefinitions = normalizeModalityDefinitions(DEFAULT_MODALITY_DEFINITIONS);
let modalityDefinitionMap = new Map();
let omittedModalityCodes = new Set();
let calGetcMapping = [];
let calGetcFilterOptions = [];
let curriculumCrosswalk = [];

function normalizeModalityCode(method) {
  return String(method || '').trim().toUpperCase();
}

function normalizeModalityDefinitions(definitions) {
  return (definitions || [])
    .map(item => {
      const code = normalizeModalityCode(item.code || item.Code || item.instructionalMethod || item['Instructional Method']);
      const rawOmitted = item.omitted ?? item.Omitted ?? item.omit ?? item.Omit ?? item.exclude ?? item.Exclude;
      const omitted = rawOmitted === true || String(rawOmitted || '').trim().toLowerCase() === 'true' || String(rawOmitted || '').trim().toLowerCase() === 'yes' || String(rawOmitted || '').trim() === '1';
      const modality = String(item.modality || item.Modality || item.category || item.Category || '').trim();
      return {
        code,
        modality: omitted ? (modality || 'Omitted from modality analysis') : modality,
        omitted
      };
    })
    .filter(item => item.code && (item.omitted || item.modality));
}

function setModalityDefinitions(definitions) {
  modalityDefinitions = normalizeModalityDefinitions(definitions);
  modalityDefinitionMap = new Map();
  omittedModalityCodes = new Set();
  modalityDefinitions.forEach(definition => {
    if (definition.omitted) {
      omittedModalityCodes.add(definition.code);
    } else {
      modalityDefinitionMap.set(definition.code, definition.modality);
    }
  });
}
setModalityDefinitions(modalityDefinitions);

function normalizeCalGetcCode(value) {
  if (window.normalizeCALGETCCode) return window.normalizeCALGETCCode(value);
  return String(value || '')
    .replace(/[\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function splitCalGetcList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(/[;,|]/).map(item => item.trim()).filter(Boolean);
}

function normalizeCalGetcMapping(mapping) {
  return (mapping || [])
    .map(item => ({
      code: normalizeCalGetcCode(item.code || item.Code || item.course || item.Course || item['Course Code']),
      areas: splitCalGetcList(item.areas || item.Areas || item.area || item.Area || item['CAL-GETC Area']),
      divisions: splitCalGetcList(item.divisions || item.Divisions || item.division || item.Division || item['CAL-GETC Division'])
    }))
    .filter(item => item.code && (item.areas.length || item.divisions.length));
}

function setCalGetcMapping(mapping) {
  calGetcMapping = normalizeCalGetcMapping(mapping);
  window.CAL_GETC_MAPPING = calGetcMapping;
  calGetcFilterOptions = buildCalGetcFilterOptions();
}

setCalGetcMapping(window.CAL_GETC_MAPPING || []);

function normalizeCurriculumCourseCode(value) {
  return String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeCurriculumCrosswalk(crosswalk) {
  return (crosswalk || [])
    .map(item => {
      const sourceCourse = normalizeCurriculumCourseCode(item.sourceCourse || item.SourceCourse || item['Source Course'] || item.oldCourse || item['Old Course'] || item.cosCourse || item['COS Course']);
      const synonymCourse = normalizeCurriculumCourseCode(item.synonymCourse || item.SynonymCourse || item['Synonym Course'] || item.newCourse || item['New Course'] || item.commonCourse || item['Common Course']);
      if (!sourceCourse || !synonymCourse) return null;
      return {
        sourceCourse,
        synonymCourse,
        sourceTitle: String(item.sourceTitle || item.SourceTitle || item['Source Title'] || item.cosTitle || item['COS Title'] || '').trim(),
        synonymTitle: String(item.synonymTitle || item.SynonymTitle || item['Synonym Title'] || item.commonTitle || item['Common Title'] || '').trim(),
        changeType: String(item.changeType || item.ChangeType || item['Change Type'] || item.type || item.Type || 'Curriculum Crosswalk').trim(),
        phase: String(item.phase || item.Phase || '').trim(),
        cid: String(item.cid || item.CID || item['C-ID'] || '').trim(),
        template: String(item.template || item.Template || '').trim(),
        effectiveTerm: String(item.effectiveTerm || item.EffectiveTerm || item['Effective Term'] || '').trim(),
        notes: String(item.notes || item.Notes || '').trim()
      };
    })
    .filter(Boolean);
}

function setCurriculumCrosswalk(crosswalk) {
  curriculumCrosswalk = normalizeCurriculumCrosswalk(crosswalk);
  window.CURRICULUM_CROSSWALK = curriculumCrosswalk;
}

setCurriculumCrosswalk(window.CURRICULUM_CROSSWALK || []);

function normalizeRoomCatalog(rawRooms, knownDivisions = []) {
  return (rawRooms || [])
    .map(room => {
      const rawPriorityDivision1 = roomPriorityRawValue(room, [
        'rawPriorityDivision1',
        'priorityDivision1',
        'Priority Division 1',
        'Priority Division',
        'Room Priority',
        'Primary Division',
        'Assigned Division',
        'Preferred Division',
        'Dean Area',
        'Priority Area',
        'priority',
        'roomPriority'
      ]);
      const rawPriorityDivision2 = roomPriorityRawValue(room, [
        'rawPriorityDivision2',
        'priorityDivision2',
        'Priority Division 2',
        'Secondary Division',
        'Secondary Priority',
        'Priority 2',
        'Room Priority 2'
      ]);
      const rawRoomFeatures = roomPriorityRawValue(room, [
        'rawRoomFeatures',
        'roomFeaturesText',
        'roomFeatures',
        'Room Features',
        'Features',
        'Preferred Room Features',
        'Technology Features',
        'Instructional Features',
        'Equipment',
        'Notes'
      ]);
      const priorityDivision1 = normalizeRoomPriorityDivision(rawPriorityDivision1, 'Unassigned', knownDivisions);
      const priorityDivision2 = normalizeRoomPriorityDivision(rawPriorityDivision2, 'None', knownDivisions);
      const roomFeatures = normalizeRoomFeatures(rawRoomFeatures);
      return {
        campus: String(room.campus || room.Campus || '').trim(),
        building: String(room.building || room.Building || '').trim(),
        room: String(room.room || room.Room || '').trim(),
        buildingRoom: String(room.buildingRoom || room['Building-Room'] || room.BuildingRoom || `${room.building || room.Building || ''}-${room.room || room.Room || ''}`).trim(),
        type: String(room.type || room.Type || room.roomType || room['Room Type'] || '').trim(),
        capacity: Number.isFinite(Number(room.capacity ?? room.Capacity ?? room.cap)) ? Number(room.capacity ?? room.Capacity ?? room.cap) : null,
        rawPriorityDivision1: String(rawPriorityDivision1 || '').trim(),
        rawPriorityDivision2: String(rawPriorityDivision2 || '').trim(),
        priorityDivision1,
        priorityDivision2,
        priority: priorityDivision1,
        rawRoomFeatures: String(rawRoomFeatures || '').trim(),
        roomFeatures,
        roomFeaturesText: roomFeatures.join('; ')
      };
    })
    .filter(room => room.building && room.room && room.buildingRoom);
}

function roomPriorityRawValue(room, names) {
  for (const name of names) {
    const value = room?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function normalizeRoomPriorityDivision(value, blankValue = 'Unassigned', knownDivisions = []) {
  const text = normalizeFilterLabel(value);
  if (!text) return blankValue;
  if (normalizeFilterKey(text) === 'ADMINISTRATION') return 'Administration';
  const match = (knownDivisions || []).find(division => normalizeFilterKey(division) === normalizeFilterKey(text));
  return match || text;
}

function normalizeRoomFeatures(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value || '');
  return text
    .split(/[;,]/)
    .map(item => normalizeFilterLabel(item))
    .filter(Boolean);
}

function currentRoomPriorityDivisions() {
  return [];
}

function roomPriorityWarnings(rooms, knownDivisions = []) {
  const knownKeys = new Set((knownDivisions || []).map(normalizeFilterKey));
  if (!knownKeys.size) return [];
  const warnings = [];
  normalizeRoomCatalog(rooms, knownDivisions).forEach(room => {
    [
      ['Priority Division 1', room.priorityDivision1],
      ['Priority Division 2', room.priorityDivision2]
    ].forEach(([field, value]) => {
      const key = normalizeFilterKey(value);
      if (!key || key === 'UNASSIGNED' || key === 'NONE' || key === 'ADMINISTRATION') return;
      if (!knownKeys.has(key)) warnings.push({ buildingRoom: room.buildingRoom, field, value, warning: 'Unknown Priority Division' });
    });
  });
  return warnings;
}

function roomPriorityScore(room, division) {
  const divisionKey = normalizeFilterKey(division);
  if (!divisionKey) return 0;
  const first = normalizeFilterKey(room?.priorityDivision1 || room?.priority);
  const second = normalizeFilterKey(room?.priorityDivision2);
  if (first === divisionKey) return 2;
  if (second === divisionKey) return 1;
  if ([first, second].includes('ADMINISTRATION')) return 0;
  const assigned = [first, second].filter(value => value && value !== 'UNASSIGNED' && value !== 'NONE');
  if (!assigned.length) return 0;
  return -1;
}

let roomCatalog = normalizeRoomCatalog(window.ROOM_CATALOG || []);
let roomCatalogByKey = new Map(roomCatalog.map(room => [room.buildingRoom, room]));

function setRoomCatalog(rawRooms) {
  roomCatalog = normalizeRoomCatalog(rawRooms);
  roomCatalogByKey = new Map(roomCatalog.map(room => [room.buildingRoom, room]));
}

function saveRoomCatalogBackup(rawRooms, lastUpdated = null) {
  const rooms = normalizeRoomCatalog(rawRooms);
  if (!rooms.length) return;
  try {
    localStorage.setItem(ROOM_CATALOG_BACKUP_KEY, JSON.stringify({
      lastUpdated: lastUpdated || new Date().toISOString(),
      data: rooms
    }));
  } catch (err) {
    console.warn('Room catalog browser backup failed:', err);
  }
}

function readRoomCatalogBackup() {
  try {
    const payload = JSON.parse(localStorage.getItem(ROOM_CATALOG_BACKUP_KEY) || 'null');
    const rooms = normalizeRoomCatalog(payload?.data || []);
    return rooms.length ? { data: rooms, lastUpdated: payload.lastUpdated || null } : null;
  } catch (err) {
    console.warn('Room catalog browser backup read failed:', err);
    return null;
  }
}

function getRoomCatalogEntries() {
  return [...roomCatalog].sort((a, b) => a.buildingRoom.localeCompare(b.buildingRoom, undefined, { numeric: true }));
}

function getRoomKey(record) {
  return `${record.Building || record.BUILDING}-${record.Room || record.ROOM}`;
}

function getRoomDisplay(key) {
  const meta = roomCatalogByKey.get(key);
  if (!meta) return key;
  const details = [
    meta.capacity == null ? null : `${meta.capacity} seats`,
    meta.type || null
  ].filter(Boolean).join(', ');
  return details ? `${key} (${details})` : key;
}

function getUniqueRooms(data) {
  if (roomCatalog.length) return getRoomCatalogEntries().map(room => room.buildingRoom);
  // Fallback: returns array of "Bldg-Room" combos from uploaded section rows.
  return [...new Set(
    data
      .filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM))
      .map(getRoomKey)
  )].sort();
}

function normalizeRow(r) {
  const canonicalSection = window.COSSectionModel?.normalizeSection?.(r);
  // Convert DAYS like "MW" to ["Monday","Wednesday"]
  const daysMap = {M:"Monday",T:"Tuesday",W:"Wednesday",R:"Thursday",F:"Friday",U:"Sunday",S:"Saturday"};
  const dayColumnMap = [
    ['MONDAY', 'Monday'],
    ['TUESDAY', 'Tuesday'],
    ['WEDNESDAY', 'Wednesday'],
    ['THURSDAY', 'Thursday'],
    ['FRIDAY', 'Friday'],
    ['SATURDAY', 'Saturday'],
    ['SUNDAY', 'Sunday']
  ];
  const rawDays = extractField(r, [
    'DAYS', 'Days', 'Meeting Days', 'Meet Days', 'Day', 'Days Of Week',
    'Mtg Days', 'Meeting Pattern', 'Meeting_Pattern', 'dayPattern', 'Day Pattern'
  ]);
  let daysArr = [];
  if (rawDays) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const normalizedDayTokens = rawDays
      .split(/[,\s/]+/)
      .map(day => day.trim())
      .filter(Boolean)
      .map(day => dayNames.find(name => name.toLowerCase().startsWith(day.toLowerCase())) || day);
    const hasNamedDay = normalizedDayTokens.some(day => dayNames.includes(day));
    daysArr = normalizedDayTokens.length > 1 || hasNamedDay
      ? normalizedDayTokens
      : rawDays.replace(/TH/gi, 'R').split('').map(d => daysMap[d.toUpperCase()] || d);
  } else if (Array.isArray(r.Days)) {
    daysArr = r.Days;
  } else if (Array.isArray(r.days)) {
    daysArr = r.days;
  } else {
    daysArr = dayColumnMap
      .filter(([column]) => extractField(r, [column]))
      .map(([, day]) => day);
  }
  // Parse Time to Start_Time and End_Time
  let start24 = "00:00", end24 = "00:00";
  const to24 = (t) => {
    const value = String(t || '').trim();
    const m = value.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/i);
    if (m) {
      let h = parseInt(m[1],10);
      let min = m[2] ? parseInt(m[2],10) : 0;
      const ap = m[3] ? m[3].toUpperCase() : '';
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return (h<10? '0'+h : h) + ':' + (min<10? '0'+min : min);
    }
    return value.match(/^\d{1,2}:\d{2}$/) ? value : '00:00';
  };
  const timeRange = extractField(r, ['Time', 'Meeting Time', 'Meet Time', 'Mtg Time', 'Time Range', 'Times']);
  if (timeRange) {
    const parts = timeRange.split(/\s*-\s*|\s+to\s+/i).map(s => s.trim());
    if (parts.length === 2) {
      start24 = to24(parts[0]);
      end24 = to24(parts[1]);
    }
  } else {
    start24 = to24(extractField(r, ['Start_Time', 'Start Time', 'Start', 'start', 'Begin Time', 'Begin_Time', 'Class Begin Time', 'Meeting Start', 'Mtg Start']));
    end24 = to24(extractField(r, ['End_Time', 'End Time', 'End', 'end', 'Stop Time', 'Stop_Time', 'Class End Time', 'Meeting End', 'Mtg End']));
  }

  return {
    ...r,
    Subject_Course: extractField(r, ['Subject_Course', 'Subject Course', 'Course', 'Course ID', 'Course Number', 'Subject']),
    CRN: extractField(r, ['CRN', 'Course Reference Number']),
    Title: extractField(r, ['Title', 'Course Title', 'Section Title']),
    Division: extractField(r, ['Division', 'Academic Division', 'Department Division', 'School', 'Area']),
    Discipline: getCourseParts(r).discipline,
    Course_Number: getCourseParts(r).courseNumber,
    Instructional_Method: extractField(r, ['INSTRUCTIONAL_METHOD_CODE', 'Instructional Method Code', 'Instructional Method', 'Instructional_Method', 'Instr Method', 'Instruction Method', 'Method', 'Modality', 'INSTRUCTION_METHOD_DESC', 'Instruction Method Desc']),
    Building: extractField(r, ['BUILDING', 'Building', 'building', 'Bldg', 'Bldg Code', 'Building Code', 'Facility Building']),
    Room: extractField(r, ['ROOM', 'Room', 'roomOnly', 'room', 'Room Number', 'Room No', 'Facility Room']),
    Days: daysArr,
    Start_Time: start24,
    End_Time: end24,
    Start_Date: extractField(r, ['Start_Date', 'Start Date', 'Start', 'Section Start Date']),
    End_Date: extractField(r, ['End_Date', 'End Date', 'End', 'Section End Date']),
    Instructor: extractField(r, ['Instructor', 'Faculty', 'Primary Instructor']),
    Campus: extractField(r, ['CAMPUS', 'Campus', 'campus', 'Campus Code']),
    canonicalSection
  }
}

// -- CAL-GETC Filtering helpers --
function buildCalGetcFilterOptions() {
  const areas = [];
  const divisions = [];
  calGetcMapping.forEach(row => {
    (row.areas || []).forEach(area => {
      if (area && !areas.includes(area)) areas.push(area);
    });
    (row.divisions || []).forEach(division => {
      if (division && !divisions.includes(division)) divisions.push(division);
    });
  });
  return [
    ...areas.map(area => ({ value: `area:${area}`, label: area })),
    ...divisions.map(division => ({ value: `division:${division}`, label: division }))
  ];
}

function getCourseCodesFromCALGETC(value) {
  if (!calGetcMapping.length) return [];
  let type = '';
  let target = String(value || '');
  const typed = target.match(/^(area|division):(.*)$/);
  if (typed) {
    type = typed[1];
    target = typed[2];
  } else if (target.startsWith('Z')) {
    target = target.substring(1);
  }
  const codes = [];
  calGetcMapping.forEach(row => {
    const areaMatch = (type !== 'division') && (row.areas || []).includes(target);
    const divisionMatch = (type !== 'area') && (row.divisions || []).includes(target);
    if (areaMatch || divisionMatch) {
      codes.push(normalizeCalGetcCode(row.code));
    }
  });
  return codes;
}

function isCALGETCGroup(value) {
  return value && (/^(area|division):/.test(value) || value.startsWith("ZCAL-GETC"));
}

function populateCalGetcSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentValue = select.value;
  resetSelect(select, calGetcFilterOptions, 'All', '');
  if (calGetcFilterOptions.some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function refreshCalGetcFilterControls() {
  ['heatmap-calgetc-select', 'modality-calgetc-select', 'linechart-calgetc-select'].forEach(populateCalGetcSelect);
}

function sectionMatchesCalGetc(section, calGetcValue) {
  if (!calGetcValue) return true;
  const codes = getCourseCodesFromCALGETC(calGetcValue);
  if (!codes.length) return false;
  const courseCode = normalizeCalGetcCode(section.key || getCourseKey(section));
  return codes.includes(courseCode);
}

function renderSchedulingAnalysisMethodologyPanels() {
  const renderPanel = window.COSUtils?.renderStandardMethodologyPanel;
  if (!renderPanel) return;
  renderPanel(document.getElementById('heatmap-standard-methodology'), {
    title: 'Heatmap Analytics Methodology & Data Dictionary',
    purpose: 'Shows when classes begin by day and 30-minute scheduled start time, with optional enrollment, capacity, and fill-rate metric views.',
    metricsUsed: ['Sections Active', 'Enrollment Present', 'Seats Offered', 'Fill Rate', 'Student Presence', 'Empty Seats'],
    calculationRules: 'A section is placed in the day/time block for each scheduled start time and meeting day it uses. Repeated rows for the same CRN/day/scheduled start time are counted once. Enrollment Heatmap mode sums census enrollment when available and actual/current enrollment otherwise. Seat Capacity Heatmap mode sums section capacity. Fill Rate Heatmap mode divides enrollment by capacity after deduplication.',
    assumptions: 'Heatmap Analytics is a start-time view. It complements Course Duration because starts and active classroom load answer different questions.',
    limitations: 'A busy scheduled start time does not prove student preference. It reflects the schedule that was offered and does not include constraints outside the uploaded data.',
    items: [
      ['Section Count Heatmap', 'Counts distinct CRNs beginning in each 30-minute day/time block.'],
      ['Enrollment Heatmap', 'Sums enrollment for distinct CRNs beginning in each 30-minute day/time block.'],
      ['Seat Capacity Heatmap', 'Sums seats offered for distinct CRNs beginning in each 30-minute day/time block.']
    ]
  });
  renderPanel(document.getElementById('utilization-standard-methodology'), {
    title: 'Room Utilization and Room Fit Methodology & Data Dictionary',
    purpose: 'Evaluates room use quality and capacity fit for scheduled physical sections.',
    metricsUsed: ['Sections Active', 'Seats Offered', 'Enrollment Present', 'Fill Rate', 'Empty Seats', 'Prime-Time Concentration'],
    calculationRules: 'Room utilization uses scheduled instructional room hours divided by available instructional hours, with separate component scores for overall use, prime-time use, distribution, and fragmentation. Room fit compares room capacity against section capacity and census/current enrollment.',
    assumptions: 'Prime time defaults to Monday-Thursday, 9:00 AM-3:00 PM. VISFSC rooms are excluded from utilization. Online/TBA and no-room rows are excluded from room fit analysis.',
    limitations: 'Room utilization does not account for specialized equipment, pedagogy, furniture layout, accessibility needs, or intentional under-scheduling for program reasons.',
    items: [
      ['Overall Room Utilization Score', 'Overall Utilization 40% + Prime-Time Utilization 25% + Distribution Score 20% + Fragmentation Score 15%.'],
      ['Opportunity Score', 'Unused total and prime-time availability, weighted toward unused prime-time capacity. Displayed separately from the overall score.'],
      ['Underutilized Room', 'Section capacity or enrollment uses less than the configured share of room capacity, defaulting to 70%.'],
      ['Over Capacity Risk', 'Section capacity exceeds assigned room capacity.'],
      ['Enrollment Exceeds Room Capacity', 'Census/current enrollment exceeds assigned room capacity.']
    ]
  });
  renderPanel(document.getElementById('modality-standard-methodology'), {
    title: 'Modality Balance Methodology & Data Dictionary',
    purpose: 'Compares Total Class Offerings and enrollment distribution across In-Person, Hybrid, and Online modalities by selected term and comparison terms.',
    metricsUsed: ['Total Class Offerings', 'Enrollment Present', 'Class Offering Share', 'Enrollment Share'],
    calculationRules: 'Instructional Method codes are normalized into In-Person, Hybrid, or Online. Total Class Offerings counts distinct CRNs after filters are applied. Duplicate meeting rows for the same CRN are counted once unless the report is explicitly analyzing meeting components. Enrollment is calculated separately because the same number of class offerings can serve different numbers of students.',
    assumptions: 'Dual Enrollment is excluded by default and can be included intentionally. Unknown instructional method codes are stored internally as UNKNOWN and excluded from standard modality analytics until mapped.',
    limitations: 'Modality balance describes the offered schedule and enrolled students. It does not prove student modality preference or account for course-level pedagogical constraints.',
    items: [
      ['Total Class Offerings', 'Distinct CRN count after filters are applied. This is the primary measure of how many class offerings the college scheduled.'],
      ['Class Offerings by Modality', 'Distinct CRNs by normalized modality.'],
      ['Enrollment by Modality', 'Enrollment by normalized modality using census enrollment when available and actual/current enrollment otherwise.'],
      ['Percentage Difference', 'Focus term percentage minus comparison term percentage for the selected modality metric.']
    ]
  });
  renderPanel(document.getElementById('linechart-standard-methodology'), {
    title: 'Course Duration and Student Presence Graph Methodology & Data Dictionary',
    purpose: 'Shows how active course load or estimated student presence persists across half-hour intervals by day of week.',
    metricsUsed: ['Sections Active', 'Student Presence', 'Enrollment Present', 'Seats Offered'],
    calculationRules: 'Each valid physical meeting contributes to every half-hour interval it overlaps. Course Count mode counts active distinct CRN/day/start/end blocks. Student Presence mode applies census enrollment when available, otherwise actual/current enrollment, once per distinct CRN/day/start/end block. Duplicate CRN/day/start/end rows are counted once; the same CRN with a different start/end or different day counts as a distinct active meeting block.',
    assumptions: 'Online/TBA placeholder rows are excluded from physical interval calculations. Lecture/lab/activity can count separately when meeting times differ.',
    limitations: 'The graph estimates scheduled presence, not actual attendance or campus traffic. It reflects only loaded schedule data and selected filters.',
    items: [
      ['Course Count', 'Number of distinct active section meetings overlapping a half-hour interval.'],
      ['Estimated Students Present', 'Enrollment assigned to each half-hour interval where the section is active.']
    ]
  });
}

function registerSchedulingCollapsibleSections() {
  const applySections = window.COSUtils?.applyCollapsibleSections;
  if (!applySections) return;
  applySections(document, [
    { selector: '#room-filter', id: 'room-availability-room-filters', title: 'Room Filters' },
    { selector: '#avail-search-panel', id: 'room-availability-search-panel', title: 'Room Availability Search' },
    { selector: '#avail-results', id: 'room-availability-results', title: 'Available Rooms Results' },
    { selector: '#heatmap-tool .analysis-explainer', id: 'heatmap-help', title: 'Heatmap Help and Definitions' },
    { selector: '#heatmap-standard-methodology', id: 'heatmap-methodology', title: 'Heatmap Methodology' },
    { selector: '#controls', id: 'heatmap-controls', title: 'Heatmap Filters' },
    { selector: '#heatmap-summary-cards', id: 'heatmap-summary-cards', title: 'Heatmap Summary Cards' },
    { selector: '#heatmapContainer', id: 'heatmap-chart', title: 'Heatmap' },
    { selector: '#dataTable', id: 'heatmap-detail-table', title: 'Heatmap Detail Table' },
    { selector: '#utilization-controls', id: 'utilization-controls', title: 'Room Utilization Filters' },
    { selector: '#utilization-tool .utilization-explainer', id: 'utilization-definitions', title: 'Room Utilization Definitions' },
    { selector: '#utilization-standard-methodology', id: 'utilization-methodology', title: 'Room Utilization Methodology' },
    { selector: '#utilization-summary', id: 'utilization-summary', title: 'Room Utilization Summary Cards' },
    { selector: '#utilization-map', id: 'utilization-map', title: 'Room Utilization Map' },
    { selector: '.room-fit-section', id: 'room-fit-section', title: 'Room Capacity Fit Flags' },
    { selector: '#modality-controls', id: 'modality-controls', title: 'Modality Balance Filters' },
    { selector: '#modality-standard-methodology', id: 'modality-methodology', title: 'Modality Balance Methodology' },
    { selector: '#modality-summary', id: 'modality-summary-cards', title: 'Modality Balance Summary Cards' },
    { selector: '#modality-chart', id: 'modality-charts', title: 'Modality Balance Charts' },
    { selector: '#modality-comparison', id: 'modality-comparison-tables', title: 'Modality Balance Comparison Tables' },
    { selector: '#modality-table', id: 'modality-current-table', title: 'Current Term Modality Table' },
    { selector: '.modality-course-comparison', id: 'modality-course-comparison', title: 'Course-Level Term Differences' },
    { selector: '.modality-definitions', id: 'modality-instructional-method-details', title: 'Instructional Method Details' },
    { selector: '#linechart-tool .analysis-explainer', id: 'duration-help', title: 'Duration Graph Help and Definitions' },
    { selector: '#linechart-standard-methodology', id: 'duration-methodology', title: 'Duration Graph Methodology' },
    { selector: '#linechart-controls', id: 'duration-controls', title: 'Duration Graph Filters' },
    { selector: '#chart-container', id: 'duration-chart', title: 'Course Duration Graph' }
  ]);
  ['#heatmap-tool', '#utilization-tool', '#modality-tool', '#linechart-tool', '#availability-ui'].forEach(selector => {
    const root = document.querySelector(selector);
    if (root && !root.querySelector('.collapsible-section-controls')) {
      window.COSUtils?.createCollapsibleControls?.(root);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderSchedulingAnalysisMethodologyPanels();
  registerSchedulingCollapsibleSections();
  const terms = [
    'Summer 2026','Fall 2026','Spring 2027',
    'Summer 2027','Fall 2027','Spring 2028',
    'Summer 2028','Fall 2028','Spring 2029',
    'Summer 2029','Fall 2029','Spring 2030',
    'Summer 2030','Fall 2030'
  ];
  const defaultTerm = 'Fall 2026';
  const defaultTermIndex = Math.max(0, terms.indexOf(defaultTerm));
  const daysOfWeek = [...hmDays];
  let currentData = [];
  let currentTerm = '';

  const BACKEND_BASE_URL = window.BACKEND_BASE_URL || window.COS_APP_CONFIG?.backendBaseUrl || "https://app-backend-pp98.onrender.com";
  window.BACKEND_BASE_URL = BACKEND_BASE_URL;

  const tabs         = document.getElementById('term-tabs');
  const uploadDiv    = document.getElementById('upload-container');
  const tsDiv        = document.getElementById('upload-timestamp');
  const roomCatalogAdminDiv = document.getElementById('room-catalog-admin');
  const calGetcAdminDiv = document.getElementById('cal-getc-admin');
  const curriculumCrosswalkAdminDiv = document.getElementById('curriculum-crosswalk-admin');
  const roomDiv      = document.getElementById('room-filter');
  const startInput   = document.getElementById('avail-start');
  const endInput     = document.getElementById('avail-end');
  const checkBtn     = document.getElementById('avail-check-btn');
  const clearBtn     = document.getElementById('avail-clear-btn');
  const resultsDiv   = document.getElementById('avail-results');
  const availTermMode = document.getElementById('avail-term-mode');
  const availDateStart = document.getElementById('avail-date-start');
  const availDateEnd = document.getElementById('avail-date-end');
  const availCampusSelect = document.getElementById('avail-campus-select');
  const availTypeSelect = document.getElementById('avail-type-select');
  const availCapacityInput = document.getElementById('avail-capacity-input');
  const utilizationCampusSelect = document.getElementById('utilization-campus-select');
  const utilizationTypeSelect = document.getElementById('utilization-type-select');
  const utilizationBuildingSelect = document.getElementById('utilization-building-select');
  const utilizationSortSelect = document.getElementById('utilization-sort-select');
  const utilizationMinCapacityInput = document.getElementById('utilization-min-capacity');
  const utilizationMaxCapacityInput = document.getElementById('utilization-max-capacity');
  const utilizationMinOverallInput = document.getElementById('utilization-min-overall');
  const utilizationMinPrimeInput = document.getElementById('utilization-min-prime');
  const utilizationMinOpportunityInput = document.getElementById('utilization-min-opportunity');
  const utilizationMinDistributionInput = document.getElementById('utilization-min-distribution');
  const utilizationMinFragmentationInput = document.getElementById('utilization-min-fragmentation');
  const utilizationClearBtn = document.getElementById('utilization-clear-btn');
  const utilizationSummary = document.getElementById('utilization-summary');
  const utilizationMap = document.getElementById('utilization-map');
  const roomFitSummary = document.getElementById('room-fit-summary');
  const roomFitTable = document.getElementById('room-fit-table');
  const roomFitExportBtn = document.getElementById('room-fit-export-btn');
  const modalityDecisionTermSelect = document.getElementById('modality-decision-term');
  const modalityComparisonSelects = ['modality-comparison-1', 'modality-comparison-2', 'modality-comparison-3']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const modalityCampusSelect = document.getElementById('modality-campus-select');
  const modalityDivisionSelect = document.getElementById('modality-division-select');
  const modalityDisciplineSelect = document.getElementById('modality-discipline-select');
  const modalityDepartmentSelect = document.getElementById('modality-department-select');
  const modalityCourseSelect = document.getElementById('modality-course-select');
  const modalityModalitySelect = document.getElementById('modality-modality-select');
  const modalityLevelSelect = document.getElementById('modality-level-select');
  const modalityCalGetcSelect = document.getElementById('modality-calgetc-select');
  const modalityIncludeDe = document.getElementById('modality-include-de');
  const modalityClearBtn = document.getElementById('modality-clear-btn');
  const modalityExportBtn = document.getElementById('modality-export-btn');
  const modalityExportExcelBtn = document.getElementById('modality-export-excel-btn');
  const modalitySummary = document.getElementById('modality-summary');
  const modalityComparison = document.getElementById('modality-comparison');
  const modalityChart = document.getElementById('modality-chart');
  const modalityTable = document.getElementById('modality-table');
  const modalityCourseComparisonTable = document.getElementById('modality-course-comparison-table');
  const table        = document.getElementById('schedule-table');
  const container    = document.getElementById('schedule-container');
  const calendarContainer = document.getElementById('calendar-container');
  const calendarEl = document.getElementById('calendar');
  const roomHeaderDiv = document.getElementById('selected-room-header'); // NEW: header div

  let snapshotRoomFilter = null;
  let calendarRoomFilter = null;
  let modalityArchiveRows = [];
  let modalityLastFilterDebug = null;
  let modalityUploadRows = [];
  let modalityLoadedSourceRows = null;
  let scheduleAnalysisRows = null;
  let roomFitReportRows = null;
  const selectedUtilizationCategories = new Set();
  const utilizationCategoryLabels = [
    'Not Utilized',
    'Very Efficient',
    'Efficient',
    'Moderately Utilized',
    'Under Utilized',
    'High Opportunity',
    'Fragmented'
  ];

  initHeatmap();
  initLineChartChoices();
  initAvailabilityAttributeFilters();
  setupRoomCatalogAdmin();
  setupCalGetcAdmin();
  setupCurriculumCrosswalkAdmin();
  loadRoomCatalogFromBackend();
  loadModalityDefinitionsFromBackend();
  loadModalityArchiveRowsFromBackend();
  refreshAnalysisArchiveSelectors();
  loadCalGetcMappingFromBackend();
  loadCurriculumCrosswalkFromBackend();

  window.COSScheduleApp = {
    getCurrentData: () => currentData,
    getCurrentTerm: () => currentTerm,
    renderUtilizationMap: () => renderUtilizationMap(),
    renderHeatmapAnalytics: () => {
      feedHeatmapTool(getScheduleAnalysisRows());
      updateAllHeatmap();
    },
    renderDurationAnalytics: () => {
      feedHeatmapTool(getScheduleAnalysisRows());
      renderLineChart();
    },
    renderModalityBalance: () => renderModalityTool(),
    renderRoomFitReport: () => renderRoomFitReport().catch(err => alert(err.message || 'Room Fit Analysis failed.')),
    renderRoomFitReportTable: () => renderRoomFitReportTable(),
    exportRoomFitReport: () => exportRoomFitReport(),
    roomUtilizationCategoryLabels: () => [...utilizationCategoryLabels],
    roomMatchesUtilizationCategory,
    filterRoomUtilizationRowsByCategory,
    roomCatalogTestHooks: {
      normalizeRoomCatalog,
      normalizeRoomPriorityDivision,
      normalizeRoomFeatures,
      roomPriorityWarnings,
      roomPriorityScore,
      roomCatalogToCsv
    },
    modalityBalanceTestHooks: {
      normalizeTermLabel,
      termMatches,
      getEnrollmentValue,
      getModalitySectionIdentity,
      normalizeFilterLabel,
      filterMatchesAny,
      modalityDivisionValue,
      modalityFilteredSections,
      modalityMixGraphData,
      modalityBalanceItemsFromSections,
      calculateModalityBalanceFromItems,
      modalityCombinedComparisonRows,
      modalityTotalClassOfferingComparisonRows,
      modalityChartData,
      modalityExportRowsForData
    }
  };

  document.getElementById('courseSelect').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-campus-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-division-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-discipline-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-calgetc-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-metric-select').addEventListener('change', updateHeatmap);
  document.getElementById('heatmap-prime-only').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-underutilized-only').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-exclude-tutoring-openlab')?.addEventListener('change', updateAllHeatmap);
  document.getElementById('linechart-campus-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-division-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-discipline-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-calgetc-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-metric-select')?.addEventListener('change', renderLineChart);
  document.getElementById('linechart-exclude-tutoring-openlab')?.addEventListener('change', renderLineChart);
  if (utilizationCampusSelect) utilizationCampusSelect.addEventListener('change', renderUtilizationMap);
  if (utilizationTypeSelect) utilizationTypeSelect.addEventListener('change', renderUtilizationMap);
  if (utilizationBuildingSelect) utilizationBuildingSelect.addEventListener('change', renderUtilizationMap);
  if (utilizationSortSelect) utilizationSortSelect.addEventListener('change', renderUtilizationMap);
  if (utilizationMinCapacityInput) utilizationMinCapacityInput.addEventListener('input', renderUtilizationMap);
  if (utilizationMaxCapacityInput) utilizationMaxCapacityInput.addEventListener('input', renderUtilizationMap);
  [utilizationMinOverallInput, utilizationMinPrimeInput, utilizationMinOpportunityInput, utilizationMinDistributionInput, utilizationMinFragmentationInput]
    .filter(Boolean)
    .forEach(input => input.addEventListener('input', renderUtilizationMap));
  document.getElementById('utilization-exclude-tutoring-openlab')?.addEventListener('change', renderUtilizationMap);
  if (roomFitExportBtn) roomFitExportBtn.addEventListener('click', exportRoomFitAnalysis);
  if (modalityCampusSelect) modalityCampusSelect.addEventListener('change', renderModalityTool);
  if (modalityDecisionTermSelect) modalityDecisionTermSelect.addEventListener('change', renderModalityTool);
  modalityComparisonSelects.forEach(select => select.addEventListener('change', renderModalityTool));
  if (modalityDivisionSelect) modalityDivisionSelect.addEventListener('change', renderModalityTool);
  if (modalityDisciplineSelect) modalityDisciplineSelect.addEventListener('change', renderModalityTool);
  if (modalityDepartmentSelect) modalityDepartmentSelect.addEventListener('change', renderModalityTool);
  if (modalityCourseSelect) modalityCourseSelect.addEventListener('change', renderModalityTool);
  if (modalityModalitySelect) modalityModalitySelect.addEventListener('change', renderModalityTool);
  if (modalityLevelSelect) modalityLevelSelect.addEventListener('change', renderModalityTool);
  if (modalityCalGetcSelect) modalityCalGetcSelect.addEventListener('change', renderModalityTool);
  if (modalityIncludeDe) modalityIncludeDe.addEventListener('change', renderModalityTool);
  if (modalityExportBtn) modalityExportBtn.addEventListener('click', exportModalityBalance);
  if (modalityExportExcelBtn) modalityExportExcelBtn.addEventListener('click', exportModalityBalanceExcel);
  document.getElementById('modality-exclude-tutoring-openlab')?.addEventListener('change', renderModalityTool);
  document.getElementById('heatmap-load-source-btn')?.addEventListener('click', () => loadScheduleAnalysisSource('heatmap').catch(err => alert(err.message || 'Heatmap source load failed.')));
  document.getElementById('linechart-load-source-btn')?.addEventListener('click', () => loadScheduleAnalysisSource('linechart').catch(err => alert(err.message || 'Duration source load failed.')));
  document.getElementById('modality-load-source-btn')?.addEventListener('click', () => loadModalitySelectedSource().catch(err => alert(err.message || 'Modality source load failed.')));
  if (utilizationClearBtn) {
    utilizationClearBtn.onclick = () => {
      if (utilizationCampusSelect) utilizationCampusSelect.value = '';
      if (utilizationTypeSelect) utilizationTypeSelect.value = '';
      if (utilizationBuildingSelect) utilizationBuildingSelect.value = '';
      if (utilizationSortSelect) utilizationSortSelect.value = 'score';
      if (utilizationMinCapacityInput) utilizationMinCapacityInput.value = '';
      if (utilizationMaxCapacityInput) utilizationMaxCapacityInput.value = '';
      [utilizationMinOverallInput, utilizationMinPrimeInput, utilizationMinOpportunityInput, utilizationMinDistributionInput, utilizationMinFragmentationInput]
        .filter(Boolean)
        .forEach(input => { input.value = ''; });
      const excludeTutoring = document.getElementById('utilization-exclude-tutoring-openlab');
      if (excludeTutoring) excludeTutoring.checked = true;
      selectedUtilizationCategories.clear();
      renderUtilizationMap();
    };
  }
  if (modalityClearBtn) {
    modalityClearBtn.onclick = () => {
      if (modalityCampusSelect) modalityCampusSelect.value = '';
      if (modalityDivisionSelect) modalityDivisionSelect.value = '';
      if (modalityDisciplineSelect) modalityDisciplineSelect.value = '';
      if (modalityDepartmentSelect) modalityDepartmentSelect.value = '';
      if (modalityCourseSelect) modalityCourseSelect.value = '';
      if (modalityModalitySelect) modalityModalitySelect.value = '';
      if (modalityLevelSelect) modalityLevelSelect.value = '';
      if (modalityCalGetcSelect) modalityCalGetcSelect.value = '';
      if (modalityDecisionTermSelect) modalityDecisionTermSelect.value = '';
      modalityComparisonSelects.forEach(select => { select.value = ''; });
      if (modalityIncludeDe) modalityIncludeDe.checked = false;
      const excludeTutoring = document.getElementById('modality-exclude-tutoring-openlab');
      if (excludeTutoring) excludeTutoring.checked = true;
      renderModalityTool();
    };
  }

  document.getElementById('heatmap-clear-btn').onclick = () => {
    if (hmChoices) hmChoices.removeActiveItems();
    ['heatmap-campus-select', 'heatmap-division-select', 'heatmap-discipline-select', 'heatmap-calgetc-select'].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.value = '';
    });
    const metric = document.getElementById('heatmap-metric-select');
    if (metric) metric.value = 'sections';
    const primeOnly = document.getElementById('heatmap-prime-only');
    const underutilizedOnly = document.getElementById('heatmap-underutilized-only');
    const excludeTutoring = document.getElementById('heatmap-exclude-tutoring-openlab');
    if (primeOnly) primeOnly.checked = false;
    if (underutilizedOnly) underutilizedOnly.checked = false;
    if (excludeTutoring) excludeTutoring.checked = true;
    clearHeatmapCellFilter(false);
    if (document.getElementById('textSearch')) {
      document.getElementById('textSearch').value = '';
      hmTable.search('').draw();
    }
    updateAllHeatmap();
  };
  document.getElementById('linechart-clear-btn').onclick = () => {
    if (lineCourseChoices) lineCourseChoices.removeActiveItems();
    ['linechart-campus-select', 'linechart-division-select', 'linechart-discipline-select', 'linechart-calgetc-select'].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.value = '';
    });
    const excludeTutoring = document.getElementById('linechart-exclude-tutoring-openlab');
    if (excludeTutoring) excludeTutoring.checked = true;
    const metric = document.getElementById('linechart-metric-select');
    if (metric) metric.value = 'count';
    renderLineChart();
  };

// --- Export to PDF ---
document.getElementById('export-pdf-btn').addEventListener('click', function() {
  const roomHeader = document.getElementById('selected-room-header').textContent;
  html2canvas(document.getElementById('schedule-container')).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    pdf.setFontSize(24);
    pdf.text(roomHeader || 'All Rooms', 40, 40);
    const pageWidth = pdf.internal.pageSize.getWidth() - 80;
    const pageHeight = pdf.internal.pageSize.getHeight() - 100;
    pdf.addImage(imgData, 'PNG', 40, 60, pageWidth, pageHeight);
    pdf.save(`Schedule-${roomHeader || 'All'}.pdf`);
  });
});

  terms.forEach((term, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === defaultTermIndex ? ' active' : '');
    tab.textContent = term;
    tab.onclick = () => selectTerm(term, tab);
    tabs.appendChild(tab);
  });
  selectTerm(terms[defaultTermIndex], tabs.children[defaultTermIndex]);

  checkBtn.onclick = handleAvailability;
  clearBtn.onclick = () => {
    document.querySelectorAll('#availability-ui .days input').forEach(cb => cb.checked = false);
    startInput.value = '';
    endInput.value   = '';
    if (availCampusSelect) availCampusSelect.value = '';
    if (availTypeSelect) availTypeSelect.value = '';
    if (availCapacityInput) availCapacityInput.value = '';
    if (availTermMode) availTermMode.value = 'full';
    setAvailabilityDateMode();
    resultsDiv.textContent = '';
  };

  function setAvailabilityDateMode() {
    const isShortTerm = availTermMode?.value === 'short';
    [availDateStart, availDateEnd].forEach(input => {
      if (!input) return;
      input.disabled = !isShortTerm;
      if (!isShortTerm) input.value = '';
    });
  }
  if (availTermMode) {
    availTermMode.addEventListener('change', setAvailabilityDateMode);
    setAvailabilityDateMode();
  }

  document.getElementById('viewSelect').addEventListener('change', function(){
    const view = this.value;
    document.getElementById('heatmap-tool').style.display = (view === 'heatmap') ? 'block' : 'none';
    document.getElementById('modality-tool').style.display = (view === 'modality') ? 'block' : 'none';
    document.getElementById('schedule-container').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('availability-ui').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('room-filter').style.display = (view === 'calendar') ? '' : 'none';
    document.getElementById('linechart-tool').style.display = (view === 'linechart') ? 'block' : 'none';
    document.getElementById('calendar-container').style.display = (view === 'fullcalendar') ? 'block' : 'none';
    document.getElementById('calendar-room-filter').style.display = (view === 'fullcalendar') ? 'block' : 'none';
    document.getElementById('selected-room-header').style.display = (view === 'calendar' ? '' : 'none'); // NEW: hide header on non-grid views
    if (view === 'linechart') {
      renderLineChart();
    }
    if (view === 'modality') {
      renderModalityTool();
    }
    if (view === 'fullcalendar') {
      renderFullCalendar();
    }
  });

  document.getElementById('lineCourseSelect').addEventListener('change', renderLineChart);

  document.getElementById('calendar-room-select').addEventListener('change', renderFullCalendar);

  function initAvailabilityAttributeFilters() {
    if (!roomCatalog.length) {
      if (availCampusSelect) resetSelect(availCampusSelect, [], 'All', '');
      if (availTypeSelect) resetSelect(availTypeSelect, [], 'All', '');
      return;
    }
    const campuses = [...new Set(roomCatalog.map(room => room.campus).filter(Boolean))].sort();
    const types = [...new Set(roomCatalog.map(room => room.type).filter(Boolean))].sort();
    if (availCampusSelect) resetSelect(availCampusSelect, campuses, 'All', '');
    if (availTypeSelect) resetSelect(availTypeSelect, types, 'All', '');
  }

  function setRoomCatalogStatus(message, isError = false) {
    const status = document.getElementById('room-catalog-status');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#b91c1c' : '';
  }

  function isUtilizationViewActive() {
    return document.getElementById('viewSelect')?.value === 'utilization' ||
      document.getElementById('emReportSelect')?.value === 'room-utilization';
  }

  function refreshRoomCatalogViews(lastUpdated = null) {
    initAvailabilityAttributeFilters();
    initUtilizationFilters();
    buildRoomDropdowns();
    renderSchedule();
    if (document.getElementById('viewSelect').value === 'fullcalendar') {
      renderFullCalendar();
    }
    if (isUtilizationViewActive()) {
      renderUtilizationMap();
    }
    const stamp = lastUpdated ? ` Updated ${new Date(lastUpdated).toLocaleString()}.` : '';
    setRoomCatalogStatus(`${roomCatalog.length} rooms loaded.${stamp}`);
    renderRoomCatalogPreview();
  }

  function loadRoomCatalogFromBackend() {
    fetch(`${BACKEND_BASE_URL}/api/rooms`)
      .then(res => {
        if (!res.ok) throw new Error('Room catalog fetch failed');
        return res.json();
      })
      .then(({ data, lastUpdated }) => {
        const backendRooms = normalizeRoomCatalog(data);
        if (backendRooms.length) {
          setRoomCatalog(backendRooms);
          saveRoomCatalogBackup(backendRooms, lastUpdated);
          refreshRoomCatalogViews(lastUpdated);
          return;
        }
        const backup = readRoomCatalogBackup();
        if (backup) {
          setRoomCatalog(backup.data);
          refreshRoomCatalogViews(backup.lastUpdated);
          setRoomCatalogStatus(`${roomCatalog.length} rooms loaded from this browser's saved copy. Re-import to restore the backend catalog.`, true);
          return;
        }
        setRoomCatalog(window.ROOM_CATALOG || []);
        refreshRoomCatalogViews(lastUpdated);
      })
      .catch(err => {
        const backup = readRoomCatalogBackup();
        if (backup) {
          setRoomCatalog(backup.data);
          refreshRoomCatalogViews(backup.lastUpdated);
          setRoomCatalogStatus(`Using this browser's saved room catalog because backend fetch failed. ${err.message}`, true);
          return;
        }
        setRoomCatalog(window.ROOM_CATALOG || []);
        refreshRoomCatalogViews();
        setRoomCatalogStatus(`Using built-in room catalog. ${err.message}`, true);
      });
  }

  function setupRoomCatalogAdmin() {
    if (!roomCatalogAdminDiv) return;
    roomCatalogAdminDiv.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = 'Room Catalog';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export Rooms CSV';

    const exportJsonBtn = document.createElement('button');
    exportJsonBtn.type = 'button';
    exportJsonBtn.textContent = 'Export Rooms JSON';

    const importLabel = document.createElement('label');
    importLabel.append('Import Rooms:');
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.csv,.json,application/json,text/csv';
    importLabel.appendChild(importInput);

    const status = document.createElement('span');
    status.id = 'room-catalog-status';
    status.className = 'room-catalog-status';
    status.textContent = `${roomCatalog.length} rooms loaded.`;

    const preview = document.createElement('div');
    preview.id = 'room-catalog-preview';
    preview.className = 'room-catalog-preview';

    roomCatalogAdminDiv.append(title, exportBtn, exportJsonBtn, importLabel, status, preview);
    renderRoomCatalogPreview();
    appendModalityDefinitionsAdmin();

    exportBtn.addEventListener('click', () => exportRoomCatalog('csv'));
    exportJsonBtn.addEventListener('click', () => exportRoomCatalog('json'));
    importInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      importRoomCatalog(file).finally(() => {
        e.target.value = '';
      });
    });
  }

  function renderRoomCatalogPreview() {
    const preview = document.getElementById('room-catalog-preview');
    if (!preview) return;
    const rooms = getRoomCatalogEntries();
    const display = rooms.slice(0, 25);
    if (!display.length) {
      preview.innerHTML = '<p>No room catalog rows loaded.</p>';
      return;
    }
    const rows = display.map(room => `
      <tr>
        <td>${escapeHTML(room.campus || '')}</td>
        <td>${escapeHTML(room.building || '')}</td>
        <td>${escapeHTML(room.room || '')}</td>
        <td>${escapeHTML(room.capacity == null ? '' : room.capacity)}</td>
        <td>${escapeHTML(room.type || '')}</td>
        <td>${escapeHTML(room.priorityDivision1 || 'Unassigned')}</td>
        <td>${escapeHTML(room.priorityDivision2 && room.priorityDivision2 !== 'None' ? room.priorityDivision2 : '-')}</td>
        <td>${escapeHTML(room.roomFeaturesText || '')}</td>
      </tr>
    `).join('');
    preview.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Campus</th>
            <th>Building</th>
            <th>Room</th>
            <th>Capacity</th>
            <th>Room Type</th>
            <th>Priority Division 1</th>
            <th>Priority Division 2</th>
            <th>Room Features</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${rooms.length > display.length ? `<p>Showing first ${display.length} of ${rooms.length} rooms.</p>` : ''}
      <p><strong>Priority Division 1</strong> is the division with first scheduling preference. <strong>Priority Division 2</strong> is a secondary scheduling preference. <strong>Administration</strong> means shared instructional space available to all divisions. <strong>Unassigned</strong> means no preferred division has been assigned. <strong>Room Features</strong> are optional room attributes intended for future room-matching and schedule-optimization tools. They do not currently restrict Room Availability results.</p>
    `;
  }

  function appendModalityDefinitionsAdmin() {
    document.getElementById('modality-definitions-admin')?.remove();
    if (!roomCatalogAdminDiv?.parentElement) return;
    const wrap = document.createElement('div');
    wrap.id = 'modality-definitions-admin';
    wrap.className = 'room-catalog-admin modality-admin';

    const title = document.createElement('strong');
    title.textContent = 'Modality Definitions';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export Modalities CSV';

    const exportJsonBtn = document.createElement('button');
    exportJsonBtn.type = 'button';
    exportJsonBtn.textContent = 'Export Modalities JSON';

    const importLabel = document.createElement('label');
    importLabel.append('Import Modalities:');
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.csv,.json,application/json,text/csv';
    importLabel.appendChild(importInput);

    const status = document.createElement('span');
    status.id = 'modality-definitions-status';
    status.className = 'room-catalog-status';
    status.textContent = `${modalityDefinitions.length} modality definitions loaded.`;

    wrap.append(title, exportBtn, exportJsonBtn, importLabel, status);
    roomCatalogAdminDiv.insertAdjacentElement('afterend', wrap);

    exportBtn.addEventListener('click', () => exportModalityDefinitions('csv'));
    exportJsonBtn.addEventListener('click', () => exportModalityDefinitions('json'));
    importInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      importModalityDefinitions(file).finally(() => {
        e.target.value = '';
      });
    });
  }

  function setupCalGetcAdmin() {
    if (!calGetcAdminDiv) return;
    calGetcAdminDiv.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = 'CAL-GETC Mapping';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export CAL-GETC CSV';

    const exportJsonBtn = document.createElement('button');
    exportJsonBtn.type = 'button';
    exportJsonBtn.textContent = 'Export CAL-GETC JSON';

    const importLabel = document.createElement('label');
    importLabel.append('Import CAL-GETC:');
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.csv,.json,application/json,text/csv';
    importLabel.appendChild(importInput);

    const status = document.createElement('span');
    status.id = 'cal-getc-status';
    status.className = 'room-catalog-status';
    status.textContent = `${calGetcMapping.length} CAL-GETC mappings loaded.`;

    calGetcAdminDiv.append(title, exportBtn, exportJsonBtn, importLabel, status);

    exportBtn.addEventListener('click', () => exportCalGetcMapping('csv'));
    exportJsonBtn.addEventListener('click', () => exportCalGetcMapping('json'));
    importInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      importCalGetcMapping(file).finally(() => {
        e.target.value = '';
      });
    });
  }

  function setupCurriculumCrosswalkAdmin() {
    if (!curriculumCrosswalkAdminDiv) return;
    curriculumCrosswalkAdminDiv.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = 'CCN/Curriculum Crosswalk';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export Crosswalk CSV';

    const exportJsonBtn = document.createElement('button');
    exportJsonBtn.type = 'button';
    exportJsonBtn.textContent = 'Export Crosswalk JSON';

    const importLabel = document.createElement('label');
    importLabel.append('Import Crosswalk:');
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.csv,.json,application/json,text/csv';
    importLabel.appendChild(importInput);

    const status = document.createElement('span');
    status.id = 'curriculum-crosswalk-status';
    status.className = 'room-catalog-status';
    status.textContent = `${curriculumCrosswalk.length} crosswalk rows loaded.`;

    curriculumCrosswalkAdminDiv.append(title, exportBtn, exportJsonBtn, importLabel, status);

    exportBtn.addEventListener('click', () => exportCurriculumCrosswalk('csv'));
    exportJsonBtn.addEventListener('click', () => exportCurriculumCrosswalk('json'));
    importInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      importCurriculumCrosswalk(file).finally(() => {
        e.target.value = '';
      });
    });
  }

  function requestPassword(message, cancelMessage = 'Password action cancelled.') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'password-dialog-backdrop';
      overlay.innerHTML = `
        <form class="password-dialog">
          <label>${escapeHTML(message)}
            <span class="password-input-wrap">
              <input type="password" autocomplete="current-password" required>
              <button type="button" class="password-eye" aria-label="Show password">Show</button>
            </span>
          </label>
          <div class="password-dialog-actions">
            <button type="submit">Submit</button>
            <button type="button" data-cancel>Cancel</button>
          </div>
        </form>`;
      const input = overlay.querySelector('input');
      const eye = overlay.querySelector('.password-eye');
      const close = value => {
        overlay.remove();
        resolve(value);
      };
      eye.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        eye.textContent = showing ? 'Show' : 'Hide';
        eye.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      });
      overlay.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        close(input.value);
      });
      overlay.querySelector('[data-cancel]').addEventListener('click', () => close(null));
      document.body.appendChild(overlay);
      input.focus();
    }).then(password => {
      if (!password) {
        alert(cancelMessage);
        return null;
      }
      return password;
    });
  }

  async function getRoomCatalogPassword(action) {
    const password = await requestPassword(`Enter upload password to ${action} room catalog:`, 'Room catalog action cancelled.');
    if (!password) {
      return null;
    }
    return password;
  }

  async function getModalityImportPassword() {
    const password = await requestPassword('Enter upload password to import modality definitions:', 'Modality import cancelled.');
    if (!password) {
      return null;
    }
    return password;
  }

  async function getCalGetcImportPassword() {
    const password = await requestPassword('Enter upload password to import CAL-GETC mapping:', 'CAL-GETC import cancelled.');
    if (!password) {
      return null;
    }
    return password;
  }

  async function getCurriculumCrosswalkImportPassword() {
    const password = await requestPassword('Enter upload password to import CCN/Curriculum crosswalk:', 'Curriculum crosswalk import cancelled.');
    if (!password) {
      return null;
    }
    return password;
  }

  function roomCatalogToCsv(rooms) {
    const rows = normalizeRoomCatalog(rooms).map(room => ({
      Campus: room.campus,
      Building: room.building,
      Room: room.room,
      Capacity: room.capacity == null ? '' : room.capacity,
      'Room Type': room.type,
      'Priority Division 1': room.priorityDivision1 || 'Unassigned',
      'Priority Division 2': room.priorityDivision2 || 'None',
      'Room Features': room.roomFeaturesText || ''
    }));
    return Papa.unparse(rows);
  }

  function modalityDefinitionsToCsv(definitions) {
    const rows = normalizeModalityDefinitions(definitions).map(definition => ({
      Code: definition.code,
      Modality: definition.modality,
      Omit: definition.omitted ? 'TRUE' : 'FALSE'
    }));
    return Papa.unparse(rows);
  }

  function calGetcMappingToCsv(mapping) {
    const rows = normalizeCalGetcMapping(mapping).map(item => ({
      Code: item.code,
      Areas: item.areas.join('; '),
      Divisions: item.divisions.join('; ')
    }));
    return Papa.unparse(rows);
  }

  function curriculumCrosswalkToCsv(crosswalk) {
    const rows = normalizeCurriculumCrosswalk(crosswalk).map(item => ({
      'Source Course': item.sourceCourse,
      'Synonym Course': item.synonymCourse,
      'Source Title': item.sourceTitle,
      'Synonym Title': item.synonymTitle,
      'Change Type': item.changeType,
      Phase: item.phase,
      'C-ID': item.cid,
      Template: item.template,
      'Effective Term': item.effectiveTerm,
      Notes: item.notes
    }));
    return Papa.unparse(rows);
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function selectedOptions(select) {
    return Array.from(select?.selectedOptions || []).map(option => option.value).filter(Boolean);
  }

  function readCsvFiles(input) {
    const files = Array.from(input?.files || []);
    if (!files.length) return Promise.resolve([]);
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
      const sourceTerm = termFromFilename(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: result => resolve((result.data || []).map(row => ({ ...row, __sourceTerm: sourceTerm }))),
        error: reject
      });
    }))).then(batches => batches.flat());
  }

  function termFromFilename(filename = '') {
    const text = String(filename || '').toUpperCase();
    const code = text.match(/\b(20\d{4})\b/)?.[1];
    if (code) {
      const year = Number(code.slice(0, 4));
      const suffix = code.slice(4);
      if (suffix === '10') return `FALL ${year - 1}`;
      if (suffix === '20') return `SPRING ${year}`;
      if (suffix === '30') return `SUMMER ${year}`;
    }
    const named = text.match(/\b(FALL|SPRING|SUMMER)\b\D*(20\d{2})/) || text.match(/\b(20\d{2})\D*(FALL|SPRING|SUMMER)\b/);
    if (named) {
      const season = /\d/.test(named[1]) ? named[2] : named[1];
      const year = /\d/.test(named[1]) ? named[1] : named[2];
      return `${season} ${year}`;
    }
    return '';
  }

  async function fetchArchivedScheduleRows(terms) {
    if (!terms.length) return [];
    const batches = await Promise.all(terms.map(async term => {
      const response = await fetch(`${BACKEND_BASE_URL}/api/analytics-archive/${encodeURIComponent(term)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Could not load archived term ${term}: ${payload.error || payload.message || response.statusText}`);
      return (payload.data || []).map(row => ({ ...row, __sourceTerm: payload.term || term }));
    }));
    return batches.flat();
  }

  async function refreshAnalysisArchiveSelectors() {
    if (!BACKEND_BASE_URL) return;
    try {
      const payload = await fetch(`${BACKEND_BASE_URL}/api/analytics-archive`).then(response => response.ok ? response.json() : { data: [] });
      const terms = (payload.data || []).map(item => item.term).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      ['heatmap-archive-terms', 'linechart-archive-terms', 'modality-archive-terms'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const selected = new Set(selectedOptions(select));
        select.replaceChildren();
        terms.forEach(term => select.appendChild(new Option(term, term, false, selected.has(term))));
      });
    } catch (err) {
      console.warn('Analysis archive selectors skipped:', err);
    }
  }

  function getScheduleAnalysisRows() {
    return scheduleAnalysisRows?.length ? scheduleAnalysisRows : currentData;
  }

  function setScheduleAnalysisStatus(prefix, message, isError = false) {
    const node = document.getElementById(`${prefix}-source-status`);
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
  }

  async function loadScheduleAnalysisSource(prefix) {
    const uploadInput = document.getElementById(`${prefix}-source-csv`);
    const archiveSelect = document.getElementById(`${prefix}-archive-terms`);
    const selectedArchiveTerms = selectedOptions(archiveSelect);
    if (!uploadInput?.files?.length && !selectedArchiveTerms.length) {
      setScheduleAnalysisStatus(prefix, 'Choose a CSV or archived term, then click Load Source.', true);
      return getScheduleAnalysisRows();
    }
    setScheduleAnalysisStatus(prefix, 'Loading source...');
    const uploadRows = await readCsvFiles(uploadInput);
    const archivedRows = await fetchArchivedScheduleRows(selectedArchiveTerms);
    const rows = [...uploadRows, ...archivedRows].map(normalizeRow);
    if (!rows.length) {
      setScheduleAnalysisStatus(prefix, 'No rows were found in the selected source.', true);
      return getScheduleAnalysisRows();
    }
    scheduleAnalysisRows = rows;
    feedHeatmapTool(getScheduleAnalysisRows());
    if (prefix === 'linechart') renderLineChart();
    else updateAllHeatmap();
    const terms = [...new Set(rows.map(row => getSectionTerm(row)).filter(Boolean))].sort();
    setScheduleAnalysisStatus(prefix, `Loaded ${rows.length} row(s)${terms.length ? ` for ${terms.join(', ')}` : ''}.`);
    return getScheduleAnalysisRows();
  }

  async function loadModalitySelectedSource() {
    const uploadInput = document.getElementById('modality-source-csv');
    const archiveSelect = document.getElementById('modality-archive-terms');
    const selectedArchiveTerms = selectedOptions(archiveSelect);
    if (!uploadInput?.files?.length && !selectedArchiveTerms.length) {
      setScheduleAnalysisStatus('modality', 'Choose a CSV or archived term, then click Load Source.', true);
      return getModalitySourceRows();
    }
    setScheduleAnalysisStatus('modality', 'Loading source...');
    const uploaded = await readCsvFiles(uploadInput);
    const archived = await fetchArchivedScheduleRows(selectedArchiveTerms);
    modalityUploadRows = [...uploaded, ...archived].map(normalizeRow);
    modalityLoadedSourceRows = modalityUploadRows;
    if (!modalityLoadedSourceRows.length) {
      setScheduleAnalysisStatus('modality', 'No rows were found in the selected source.', true);
      return getModalitySourceRows();
    }
    if (BACKEND_BASE_URL && !modalityArchiveRows.length) {
      await loadModalityArchiveRowsFromBackend();
    }
    initModalityFilters();
    renderModalityTool();
    const terms = [...new Set(modalityLoadedSourceRows.map(getSectionTerm).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    setScheduleAnalysisStatus('modality', `Loaded ${modalityLoadedSourceRows.length} row(s)${terms.length ? ` for ${terms.join(', ')}` : ''}.`);
    return modalityLoadedSourceRows;
  }

  async function exportRoomCatalog(format = 'csv') {
    const password = await getRoomCatalogPassword('export');
    if (!password) return;
    fetch(`${BACKEND_BASE_URL}/api/rooms/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
      .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Unauthorized' : 'Export failed');
        return res.json();
      })
      .then(({ data }) => {
        const rooms = normalizeRoomCatalog(data).length ? normalizeRoomCatalog(data) : roomCatalog;
        if (format === 'json') {
          downloadTextFile('cos-room-catalog.json', JSON.stringify(rooms, null, 2), 'application/json;charset=utf-8');
        } else {
          downloadTextFile('cos-room-catalog.csv', roomCatalogToCsv(rooms), 'text/csv;charset=utf-8');
        }
        setRoomCatalogStatus(`Exported ${rooms.length} rooms.`);
      })
      .catch(err => {
        alert('Room catalog export failed: ' + err.message);
        setRoomCatalogStatus('Room catalog export failed.', true);
      });
  }

  function setModalityDefinitionsStatus(message, isError = false) {
    const status = document.getElementById('modality-definitions-status');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#b91c1c' : '';
  }

  function refreshModalityDefinitionsViews(lastUpdated = null) {
    const stamp = lastUpdated ? ` Updated ${new Date(lastUpdated).toLocaleString()}.` : '';
    setModalityDefinitionsStatus(`${modalityDefinitions.length} modality definitions loaded.${stamp}`);
    renderModalityDefinitionsTable();
    if (document.getElementById('viewSelect').value === 'modality') {
      renderModalityTool();
    }
  }

  function renderModalityDefinitionsTable() {
    const tbody = document.getElementById('modality-definitions-table-body');
    if (!tbody) return;
    tbody.replaceChildren();
    modalityDefinitions
      .slice()
      .sort((a, b) => Number(a.omitted) - Number(b.omitted) || a.modality.localeCompare(b.modality) || a.code.localeCompare(b.code))
      .forEach(definition => {
        const tr = document.createElement('tr');
        const code = document.createElement('td');
        code.textContent = definition.code;
        const modality = document.createElement('td');
        modality.textContent = definition.omitted ? `${definition.modality || 'Omitted from modality analysis'} (omitted)` : definition.modality;
        tr.append(code, modality);
        tbody.appendChild(tr);
      });
  }

  function loadModalityDefinitionsFromBackend() {
    fetch(`${BACKEND_BASE_URL}/api/modalities`)
      .then(res => {
        if (!res.ok) throw new Error('Modality definitions fetch failed');
        return res.json();
      })
      .then(({ data, lastUpdated }) => {
        const definitions = normalizeModalityDefinitions(data);
        setModalityDefinitions(definitions.length ? definitions : DEFAULT_MODALITY_DEFINITIONS);
        refreshModalityDefinitionsViews(lastUpdated);
      })
      .catch(err => {
        setModalityDefinitions(DEFAULT_MODALITY_DEFINITIONS);
        refreshModalityDefinitionsViews();
        setModalityDefinitionsStatus(`Using built-in modality definitions. ${err.message}`, true);
      });
  }

  function exportModalityDefinitions(format = 'csv') {
    fetch(`${BACKEND_BASE_URL}/api/modalities`)
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.json();
      })
      .then(({ data }) => {
        const definitions = normalizeModalityDefinitions(data).length ? normalizeModalityDefinitions(data) : modalityDefinitions;
        if (format === 'json') {
          downloadTextFile('cos-modality-definitions.json', JSON.stringify(definitions, null, 2), 'application/json;charset=utf-8');
        } else {
          downloadTextFile('cos-modality-definitions.csv', modalityDefinitionsToCsv(definitions), 'text/csv;charset=utf-8');
        }
        setModalityDefinitionsStatus(`Exported ${definitions.length} modality definitions.`);
      })
      .catch(err => {
        alert('Modality definitions export failed: ' + err.message);
        setModalityDefinitionsStatus('Modality definitions export failed.', true);
      });
  }

  function parseModalityDefinitionsFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read selected file'));
      reader.onload = ev => {
        try {
          const text = String(ev.target.result || '');
          if (file.name.toLowerCase().endsWith('.json')) {
            const parsed = JSON.parse(text);
            resolve(Array.isArray(parsed) ? parsed : parsed.data || parsed.definitions || []);
            return;
          }
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (parsed.errors?.length) {
            reject(new Error(parsed.errors[0].message || 'CSV parse failed'));
            return;
          }
          resolve(parsed.data || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  async function importModalityDefinitions(file) {
    const password = await getModalityImportPassword();
    if (!password) return;
    try {
      const parsedDefinitions = await parseModalityDefinitionsFile(file);
      const definitions = normalizeModalityDefinitions(parsedDefinitions);
      if (!definitions.length) {
        throw new Error('No valid modality definitions found. Include Code and Modality columns, or Code and Omit for omitted values.');
      }
      const res = await fetch(`${BACKEND_BASE_URL}/api/modalities/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, definitions })
      });
      if (!res.ok) throw new Error(res.status === 403 ? 'Unauthorized' : 'Import failed');
      const payload = await res.json();
      setModalityDefinitions(payload.data || definitions);
      refreshModalityDefinitionsViews(payload.lastUpdated);
      alert(`Imported ${payload.count || definitions.length} modality definitions.`);
    } catch (err) {
      alert('Modality definitions import failed: ' + err.message);
      setModalityDefinitionsStatus('Modality definitions import failed.', true);
    }
  }

  function setCalGetcStatus(message, isError = false) {
    const status = document.getElementById('cal-getc-status');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#b91c1c' : '';
  }

  function saveCalGetcBackup(mapping, lastUpdated = null) {
    const normalized = normalizeCalGetcMapping(mapping);
    if (!normalized.length) return;
    try {
      localStorage.setItem(CAL_GETC_BACKUP_KEY, JSON.stringify({
        lastUpdated: lastUpdated || new Date().toISOString(),
        data: normalized
      }));
    } catch (err) {
      console.warn('CAL-GETC browser backup failed:', err);
    }
  }

  function readCalGetcBackup() {
    try {
      const payload = JSON.parse(localStorage.getItem(CAL_GETC_BACKUP_KEY) || 'null');
      const mapping = normalizeCalGetcMapping(payload?.data || []);
      return mapping.length ? { data: mapping, lastUpdated: payload.lastUpdated || null } : null;
    } catch (err) {
      console.warn('CAL-GETC browser backup read failed:', err);
      return null;
    }
  }

  function refreshCalGetcViews(lastUpdated = null) {
    refreshCalGetcFilterControls();
    feedHeatmapTool(getScheduleAnalysisRows());
    initModalityFilters();
    if (document.getElementById('viewSelect').value === 'modality') {
      renderModalityTool();
    }
    if (document.getElementById('viewSelect').value === 'linechart') {
      renderLineChart();
    }
    const stamp = lastUpdated ? ` Updated ${new Date(lastUpdated).toLocaleString()}.` : '';
    setCalGetcStatus(`${calGetcMapping.length} CAL-GETC mappings loaded.${stamp}`);
  }

  function loadCalGetcMappingFromBackend() {
    fetch(`${BACKEND_BASE_URL}/api/cal-getc`)
      .then(res => {
        if (!res.ok) throw new Error('CAL-GETC mapping fetch failed');
        return res.json();
      })
      .then(({ data, lastUpdated }) => {
        const backendMapping = normalizeCalGetcMapping(data);
        if (backendMapping.length) {
          setCalGetcMapping(backendMapping);
          saveCalGetcBackup(backendMapping, lastUpdated);
          refreshCalGetcViews(lastUpdated);
          return;
        }
        const fallback = normalizeCalGetcMapping(window.CAL_GETC_MAPPING || []);
        if (fallback.length) {
          setCalGetcMapping(fallback);
          refreshCalGetcViews(lastUpdated);
        }
      })
      .catch(err => {
        const backup = readCalGetcBackup();
        if (backup) {
          setCalGetcMapping(backup.data);
          refreshCalGetcViews(backup.lastUpdated);
          setCalGetcStatus(`Using this browser's saved CAL-GETC mapping because backend fetch failed. ${err.message}`, true);
          return;
        }
        setCalGetcMapping(window.CAL_GETC_MAPPING || []);
        refreshCalGetcViews();
        setCalGetcStatus(`Using built-in CAL-GETC mapping. ${err.message}`, true);
      });
  }

  function exportCalGetcMapping(format = 'csv') {
    fetch(`${BACKEND_BASE_URL}/api/cal-getc`)
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.json();
      })
      .then(({ data }) => {
        const mapping = normalizeCalGetcMapping(data).length ? normalizeCalGetcMapping(data) : calGetcMapping;
        if (format === 'json') {
          downloadTextFile('cos-cal-getc-mapping.json', JSON.stringify(mapping, null, 2), 'application/json;charset=utf-8');
        } else {
          downloadTextFile('cos-cal-getc-mapping.csv', calGetcMappingToCsv(mapping), 'text/csv;charset=utf-8');
        }
        setCalGetcStatus(`Exported ${mapping.length} CAL-GETC mappings.`);
      })
      .catch(err => {
        alert('CAL-GETC export failed: ' + err.message);
        setCalGetcStatus('CAL-GETC export failed.', true);
      });
  }

  function parseCalGetcMappingFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read selected file'));
      reader.onload = ev => {
        try {
          const text = String(ev.target.result || '');
          if (file.name.toLowerCase().endsWith('.json')) {
            const parsed = JSON.parse(text);
            resolve(Array.isArray(parsed) ? parsed : parsed.data || parsed.mapping || []);
            return;
          }
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (parsed.errors?.length) {
            reject(new Error(parsed.errors[0].message || 'CSV parse failed'));
            return;
          }
          resolve(parsed.data || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  async function importCalGetcMapping(file) {
    const password = await getCalGetcImportPassword();
    if (!password) return;
    try {
      const parsedMapping = await parseCalGetcMappingFile(file);
      const mapping = normalizeCalGetcMapping(parsedMapping);
      if (!mapping.length) {
        throw new Error('No valid CAL-GETC mappings found. Include Code plus Areas and/or Divisions columns.');
      }
      const res = await fetch(`${BACKEND_BASE_URL}/api/cal-getc/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, mapping })
      });
      if (!res.ok) throw new Error(res.status === 403 ? 'Unauthorized' : 'Import failed');
      const payload = await res.json();
      setCalGetcMapping(payload.data || mapping);
      saveCalGetcBackup(payload.data || mapping, payload.lastUpdated);
      refreshCalGetcViews(payload.lastUpdated);
      alert(`Imported ${payload.count || mapping.length} CAL-GETC mappings.`);
    } catch (err) {
      alert('CAL-GETC import failed: ' + err.message);
      setCalGetcStatus('CAL-GETC import failed.', true);
    }
  }

  function setCurriculumCrosswalkStatus(message, isError = false) {
    const status = document.getElementById('curriculum-crosswalk-status');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#b91c1c' : '';
  }

  function saveCurriculumCrosswalkBackup(crosswalk, lastUpdated = null) {
    const normalized = normalizeCurriculumCrosswalk(crosswalk);
    if (!normalized.length) return;
    try {
      localStorage.setItem(CURRICULUM_CROSSWALK_BACKUP_KEY, JSON.stringify({
        lastUpdated: lastUpdated || new Date().toISOString(),
        data: normalized
      }));
    } catch (err) {
      console.warn('Curriculum crosswalk browser backup failed:', err);
    }
  }

  function readCurriculumCrosswalkBackup() {
    try {
      const payload = JSON.parse(localStorage.getItem(CURRICULUM_CROSSWALK_BACKUP_KEY) || 'null');
      const crosswalk = normalizeCurriculumCrosswalk(payload?.data || []);
      return crosswalk.length ? { data: crosswalk, lastUpdated: payload.lastUpdated || null } : null;
    } catch (err) {
      console.warn('Curriculum crosswalk browser backup read failed:', err);
      return null;
    }
  }

  function refreshCurriculumCrosswalkViews(lastUpdated = null) {
    const stamp = lastUpdated ? ` Updated ${new Date(lastUpdated).toLocaleString()}.` : '';
    setCurriculumCrosswalkStatus(`${curriculumCrosswalk.length} crosswalk rows loaded.${stamp}`);
  }

  function loadCurriculumCrosswalkFromBackend() {
    fetch(`${BACKEND_BASE_URL}/api/curriculum-crosswalk`)
      .then(res => {
        if (!res.ok) throw new Error('Curriculum crosswalk fetch failed');
        return res.json();
      })
      .then(({ data, lastUpdated }) => {
        const backendCrosswalk = normalizeCurriculumCrosswalk(data);
        if (backendCrosswalk.length) {
          setCurriculumCrosswalk(backendCrosswalk);
          saveCurriculumCrosswalkBackup(backendCrosswalk, lastUpdated);
          refreshCurriculumCrosswalkViews(lastUpdated);
          return;
        }
        const fallback = normalizeCurriculumCrosswalk(window.CURRICULUM_CROSSWALK || []);
        setCurriculumCrosswalk(fallback);
        refreshCurriculumCrosswalkViews(lastUpdated);
      })
      .catch(err => {
        const backup = readCurriculumCrosswalkBackup();
        if (backup) {
          setCurriculumCrosswalk(backup.data);
          refreshCurriculumCrosswalkViews(backup.lastUpdated);
          setCurriculumCrosswalkStatus(`Using this browser's saved curriculum crosswalk because backend fetch failed. ${err.message}`, true);
          return;
        }
        setCurriculumCrosswalk(window.CURRICULUM_CROSSWALK || []);
        refreshCurriculumCrosswalkViews();
        setCurriculumCrosswalkStatus(`Using built-in curriculum crosswalk. ${err.message}`, true);
      });
  }

  function exportCurriculumCrosswalk(format = 'csv') {
    fetch(`${BACKEND_BASE_URL}/api/curriculum-crosswalk`)
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.json();
      })
      .then(({ data }) => {
        const crosswalk = normalizeCurriculumCrosswalk(data).length ? normalizeCurriculumCrosswalk(data) : curriculumCrosswalk;
        if (format === 'json') {
          downloadTextFile('cos-curriculum-crosswalk.json', JSON.stringify(crosswalk, null, 2), 'application/json;charset=utf-8');
        } else {
          downloadTextFile('cos-curriculum-crosswalk.csv', curriculumCrosswalkToCsv(crosswalk), 'text/csv;charset=utf-8');
        }
        setCurriculumCrosswalkStatus(`Exported ${crosswalk.length} crosswalk rows.`);
      })
      .catch(err => {
        alert('Curriculum crosswalk export failed: ' + err.message);
        setCurriculumCrosswalkStatus('Curriculum crosswalk export failed.', true);
      });
  }

  function parseCurriculumCrosswalkFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read selected file'));
      reader.onload = ev => {
        try {
          const text = String(ev.target.result || '');
          if (file.name.toLowerCase().endsWith('.json')) {
            const parsed = JSON.parse(text);
            resolve(Array.isArray(parsed) ? parsed : parsed.data || parsed.crosswalk || []);
            return;
          }
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (parsed.errors?.length) {
            reject(new Error(parsed.errors[0].message || 'CSV parse failed'));
            return;
          }
          resolve(parsed.data || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  async function importCurriculumCrosswalk(file) {
    const password = await getCurriculumCrosswalkImportPassword();
    if (!password) return;
    try {
      const parsedCrosswalk = await parseCurriculumCrosswalkFile(file);
      const crosswalk = normalizeCurriculumCrosswalk(parsedCrosswalk);
      if (!crosswalk.length) {
        throw new Error('No valid crosswalk rows found. Include Source Course and Synonym Course columns.');
      }
      const res = await fetch(`${BACKEND_BASE_URL}/api/curriculum-crosswalk/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, crosswalk })
      });
      if (!res.ok) throw new Error(res.status === 403 ? 'Unauthorized' : 'Import failed');
      const payload = await res.json();
      setCurriculumCrosswalk(payload.data || crosswalk);
      saveCurriculumCrosswalkBackup(payload.data || crosswalk, payload.lastUpdated);
      refreshCurriculumCrosswalkViews(payload.lastUpdated);
      alert(`Imported ${payload.count || crosswalk.length} curriculum crosswalk rows.`);
    } catch (err) {
      alert('Curriculum crosswalk import failed: ' + err.message);
      setCurriculumCrosswalkStatus('Curriculum crosswalk import failed.', true);
    }
  }

  function parseRoomCatalogFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read selected file'));
      reader.onload = ev => {
        try {
          const text = String(ev.target.result || '');
          if (file.name.toLowerCase().endsWith('.json')) {
            const parsed = JSON.parse(text);
            resolve(Array.isArray(parsed) ? parsed : parsed.data || parsed.rooms || []);
            return;
          }
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (parsed.errors?.length) {
            reject(new Error(parsed.errors[0].message || 'CSV parse failed'));
            return;
          }
          resolve(parsed.data || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  async function importRoomCatalog(file) {
    const password = await getRoomCatalogPassword('import');
    if (!password) return;
    try {
      const parsedRooms = await parseRoomCatalogFile(file);
      const knownPriorityDivisions = uniqueFilterOptions(currentData.map(getDivision));
      const rooms = normalizeRoomCatalog(parsedRooms, knownPriorityDivisions);
      if (!rooms.length) {
        throw new Error('No valid rooms found. Include Building and Room columns.');
      }
      const priorityWarnings = roomPriorityWarnings(parsedRooms, knownPriorityDivisions);
      const res = await fetch(`${BACKEND_BASE_URL}/api/rooms/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, rooms })
      });
      if (!res.ok) throw new Error(res.status === 403 ? 'Unauthorized' : 'Import failed');
      const payload = await res.json();
      setRoomCatalog(payload.data || rooms);
      saveRoomCatalogBackup(payload.data || rooms, payload.lastUpdated);
      refreshRoomCatalogViews(payload.lastUpdated);
      if (priorityWarnings.length) {
        setRoomCatalogStatus(`Imported ${payload.count || rooms.length} rooms. Unknown Priority Division warning for ${priorityWarnings.length} value(s).`, true);
      }
      alert(`Imported ${payload.count || rooms.length} rooms.${priorityWarnings.length ? ` ${priorityWarnings.length} Unknown Priority Division warning(s).` : ''}`);
    } catch (err) {
      alert('Room catalog import failed: ' + err.message);
      setRoomCatalogStatus('Room catalog import failed.', true);
    }
  }

  // --- Backend fetch instead of localStorage ---
  function loadScheduleFromBackend(term) {
    fetch(`${BACKEND_BASE_URL}/api/schedule/${encodeURIComponent(term)}`)
      .then(res => res.json())
      .then(({ data, lastUpdated }) => {
        // PATCH: Normalize backend data fields to frontend expectations
        currentData = (data || []).map(normalizeRow);
        tsDiv.textContent = lastUpdated ? `Last upload: ${new Date(lastUpdated).toLocaleString()}` : '';
        buildRoomDropdowns();
        renderSchedule();
        feedHeatmapTool(getScheduleAnalysisRows());
        initUtilizationFilters();
        initModalityFilters();
        if (isUtilizationViewActive()) {
          renderUtilizationMap();
        }
        if (document.getElementById('viewSelect').value === 'modality') {
          renderModalityTool();
        }
        if (document.getElementById('viewSelect').value === 'fullcalendar') {
          renderFullCalendar();
        }
      });
  }

  // --- POST CSV to backend, not localStorage ---
  function uploadScheduleToBackend(term, csvString, password) {
    fetch(`${BACKEND_BASE_URL}/api/schedule/${encodeURIComponent(term)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvString, password })
    })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then(() => {
        alert('Upload successful!');
        loadScheduleFromBackend(term);
      })
      .catch(err => alert('Upload failed: ' + err.message));
  }

  function selectTerm(term, tabElem) {
    currentTerm = term;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElem.classList.add('active');
    clearSchedule();
    setupUpload();
    loadScheduleFromBackend(term);
  }

  function setupUpload() {
    roomDiv.replaceChildren();
    uploadDiv.replaceChildren();
    const label = document.createElement('label');
    const title = document.createElement('strong');
    title.textContent = `Upload CSV for ${currentTerm}`;
    label.appendChild(title);
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'file-input';
    input.accept = '.csv';
    label.appendChild(input);
    uploadDiv.appendChild(label);
    input.onchange = async e => {
      const password = await requestPassword('Enter upload password:', 'Upload cancelled.');
      if (!password) {
        e.target.value = '';
        return;
      }
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const csvString = ev.target.result;
        uploadScheduleToBackend(currentTerm, csvString, password); // reloads after upload
      };
      reader.readAsText(file);
    };
  }

  function buildRoomDropdowns() {
    // For snapshot
    const combos = getUniqueRooms(currentData);
    const roomOptions = combos.map(room => ({ value: room, label: getRoomDisplay(room) }));
    if (roomDiv) {
      roomDiv.replaceChildren();
      const label = document.createElement('label');
      label.append('Filter Bldg-Room: ');
      snapshotRoomFilter = document.createElement('select');
      snapshotRoomFilter.id = 'room-select';
      resetSelect(snapshotRoomFilter, roomOptions);
      label.appendChild(snapshotRoomFilter);
      roomDiv.appendChild(label);
      snapshotRoomFilter.onchange = renderSchedule;
    }

    // For fullcalendar
    const calendarRoomSelect = document.getElementById('calendar-room-select');
    if (calendarRoomSelect) {
      resetSelect(calendarRoomSelect, roomOptions);
      calendarRoomFilter = calendarRoomSelect;
      calendarRoomFilter.onchange = renderFullCalendar;
    }
  }

  function clearSchedule() {
    table.innerHTML = '';
    container.querySelectorAll('.class-block').forEach(e => e.remove());
    const header = table.insertRow();
    header.insertCell().outerHTML = '<th>Time</th>';
    daysOfWeek.forEach(d => header.insertCell().outerHTML = `<th>${d}</th>`);
    for (let t = 360; t <= 22*60; t += 30) {
      const row = table.insertRow();
      const hh = Math.floor(t/60), mm = t%60;
      const h12 = ((hh+11)%12)+1, ap = hh<12?'AM':'PM';
      row.insertCell().outerHTML = `<th>${h12}:${('0'+mm).slice(-2)}${ap}</th>`;
      daysOfWeek.forEach(() => row.insertCell());
    }
  }

  function renderSchedule() {
    // --- NEW: Large room header above grid ---
    const selectedRoom = snapshotRoomFilter?.value || 'All';
    if (roomHeaderDiv) {
      if (selectedRoom !== 'All') {
        roomHeaderDiv.textContent = getRoomDisplay(selectedRoom);
        roomHeaderDiv.style.display = 'block';
      } else {
        roomHeaderDiv.textContent = '';
        roomHeaderDiv.style.display = 'none';
      }
    }
    // --- END HEADER CODE ---

    clearSchedule();
    const filt = selectedRoom;
    const data = (filt === 'All'
      ? currentData
      : currentData.filter(i => getRoomKey(i) === filt)
    ).filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM)); // Omit invalid rooms
    const rect = container.getBoundingClientRect();
    daysOfWeek.forEach((day, dIdx) => {
      let evs = data
        .filter(i => Array.isArray(i.Days) ? i.Days.includes(day) : false)
        .filter(i => parseHour(i.Start_Time) !== parseHour(i.End_Time))
        .map(i => ({
          ...i,
          startMin: parseTime(i.Start_Time),
          endMin:   parseTime(i.End_Time)
        }))
        .sort((a,b) => a.startMin - b.startMin);
      const seen = new Set();
      evs = evs.filter(ev => {
        const key = [
          ev.CRN,
          ev.Start_Time,
          ev.End_Time,
          Array.isArray(ev.Days) ? ev.Days.join(',') : ev.Days,
          ev.Building || ev.BUILDING,
          ev.Room || ev.ROOM
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      evs.forEach((ev, i) => {
        ev.overlaps = evs.filter(other =>
          !(other.endMin <= ev.startMin || other.startMin >= ev.endMin)
        );
        ev.overlaps.sort((a, b) => a.startMin - b.startMin);
      });

      evs.forEach(ev => {
        let columns = [];
        ev.overlaps.forEach(overlapEv => {
          let placed = false;
          for (let c = 0; c < columns.length; c++) {
            if (columns[c][columns[c].length-1].endMin <= overlapEv.startMin) {
              columns[c].push(overlapEv);
              placed = true;
              break;
            }
          }
          if (!placed) columns.push([overlapEv]);
        });
        for (let c = 0; c < columns.length; c++) {
          if (columns[c].includes(ev)) {
            ev.colIndex = c;
            ev.colCount = columns.length;
            break;
          }
        }
      });

      evs.forEach(ev => {
        const offset = ev.startMin - 360;
        const rowIndex = Math.floor(offset/30) + 1;
        const rem = offset % 30;
        if (rowIndex < 1 || rowIndex >= table.rows.length) return;
        const cell = table.rows[rowIndex].cells[dIdx+1];
        const cr   = cell.getBoundingClientRect();
        const topPx    = cr.top - rect.top + (rem/30)*cr.height;
        const leftPx   = cr.left - rect.left + (ev.colCount === 1 ? 0 : ev.colIndex*(cr.width/ev.colCount));
        const widthPx  = (ev.colCount === 1) ? cr.width : cr.width / ev.colCount;
        const heightPx = ((ev.endMin-ev.startMin)/30)*cr.height;
        const b = document.createElement('div');
        b.className = 'class-block';
        b.style.top    = `${topPx}px`;
        b.style.left   = `${leftPx}px`;
        b.style.width  = `${widthPx}px`;
        b.style.height = `${heightPx}px`;

        const title = extractField(ev, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
        const instructor = extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
        const startDate = extractField(ev, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
        const endDate = extractField(ev, ['End_Date', 'End Date', 'End', 'end_date', 'end']);

        appendLine(b, ev.Subject_Course || '', true);
        appendLine(b, `CRN: ${ev.CRN || ''}`);
        appendLine(b, `${format12(ev.Start_Time)} - ${format12(ev.End_Time)}`);
        appendLine(b, instructor);

        b.addEventListener('mouseenter', function(e) {
          const tooltip = document.getElementById('class-block-tooltip');
          setTooltipLines(tooltip, [
            { text: ev.Subject_Course || '', bold: true },
            { text: title },
            { text: `CRN: ${ev.CRN || ''}` },
            { text: `Time: ${format12(ev.Start_Time)} - ${format12(ev.End_Time)}` },
            { text: `Date Range: ${startDate || 'N/A'} - ${endDate || 'N/A'}` },
            { text: `Instructor: ${instructor || 'N/A'}` }
          ]);
          tooltip.style.display = 'block';
          const rect = b.getBoundingClientRect();
          tooltip.style.left = (rect.right + window.scrollX + 8) + 'px';
          tooltip.style.top = (rect.top + window.scrollY - 10) + 'px';
        });
        b.addEventListener('mouseleave', function() {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.display = 'none';
        });
        b.addEventListener('mousemove', function(e) {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.left = (e.pageX + 12) + 'px';
          tooltip.style.top = (e.pageY + 12) + 'px';
        });

        container.appendChild(b);
      });
    });
  }

  function handleAvailability() {
    resultsDiv.textContent = '';
    const days = Array.from(
      document.querySelectorAll('#availability-ui .days input:checked')
    ).map(cb => cb.value);
    const start = startInput.value, end = endInput.value;
    if (!days.length || !start || !end) {
      resultsDiv.textContent = 'Please select at least one day and both start/end times.';
      return;
    }
    const toMin = t => {
      const [h,m] = t.split(':').map(Number);
      return h*60 + m;
    };
    const sMin = toMin(start), eMin = toMin(end);
    const isShortTerm = availTermMode?.value === 'short';
    const requestedStart = isShortTerm ? parseDateOnly(availDateStart?.value) : null;
    const requestedEnd = isShortTerm ? parseDateOnly(availDateEnd?.value) : null;
    if (isShortTerm && (!requestedStart || !requestedEnd)) {
      resultsDiv.textContent = 'Please enter a start and end date for a short-term availability search.';
      return;
    }
    if (isShortTerm && requestedStart > requestedEnd) {
      resultsDiv.textContent = 'The short-term start date must be on or before the end date.';
      return;
    }
    const catalogRooms = roomCatalog.length
      ? getRoomCatalogEntries()
      : getUniqueRooms(currentData).map(key => ({ buildingRoom: key, campus: '', type: '', capacity: null }));
    const selectedCampus = availCampusSelect?.value || '';
    const selectedType = availTypeSelect?.value || '';
    const minCapacity = Number(availCapacityInput?.value || 0);
    const occ   = new Set();
    currentData.forEach(i => {
      if (!isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM)) return;
      if (Array.isArray(i.Days) && i.Days.some(d => days.includes(d))) {
        const si = parseTime(i.Start_Time), ei = parseTime(i.End_Time);
        if (!(ei <= sMin || si >= eMin)) {
          if (isShortTerm && !sectionOverlapsRequestedDates(i, requestedStart, requestedEnd)) return;
          occ.add(getRoomKey(i));
        }
      }
    });
    const avail = catalogRooms
      .filter(room => !occ.has(room.buildingRoom))
      .filter(room => !selectedCampus || room.campus === selectedCampus)
      .filter(room => !selectedType || room.type === selectedType)
      .filter(room => !minCapacity || (room.capacity != null && room.capacity >= minCapacity));
    if (avail.length) {
      const list = document.createElement('ul');
      avail.forEach(room => {
        const item = document.createElement('li');
        item.textContent = getRoomDisplay(room.buildingRoom);
        list.appendChild(item);
      });
      resultsDiv.replaceChildren(list);
    } else {
      resultsDiv.textContent = 'No rooms available.';
    }
  }

  function initUtilizationFilters() {
    if (!utilizationCampusSelect || !utilizationTypeSelect) return;
    const rooms = getRoomCatalogEntries().filter(room => !isExcludedUtilizationRoom(room));
    const campuses = [...new Set(rooms.map(room => room.campus).filter(Boolean))].sort();
    const types = [...new Set(rooms.map(room => room.type).filter(Boolean))].sort();
    const buildings = [...new Set(rooms.map(room => room.building).filter(Boolean))].sort();
    const campusValue = utilizationCampusSelect.value;
    const typeValue = utilizationTypeSelect.value;
    const buildingValue = utilizationBuildingSelect?.value || '';
    resetSelect(utilizationCampusSelect, campuses, 'All', '');
    resetSelect(utilizationTypeSelect, types, 'All', '');
    if (utilizationBuildingSelect) resetSelect(utilizationBuildingSelect, buildings, 'All', '');
    if (campuses.includes(campusValue)) utilizationCampusSelect.value = campusValue;
    if (types.includes(typeValue)) utilizationTypeSelect.value = typeValue;
    if (buildings.includes(buildingValue) && utilizationBuildingSelect) utilizationBuildingSelect.value = buildingValue;
  }

  function overlapMinutes(startMin, endMin, windowStart, windowEnd) {
    return Math.max(0, Math.min(endMin, windowEnd) - Math.max(startMin, windowStart));
  }

  function isUtilizationPeakDay(day) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'MO', 'TU', 'WE', 'TH'].includes(day);
  }

  const utilizationConfig = {
    instructionalStart: 8 * 60,
    instructionalEnd: 17 * 60,
    primeStart: 9 * 60,
    primeEnd: 15 * 60,
    blockMinutes: 30,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    primeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    weights: {
      overall: 0.4,
      prime: 0.25,
      distribution: 0.2,
      fragmentation: 0.15
    }
  };

  function utilizationDayName(day) {
    const aliases = {
      MO: 'Monday',
      MON: 'Monday',
      MONDAY: 'Monday',
      TU: 'Tuesday',
      TUE: 'Tuesday',
      TUESDAY: 'Tuesday',
      WE: 'Wednesday',
      WED: 'Wednesday',
      WEDNESDAY: 'Wednesday',
      TH: 'Thursday',
      R: 'Thursday',
      THU: 'Thursday',
      THURSDAY: 'Thursday',
      FR: 'Friday',
      FRI: 'Friday',
      FRIDAY: 'Friday'
    };
    return aliases[String(day || '').trim().toUpperCase()] || day;
  }

  function pctScore(value) {
    return Math.max(0, Math.min(1, value || 0));
  }

  function utilizationAvailableMinutes() {
    return utilizationConfig.days.length * (utilizationConfig.instructionalEnd - utilizationConfig.instructionalStart);
  }

  function utilizationPrimeAvailableMinutes() {
    return utilizationConfig.primeDays.length * (utilizationConfig.primeEnd - utilizationConfig.primeStart);
  }

  function utilizationAvailableBlocks() {
    return utilizationConfig.days.length * ((utilizationConfig.instructionalEnd - utilizationConfig.instructionalStart) / utilizationConfig.blockMinutes);
  }

  function utilizationBlockStarts(startMin, endMin, windowStart = utilizationConfig.instructionalStart, windowEnd = utilizationConfig.instructionalEnd) {
    const blocks = [];
    for (let block = windowStart; block < windowEnd; block += utilizationConfig.blockMinutes) {
      if (overlapMinutes(startMin, endMin, block, block + utilizationConfig.blockMinutes) > 0) blocks.push(block);
    }
    return blocks;
  }

  function contiguousSegmentCount(blocks) {
    const sorted = [...new Set(blocks)].sort((a, b) => a - b);
    if (!sorted.length) return 0;
    let segments = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] - sorted[i - 1] > utilizationConfig.blockMinutes) segments += 1;
    }
    return segments;
  }

  function longestEmptyPrimeBlockHours(room) {
    let longest = 0;
    utilizationConfig.primeDays.forEach(day => {
      let current = 0;
      for (let block = utilizationConfig.primeStart; block < utilizationConfig.primeEnd; block += utilizationConfig.blockMinutes) {
        if (room.activePrimeBlocks.has(`${day}|${block}`)) {
          longest = Math.max(longest, current);
          current = 0;
        } else {
          current += utilizationConfig.blockMinutes;
        }
      }
      longest = Math.max(longest, current);
    });
    return longest / 60;
  }

  function roomUtilizationRecommendation(room) {
    if (room.totalMinutes === 0) return 'Available for additional scheduling.';
    if (room.overallUtilization >= 0.65 && room.primeUtilization >= 0.65 && room.distributionScore >= 0.45) {
      return 'Highly utilized and well distributed.';
    }
    if (room.primeUtilization >= 0.5 && room.overallUtilization < 0.35) {
      return 'Prime-time demand exists, but room is underutilized outside peak periods.';
    }
    if (room.overallUtilization < 0.35 && room.opportunityScore >= 0.65) {
      return 'Available for additional scheduling.';
    }
    if (room.distributionScore < 0.3) {
      return 'Usage is concentrated; review for schedule balancing.';
    }
    if (room.fragmentationScore < 0.55) {
      return 'Fragmented usage; review for cleaner scheduling blocks.';
    }
    return 'Utilization is balanced for the loaded schedule.';
  }

  function getRoomTypeTarget(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('meeting') || normalized.includes('study')) return 0.25;
    if (normalized.includes('exercise')) return 0.35;
    if (normalized.includes('lab') || normalized.includes('activity')) return 0.45;
    if (normalized.includes('computer')) return 0.55;
    return 0.6;
  }

  function getCapacityExpectation(capacity) {
    if (capacity == null) return { factor: 0.85, label: 'Unknown capacity' };
    if (capacity < 20) return { factor: 0.35, label: 'Very small room' };
    if (capacity < 30) return { factor: 0.55, label: 'Small room' };
    if (capacity < 40) return { factor: 0.8, label: 'Moderate room' };
    return { factor: 1, label: 'Standard capacity' };
  }

  function isExcludedUtilizationRoom(room) {
    return String(room?.building || '').trim().toUpperCase() === 'VISFSC' ||
      String(room?.buildingRoom || '').trim().toUpperCase().startsWith('VISFSC-');
  }

  function getUtilizationStatus(room) {
    if (room.totalMinutes === 0) {
      return {
        label: 'Not Utilized',
        color: '#dc2626',
        reason: 'No scheduled room use was found in the loaded term data.'
      };
    }
    if (room.score < 0.35) {
      return {
        label: 'Under Utilized',
        color: '#2563eb',
        reason: 'Low component score across overall use, prime-time use, distribution, or schedule cleanliness.'
      };
    }
    if (room.score < 0.6) {
      return {
        label: 'Moderately Utilized',
        color: '#7c3aed',
        reason: 'Some use is present, but one or more utilization components are below the preferred range.'
      };
    }
    if (room.score >= 0.8) {
      return {
        label: 'Very Efficient',
        color: '#059669',
        reason: 'Strong use across total hours, prime-time hours, and distribution.'
      };
    }
    return {
      label: 'Efficient',
      color: '#0d9488',
      reason: 'Component utilization is aligned with expectations for this room.'
    };
  }

  function calculateRoomUtilization() {
    const excludeTutoringOpenLab = document.getElementById('utilization-exclude-tutoring-openlab')?.checked !== false;
    const rooms = getRoomCatalogEntries().filter(room => !isExcludedUtilizationRoom(room)).map(room => ({
      ...room,
      sections: 0,
      totalMinutes: 0,
      peakMinutes: 0,
      activeDays: new Set(),
      activeBlocks: new Set(),
      activePrimeBlocks: new Set(),
      blocksByDay: new Map(),
      meetingKeys: new Set()
    }));
    const roomMap = new Map(rooms.map(room => [room.buildingRoom, room]));
    currentData.forEach(section => {
      const canonical = getCanonicalSection(section);
      if (excludeTutoringOpenLab && isTutoringOpenLabSection(section)) return;
      const building = canonical?.building || section.Building || section.BUILDING;
      const roomOnly = canonical?.roomOnly || section.Room || section.ROOM;
      if (!isValidRoom(building, roomOnly)) return;
      const key = canonical?.building && canonical?.roomOnly ? `${canonical.building}-${canonical.roomOnly}` : getRoomKey(section);
      if (String(key || '').toUpperCase().startsWith('VISFSC-')) return;
      if (!roomMap.has(key)) {
        const fallback = { buildingRoom: key, campus: canonical?.campus || '', building: building || '', room: roomOnly || '', type: '', capacity: null, sections: 0, totalMinutes: 0, peakMinutes: 0, activeDays: new Set(), activeBlocks: new Set(), activePrimeBlocks: new Set(), blocksByDay: new Map(), meetingKeys: new Set() };
        roomMap.set(key, fallback);
        rooms.push(fallback);
      }
      const room = roomMap.get(key);
      const days = Array.isArray(canonical?.days) ? canonical.days : (Array.isArray(section.Days) ? section.Days : []);
      const startMin = parseTime(canonical?.start || section.Start_Time || '');
      const endMin = parseTime(canonical?.end || section.End_Time || '');
      if (!days.length || !Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return;
      days.map(utilizationDayName).forEach(day => {
        if (!utilizationConfig.days.includes(day)) return;
        const meetingKey = [
          extractField(section, ['Term', 'TERM', 'term']) || currentTerm || '',
          canonical?.crn || extractField(section, ['CRN', 'Course Reference Number']) || '',
          key,
          day,
          startMin,
          endMin
        ].join('|');
        if (room.meetingKeys.has(meetingKey)) return;
        room.meetingKeys.add(meetingKey);
        const scheduledMinutes = overlapMinutes(startMin, endMin, utilizationConfig.instructionalStart, utilizationConfig.instructionalEnd);
        if (!scheduledMinutes) return;
        const primeMinutes = isUtilizationPeakDay(day) ? overlapMinutes(startMin, endMin, utilizationConfig.primeStart, utilizationConfig.primeEnd) : 0;
        room.sections += 1;
        room.totalMinutes += scheduledMinutes;
        room.peakMinutes += primeMinutes;
        room.activeDays.add(day);
        const blocks = utilizationBlockStarts(startMin, endMin);
        const dayBlocks = room.blocksByDay.get(day) || new Set();
        blocks.forEach(block => {
          room.activeBlocks.add(`${day}|${block}`);
          dayBlocks.add(block);
        });
        if (isUtilizationPeakDay(day)) {
          utilizationBlockStarts(startMin, endMin, utilizationConfig.primeStart, utilizationConfig.primeEnd)
            .forEach(block => room.activePrimeBlocks.add(`${day}|${block}`));
        }
        room.blocksByDay.set(day, dayBlocks);
      });
    });

    const availableMinutes = utilizationAvailableMinutes();
    const availablePrimeMinutes = utilizationPrimeAvailableMinutes();
    const availableBlocks = utilizationAvailableBlocks();
    return rooms
      .filter(room => room.buildingRoom && room.buildingRoom !== 'undefined-undefined')
      .map(room => {
        const totalHours = room.totalMinutes / 60;
        const peakHours = room.peakMinutes / 60;
        const availableHours = availableMinutes / 60;
        const overallUtilization = pctScore(room.totalMinutes / availableMinutes);
        const primeUtilization = pctScore(room.peakMinutes / availablePrimeMinutes);
        const activeDaysCount = room.activeDays.size;
        const activeTimeBlocks = room.activeBlocks.size;
        const daySpread = activeDaysCount / utilizationConfig.days.length;
        const blockSpread = activeTimeBlocks / availableBlocks;
        const distributionScore = pctScore((daySpread * 0.55) + (blockSpread * 0.45));
        const segmentCount = [...room.blocksByDay.values()].reduce((count, blocks) => count + contiguousSegmentCount(blocks), 0);
        const extraSegments = Math.max(0, segmentCount - activeDaysCount);
        const fragmentationScore = activeTimeBlocks ? pctScore(1 - (extraSegments / Math.max(activeTimeBlocks, 1))) : 0;
        const opportunityScore = pctScore(((1 - primeUtilization) * 0.6) + ((1 - overallUtilization) * 0.4));
        const score =
          (overallUtilization * utilizationConfig.weights.overall) +
          (primeUtilization * utilizationConfig.weights.prime) +
          (distributionScore * utilizationConfig.weights.distribution) +
          (fragmentationScore * utilizationConfig.weights.fragmentation);
        const peakShare = room.totalMinutes ? room.peakMinutes / room.totalMinutes : 0;
        const longestEmptyPrimeBlock = longestEmptyPrimeBlockHours(room);
        const smallRoomCaution = room.capacity != null && room.capacity < 20 && totalHours >= 12;
        const enriched = {
          ...room,
          score,
          totalHours,
          scheduledHours: totalHours,
          availableHours,
          peakHours,
          primeHours: peakHours,
          overallUtilization,
          primeUtilization,
          distributionScore,
          fragmentationScore,
          opportunityScore,
          activeDaysCount,
          activeTimeBlocks,
          longestEmptyPrimeBlock,
          peakShare,
          capacityLabel: getCapacityExpectation(room.capacity).label,
          smallRoomCaution
        };
        enriched.recommendation = roomUtilizationRecommendation(enriched);
        return { ...enriched, status: getUtilizationStatus(enriched) };
      })
      .sort(sortRoomUtilization);
  }

  function sortRoomUtilization(a, b) {
    const sortBy = utilizationSortSelect?.value || 'score';
    const compareNumber = (left, right) => (right || 0) - (left || 0);
    const sorters = {
      score: () => compareNumber(a.score, b.score),
      overall: () => compareNumber(a.overallUtilization, b.overallUtilization),
      prime: () => compareNumber(a.primeUtilization, b.primeUtilization),
      opportunity: () => compareNumber(a.opportunityScore, b.opportunityScore),
      distribution: () => compareNumber(a.distributionScore, b.distributionScore),
      fragmentation: () => compareNumber(a.fragmentationScore, b.fragmentationScore),
      capacity: () => compareNumber(a.capacity, b.capacity),
      room: () => a.buildingRoom.localeCompare(b.buildingRoom, undefined, { numeric: true })
    };
    return (sorters[sortBy]?.() || 0) || a.buildingRoom.localeCompare(b.buildingRoom, undefined, { numeric: true });
  }

  function roomMatchesUtilizationCategory(room, category) {
    const label = String(category || '').trim();
    if (!label) return true;
    if (label === 'High Opportunity') return (room?.opportunityScore || 0) >= 0.65;
    if (label === 'Fragmented') return (room?.fragmentationScore || 0) < 0.55 && (room?.totalMinutes || 0) > 0;
    return room?.status?.label === label;
  }

  function filterRoomUtilizationRowsByCategory(rooms, categories = selectedUtilizationCategories) {
    const active = [...categories].filter(Boolean);
    if (!active.length) return rooms;
    return rooms.filter(room => active.some(category => roomMatchesUtilizationCategory(room, category)));
  }

  function getRoomUtilizationRowsForControls() {
    const selectedCampus = utilizationCampusSelect?.value || '';
    const selectedType = utilizationTypeSelect?.value || '';
    const selectedBuilding = utilizationBuildingSelect?.value || '';
    const minCapacity = Number(utilizationMinCapacityInput?.value || 0);
    const maxCapacity = Number(utilizationMaxCapacityInput?.value || 0);
    const minOverall = Number(utilizationMinOverallInput?.value || 0) / 100;
    const minPrime = Number(utilizationMinPrimeInput?.value || 0) / 100;
    const minOpportunity = Number(utilizationMinOpportunityInput?.value || 0) / 100;
    const minDistribution = Number(utilizationMinDistributionInput?.value || 0) / 100;
    const minFragmentation = Number(utilizationMinFragmentationInput?.value || 0) / 100;
    return calculateRoomUtilization()
      .filter(room => !selectedCampus || room.campus === selectedCampus)
      .filter(room => !selectedType || room.type === selectedType)
      .filter(room => !selectedBuilding || room.building === selectedBuilding)
      .filter(room => !minCapacity || (room.capacity != null && room.capacity >= minCapacity))
      .filter(room => !maxCapacity || (room.capacity != null && room.capacity <= maxCapacity))
      .filter(room => !minOverall || room.overallUtilization >= minOverall)
      .filter(room => !minPrime || room.primeUtilization >= minPrime)
      .filter(room => !minOpportunity || room.opportunityScore >= minOpportunity)
      .filter(room => !minDistribution || room.distributionScore >= minDistribution)
      .filter(room => !minFragmentation || room.fragmentationScore >= minFragmentation);
  }

  function getActiveRoomUtilizationKeys() {
    return new Set(filterRoomUtilizationRowsByCategory(getRoomUtilizationRowsForControls())
      .map(room => room.buildingRoom));
  }

  function getSectionCapacity(section) {
    const value = extractField(section, ['Capacity', 'CAPACITY', 'Seats', 'SEATS', 'Max Enrollment', 'MAX ENROLL', 'Maximum Enrollment']);
    const parsed = Number(String(value || '').replace(/[%,$]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getFitEnrollmentValue(section) {
    const value = extractField(section, ['CENSUS_ENROLL', 'Census_Enroll', 'Census Enroll', 'Census Enrollment', 'ACTUAL_ENROLL', 'Actual_Enroll', 'Actual Enroll', 'Enrollment', 'Enroll']);
    const parsed = Number(String(value || '').replace(/[%,$]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getSectionTermLabel(section) {
    return extractField(section, ['Term', 'TERM', 'term']) || currentTerm || '';
  }

  function getSectionCourseLabel(section) {
    const parts = getCourseParts(section);
    return [parts.discipline, parts.courseNumber].filter(Boolean).join(' ') || extractField(section, ['Subject_Course', 'Subject Course', 'Course']);
  }

  function getSectionNumber(section) {
    return extractField(section, ['Section', 'SECTION', 'Sec', 'SEC', 'SECTION_NUMB', 'Section Number']);
  }

  function calculateRoomFitFlags(options = {}) {
    const threshold = Number(options.threshold || 0.7);
    const sourceRows = options.rows || currentData;
    const excludeTutoringOpenLab = document.getElementById('roomFitExcludeTutoringOpenLab')?.checked !== false;
    const seen = new Set();
    return sourceRows.reduce((rows, section, index) => {
      const canonical = getCanonicalSection(section);
      if (excludeTutoringOpenLab && isTutoringOpenLabSection(section)) return rows;
      const building = canonical?.building || section.Building || section.BUILDING;
      const roomOnly = canonical?.roomOnly || section.Room || section.ROOM;
      if (!isValidRoom(building, roomOnly)) return rows;
      const modality = getModalityCategory(canonical?.instructionalMethod || getInstructionalMethod(section));
      if (['ONLINE', 'WORK EXPERIENCE'].includes(String(modality || '').toUpperCase())) return rows;
      const key = canonical?.building && canonical?.roomOnly ? `${canonical.building}-${canonical.roomOnly}` : getRoomKey(section);
      if (String(key || '').toUpperCase().startsWith('VISFSC-')) return rows;
      const roomMeta = roomCatalogByKey.get(key);
      const roomCapacity = roomMeta?.capacity ?? null;
      if (roomCapacity == null || roomCapacity <= 0) return rows;
      const sectionCapacity = canonical?.cap || getSectionCapacity(section);
      const enrollment = canonical ? window.COSSectionModel.enrollmentForSection(canonical) : getFitEnrollmentValue(section);
      const basis = Math.max(sectionCapacity || 0, enrollment || 0);
      if (!basis) return rows;
      const term = canonical?.term || getSectionTermLabel(section);
      const crn = canonical?.crn || extractField(section, ['CRN', 'Course Reference Number']) || `ROW${index}`;
      const dedupeKey = [term, crn, key].join('|');
      if (seen.has(dedupeKey)) return rows;
      seen.add(dedupeKey);
      const fitRatio = basis / roomCapacity;
      const flags = [];
      const recommendations = [];
      if (sectionCapacity != null && sectionCapacity > roomCapacity) {
        flags.push('Over Capacity Risk');
        recommendations.push('Review room assignment or reduce section cap below room capacity.');
      }
      if (enrollment != null && enrollment > roomCapacity) {
        flags.push('Enrollment Exceeds Room Capacity');
        recommendations.push('Move section to a larger room or resolve enrollment/room-capacity mismatch.');
      }
      if (fitRatio < threshold) {
        flags.push('Underutilized Room');
        recommendations.push('Consider a smaller room or reserve this larger room for higher-capacity demand.');
      }
      if (!flags.length) return rows;
      rows.push({
        term,
        crn,
        course: canonical?.courseCode || getSectionCourseLabel(section),
        section: canonical?.section || getSectionNumber(section),
        campus: canonical?.campus || section.Campus || extractField(section, ['Campus', 'CAMPUS']),
        division: canonical?.division || getDivision(section),
        subject: canonical?.subject || getCourseParts(section).discipline,
        building: building || roomMeta?.building || '',
        room: roomOnly || roomMeta?.room || '',
        roomCapacity,
        sectionCapacity: sectionCapacity == null ? '' : sectionCapacity,
        enrollment: enrollment == null ? '' : enrollment,
        fitRatio,
        flag: flags.join('; '),
        recommendation: recommendations.join(' ')
      });
      return rows;
    }, []).sort((a, b) =>
      String(a.term).localeCompare(String(b.term), undefined, { numeric: true }) ||
      String(a.building).localeCompare(String(b.building), undefined, { numeric: true }) ||
      String(a.room).localeCompare(String(b.room), undefined, { numeric: true }) ||
      String(a.course).localeCompare(String(b.course), undefined, { numeric: true })
    );
  }

  function renderRoomFitAnalysis() {
    if (!roomFitSummary || !roomFitTable) return;
    const selectedCampus = utilizationCampusSelect?.value || '';
    const selectedType = utilizationTypeSelect?.value || '';
    const activeUtilizationRoomKeys = getActiveRoomUtilizationKeys();
    const rows = calculateRoomFitFlags()
      .filter(row => {
        const meta = roomCatalogByKey.get(`${row.building}-${row.room}`);
        if (selectedCampus && row.campus !== selectedCampus && meta?.campus !== selectedCampus) return false;
        if (selectedType && meta?.type !== selectedType) return false;
        if (selectedUtilizationCategories.size && !activeUtilizationRoomKeys.has(`${row.building}-${row.room}`)) return false;
        return true;
      });
    const counts = rows.reduce((acc, row) => {
      row.flag.split('; ').forEach(flag => { acc[flag] = (acc[flag] || 0) + 1; });
      return acc;
    }, {});
    roomFitSummary.replaceChildren();
    [
      `Fit flags: ${rows.length}`,
      `Underutilized Room: ${counts['Underutilized Room'] || 0}`,
      `Over Capacity Risk: ${counts['Over Capacity Risk'] || 0}`,
      `Enrollment Exceeds Room Capacity: ${counts['Enrollment Exceeds Room Capacity'] || 0}`
    ].forEach(text => {
      const pill = document.createElement('div');
      pill.className = 'utilization-pill';
      pill.textContent = text;
      roomFitSummary.appendChild(pill);
    });
    const tbody = roomFitTable.querySelector('tbody');
    if (!tbody) return;
    tbody.replaceChildren();
    rows.forEach(row => {
      const tr = document.createElement('tr');
      [
        row.term,
        row.crn,
        row.course,
        row.section,
        row.campus,
        row.building,
        row.room,
        row.roomCapacity,
        row.sectionCapacity,
        row.enrollment,
        `${Math.round(row.fitRatio * 100)}%`,
        row.flag,
        row.recommendation
      ].forEach(value => {
        const td = document.createElement('td');
        td.textContent = value ?? '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 13;
      td.textContent = 'No room capacity fit flags match the selected filters.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function exportRoomFitAnalysis() {
    const selectedCampus = utilizationCampusSelect?.value || '';
    const selectedType = utilizationTypeSelect?.value || '';
    const activeUtilizationRoomKeys = getActiveRoomUtilizationKeys();
    const rows = calculateRoomFitFlags()
      .filter(row => {
        const meta = roomCatalogByKey.get(`${row.building}-${row.room}`);
        if (selectedCampus && row.campus !== selectedCampus && meta?.campus !== selectedCampus) return false;
        if (selectedType && meta?.type !== selectedType) return false;
        if (selectedUtilizationCategories.size && !activeUtilizationRoomKeys.has(`${row.building}-${row.room}`)) return false;
        return true;
      })
      .map(row => ({
        Term: row.term,
        CRN: row.crn,
        Course: row.course,
        Section: row.section,
        Campus: row.campus,
        Building: row.building,
        Room: row.room,
        'Room Capacity': row.roomCapacity,
        'Section Capacity': row.sectionCapacity,
        'Census/Current Enrollment': row.enrollment,
        'Fit Ratio': `${Math.round(row.fitRatio * 100)}%`,
        Flag: row.flag,
        Recommendation: row.recommendation
      }));
    downloadTextFile('room-capacity-fit-flags.csv', Papa.unparse(rows), 'text/csv;charset=utf-8');
  }

  async function getRoomFitReportSourceRows() {
    const uploaded = await readCsvFiles(document.getElementById('roomFitCsv'));
    const archived = await fetchArchivedScheduleRows(selectedOptions(document.getElementById('roomFitArchiveTerms')));
    const rows = [...uploaded, ...archived].map(normalizeRow);
    roomFitReportRows = rows.length ? rows : currentData;
    return roomFitReportRows;
  }

  function setSimpleSelectOptions(id, values, allLabel = 'All') {
    const select = document.getElementById(id);
    if (!select) return;
    const prior = select.value;
    select.replaceChildren(new Option(allLabel, ''));
    [...new Set((values || []).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
      .forEach(value => select.appendChild(new Option(value, value, false, value === prior)));
    if ([...select.options].some(option => option.value === prior)) select.value = prior;
  }

  function roomFitFilteredRows() {
    const rows = calculateRoomFitFlags({ rows: roomFitReportRows || currentData });
    const selected = {
      term: document.getElementById('roomFitTerm')?.value || '',
      campus: document.getElementById('roomFitCampus')?.value || '',
      building: document.getElementById('roomFitBuilding')?.value || '',
      room: document.getElementById('roomFitRoom')?.value || '',
      division: document.getElementById('roomFitDivision')?.value || '',
      subject: document.getElementById('roomFitSubject')?.value || '',
      course: document.getElementById('roomFitCourse')?.value || '',
      flag: document.getElementById('roomFitFlag')?.value || ''
    };
    return rows.filter(row => {
      if (selected.term && row.term !== selected.term) return false;
      if (selected.campus && row.campus !== selected.campus) return false;
      if (selected.building && row.building !== selected.building) return false;
      if (selected.room && row.room !== selected.room) return false;
      if (selected.division && row.division !== selected.division) return false;
      if (selected.subject && row.subject !== selected.subject) return false;
      if (selected.course && row.course !== selected.course) return false;
      if (selected.flag && !row.flag.split('; ').includes(selected.flag)) return false;
      return true;
    });
  }

  function populateRoomFitReportFilters() {
    const rows = calculateRoomFitFlags({ rows: roomFitReportRows || currentData });
    setSimpleSelectOptions('roomFitTerm', rows.map(row => row.term));
    setSimpleSelectOptions('roomFitCampus', rows.map(row => row.campus));
    setSimpleSelectOptions('roomFitBuilding', rows.map(row => row.building));
    setSimpleSelectOptions('roomFitRoom', rows.map(row => row.room));
    setSimpleSelectOptions('roomFitDivision', rows.map(row => row.division));
    setSimpleSelectOptions('roomFitSubject', rows.map(row => row.subject));
    setSimpleSelectOptions('roomFitCourse', rows.map(row => row.course));
  }

  async function renderRoomFitReport() {
    await getRoomFitReportSourceRows();
    populateRoomFitReportFilters();
    renderRoomFitReportTable();
  }

  function renderRoomFitReportTable() {
    const metricsNode = document.getElementById('roomFitReportMetrics');
    const tableNode = document.getElementById('roomFitReportTable');
    if (!metricsNode || !tableNode) return;
    const rows = roomFitFilteredRows();
    const tutoringOpenLabRowsExcluded = document.getElementById('roomFitExcludeTutoringOpenLab')?.checked !== false
      ? (roomFitReportRows || currentData).filter(isTutoringOpenLabSection).length
      : 0;
    const countFlag = flag => rows.filter(row => row.flag.split('; ').includes(flag)).length;
    const cards = [
      ['All', rows.length, ''],
      ['Underutilized Room', countFlag('Underutilized Room'), 'Underutilized Room'],
      ['Over Capacity Risk', countFlag('Over Capacity Risk'), 'Over Capacity Risk'],
      ['Enrollment Exceeds Room Capacity', countFlag('Enrollment Exceeds Room Capacity'), 'Enrollment Exceeds Room Capacity'],
      ['Tutoring/Open Lab Rows Excluded', tutoringOpenLabRowsExcluded, '']
    ];
    const selectedFlag = document.getElementById('roomFitFlag')?.value || '';
    metricsNode.innerHTML = cards.map(([label, value, flag]) => `<button type="button" class="room-fit-card${selectedFlag === flag ? ' is-active' : ''}" data-room-fit-flag="${escapeHTML(flag)}"><strong>${value}</strong><span>${escapeHTML(label)}</span></button>`).join('');
    metricsNode.querySelectorAll('[data-room-fit-flag]').forEach(button => {
      button.addEventListener('click', () => {
        const flagSelect = document.getElementById('roomFitFlag');
        if (flagSelect) flagSelect.value = button.dataset.roomFitFlag || '';
        renderRoomFitReportTable();
      });
    });
    const headers = ['Term', 'CRN', 'Course', 'Section', 'Campus', 'Building', 'Room', 'Room Capacity', 'Section Capacity', 'Census/Current Enrollment', 'Fit Ratio', 'Flag', 'Recommendation'];
    const body = rows.map(row => `<tr>${[
      row.term,
      row.crn,
      row.course,
      row.section,
      row.campus,
      row.building,
      row.room,
      row.roomCapacity,
      row.sectionCapacity,
      row.enrollment,
      `${Math.round(row.fitRatio * 100)}%`,
      row.flag,
      row.recommendation
    ].map(value => `<td>${escapeHTML(value ?? '')}</td>`).join('')}</tr>`).join('');
    tableNode.innerHTML = rows.length
      ? `<table><thead><tr>${headers.map(header => `<th>${escapeHTML(header)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
      : '<p class="analytics-empty">No room fit flags match the selected filters.</p>';
  }

  function exportRoomFitReport() {
    const rows = roomFitFilteredRows().map(row => ({
      Term: row.term,
      CRN: row.crn,
      Course: row.course,
      Section: row.section,
      Campus: row.campus,
      Building: row.building,
      Room: row.room,
      'Room Capacity': row.roomCapacity,
      'Section Capacity': row.sectionCapacity,
      'Census/Current Enrollment': row.enrollment,
      'Fit Ratio': `${Math.round(row.fitRatio * 100)}%`,
      Flag: row.flag,
      Recommendation: row.recommendation
    }));
    downloadTextFile('room-fit-analysis.csv', Papa.unparse(rows), 'text/csv;charset=utf-8');
  }

  function renderUtilizationMap() {
    if (!utilizationMap || !utilizationSummary) return;
    const baseRooms = getRoomUtilizationRowsForControls();
    const rooms = filterRoomUtilizationRowsByCategory(baseRooms);
    const counts = utilizationCategoryLabels.reduce((acc, label) => {
      acc[label] = baseRooms.filter(room => roomMatchesUtilizationCategory(room, label)).length;
      return acc;
    }, {});
    utilizationSummary.replaceChildren();

    const actions = document.createElement('div');
    actions.className = 'utilization-filter-actions';
    [
      ['Select All', 'select-all'],
      ['Clear Category Filters', 'clear']
    ].forEach(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'utilization-filter-action';
      button.dataset.utilizationCategoryAction = action;
      button.textContent = label;
      button.addEventListener('click', () => {
        selectedUtilizationCategories.clear();
        if (action === 'select-all') utilizationCategoryLabels.forEach(category => selectedUtilizationCategories.add(category));
        renderUtilizationMap();
      });
      actions.appendChild(button);
    });
    utilizationSummary.appendChild(actions);

    [
      { label: 'Rooms', count: rooms.length, category: '' },
      ...utilizationCategoryLabels.map(label => ({ label, count: counts[label] || 0, category: label }))
    ].forEach(({ label, count, category }) => {
      const pill = document.createElement('div');
      const isActive = category && selectedUtilizationCategories.has(category);
      pill.className = `utilization-pill${category ? ' utilization-pill-filter' : ' utilization-pill-info'}${isActive ? ' is-active' : ''}`;
      if (category) {
        pill.setAttribute('role', 'button');
        pill.tabIndex = 0;
        pill.dataset.utilizationCategory = category;
        pill.setAttribute('aria-pressed', String(isActive));
        pill.setAttribute('aria-label', `${label} rooms filter, ${count} rooms`);
        pill.title = `${isActive ? 'Remove' : 'Add'} ${label} room filter`;
        const toggleCategory = () => {
          if (selectedUtilizationCategories.has(category)) {
            selectedUtilizationCategories.delete(category);
          } else {
            selectedUtilizationCategories.add(category);
          }
          renderUtilizationMap();
        };
        pill.addEventListener('click', toggleCategory);
        pill.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCategory();
          }
        });
      }
      const metricLabel = document.createElement('span');
      metricLabel.className = 'metric-card-label';
      metricLabel.textContent = `${label}: ${count}`;
      pill.appendChild(metricLabel);
      window.MetricHelpProvider?.attach?.(pill, label, { id: `room-utilization-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-help` });
      utilizationSummary.appendChild(pill);
    });

    utilizationMap.replaceChildren();
    if (!rooms.length) {
      utilizationMap.textContent = 'No rooms match the selected filters.';
      renderRoomFitAnalysis();
      return;
    }
    rooms.forEach(room => {
      const card = document.createElement('article');
      card.className = 'utilization-card';
      card.style.setProperty('--status-color', room.status.color);
      const title = document.createElement('h3');
      title.textContent = room.buildingRoom;
      const badge = document.createElement('span');
      badge.className = 'status';
      badge.textContent = room.status.label;
      const details = document.createElement('dl');
      [
        ['Overall Room Utilization Score', `${Math.round(room.score * 100)}%`],
        ['Campus', room.campus || 'N/A'],
        ['Building', room.building || 'N/A'],
        ['Room', room.room || room.buildingRoom],
        ['Scheduled Hours', room.scheduledHours.toFixed(1)],
        ['Available Hours', room.availableHours.toFixed(1)],
        ['Overall Utilization %', `${Math.round(room.overallUtilization * 100)}%`],
        ['Prime-Time Utilization %', `${Math.round(room.primeUtilization * 100)}%`],
        ['Distribution Score', `${Math.round(room.distributionScore * 100)}%`],
        ['Fragmentation Score', `${Math.round(room.fragmentationScore * 100)}%`],
        ['Opportunity Score', `${Math.round(room.opportunityScore * 100)}%`],
        ['Active Days', room.activeDaysCount],
        ['Active Time Blocks', room.activeTimeBlocks],
        ['Longest Empty Prime-Time Block', `${room.longestEmptyPrimeBlock.toFixed(1)} hrs`],
        ['Raw Peak Hours', room.peakHours.toFixed(1)],
        ['Peak Share', `${Math.round(room.peakShare * 100)}%`],
        ['Capacity', room.capacity == null ? 'N/A' : room.capacity],
        ['Type', room.type || 'N/A'],
        ['Caution', room.smallRoomCaution ? 'Small room with regular use' : 'None']
      ].forEach(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        details.append(dt, dd);
      });
      const reason = document.createElement('p');
      reason.className = 'reason';
      reason.textContent = `${room.recommendation} ${room.status.reason} ${room.capacityLabel}.${room.smallRoomCaution ? ' Small room caution applies because capacity is below 20 and weekly scheduled use is 12+ hours.' : ''}`;
      card.append(title, badge, details, reason);
      utilizationMap.appendChild(card);
    });
    renderRoomFitAnalysis();
  }

  function getInstructionalMethod(section) {
    return extractField(section, [
      'Instructional_Method',
      'INSTRUCTIONAL_METHOD_CODE',
      'Instructional Method Code',
      'Instructional Method',
      'Instr Method',
      'Instruction Method',
      'InstructionalMethod',
      'instructionalMethod',
      'Method',
      'Modality',
      'modality',
      'INSTRUCTION_METHOD_DESC',
      'Instruction Method Desc',
      'Schedule Type'
    ]);
  }

  function getModalityCategory(method) {
    const category = window.COSModalityNormalizer?.normalize
      ? window.COSModalityNormalizer.normalize(method, { INSTRUCTIONAL_METHOD_CODE: method })
      : '';
    if (window.COSModalityNormalizer?.isReportable?.(category)) return window.COSModalityNormalizer.displayLabel(category);
    return category || 'UNKNOWN';
  }

  function isReportableModalityCategory(category) {
    const normalized = String(category || '').toUpperCase().replace('-', ' ');
    return normalized === 'IN PERSON' || normalized === 'HYBRID' || normalized === 'ONLINE';
  }

  function getCanonicalSection(section) {
    return section?.canonicalSection || window.COSSectionModel?.normalizeSection?.(section) || null;
  }

  function getSectionIdentity(section, index) {
    const canonical = getCanonicalSection(section);
    if (canonical && window.COSSectionModel?.sectionIdentity) return window.COSSectionModel.sectionIdentity(canonical, index);
    const crn = extractField(section, ['CRN', 'Course Reference Number']);
    const term = getSectionTerm(section);
    if (crn) return `${term || 'UNKNOWN'}|CRN:${crn}`;
    return [
      term,
      extractField(section, ['Subject_Course', 'Subject Course', 'Course']),
      extractField(section, ['Title', 'Course Title']),
      getInstructionalMethod(section),
      extractField(section, ['Start_Date', 'Start Date']),
      extractField(section, ['End_Date', 'End Date'])
    ].filter(Boolean).join('|') || `ROW:${index}`;
  }

  function getModalitySectionIdentity(section, index) {
    const canonical = getCanonicalSection(section);
    const term = canonical?.term ? normalizeTermLabel(canonical.term) : getSectionTerm(section);
    const crn = canonical?.crn || extractField(section, ['CRN', 'Course Reference Number', 'crn']);
    if (crn) return `${term || 'UNKNOWN'}|CRN:${crn}`;
    return getSectionIdentity(section, index);
  }

  function getDivision(section) {
    return normalizeFilterLabel(extractField(section, ['Division', 'DIVISION', 'Division Name', 'DIVISION_NAME', 'Academic Division', 'Department Division', 'School', 'Area']));
  }

  function getDepartment(section) {
    return normalizeFilterLabel(extractField(section, ['Department', 'DEPARTMENT', 'Dept', 'DEPT', 'Department Name']));
  }

  function modalityDivisionValue(section) {
    return normalizeFilterLabel(getDivision(section) || getCanonicalSection(section)?.division);
  }

  function modalityDepartmentValue(section) {
    return normalizeFilterLabel(getDepartment(section) || getCanonicalSection(section)?.department);
  }

  function getCourseCode(section) {
    const parts = getCourseParts(section);
    return [parts.discipline, parts.courseNumber].filter(Boolean).join(' ');
  }

  function getModalitySourceRows() {
    return modalityLoadedSourceRows?.length ? modalityLoadedSourceRows : currentData;
  }

  function getModalityComparisonTerms(sourceTerms = []) {
    const archiveTerms = modalityArchiveRows
      .map(getSectionTerm)
      .filter(Boolean);
    return [...new Set([...sourceTerms, ...archiveTerms])]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function getModalityComparisonSourceRows(term = '') {
    if (!term) return getModalitySourceRows();
    const sourceRows = getModalitySourceRows();
    const matchingSourceRows = sourceRows.filter(row => termMatches(getSectionTerm(row), term));
    if (matchingSourceRows.length) return matchingSourceRows;
    const archiveRows = modalityArchiveRows.filter(row => termMatches(getSectionTerm(row), term));
    return archiveRows;
  }

  function normalizeTermLabel(value) {
    const text = String(value || '').trim();
    const match = text.match(/\b(SUMMER|FALL|SPRING)\b\s*(20\d{2})/i) || text.match(/\b(20\d{2})\b.*\b(SUMMER|FALL|SPRING)\b/i);
    if (!match) return text;
    const season = (match[1].match(/20\d{2}/) ? match[2] : match[1]).toUpperCase();
    const year = match[1].match(/20\d{2}/) ? match[1] : match[2];
    return `${season} ${year}`;
  }

  function termMatches(sectionTerm, selectedTerm) {
    if (!selectedTerm) return true;
    return normalizeTermLabel(sectionTerm).toUpperCase() === normalizeTermLabel(selectedTerm).toUpperCase();
  }

  async function loadModalityArchiveRowsFromBackend() {
    if (!BACKEND_BASE_URL) return;
    try {
      const listPayload = await fetch(`${BACKEND_BASE_URL}/api/analytics-archive`).then(response => response.ok ? response.json() : { data: [] });
      const terms = (listPayload.data || []).map(item => item.term).filter(Boolean);
      const batches = await Promise.all(terms.map(term => fetch(`${BACKEND_BASE_URL}/api/analytics-archive/${encodeURIComponent(term)}`)
        .then(response => response.ok ? response.json() : { data: [] })
        .then(payload => (payload.data || []).map(row => normalizeRow({ ...row, __sourceTerm: payload.term || term })))
        .catch(() => [])));
      modalityArchiveRows = batches.flat();
      initModalityFilters();
      if (document.getElementById('viewSelect')?.value === 'modality') renderModalityTool();
    } catch (err) {
      console.warn('Modality archive rows skipped:', err);
    }
  }

  function getCourseLevelSort(level) {
    return {
      'Below 100': 0,
      '100 Level': 1,
      '200 Level': 2,
      '300 Level': 3,
      '400+ Level': 4,
      'Unspecified': 5
    }[level] ?? 9;
  }

  function initModalityFilters() {
    if (!modalityCampusSelect || !modalityDivisionSelect || !modalityDisciplineSelect || !modalityLevelSelect) return;
    const rows = getModalitySourceRows();
    const decisionTermValue = modalityDecisionTermSelect?.value || '';
    const comparisonValues = modalityComparisonSelects.map(select => select.value);
    const campusValues = selectedValues(modalityCampusSelect);
    const divisionValues = selectedValues(modalityDivisionSelect);
    const disciplineValues = selectedValues(modalityDisciplineSelect);
    const departmentValues = selectedValues(modalityDepartmentSelect);
    const courseValues = selectedValues(modalityCourseSelect);
    const modalityValues = selectedValues(modalityModalitySelect);
    const levelValues = selectedValues(modalityLevelSelect);
    const calGetcValue = modalityCalGetcSelect?.value || '';
    const campuses = getUniqueCampuses(rows);
    const terms = [...new Set(rows.map(getSectionTerm).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const comparisonTerms = getModalityComparisonTerms(terms);
    const divisions = uniqueFilterOptions(rows.map(modalityDivisionValue));
    const disciplines = [...new Set(rows.map(section => getCourseParts(section).discipline).filter(Boolean))].sort();
    const departments = uniqueFilterOptions(rows.map(modalityDepartmentValue));
    const courses = [...new Set(rows.map(getCourseCode).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const modalityOptions = [...new Set(rows.map(section => getModalityCategory(getInstructionalMethod(section) || 'Unspecified')).filter(isReportableModalityCategory))].sort();
    const levels = [...new Set(rows.map(section => getCourseLevel(getCourseParts(section).courseNumber)).filter(Boolean))]
      .sort((a, b) => getCourseLevelSort(a) - getCourseLevelSort(b));
    if (modalityDecisionTermSelect) resetSelect(modalityDecisionTermSelect, terms, modalityLoadedSourceRows?.length ? 'All loaded source terms' : 'Current room-grid term', '');
    modalityComparisonSelects.forEach(select => resetSelect(select, comparisonTerms, 'None', ''));
    resetSelect(modalityCampusSelect, campuses, 'All', '');
    resetSelect(modalityDivisionSelect, divisions, 'All', '');
    resetSelect(modalityDisciplineSelect, disciplines, 'All', '');
    if (modalityDepartmentSelect) resetSelect(modalityDepartmentSelect, departments, 'All', '');
    if (modalityCourseSelect) resetSelect(modalityCourseSelect, courses, 'All', '');
    if (modalityModalitySelect) resetSelect(modalityModalitySelect, modalityOptions, 'All', '');
    resetSelect(modalityLevelSelect, levels, 'All', '');
    if (modalityCalGetcSelect) resetSelect(modalityCalGetcSelect, calGetcFilterOptions, 'All', '');
    if (terms.includes(decisionTermValue) && modalityDecisionTermSelect) modalityDecisionTermSelect.value = decisionTermValue;
    else if (modalityLoadedSourceRows?.length && terms.length === 1 && modalityDecisionTermSelect) modalityDecisionTermSelect.value = terms[0];
    modalityComparisonSelects.forEach((select, index) => {
      if (comparisonTerms.includes(comparisonValues[index])) select.value = comparisonValues[index];
    });
    preserveSelected(modalityCampusSelect, campusValues);
    preserveSelected(modalityDivisionSelect, divisionValues);
    preserveSelected(modalityDisciplineSelect, disciplineValues);
    preserveSelected(modalityDepartmentSelect, departmentValues);
    preserveSelected(modalityCourseSelect, courseValues);
    preserveSelected(modalityModalitySelect, modalityValues);
    preserveSelected(modalityLevelSelect, levelValues);
    if (calGetcFilterOptions.some(option => option.value === calGetcValue) && modalityCalGetcSelect) modalityCalGetcSelect.value = calGetcValue;
  }

  function getSectionTerm(section) {
    return normalizeTermLabel(extractField(section, ['Term', 'TERM', 'term']) || section.__sourceTerm || '');
  }

  function getEnrollmentValue(section) {
    const value = extractField(section, ['CENSUS_ENROLL', 'Census_Enroll', 'Census Enroll', 'Census Enrollment', 'ACTUAL_ENROLL', 'Actual_Enroll', 'Actual Enroll', 'Enrollment', 'Enroll']);
    const parsed = Number(String(value || '').replace(/[%,$]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getCourseTitle(section) {
    return extractField(section, ['Title', 'Course_Title', 'Course Title', 'Section Title', 'COURSE_TITLE', 'Course_Name', 'Course Name']);
  }

  function modalityFilterDebugBase(sourceRows, selected = {}) {
    return {
      selectedDivision: (selected.division || []).join('; ') || 'All',
      uniqueDivisions: uniqueFilterOptions(sourceRows.map(modalityDivisionValue)),
      rowsLoaded: sourceRows.length,
      rowsBeforeDivisionFilter: 0,
      rowsAfterCampusFilter: 0,
      rowsAfterDivisionFilter: 0,
      rowsAfterDepartmentFilter: 0,
      rowsAfterDisciplineFilter: 0,
      rowsAfterCourseFilter: 0,
      finalRows: 0
    };
  }

  function modalityFilteredSections(options = {}) {
    const selectedTerm = options.term || modalityDecisionTermSelect?.value || '';
    const selectedCampus = options.selectedCampus || selectedValues(modalityCampusSelect);
    const selectedDivision = options.selectedDivision || selectedValues(modalityDivisionSelect);
    const selectedDiscipline = options.selectedDiscipline || selectedValues(modalityDisciplineSelect);
    const selectedDepartment = options.selectedDepartment || selectedValues(modalityDepartmentSelect);
    const selectedCourse = options.selectedCourse || selectedValues(modalityCourseSelect);
    const selectedModality = options.selectedModality || selectedValues(modalityModalitySelect);
    const selectedLevel = options.selectedLevel || selectedValues(modalityLevelSelect);
    const selectedCalGetc = options.selectedCalGetc ?? (modalityCalGetcSelect?.value || '');
    const includeDualEnrollment = Boolean(modalityIncludeDe?.checked);
    const excludeTutoringOpenLab = document.getElementById('modality-exclude-tutoring-openlab')?.checked !== false;
    let tutoringOpenLabRowsExcluded = 0;
    const seenSections = new Set();
    const rows = [];
    const sourceRows = options.sourceRows || getModalitySourceRows();
    const debug = modalityFilterDebugBase(sourceRows, { division: selectedDivision });

    sourceRows.forEach((section, index) => {
      const canonical = getCanonicalSection(section);
      const campus = normalizeFilterLabel(canonical?.campus || extractField(section, ['Campus', 'campus', 'CAMPUS']));
      const term = canonical?.term ? normalizeTermLabel(canonical.term) : getSectionTerm(section);
      const division = modalityDivisionValue(section);
      const department = modalityDepartmentValue(section);
      const courseParts = canonical ? { discipline: canonical.subject, courseNumber: canonical.course } : getCourseParts(section);
      const courseCode = normalizeFilterLabel(canonical?.courseCode || getCourseCode(section));
      const courseLevel = getCourseLevel(courseParts.courseNumber);
      if (excludeTutoringOpenLab && isTutoringOpenLabSection(section)) {
        tutoringOpenLabRowsExcluded += 1;
        return;
      }
      if (selectedTerm && !termMatches(term, selectedTerm)) return;
      debug.rowsBeforeDivisionFilter += 1;
      if (!filterMatchesAny(campus, selectedCampus)) return;
      debug.rowsAfterCampusFilter += 1;
      if (!filterMatchesAny(division, selectedDivision)) return;
      debug.rowsAfterDivisionFilter += 1;
      if (!filterMatchesAny(department, selectedDepartment)) return;
      debug.rowsAfterDepartmentFilter += 1;
      if (!filterMatchesAny(courseParts.discipline, selectedDiscipline)) return;
      debug.rowsAfterDisciplineFilter += 1;
      if (!filterMatchesAny(courseCode, selectedCourse)) return;
      debug.rowsAfterCourseFilter += 1;
      if (!filterMatchesAny(courseLevel, selectedLevel)) return;
      if (!sectionMatchesCalGetc(section, selectedCalGetc)) return;

      const identity = getModalitySectionIdentity(section, index);
      if (seenSections.has(identity)) return;
      seenSections.add(identity);

      const rawMethod = canonical?.instructionalMethod || getInstructionalMethod(section) || 'Unspecified';
      const category = getModalityCategory(rawMethod);
      if (!isReportableModalityCategory(category)) return;
      if (!valueMatchesAny(category, selectedModality)) return;
      rows.push({
        section,
        identity,
        term,
        campus,
        division,
        department,
        discipline: courseParts.discipline,
        courseCode,
        courseTitle: canonical?.title || getCourseTitle(section),
        courseLevel,
        rawMethod,
        category,
        enrollment: window.COSSectionModel?.enrollmentForSection?.(canonical || section) ?? getEnrollmentValue(section)
      });
    });
    debug.finalRows = rows.length;

    return { rows, tutoringOpenLabRowsExcluded, debug };
  }

  function modalityBalanceItemsFromSections(sourceRows = []) {
    const seenSections = new Set();
    const rows = [];
    (sourceRows || []).forEach((section, index) => {
      const canonical = getCanonicalSection(section);
      const rawMethod = canonical?.instructionalMethod || getInstructionalMethod(section) || 'Unspecified';
      const category = getModalityCategory(rawMethod);
      if (!isReportableModalityCategory(category)) return;
      const identity = getModalitySectionIdentity(section, index);
      if (seenSections.has(identity)) return;
      seenSections.add(identity);
      rows.push({
        section,
        identity,
        term: canonical?.term ? normalizeTermLabel(canonical.term) : getSectionTerm(section),
        rawMethod,
        category,
        enrollment: window.COSSectionModel?.enrollmentForSection?.(canonical || section) ?? getEnrollmentValue(section)
      });
    });
    return rows;
  }

  function calculateModalityBalance(options = {}) {
    const filtered = modalityFilteredSections(options);
    if (!options.sourceRows || options.sourceRows === getModalitySourceRows()) modalityLastFilterDebug = filtered.debug;
    return calculateModalityBalanceFromItems(filtered.rows, {
      tutoringOpenLabRowsExcluded: filtered.tutoringOpenLabRowsExcluded,
      filterDebug: filtered.debug
    });
  }

  function calculateModalityBalanceFromItems(items, options = {}) {
    const categories = new Map();

    (items || []).forEach(item => {
      const { category, rawMethod } = item;
      if (!categories.has(category)) {
        categories.set(category, {
          category,
          classOfferings: 0,
          enrollment: 0,
          methods: new Map()
        });
      }
      const bucket = categories.get(category);
      bucket.classOfferings += 1;
      bucket.enrollment += item.enrollment;
      bucket.methods.set(rawMethod, (bucket.methods.get(rawMethod) || 0) + 1);
    });

    const total = Array.from(categories.values()).reduce((sum, item) => sum + item.classOfferings, 0);
    const totalEnrollment = Array.from(categories.values()).reduce((sum, item) => sum + item.enrollment, 0);
    const order = ['In-Person', 'Online', 'Hybrid'];
    return Array.from(categories.values())
      .map(item => ({
        ...item,
        count: item.classOfferings,
        share: total ? item.classOfferings / total : 0,
        classOfferingShare: total ? item.classOfferings / total : 0,
        enrollmentShare: totalEnrollment ? item.enrollment / totalEnrollment : 0,
        methodDetails: Array.from(item.methods.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      }))
      .sort((a, b) => {
        const ai = order.includes(a.category) ? order.indexOf(a.category) : order.length;
        const bi = order.includes(b.category) ? order.indexOf(b.category) : order.length;
        return ai - bi || a.category.localeCompare(b.category);
      })
      .map(item => ({ ...item, total, totalEnrollment, totalClassOfferings: total, tutoringOpenLabRowsExcluded: options.tutoringOpenLabRowsExcluded || 0, filterDebug: options.filterDebug || null }));
  }

  function renderModalityTool() {
    if (!modalitySummary || !modalityChart || !modalityTable) return;
    const rows = calculateModalityBalance();
    const total = rows[0]?.total || 0;
    const totalEnrollment = rows[0]?.totalEnrollment || 0;
    const tutoringOpenLabRowsExcluded = rows[0]?.tutoringOpenLabRowsExcluded || 0;
    modalitySummary.replaceChildren();
    if (modalityComparison) modalityComparison.replaceChildren();
    modalityChart.replaceChildren();
    const tbody = modalityTable.querySelector('tbody');
    if (tbody) tbody.replaceChildren();

    const summaryItems = [
      ['Total Class Offerings', total, 'scheduled-class-offerings'],
      ['Enrollment', totalEnrollment, 'enrollment'],
      ['In-Person Offerings', rows.find(row => row.category === 'In-Person')?.classOfferings || 0, 'in-person'],
      ['Online Offerings', rows.find(row => row.category === 'Online')?.classOfferings || 0, 'online'],
      ['Hybrid Offerings', rows.find(row => row.category === 'Hybrid')?.classOfferings || 0, 'hybrid'],
      ['Tutoring/Open Lab Rows Excluded', tutoringOpenLabRowsExcluded, '']
    ];
    const comparisonTerms = modalitySelectedComparisonTerms();
    modalityTotalClassOfferingComparisonRows(rows, comparisonTerms).forEach(row => {
      summaryItems.push([`Net Offerings vs ${row.comparisonTerm}`, `${signedNumber(row.classOfferingDiff)} (${row.classOfferingPctChange})`, 'scheduled-class-offerings']);
    });
    summaryItems.forEach(([label, value, metricId]) => {
      const pill = document.createElement('div');
      pill.className = 'modality-pill';
      const metricLabel = document.createElement('span');
      metricLabel.className = 'metric-card-label';
      metricLabel.textContent = `${label}: ${value}`;
      pill.appendChild(metricLabel);
      window.MetricHelpProvider?.attach?.(pill, metricId);
      modalitySummary.appendChild(pill);
    });

    if (!rows.length) {
      modalityChart.textContent = 'No modality data is available for the selected term.';
      renderModalityCourseComparisonTable();
      return;
    }

    renderModalityComparison(rows);
    renderModalityDiagnostics();
    renderModalityPieCharts(rows);

    rows.forEach(row => {
      if (tbody) {
        const tr = document.createElement('tr');
        [row.category, row.classOfferings, row.enrollment, `${(row.classOfferingShare * 100).toFixed(1)}%`, `${(row.enrollmentShare * 100).toFixed(1)}%`].forEach(value => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });
        const visualTd = document.createElement('td');
        const miniTrack = document.createElement('div');
        miniTrack.className = 'modality-table-track';
        const miniFill = document.createElement('div');
        miniFill.className = `modality-table-fill ${row.category.toLowerCase().replace(/\s+/g, '-')}`;
        miniFill.style.width = `${Math.max(row.classOfferingShare * 100, 2)}%`;
        miniTrack.appendChild(miniFill);
        visualTd.appendChild(miniTrack);
        tr.appendChild(visualTd);

        const detailsTd = document.createElement('td');
        const methodList = document.createElement('div');
        methodList.className = 'modality-method-list';
        row.methodDetails.forEach(([method, count]) => {
          const chip = document.createElement('span');
          chip.className = 'modality-method-chip';
          chip.textContent = `${method} (${count})`;
          methodList.appendChild(chip);
        });
        detailsTd.appendChild(methodList);
        tr.appendChild(detailsTd);
        tbody.appendChild(tr);
      }
    });
    renderModalityCourseComparisonTable();
  }

  function renderModalityDiagnostics() {
    if (!modalityComparison) return;
    const filterDebug = modalityLastFilterDebug || modalityFilterDebugBase(getModalitySourceRows(), { division: selectedValues(modalityDivisionSelect) });
    const diagnostics = window.COSModalityNormalizer?.diagnosticRows
      ? window.COSModalityNormalizer.diagnosticRows(getModalitySourceRows(), row => getInstructionalMethod(row))
      : [];
    const section = document.createElement('section');
    section.className = 'modality-diagnostics';
    const rows = diagnostics.map(row => `
      <tr>
        <td>${escapeHTML(row.originalInstructionalMethodCode)}</td>
        <td>${row.count}</td>
        <td>${escapeHTML(row.currentMappedCategory)}</td>
        <td>${escapeHTML(row.exampleCrnsCourses || '')}</td>
      </tr>`).join('');
    const debugRows = [
      ['Selected Division', filterDebug.selectedDivision],
      ['Unique Division values loaded', filterDebug.uniqueDivisions.join('; ') || 'None'],
      ['Rows loaded', filterDebug.rowsLoaded],
      ['Rows before division filter', filterDebug.rowsBeforeDivisionFilter],
      ['Rows after Campus filter', filterDebug.rowsAfterCampusFilter],
      ['Rows after Division filter', filterDebug.rowsAfterDivisionFilter],
      ['Rows after Department filter', filterDebug.rowsAfterDepartmentFilter],
      ['Rows after Discipline filter', filterDebug.rowsAfterDisciplineFilter],
      ['Rows after Course filter', filterDebug.rowsAfterCourseFilter],
      ['Final rows', filterDebug.finalRows]
    ].map(([metric, value]) => `<tr><td>${escapeHTML(metric)}</td><td>${escapeHTML(value)}</td></tr>`).join('');
    section.innerHTML = `
      <h3>Modality Filter Diagnostics</h3>
      <p>Division, department, discipline, course, campus, and term filters are applied before modality classification, summary cards, charts, comparison tables, and exports. Comparison terms use the same normalized filter values.</p>
      <div class="table-scroll"><table class="modality-diagnostics-table">
        <thead><tr><th>Filter stage</th><th>Value</th></tr></thead>
        <tbody>${debugRows}</tbody>
      </table></div>
      <h3>Unmapped Instructional Method Diagnostics</h3>
      <p>Unknown instructional method codes are stored internally as UNKNOWN and excluded from standard modality analytics until mapped.</p>
      <div class="table-scroll"><table class="modality-diagnostics-table">
        <thead><tr><th>Original instructional method code</th><th>Count</th><th>Current mapped category</th><th>Example CRNs/courses</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No unmapped instructional method codes detected.</td></tr>'}</tbody>
      </table></div>`;
    modalityComparison.appendChild(section);
  }

  function modalityTermLabel() {
    return modalityDecisionTermSelect?.value || (modalityLoadedSourceRows?.length ? 'All loaded source terms' : currentTerm || 'Current room-grid term');
  }

  function modalitySelectedComparisonTerms() {
    return modalityComparisonSelects.map(select => select.value).filter(Boolean);
  }

  function modalityExportContextRows(focusRows, comparisonTerms) {
    const termsInSource = [...new Set(getModalitySourceRows().map(getSectionTerm).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const debug = modalityLastFilterDebug || modalityFilterDebugBase(getModalitySourceRows(), { division: selectedValues(modalityDivisionSelect) });
    return [
      ['Report', 'Modality Balance'],
      ['Focus Term', modalityTermLabel()],
      ['Comparison Terms', comparisonTerms.join('; ') || 'None'],
      ['Loaded Source Terms', termsInSource.join('; ') || 'Current room-grid term'],
      ['Source Rows', getModalitySourceRows().length],
      ['Focus Total Class Offerings', focusRows[0]?.totalClassOfferings || 0],
      ['Focus Enrollment', focusRows[0]?.totalEnrollment || 0],
      ['Include Dual Enrollment', modalityIncludeDe?.checked ? 'Yes' : 'No'],
      ['Exclude Tutoring/Open Lab Sections', document.getElementById('modality-exclude-tutoring-openlab')?.checked !== false ? 'Yes' : 'No'],
      ['Campus Filter', selectedValues(modalityCampusSelect).join('; ') || 'All'],
      ['Division Filter', selectedValues(modalityDivisionSelect).join('; ') || 'All'],
      ['Discipline Filter', selectedValues(modalityDisciplineSelect).join('; ') || 'All'],
      ['Department Filter', selectedValues(modalityDepartmentSelect).join('; ') || 'All'],
      ['Course Filter', selectedValues(modalityCourseSelect).join('; ') || 'All'],
      ['Modality Filter', selectedValues(modalityModalitySelect).join('; ') || 'All'],
      ['Course Level Filter', selectedValues(modalityLevelSelect).join('; ') || 'All'],
      ['CAL-GETC Filter', modalityCalGetcSelect?.value || 'All'],
      ['Debug Rows Loaded', debug.rowsLoaded],
      ['Debug Rows After Campus Filter', debug.rowsAfterCampusFilter],
      ['Debug Rows After Division Filter', debug.rowsAfterDivisionFilter],
      ['Debug Rows After Department Filter', debug.rowsAfterDepartmentFilter],
      ['Debug Rows After Discipline Filter', debug.rowsAfterDisciplineFilter],
      ['Debug Rows After Course Filter', debug.rowsAfterCourseFilter],
      ['Debug Final Rows', debug.finalRows],
      ['Debug Unique Divisions Loaded', debug.uniqueDivisions.join('; ') || 'None']
    ].map(([metric, value]) => ({
      Section: 'Export Context',
      Term: modalityTermLabel(),
      Chart: '',
      Category: metric,
      Metric: 'Value',
      Value: value,
      Share: '',
      ComparisonTerm: '',
      Difference: '',
      PercentChange: '',
      Notes: ''
    }));
  }

  function modalitySummaryExportRows(rows, termLabel, sectionName = 'Focus Results') {
    return rows.map(row => ({
      Section: sectionName,
      Term: termLabel,
      Chart: '',
      Category: row.category,
      Metric: 'Modality Summary',
      Value: row.classOfferings,
      ClassOfferings: row.classOfferings,
      Enrollment: row.enrollment,
      ClassOfferingShare: `${(row.classOfferingShare * 100).toFixed(1)}%`,
      Share: `${(row.classOfferingShare * 100).toFixed(1)}%`,
      EnrollmentShare: `${(row.enrollmentShare * 100).toFixed(1)}%`,
      ComparisonTerm: '',
      Difference: '',
      PercentChange: '',
      Notes: row.methodDetails.map(([method, count]) => `${method} (${count})`).join('; ')
    }));
  }

  function modalityPieExportRows(rows, termLabel) {
    return rows.flatMap(row => ([
      {
        Section: 'Graph Data',
        Term: termLabel,
        Chart: 'Class Offerings by Modality',
        Category: row.category,
        Metric: 'Total Class Offerings',
        Value: row.classOfferings,
        ClassOfferings: row.classOfferings,
        Enrollment: '',
        ClassOfferingShare: `${(row.classOfferingShare * 100).toFixed(1)}%`,
        Share: `${(row.classOfferingShare * 100).toFixed(1)}%`,
        EnrollmentShare: '',
        ComparisonTerm: '',
        Difference: '',
        PercentChange: '',
        Notes: `Color ${modalityColor(row.category)}`
      },
      {
        Section: 'Graph Data',
        Term: termLabel,
        Chart: 'Enrollment by Modality',
        Category: row.category,
        Metric: 'Enrollment',
        Value: row.enrollment,
        ClassOfferings: '',
        Enrollment: row.enrollment,
        ClassOfferingShare: '',
        Share: `${(row.enrollmentShare * 100).toFixed(1)}%`,
        EnrollmentShare: `${(row.enrollmentShare * 100).toFixed(1)}%`,
        ComparisonTerm: '',
        Difference: '',
        PercentChange: '',
        Notes: `Color ${modalityColor(row.category)}`
      }
    ]));
  }

  function modalityComparisonExportRows(focusRows, comparisonTerms) {
    const focusLabel = modalityTermLabel();
    const focusMap = new Map(focusRows.map(row => [row.category, row]));
    const totalRows = modalityTotalClassOfferingComparisonRows(focusRows, comparisonTerms).map(row => ({
      Section: 'Total Class Offerings Term Comparison',
      Term: focusLabel,
      Chart: '',
      Category: 'All Modalities',
      Metric: 'Total Class Offerings',
      CurrentTermClassOfferings: row.currentClassOfferings,
      ComparisonTermClassOfferings: row.comparisonClassOfferings,
      Difference: signedNumber(row.classOfferingDiff),
      PercentIncrease: row.classOfferingPctChange,
      CurrentTermEnrollment: row.currentEnrollment,
      ComparisonTermEnrollment: row.comparisonEnrollment,
      EnrollmentDifference: signedNumber(row.enrollmentDiff),
      Value: row.currentClassOfferings,
      ClassOfferings: row.currentClassOfferings,
      Enrollment: row.currentEnrollment,
      ComparisonTerm: row.comparisonTerm,
      Notes: 'Net total class offerings across all modalities. Positive values mean the focus term scheduled more distinct CRNs after filters; negative values mean fewer.'
    }));
    return comparisonTerms.flatMap(term => {
      const comparisonRows = calculateModalityBalance({ term, sourceRows: getModalityComparisonSourceRows(term) });
      const comparisonMap = new Map(comparisonRows.map(row => [row.category, row]));
      const combinedRows = modalityCombinedComparisonRows(focusMap, comparisonMap);
      const asRows = rows => rows.map(row => ({
        Section: 'Comparison Results',
        Term: focusLabel,
        Chart: 'Modality Comparison',
        Category: row.category,
        Metric: 'Class Offerings and Enrollment',
        CurrentTermClassOfferings: row.currentClassOfferings,
        ComparisonTermClassOfferings: row.comparisonClassOfferings,
        Difference: signedNumber(row.classOfferingDiff),
        PercentIncrease: row.classOfferingPctIncrease,
        CurrentTermShareOfClassOfferings: pctLabel(row.currentClassOfferingShare),
        ComparisonTermShareOfClassOfferings: pctLabel(row.comparisonClassOfferingShare),
        ShareDifference: row.classOfferingShareDiff,
        CurrentTermEnrollment: row.currentEnrollment,
        ComparisonTermEnrollment: row.comparisonEnrollment,
        EnrollmentDifference: signedNumber(row.enrollmentDiff),
        CurrentTermEnrollmentShare: pctLabel(row.currentEnrollmentShare),
        ComparisonTermEnrollmentShare: pctLabel(row.comparisonEnrollmentShare),
        EnrollmentShareDifference: row.enrollmentShareDiff,
        Value: row.currentClassOfferings,
        ClassOfferings: row.currentClassOfferings,
        Enrollment: row.currentEnrollment,
        ClassOfferingShare: pctLabel(row.currentClassOfferingShare),
        Share: pctLabel(row.currentClassOfferingShare),
        EnrollmentShare: pctLabel(row.currentEnrollmentShare),
        ComparisonTerm: term,
        Notes: 'Total Class Offerings counts distinct CRNs after filters are applied.'
      }));
      return [
        ...modalitySummaryExportRows(comparisonRows, term, 'Comparison Term Results'),
        ...modalityPieExportRows(comparisonRows, term),
        ...asRows(combinedRows)
      ];
    }).concat(totalRows);
  }

  function courseModalityKey(item) {
    return [item.courseCode || 'Unknown Course', item.courseTitle || '', item.division || '', item.discipline || '', item.category || 'Unspecified'].join('||');
  }

  function aggregateCourseModalityRows(rows) {
    const map = new Map();
    rows.forEach(item => {
      const key = courseModalityKey(item);
      if (!map.has(key)) {
        map.set(key, {
          course: item.courseCode || 'Unknown Course',
          courseTitle: item.courseTitle || '',
          division: item.division || '',
          discipline: item.discipline || '',
          category: item.category || 'Unspecified',
          classOfferings: 0,
          enrollment: 0
        });
      }
      const bucket = map.get(key);
      bucket.classOfferings += 1;
      bucket.sections = bucket.classOfferings;
      bucket.enrollment += item.enrollment || 0;
    });
    return map;
  }

  function modalityCourseComparisonRows() {
    const comparisonTerms = modalitySelectedComparisonTerms();
    if (!comparisonTerms.length) return [];
    const focusTerm = modalityDecisionTermSelect?.value || '';
    const focusMap = aggregateCourseModalityRows(modalityFilteredSections({ term: focusTerm }).rows);
    return comparisonTerms.flatMap(term => {
      const comparisonMap = aggregateCourseModalityRows(modalityFilteredSections({ term, sourceRows: getModalityComparisonSourceRows(term) }).rows);
      const keys = [...new Set([...focusMap.keys(), ...comparisonMap.keys()])];
      return keys.map(key => {
        const focus = focusMap.get(key) || {
          course: comparisonMap.get(key)?.course || 'Unknown Course',
          courseTitle: comparisonMap.get(key)?.courseTitle || '',
          division: comparisonMap.get(key)?.division || '',
          discipline: comparisonMap.get(key)?.discipline || '',
          category: comparisonMap.get(key)?.category || 'Unspecified',
          classOfferings: 0,
          sections: 0,
          enrollment: 0
        };
        const comparison = comparisonMap.get(key) || { classOfferings: 0, sections: 0, enrollment: 0 };
        const focusClassOfferings = focus.classOfferings ?? focus.sections ?? 0;
        const comparisonClassOfferings = comparison.classOfferings ?? comparison.sections ?? 0;
        return {
          ...focus,
          focusTerm: modalityTermLabel(),
          focusClassOfferings,
          focusEnrollment: focus.enrollment,
          comparisonTerm: term,
          comparisonClassOfferings,
          comparisonEnrollment: comparison.enrollment,
          classOfferingDiff: focusClassOfferings - comparisonClassOfferings,
          sectionDiff: focusClassOfferings - comparisonClassOfferings,
          enrollmentDiff: focus.enrollment - comparison.enrollment,
          classOfferingPctChange: signedPctChange(focusClassOfferings, comparisonClassOfferings),
          sectionPctChange: signedPctChange(focusClassOfferings, comparisonClassOfferings),
          enrollmentPctChange: signedPctChange(focus.enrollment, comparison.enrollment)
        };
      });
    }).sort((a, b) =>
      a.course.localeCompare(b.course, undefined, { numeric: true }) ||
      a.category.localeCompare(b.category) ||
      a.comparisonTerm.localeCompare(b.comparisonTerm)
    );
  }

  function renderModalityCourseComparisonTable() {
    if (!modalityCourseComparisonTable) return;
    const tbody = modalityCourseComparisonTable.querySelector('tbody');
    if (!tbody) return;
    tbody.replaceChildren();
    const comparisonTerms = modalitySelectedComparisonTerms();
    if (!comparisonTerms.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 15;
      td.textContent = 'Select Compare 1, Compare 2, or Compare 3 to see course-level term differences.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    const rows = modalityCourseComparisonRows();
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 15;
      td.textContent = 'No course-level modality differences match the selected filters.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.slice(0, 750).forEach(row => {
      const tr = document.createElement('tr');
      [
        row.course,
        row.courseTitle || 'N/A',
        row.division || 'N/A',
        row.discipline || 'N/A',
        row.category,
        row.focusTerm,
        row.focusClassOfferings,
        row.focusEnrollment,
        row.comparisonTerm,
        row.comparisonClassOfferings,
        row.comparisonEnrollment,
        signedNumber(row.classOfferingDiff),
        signedNumber(row.enrollmentDiff),
        row.classOfferingPctChange,
        row.enrollmentPctChange
      ].forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    if (rows.length > 750) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 15;
      td.textContent = `Showing first 750 of ${rows.length} course comparison rows. Use Division, Discipline, Course, or Modality filters to narrow the table.`;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function modalityCourseComparisonExportRows() {
    return modalityCourseComparisonRows().map(row => ({
      Section: 'Course-Level Term Differences',
      Term: row.focusTerm,
      Chart: '',
      Category: row.category,
      Metric: 'Course Modality Comparison',
      Course: row.course,
      CourseTitle: row.courseTitle,
      Division: row.division,
      Discipline: row.discipline,
      Value: row.focusClassOfferings,
      ClassOfferings: row.focusClassOfferings,
      Enrollment: row.focusEnrollment,
      Share: '',
      EnrollmentShare: '',
      ComparisonTerm: row.comparisonTerm,
      ComparisonValue: row.comparisonClassOfferings,
      ComparisonClassOfferings: row.comparisonClassOfferings,
      ComparisonEnrollment: row.comparisonEnrollment,
      Difference: signedNumber(row.classOfferingDiff),
      EnrollmentDifference: signedNumber(row.enrollmentDiff),
      PercentChange: row.classOfferingPctChange,
      EnrollmentPercentChange: row.enrollmentPctChange,
      Notes: 'Focus term minus comparison term by Total Class Offerings (unique CRN course/modality grouping).'
    }));
  }

  function modalityExportRowsForData(focusRows, comparisonTerms) {
    return [
      ...modalityExportContextRows(focusRows, comparisonTerms),
      ...modalitySummaryExportRows(focusRows, modalityTermLabel()),
      ...modalityPieExportRows(focusRows, modalityTermLabel()),
      ...modalityComparisonExportRows(focusRows, comparisonTerms),
      ...modalityCourseComparisonExportRows()
    ];
  }

  function currentModalityExportRows() {
    const focusRows = calculateModalityBalance();
    if (!focusRows.length) {
      alert('No modality data is available to export for the current selection.');
      return null;
    }
    const comparisonTerms = modalitySelectedComparisonTerms();
    return modalityExportRowsForData(focusRows, comparisonTerms);
  }

  function exportModalityBalance() {
    const rows = currentModalityExportRows();
    if (!rows) return;
    const slug = modalityTermLabel().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'loaded-source';
    downloadTextFile(`modality-balance-${slug}.csv`, Papa.unparse(rows), 'text/csv;charset=utf-8');
  }

  function exportModalityBalanceExcel() {
    const rows = currentModalityExportRows();
    if (!rows) return;
    const slug = modalityTermLabel().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'loaded-source';
    const columns = [...rows.reduce((set, row) => {
      Object.keys(row).forEach(key => set.add(key));
      return set;
    }, new Set())];
    const html = `<table><thead><tr>${columns.map(column => `<th>${escapeHTML(column)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${escapeHTML(row[column] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    downloadTextFile(`modality-balance-${slug}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
  }

  const modalityColors = {
    'In-Person': '#1d4f8f',
    Online: '#7c3aed',
    Hybrid: '#f59e0b'
  };

  function modalityColor(category) {
    return modalityColors[category] || '#64748b';
  }

  function renderModalityPieCharts(rows) {
    if (!modalityChart) return;
    modalityChart.replaceChildren();
    const charts = document.createElement('div');
    charts.className = 'modality-pie-grid';
    charts.append(
      modalityPieCard(`${modalityTermLabel()} Class Offerings by Modality`, 'Total Class Offerings uses unduplicated CRN counts after filters are applied.', rows, 'classOfferings', 'classOfferingShare'),
      modalityPieCard(`${modalityTermLabel()} Enrollment by Modality`, 'Enrollment by modality uses census enrollment first, then actual/current enrollment.', rows, 'enrollment', 'enrollmentShare')
    );
    modalityChart.appendChild(charts);
    renderModalityChartExportMenu(rows);
  }

  function renderModalityChartExportMenu(rows) {
    if (!modalityChart || !window.COSUtils?.renderVisualizationExportMenu) return;
    const filters = [
      `Term/source: ${modalityTermLabel()}`,
      `Campus: ${selectedValues(modalityCampusSelect).join('; ') || 'All'}`,
      `Division: ${selectedValues(modalityDivisionSelect).join('; ') || 'All'}`,
      `Discipline: ${selectedValues(modalityDisciplineSelect).join('; ') || 'All'}`,
      `Department: ${selectedValues(modalityDepartmentSelect).join('; ') || 'All'}`,
      `Course: ${selectedValues(modalityCourseSelect).join('; ') || 'All'}`,
      `Modality: ${selectedValues(modalityModalitySelect).join('; ') || 'All'}`
    ];
    window.COSUtils.renderVisualizationExportMenu(modalityChart, {
      container: () => modalityChart,
      anchor: '.modality-pie-grid',
      rows: () => modalityVisualizationRows(rows),
      options: () => ({
        title: 'Modality Balance Charts',
        term: modalityTermLabel(),
        filters,
        metric: 'Class Offerings and Enrollment by Modality',
        modalityScope: selectedValues(modalityModalitySelect).join(', ') || 'All reportable modalities',
        legend: 'Class offerings use distinct CRNs after filters. Enrollment uses census enrollment when available, otherwise actual/current enrollment.',
        columns: ['reportName', 'termSource', 'selectedFilters', 'metric', 'modality', 'value', 'sections', 'enrollment', 'share', 'modalityScope'],
        filename: 'modality-balance-charts.png',
        csvFilename: 'modality-balance-charts.csv',
        pdfFilename: 'modality-balance-charts.pdf'
      })
    });
  }

  function modalityVisualizationRows(rows) {
    const term = modalityTermLabel();
    const classRows = modalityMixGraphData(rows, 'classOfferings', 'classOfferingShare').map(row => ({
      reportName: 'Modality Balance',
      termSource: term,
      selectedFilters: 'Current report filters',
      metric: 'Class Offerings by Modality',
      day: '',
      timeBlock: '',
      value: row.value,
      sections: row.value,
      seats: '',
      enrollment: '',
      fillRate: '',
      waitlist: '',
      modalityScope: row.category,
      modality: row.category,
      share: row.percentLabel
    }));
    const enrollmentRows = modalityMixGraphData(rows, 'enrollment', 'enrollmentShare').map(row => ({
      reportName: 'Modality Balance',
      termSource: term,
      selectedFilters: 'Current report filters',
      metric: 'Enrollment by Modality',
      day: '',
      timeBlock: '',
      value: row.value,
      sections: '',
      seats: '',
      enrollment: row.value,
      fillRate: '',
      waitlist: '',
      modalityScope: row.category,
      modality: row.category,
      share: row.percentLabel
    }));
    return [...classRows, ...enrollmentRows];
  }

  function modalityPieCard(title, description, rows, metricKey, shareKey) {
    const card = document.createElement('section');
    card.className = 'modality-pie-card';
    const graphRows = modalityMixGraphData(rows, metricKey, shareKey);
    const heading = document.createElement('h3');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = description;
    const graph = document.createElement('div');
    graph.className = 'modality-mix-bars';
    graphRows.forEach(row => {
      const line = document.createElement('div');
      line.className = 'modality-mix-row';
      const label = document.createElement('div');
      label.className = 'modality-mix-label';
      label.innerHTML = `<span>${escapeHTML(row.category)}</span><strong>${row.value} (${row.percentLabel})</strong>`;
      const track = document.createElement('div');
      track.className = 'modality-bar-track';
      const fill = document.createElement('div');
      fill.className = `modality-bar-fill ${row.category.toLowerCase().replace(/\s+/g, '-')}`;
      fill.style.width = `${Math.max(row.share * 100, row.value ? 2 : 0)}%`;
      fill.style.background = modalityColor(row.category);
      track.appendChild(fill);
      line.append(label, track);
      graph.appendChild(line);
    });
    card.append(heading, body, graph);
    return card;
  }

  function modalityMixGraphData(rows, metricKey, shareKey) {
    return rows
      .filter(row => (row[metricKey] || 0) > 0)
      .map(row => ({
        category: row.category,
        value: row[metricKey] || 0,
        share: row[shareKey] || 0,
        percentLabel: `${((row[shareKey] || 0) * 100).toFixed(1)}%`
      }));
  }

  function modalityChartData(rows) {
    return {
      classOfferings: modalityMixGraphData(rows, 'classOfferings', 'classOfferingShare'),
      enrollment: modalityMixGraphData(rows, 'enrollment', 'enrollmentShare')
    };
  }

  function signedNumber(value) {
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }

  function signedPctChange(current, comparison) {
    if (!comparison && !current) return '0.0%';
    if (!comparison) return 'N/A';
    const change = (current - comparison) / comparison;
    const pct = change * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  }

  function signedPointChange(currentShare, comparisonShare) {
    const points = (currentShare - comparisonShare) * 100;
    return `${points > 0 ? '+' : ''}${points.toFixed(1)} pts`;
  }

  function pctLabel(value) {
    return `${((Number(value) || 0) * 100).toFixed(1)}%`;
  }

  function modalityComparisonRows(decisionMap, comparisonMap, metricKey, shareKey) {
    const categories = [...new Set([...decisionMap.keys(), ...comparisonMap.keys()])];
    return categories.map(category => {
      const decision = decisionMap.get(category) || { count: 0, enrollment: 0, share: 0, enrollmentShare: 0 };
      const compare = comparisonMap.get(category) || { count: 0, enrollment: 0, share: 0, enrollmentShare: 0 };
      return {
        category,
        current: decision[metricKey] || 0,
        comparison: compare[metricKey] || 0,
        diff: (decision[metricKey] || 0) - (compare[metricKey] || 0),
        pctIncrease: signedPctChange(decision[metricKey] || 0, compare[metricKey] || 0),
        currentShare: decision[shareKey] || 0,
        comparisonShare: compare[shareKey] || 0,
        shareDiff: signedPointChange(decision[shareKey] || 0, compare[shareKey] || 0)
      };
    });
  }

  function modalityCombinedComparisonRows(decisionMap, comparisonMap) {
    const categories = [...new Set([...decisionMap.keys(), ...comparisonMap.keys()])];
    return categories.map(category => {
      const decision = decisionMap.get(category) || { classOfferings: 0, count: 0, enrollment: 0, classOfferingShare: 0, share: 0, enrollmentShare: 0 };
      const compare = comparisonMap.get(category) || { classOfferings: 0, count: 0, enrollment: 0, classOfferingShare: 0, share: 0, enrollmentShare: 0 };
      const currentClassOfferings = decision.classOfferings ?? decision.count ?? 0;
      const comparisonClassOfferings = compare.classOfferings ?? compare.count ?? 0;
      const currentClassOfferingShare = decision.classOfferingShare ?? decision.share ?? 0;
      const comparisonClassOfferingShare = compare.classOfferingShare ?? compare.share ?? 0;
      return {
        category,
        currentClassOfferings,
        comparisonClassOfferings,
        classOfferingDiff: currentClassOfferings - comparisonClassOfferings,
        classOfferingPctIncrease: signedPctChange(currentClassOfferings, comparisonClassOfferings),
        currentClassOfferingShare,
        comparisonClassOfferingShare,
        classOfferingShareDiff: signedPointChange(currentClassOfferingShare, comparisonClassOfferingShare),
        currentEnrollment: decision.enrollment || 0,
        comparisonEnrollment: compare.enrollment || 0,
        enrollmentDiff: (decision.enrollment || 0) - (compare.enrollment || 0),
        currentEnrollmentShare: decision.enrollmentShare || 0,
        comparisonEnrollmentShare: compare.enrollmentShare || 0,
        enrollmentShareDiff: signedPointChange(decision.enrollmentShare || 0, compare.enrollmentShare || 0)
      };
    });
  }

  function modalityTotals(rows) {
    return {
      classOfferings: rows[0]?.totalClassOfferings ?? rows.reduce((total, row) => total + (row.classOfferings || 0), 0),
      enrollment: rows[0]?.totalEnrollment ?? rows.reduce((total, row) => total + (row.enrollment || 0), 0)
    };
  }

  function modalityTotalClassOfferingComparisonRows(focusRows, comparisonTerms = []) {
    const focusTotals = modalityTotals(focusRows || []);
    return (comparisonTerms || []).filter(Boolean).map(term => {
      const comparisonRows = calculateModalityBalance({ term, sourceRows: getModalityComparisonSourceRows(term) });
      const comparisonTotals = modalityTotals(comparisonRows || []);
      return {
        comparisonTerm: term,
        currentClassOfferings: focusTotals.classOfferings,
        comparisonClassOfferings: comparisonTotals.classOfferings,
        classOfferingDiff: focusTotals.classOfferings - comparisonTotals.classOfferings,
        classOfferingPctChange: signedPctChange(focusTotals.classOfferings, comparisonTotals.classOfferings),
        currentEnrollment: focusTotals.enrollment,
        comparisonEnrollment: comparisonTotals.enrollment,
        enrollmentDiff: focusTotals.enrollment - comparisonTotals.enrollment
      };
    });
  }

  function modalityTotalComparisonTable(focusLabel, rows) {
    if (!rows.length) return '';
    const body = rows.map(row => `
      <tr>
        <td>${escapeHTML(focusLabel)}</td>
        <td>${escapeHTML(row.comparisonTerm)}</td>
        <td>${row.currentClassOfferings}</td>
        <td>${row.comparisonClassOfferings}</td>
        <td>${signedNumber(row.classOfferingDiff)}</td>
        <td>${row.classOfferingPctChange}</td>
        <td>${row.currentEnrollment}</td>
        <td>${row.comparisonEnrollment}</td>
        <td>${signedNumber(row.enrollmentDiff)}</td>
      </tr>
    `).join('');
    return `
      <section class="modality-comparison-card modality-total-comparison">
        <h4>Total Class Offerings Term Comparison</h4>
        <p>Net total class offerings compares distinct CRNs across all included modalities after filters. Positive means the focus term scheduled more offerings; negative means fewer.</p>
        <table>
          <thead>
            <tr>
              <th>Current Term</th>
              <th>Comparison Term</th>
              <th>Current Term Total Class Offerings</th>
              <th>Comparison Term Total Class Offerings</th>
              <th>Net Difference</th>
              <th>% Increase</th>
              <th>Current Term Enrollment</th>
              <th>Comparison Term Enrollment</th>
              <th>Enrollment Difference</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </section>
    `;
  }

  function modalityComparisonTable(title, focusLabel, compareLabel, rows) {
    const body = rows.map(row => `
      <tr>
        <td>${escapeHTML(row.category)}</td>
        <td>${row.currentClassOfferings}</td>
        <td>${row.comparisonClassOfferings}</td>
        <td>${signedNumber(row.classOfferingDiff)}</td>
        <td>${row.classOfferingPctIncrease}</td>
        <td>${pctLabel(row.currentClassOfferingShare)}</td>
        <td>${pctLabel(row.comparisonClassOfferingShare)}</td>
        <td>${row.classOfferingShareDiff}</td>
        <td>${row.currentEnrollment}</td>
        <td>${row.comparisonEnrollment}</td>
        <td>${signedNumber(row.enrollmentDiff)}</td>
        <td>${pctLabel(row.currentEnrollmentShare)}</td>
        <td>${pctLabel(row.comparisonEnrollmentShare)}</td>
        <td>${row.enrollmentShareDiff}</td>
      </tr>
    `).join('');
    return `
      <section class="modality-comparison-card">
        <h4>${escapeHTML(title)}</h4>
        <table>
          <thead>
            <tr>
              <th>Modality</th>
              <th>${escapeHTML(focusLabel)} Class Offerings</th>
              <th>${escapeHTML(compareLabel)} Class Offerings</th>
              <th>Difference</th>
              <th>% Increase</th>
              <th>${escapeHTML(focusLabel)} Share of Class Offerings</th>
              <th>${escapeHTML(compareLabel)} Share of Class Offerings</th>
              <th>Share Diff</th>
              <th>${escapeHTML(focusLabel)} Enrollment</th>
              <th>${escapeHTML(compareLabel)} Enrollment</th>
              <th>Enrollment Difference</th>
              <th>${escapeHTML(focusLabel)} Enrollment Share</th>
              <th>${escapeHTML(compareLabel)} Enrollment Share</th>
              <th>Enrollment Share Difference</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </section>
    `;
  }

  function renderModalityComparison(decisionRows) {
    if (!modalityComparison) return;
    const selectedTerms = modalityComparisonSelects.map(select => select.value).filter(Boolean);
    if (!selectedTerms.length) return;
    const decisionTerm = modalityDecisionTermSelect?.value || 'Current Loaded Term';
    const decisionMap = new Map(decisionRows.map(row => [row.category, row]));
    const totalComparisonRows = modalityTotalClassOfferingComparisonRows(decisionRows, selectedTerms);
    const sections = selectedTerms.map(term => {
      const comparisonRows = calculateModalityBalance({ term, sourceRows: getModalityComparisonSourceRows(term) });
      const comparisonMap = new Map(comparisonRows.map(row => [row.category, row]));
      const comparisonTableRows = modalityCombinedComparisonRows(decisionMap, comparisonMap);
      return `
        <section class="modality-comparison-term">
          <h3>${escapeHTML(decisionTerm)} vs ${escapeHTML(term)}</h3>
          <p>Total Class Offerings and enrollment are intentionally tracked as separate data sets. Total Class Offerings answers how many distinct CRNs are in each modality. Enrollment answers how many students are represented in each modality.</p>
          <div class="modality-comparison-grid">
            ${modalityComparisonTable('Class Offerings and Enrollment by Modality', decisionTerm, term, comparisonTableRows)}
          </div>
        </section>
      `;
    }).join('');
    modalityComparison.innerHTML = `${modalityTotalComparisonTable(decisionTerm, totalComparisonRows)}${sections}`;
  }

  function parseTime(t) {
    const [h,m] = t.split(':').map(Number);
    return h*60 + m;
  }

  function parseDateOnly(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slash) {
      let year = Number(slash[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(slash[1]) - 1, Number(slash[2]));
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function dateRangesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return true;
    return startA <= endB && endA >= startB;
  }

  function sectionOverlapsRequestedDates(section, requestedStart, requestedEnd) {
    const sectionStart = parseDateOnly(extractField(section, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']));
    const sectionEnd = parseDateOnly(extractField(section, ['End_Date', 'End Date', 'End', 'end_date', 'end']));
    return dateRangesOverlap(sectionStart, sectionEnd, requestedStart, requestedEnd);
  }

  function format12(t) {
    let [h,m] = t.split(':').map(Number);
    const ap = h<12 ? 'AM':'PM';
    h = ((h+11)%12)+1;
    return `${h}:${('0'+m).slice(-2)}${ap}`;
  }

  function normalizeMeetingDays(days) {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const codeMap = {
      U: 'Sunday',
      SU: 'Sunday',
      SUNDAY: 'Sunday',
      M: 'Monday',
      MO: 'Monday',
      MON: 'Monday',
      MONDAY: 'Monday',
      T: 'Tuesday',
      TU: 'Tuesday',
      TUE: 'Tuesday',
      TUESDAY: 'Tuesday',
      W: 'Wednesday',
      WE: 'Wednesday',
      WED: 'Wednesday',
      WEDNESDAY: 'Wednesday',
      R: 'Thursday',
      TH: 'Thursday',
      THU: 'Thursday',
      THURSDAY: 'Thursday',
      F: 'Friday',
      FR: 'Friday',
      FRI: 'Friday',
      FRIDAY: 'Friday',
      S: 'Saturday',
      SA: 'Saturday',
      SAT: 'Saturday',
      SATURDAY: 'Saturday'
    };
    let recDays = Array.isArray(days) ? days : (typeof days === 'string' ? days.split(',') : []);
    recDays = recDays.map(day => String(day || '').trim()).filter(Boolean);
    recDays = recDays.map(day => codeMap[day.toUpperCase()] || day);
    if (recDays.length === 1 && recDays[0].length > 1 && recDays[0].length <= 7 && !dayNames.includes(recDays[0])) {
      const abbrevDayMap = { U:'Sunday', M:'Monday', T:'Tuesday', W:'Wednesday', R:'Thursday', F:'Friday', S:'Saturday' };
      recDays = recDays[0].split('').map(abbr => abbrevDayMap[abbr] || abbr);
    }
    return recDays.filter(day => dayNames.includes(day));
  }

  function initHeatmap() {
    hmChoices = new Choices('#courseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by course',
      callbackOnCreateTemplates: function(template) {
        return {
          choice: (classNames, data) => {
            const choiceId = escapeHTML(data.id);
            const choiceValue = escapeHTML(data.value);
            const choiceLabel = escapeHTML(data.label);
            return template(`
              <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled 
                ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="" data-choice 
                data-id="${choiceId}" data-value="${choiceValue}" ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
                role="option">
                <input type="checkbox" ${data.selected ? 'checked' : ''} tabindex="-1"/>
                <span>${choiceLabel}</span>
              </div>
            `);
          }
        }
      }
    });
    if(hmTable) {
      hmTable.destroy();
      $('#dataTable').empty();
    }
    hmTable = $('#dataTable').DataTable({
      data: [],
      columns: [
        { title: 'Course', render: $.fn.dataTable.render.text() },
        { title: 'CRN(s)', render: $.fn.dataTable.render.text() },
        { title: 'Building', render: $.fn.dataTable.render.text() },
        { title: 'Room', render: $.fn.dataTable.render.text() },
        { title: 'Days', render: $.fn.dataTable.render.text() },
        { title: 'Time', render: $.fn.dataTable.render.text() },
        { title: 'Enrollment', visible: false },
        { title: 'Capacity', visible: false },
        { title: 'Division', visible: false },
        { title: 'Discipline', visible: false },
        { title: 'Campus', visible: false },
        { title: 'Term', visible: false },
        { title: 'Modality', visible: false }
      ],
      destroy: true,
      searching: true
    });
    hmTable.on('search.dt', updateHeatmap);
    registerHeatmapDataTableFilter();
  }

  function getHeatmapCellFilterNote() {
    return document.getElementById('heatmap-cell-filter-note');
  }

  function setHeatmapCellFilterNote() {
    const note = getHeatmapCellFilterNote();
    if (!note) return;
    if (!heatmapCellFilter) {
      note.hidden = true;
      note.textContent = '';
      return;
    }
    note.hidden = false;
    note.textContent = `Table filtered to ${heatmapCellFilter.day} starts at ${formatHourLabel(heatmapCellFilter.hour)}. Use Clear to reset.`;
  }

  function clearHeatmapCellFilter(redraw = true) {
    heatmapCellFilter = null;
    setHeatmapCellFilterNote();
    document.querySelectorAll('.heatmap-cell.is-selected').forEach(cell => cell.classList.remove('is-selected'));
    if (redraw && hmTable) hmTable.draw();
  }

  function rowMatchesHeatmapCell(row, filter) {
    if (!filter) return true;
    const days = normalizeMeetingDays(row[4]);
    if (!days.includes(filter.day)) return false;
    const startTime = row[5]?.split('-')[0]?.trim();
    const startHour = parseHour(startTime);
    if (!Number.isFinite(startHour)) return false;
    return Math.floor(startHour * 2) / 2 === filter.hour;
  }

  function heatmapNumber(value) {
    const parsed = Number(String(value ?? '').replace(/[%,$]/g, '').trim());
    if (Number.isFinite(parsed)) return parsed;
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function rowEnrollment(row) {
    return heatmapNumber(row[6]);
  }

  function rowCapacity(row) {
    return heatmapNumber(row[7]);
  }

  function rowFillRate(row) {
    const capacity = rowCapacity(row);
    return capacity > 0 ? rowEnrollment(row) / capacity : 0;
  }

  function isPrimeHeatmapSlot(day, hour) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday'].includes(day) && hour >= 9 && hour < 15;
  }

  function isUnderutilizedHeatmapRow(row) {
    const capacity = rowCapacity(row);
    return capacity > 0 && rowFillRate(row) < 0.7;
  }

  function heatmapCrnKey(row, fallback = '') {
    const crns = String(Array.isArray(row) ? row[1] : row?.CRN || '').split(/[;,]/).map(value => value.trim()).filter(Boolean);
    if (crns.length) return crns.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(',');
    if (Array.isArray(row)) return [row[10], row[0], row[4], row[5], fallback].filter(Boolean).join('|');
    return [row?.Term, row?.key, row?.Days?.join(','), row?.Start_Time, fallback].filter(Boolean).join('|');
  }

  function isOnlineTbaHeatmapRow(row) {
    const modality = String(row?.Modality || '').toUpperCase();
    const category = String(row?.ModalityCategory || '').toUpperCase();
    const startHour = parseHour(row?.Start_Time);
    const endHour = parseHour(row?.End_Time);
    const timeBlock = String(row?.TimeBlock || '').trim();
    const startsAtMidnight = startHour === 0 || /^0?0:00\s*-\s*0?0:59/i.test(timeBlock);
    return startsAtMidnight && (category === 'ONLINE' || /\b(ONLINE|ONL|WEB|REMOTE|VIRTUAL|TBA)\b/.test(modality) || endHour === 0);
  }

  function normalizedHeatmapTimeBlock(row, startTime, endTime) {
    const modality = String(row?.Modality || '').toUpperCase();
    const category = String(row?.ModalityCategory || '').toUpperCase();
    const block = String(row?.TimeBlock || '').trim();
    const startHour = parseHour(startTime);
    const endHour = parseHour(endTime);
    const isOnline = category === 'ONLINE' || /\b(ONLINE|ONL|OL|ONN|ONS|O1|WEB|REMOTE|VIRTUAL|TBA)\b/.test(modality);
    const placeholder = !startTime || !endTime || startHour === 0 || /^0?0:00\s*-\s*0?0:(?:00|59)/i.test(block) || endHour === 0;
    if (isOnline && placeholder) return 'Online/TBA';
    return block;
  }

  function dedupeHeatmapRows(rows) {
    const map = new Map();
    (rows || []).forEach((row, index) => {
      const days = Array.isArray(row.Days) ? row.Days.join(',') : row.Days || '';
      const key = [
        row.Term || '',
        heatmapCrnKey(row, index),
        row.key || '',
        days,
        row.Start_Time || '',
        row.End_Time || ''
      ].join('|');
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...row,
          Rooms: new Set([row.Room].filter(Boolean)),
          Buildings: new Set([row.Building].filter(Boolean)),
          Crns: new Set([row.CRN].filter(Boolean))
        });
        return;
      }
      if (row.Room) existing.Rooms.add(row.Room);
      if (row.Building) existing.Buildings.add(row.Building);
      if (row.CRN) existing.Crns.add(row.CRN);
      existing.Room = [...existing.Rooms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('; ');
      existing.Building = [...existing.Buildings].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('; ');
      existing.CRN = [...existing.Crns].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('; ');
      existing.Enrollment = Math.max(existing.Enrollment || 0, row.Enrollment || 0);
      existing.Capacity = Math.max(existing.Capacity || 0, row.Capacity || 0);
    });
    return [...map.values()];
  }

  function heatmapMetricMode() {
    return document.getElementById('heatmap-metric-select')?.value || 'sections';
  }

  function formatHeatmapValue(value, metric) {
    if (!value) return '';
    if (metric === 'fillRate') return `${Math.round(value * 100)}%`;
    return String(Math.round(value));
  }

  function heatmapMetricLabel(metric = heatmapMetricMode()) {
    return {
      sections: 'Section Count Heatmap',
      enrollment: 'Enrollment Heatmap',
      capacity: 'Seat Capacity Heatmap',
      fillRate: 'Fill Rate Heatmap'
    }[metric] || 'Section Count Heatmap';
  }

  function formatHeatmapCardValue(item, metric = 'sections') {
    if (!item) return 'N/A';
    const value = metric === 'fillRate' ? `${Math.round(item.value * 100)}%` : Math.round(item.value);
    return `${item.day} ${formatHourLabel(item.hour)} (${value})`;
  }

  function registerHeatmapDataTableFilter() {
    if (heatmapDataTableFilterRegistered || !window.jQuery?.fn?.dataTable?.ext?.search) return;
    $.fn.dataTable.ext.search.push((settings, row) => {
      if (settings.nTable?.id !== 'dataTable') return true;
      return rowMatchesHeatmapCell(row, heatmapCellFilter);
    });
    heatmapDataTableFilterRegistered = true;
  }

  function attachHeatmapCellHandlers() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    container.querySelectorAll('.heatmap-cell:not(.heatmap-empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        heatmapCellFilter = {
          day: cell.dataset.day,
          hour: Number(cell.dataset.hour)
        };
        document.querySelectorAll('.heatmap-cell.is-selected').forEach(el => el.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        setHeatmapCellFilterNote();
        if (hmTable) hmTable.draw();
      });
    });
  }

  function initLineChartChoices() {
    lineCourseChoices = new Choices('#lineCourseSelect', {
      removeItemButton: true,
      searchEnabled: true,
      placeholderValue: 'Filter by course',
      callbackOnCreateTemplates: function(template) {
        return {
          choice: (classNames, data) => {
            const choiceId = escapeHTML(data.id);
            const choiceValue = escapeHTML(data.value);
            const choiceLabel = escapeHTML(data.label);
            return template(`
              <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled 
                ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="" data-choice 
                data-id="${choiceId}" data-value="${choiceValue}" ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
                role="option">
                <input type="checkbox" ${data.selected ? 'checked' : ''} tabindex="-1"/>
                <span>${choiceLabel}</span>
              </div>
            `);
          }
        }
      }
    });
  }

  function feedHeatmapTool(dataArray) {
    hmRaw = dataArray.map(r => {
      const canonical = getCanonicalSection(r);
      const key = canonical?.courseCode || getCourseKey(r);
      const daysVal = normalizeMeetingDays(canonical?.days || r.Days || r.days || r.dayPattern);

      const instructor = canonical?.instructor || extractField(r, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
      const startDate = canonical?.startDate || extractField(r, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
      const endDate = canonical?.endDate || extractField(r, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
      const title = canonical?.title || extractField(r, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
      const enrollment = canonical ? window.COSSectionModel.enrollmentForSection(canonical) : heatmapNumber(extractField(r, ['CENSUS_ENROLL', 'Census_Enroll', 'Census Enroll', 'Census Enrollment', 'census', 'ACTUAL_ENROLL', 'Actual_Enroll', 'Actual Enroll', 'actual', 'Enrollment', 'Enroll']));
      const capacity = canonical?.cap ?? heatmapNumber(extractField(r, ['Capacity', 'CAPACITY', 'cap', 'Seats', 'SEATS', 'Max Enrollment', 'Maximum Enrollment', 'MAX ENROLL']));
      const instructionalMethod = canonical?.instructionalMethod || getInstructionalMethod(r);
      const modalityCategory = getModalityCategory(instructionalMethod);

      const building = canonical?.building || extractField(r, ['Building', 'BUILDING', 'building', 'Bldg', 'Building Code']);
      const room = canonical?.roomOnly || extractField(r, ['Room', 'ROOM', 'roomOnly', 'room', 'Room Number']);

      let startTime = canonical?.start || extractField(r, ['Start_Time', 'Start Time', 'start', 'Start']) || '';
      let endTime = canonical?.end || extractField(r, ['End_Time', 'End Time', 'end', 'End']) || '';
      if ((!startTime || !endTime) && r.Time) {
        let parts = r.Time.split('-');
        if (parts.length === 2) {
          startTime = startTime || parts[0].trim();
          endTime = endTime || parts[1].trim();
        }
      }

      return {
        key,
        Subject_Course: r.Subject_Course || '',
        CRN: canonical?.crn || extractField(r, ['CRN', 'Course Reference Number']) || '',
        Term: canonical?.term ? normalizeTermLabel(canonical.term) : getSectionTerm(r),
        Building: building,
        Room: room,
        Days: daysVal,
        Start_Time: startTime,
        End_Time: endTime,
        TimeBlock: normalizedHeatmapTimeBlock({ Modality: instructionalMethod, ModalityCategory: modalityCategory, TimeBlock: extractField(r, ['Time Block', 'Time_Block', 'TIME_BLOCK']) }, startTime, endTime),
        Title: title,
        Start_Date: startDate,
        End_Date: endDate,
        Instructor: instructor,
        Enrollment: enrollment,
        Capacity: capacity,
        Campus: canonical?.campus || extractField(r, ['Campus', 'campus', 'CAMPUS']),
        Division: canonical?.division || getDivision(r),
        Discipline: canonical?.subject || getCourseParts(r).discipline,
        Modality: instructionalMethod,
        ModalityCategory: modalityCategory
      };
    }).filter(r => {
      if (!isReportableModalityCategory(r.ModalityCategory)) return false;
      // Omit if room is blank, N/A, LIVE, ONLINE
      if (!isValidRoom(r.Building, r.Room)) return false;
      if (isOnlineTbaHeatmapRow(r)) return false;
      if (!Array.isArray(r.Days) || !r.Days.length) return false;
      let dayField = r.Days;
      if (Array.isArray(dayField)) dayField = dayField.join(',');
      if (typeof dayField !== 'string') dayField = '';
      const cleaned = dayField.replace(/\s/g, '');
      if (cleaned === 'X' || cleaned === 'XX') return false;
      if (/^(X,)+X$/.test(cleaned)) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });
    hmRaw = dedupeHeatmapRows(hmRaw);

    const campuses = getUniqueCampuses(hmRaw);
    const divisions = [...new Set(hmRaw.map(r => r.Division).filter(Boolean))].sort();
    const disciplines = [...new Set(hmRaw.map(r => r.Discipline).filter(Boolean))].sort();
    const heatmapCampusSelect = document.getElementById('heatmap-campus-select');
    const heatmapDivisionSelect = document.getElementById('heatmap-division-select');
    const heatmapDisciplineSelect = document.getElementById('heatmap-discipline-select');
    const linechartCampusSelect = document.getElementById('linechart-campus-select');
    const linechartDivisionSelect = document.getElementById('linechart-division-select');
    const linechartDisciplineSelect = document.getElementById('linechart-discipline-select');
    if (heatmapCampusSelect) resetSelect(heatmapCampusSelect, campuses, 'All', '');
    if (linechartCampusSelect) resetSelect(linechartCampusSelect, campuses, 'All', '');
    if (heatmapDivisionSelect) resetSelect(heatmapDivisionSelect, divisions, 'All', '');
    if (linechartDivisionSelect) resetSelect(linechartDivisionSelect, divisions, 'All', '');
    if (heatmapDisciplineSelect) resetSelect(heatmapDisciplineSelect, disciplines, 'All', '');
    if (linechartDisciplineSelect) resetSelect(linechartDisciplineSelect, disciplines, 'All', '');

    let uniqueKeys = Array.from(new Set(hmRaw.map(r => r.key).filter(k => k))).sort();
    let items = uniqueKeys
      .filter(k => !k.startsWith("CAL-GETC"))
      .map(k => ({ value: k, label: k }));

    if (hmChoices) {
      hmChoices.setChoices(items, 'value', 'label', true);
    }
    if (lineCourseChoices) {
      lineCourseChoices.setChoices(items, 'value', 'label', true);
    }
    refreshCalGetcFilterControls();
    updateAllHeatmap();
    renderLineChart();
  }

  function buildCourseFilterSet(selectedCourses) {
    let filterCourseCodes = new Set();
    selectedCourses.forEach(val => {
      if (isCALGETCGroup(val)) {
        getCourseCodesFromCALGETC(val).forEach(c => filterCourseCodes.add(c));
      } else {
        if (window.normalizeCALGETCCode) {
          filterCourseCodes.add(window.normalizeCALGETCCode(val));
        } else {
          filterCourseCodes.add(val);
        }
      }
    });
    return filterCourseCodes;
  }

  function filterAnalysisRows({ campusId, divisionId, disciplineId, calGetcId, courseChoices, excludeTutoringId }) {
    const selectedCampus = document.getElementById(campusId)?.value || '';
    const selectedDivision = document.getElementById(divisionId)?.value || '';
    const selectedDiscipline = document.getElementById(disciplineId)?.value || '';
    const selectedCalGetc = document.getElementById(calGetcId)?.value || '';
    const selectedCourses = courseChoices ? courseChoices.getValue(true) : [];
    const excludeTutoringOpenLab = document.getElementById(excludeTutoringId)?.checked !== false;
    const filterCourseCodes = buildCourseFilterSet(selectedCourses);

    return hmRaw.filter(r => {
      if (excludeTutoringOpenLab && isTutoringOpenLabSection(r)) return false;
      if (selectedCampus && extractField(r, ['Campus', 'campus', 'CAMPUS']) !== selectedCampus) return false;
      if (selectedDivision && r.Division !== selectedDivision) return false;
      if (selectedDiscipline && r.Discipline !== selectedDiscipline) return false;
      if (!sectionMatchesCalGetc(r, selectedCalGetc)) return false;
      if (selectedCourses.length && !filterCourseCodes.has(window.normalizeCALGETCCode ? window.normalizeCALGETCCode(r.key) : r.key)) return false;
      if (!isValidRoom(r.Building, r.Room)) return false;
      return true;
    });
  }

  function updateAllHeatmap() {
    clearHeatmapCellFilter(false);
    const primeOnly = document.getElementById('heatmap-prime-only')?.checked;
    const underutilizedOnly = document.getElementById('heatmap-underutilized-only')?.checked;
    const rows = filterAnalysisRows({
      campusId: 'heatmap-campus-select',
      divisionId: 'heatmap-division-select',
      disciplineId: 'heatmap-discipline-select',
      calGetcId: 'heatmap-calgetc-select',
      courseChoices: hmChoices,
      excludeTutoringId: 'heatmap-exclude-tutoring-openlab'
    }).filter(r => {
      const startHour = parseHour(r.Start_Time);
      if (primeOnly && !r.Days.some(day => isPrimeHeatmapSlot(day, startHour))) return false;
      if (underutilizedOnly && !isUnderutilizedHeatmapRow([r.key, r.CRN || '', r.Building, r.Room, Array.isArray(r.Days) ? r.Days.join(',') : '', r.Start_Time + '-' + r.End_Time, r.Enrollment || 0, r.Capacity || 0])) return false;
      return true;
    }).map(r => [
      r.key,
      r.CRN || '',
      r.Building,
      r.Room,
      Array.isArray(r.Days) ? r.Days.join(',') : '',
      r.Start_Time + '-' + r.End_Time,
      r.Enrollment || 0,
      r.Capacity || 0,
      r.Division || '',
      r.Discipline || '',
      r.Campus || '',
      r.Term || '',
      r.ModalityCategory || r.Modality || ''
    ]);
    hmTable.clear().rows.add(rows).draw();
  }

  function renderHeatmapSummaryCards(cells) {
    const node = document.getElementById('heatmap-summary-cards');
    if (!node) return;
    const usable = (cells || []).filter(cell => cell.sections > 0);
    if (!usable.length) {
      const excluded = document.getElementById('heatmap-exclude-tutoring-openlab')?.checked !== false ? hmRaw.filter(isTutoringOpenLabSection).length : 0;
      node.innerHTML = `<div><strong>N/A</strong><span>No matching heatmap periods</span></div><div><strong>${excluded}</strong><span>Tutoring/Open Lab rows excluded</span></div>`;
      return;
    }
    const bySections = [...usable].sort((a, b) => b.sections - a.sections || b.enrollment - a.enrollment);
    const byEnrollment = [...usable].sort((a, b) => b.enrollment - a.enrollment || b.sections - a.sections);
    const lightest = [...usable].sort((a, b) => a.sections - b.sections || a.enrollment - b.enrollment)[0];
    const lowestEnrollment = [...usable].sort((a, b) => a.enrollment - b.enrollment || a.sections - b.sections)[0];
    const card = (label, value, detail) => `<div><strong>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span>${detail ? `<small>${escapeHTML(detail)}</small>` : ''}</div>`;
    node.innerHTML = [
      card('Busiest day/time', formatHeatmapCardValue(bySections[0], 'sections'), `${bySections[0].enrollment} enrolled / ${bySections[0].capacity} seats`),
      card('Lightest day/time', formatHeatmapCardValue(lightest, 'sections'), `${lightest.enrollment} enrolled / ${lightest.capacity} seats`),
      card('Highest enrolled time block', formatHeatmapCardValue(byEnrollment[0], 'enrollment'), `${byEnrollment[0].sections} section start${byEnrollment[0].sections === 1 ? '' : 's'}`),
      card('Lowest enrolled time block', formatHeatmapCardValue(lowestEnrollment, 'enrollment'), `${lowestEnrollment.sections} section start${lowestEnrollment.sections === 1 ? '' : 's'}`),
      card('Tutoring/Open Lab rows excluded', document.getElementById('heatmap-exclude-tutoring-openlab')?.checked !== false ? hmRaw.filter(isTutoringOpenLabSection).length : 0, 'Default exclusion for standard analytics')
    ].join('');
  }

  function updateHeatmap() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const metric = heatmapMetricMode();
    const startHours = filtered
      .map(row => parseHour(row[5]?.split('-')[0]?.trim()))
      .filter(hour => Number.isFinite(hour));
    let minHour = startHours.length ? Math.floor(Math.min(...startHours) * 2) / 2 : 6;
    let maxHour = startHours.length ? (Math.ceil(Math.max(...startHours) * 2) / 2) + 0.5 : 22;
    if (minHour >= maxHour) { minHour = 6; maxHour = 22; }
    const hours = buildHalfHourSlots(minHour, maxHour);
    const cells = {};
    hmDays.forEach(d => cells[d] = hours.map(() => ({ sections: 0, enrollment: 0, capacity: 0, crns: new Set() })));
    filtered.forEach((row, rowIndex) => {
      const [ course, crns, bld, room, daysStr, timeStr ] = row;
      const dayList = normalizeMeetingDays(daysStr);
      const timeParts = timeStr.split('-');
      const st = timeParts[0]?.trim();
      const en = timeParts[1]?.trim();
      if (!st || !en) return;
      const startHour = parseHour(st);
      const endHour = parseHour(en);
      if (startHour == null || endHour == null || startHour === endHour) return;
      const startIndex = hours.indexOf(Math.floor(startHour * 2) / 2);
      if (startIndex < 0) return;
      dayList.forEach(d => {
        if (!cells[d]) return;
        const bucketKey = heatmapCrnKey(row, rowIndex);
        if (cells[d][startIndex].crns.has(bucketKey)) return;
        cells[d][startIndex].crns.add(bucketKey);
        cells[d][startIndex].sections++;
        cells[d][startIndex].enrollment += rowEnrollment(row);
        cells[d][startIndex].capacity += rowCapacity(row);
      });
    });
    const cellValue = (cell) => {
      if (metric === 'enrollment') return cell.enrollment;
      if (metric === 'capacity') return cell.capacity;
      if (metric === 'fillRate') return cell.capacity > 0 ? cell.enrollment / cell.capacity : 0;
      return cell.sections;
    };
    const allCells = [];
    Object.entries(cells).forEach(([day, row]) => {
      row.forEach((cell, index) => allCells.push({ ...cell, day, hour: hours[index], value: cellValue(cell) }));
    });
    const nonEmptyCells = allCells.filter(cell => cell.sections > 0);
    const maxC = Math.max(0, ...nonEmptyCells.map(cell => cell.value));
    renderHeatmapSummaryCards(nonEmptyCells);
    let html = '<div class="heatmap-wrap"><table class="heatmap heatmap-table">';
    html += '<thead><tr><th class="heatmap-day-header">Day</th>';
    hours.forEach(h=>{
      html+=`<th class="heatmap-time-header">${formatHeatmapTimeHeader(h)}</th>`;
    });
    html+='</tr></thead><tbody>';
    hmDays.forEach(d=>{
      html+=`<tr><th class="heatmap-day-cell">${d}</th>`;
      cells[d].forEach((cell, i)=>{
        const h = hours[i];
        const value = cellValue(cell);
        const op=maxC?value/maxC:0;
        const level = op >= 0.8 ? 'high' : op >= 0.45 ? 'medium' : op > 0 ? 'low' : 'empty';
        const selected = heatmapCellFilter && heatmapCellFilter.day === d && heatmapCellFilter.hour === h ? ' is-selected' : '';
        const title = `${d} ${formatHourLabel(h)} scheduled start time: ${formatHeatmapValue(value, metric) || 0} ${heatmapMetricLabel(metric)}; ${cell.sections} section${cell.sections === 1 ? '' : 's'}, ${cell.enrollment} enrolled, ${cell.capacity} seats`;
        html+=`<td class="heatmap-cell heatmap-value-cell heatmap-${level}${selected}" data-day="${escapeHTML(d)}" data-hour="${h}" title="${escapeHTML(title)}" style="--heat:${op.toFixed(3)}">${formatHeatmapValue(value, metric)}</td>`;
      });
      html+='</tr>';
    });
    html+='</tbody></table></div>';
    document.getElementById('heatmapContainer').innerHTML = html;
    if (window.COSUtils?.renderHeatmapExportToolbar) {
      const filters = [
        `Campus: ${document.getElementById('heatmap-campus-select')?.value || 'All'}`,
        `Division: ${document.getElementById('heatmap-division-select')?.value || 'All'}`,
        `Discipline: ${document.getElementById('heatmap-discipline-select')?.value || 'All'}`,
        `CAL-GETC: ${document.getElementById('heatmap-calgetc-select')?.value || 'All'}`,
        document.getElementById('heatmap-prime-only')?.checked ? 'Prime time only' : '',
        document.getElementById('heatmap-underutilized-only')?.checked ? 'Underutilized only' : ''
      ].filter(Boolean);
      window.COSUtils.renderHeatmapExportToolbar(document.getElementById('heatmapContainer'), {
        container: () => document.getElementById('heatmapContainer'),
        rows: () => allCells.map(cell => ({
          reportName: `${heatmapMetricLabel(metric)} - Heatmap Analytics`,
          termSource: document.getElementById('heatmap-archive-terms')?.selectedOptions?.length ? Array.from(document.getElementById('heatmap-archive-terms').selectedOptions).map(option => option.value).join('; ') : 'Current source',
          selectedFilters: filters.join('; '),
          metric: heatmapMetricLabel(metric),
          day: cell.day,
          timeBlock: formatHourLabel(cell.hour),
          value: formatHeatmapValue(cell.value, metric),
          sections: cell.sections,
          seats: cell.capacity,
          enrollment: cell.enrollment,
          fillRate: cell.capacity ? `${((cell.enrollment / cell.capacity) * 100).toFixed(1)}%` : '',
          waitlist: '',
          modalityScope: 'Physical start-time rows'
        })),
        options: () => ({
          title: `${heatmapMetricLabel(metric)} - Heatmap Analytics`,
          term: document.getElementById('heatmap-archive-terms')?.selectedOptions?.length ? Array.from(document.getElementById('heatmap-archive-terms').selectedOptions).map(option => option.value).join('; ') : 'Current source',
          filters,
          metric: heatmapMetricLabel(metric),
          modalityScope: 'Physical start-time rows',
          filename: 'heatmap-analytics.png'
        })
      });
    }
    attachHeatmapCellHandlers();
    setHeatmapCellFilterNote();
  }

  function renderLineChart() {
    const chartDiv = document.getElementById('lineChartCanvas');
    if (lineChartInstance) {
      lineChartInstance.destroy();
      lineChartInstance = null;
    }
    const metric = document.getElementById('linechart-metric-select')?.value === 'presence' ? 'presence' : 'count';
    const isPresenceMetric = metric === 'presence';
    const titleNode = document.getElementById('linechart-title');
    const methodologyNode = document.getElementById('linechart-methodology');
    if (titleNode) titleNode.textContent = isPresenceMetric ? 'Student Presence Duration Graph' : 'Course Duration Graph';
    if (methodologyNode) {
      methodologyNode.textContent = isPresenceMetric
        ? 'The Student Presence Duration Graph estimates how many enrolled students are scheduled to be physically present during each half-hour interval by day of week. Calculation: interval total = census enrollment when available, otherwise current enrollment, applied once per distinct CRN/day/start/end block whose meeting time overlaps that half-hour interval. Duplicate rows for the same CRN/day/start/end count once; the same CRN with a different day or different start/end counts as a distinct meeting block.'
        : 'The Course Duration Graph counts how many classes are active during each half-hour interval by day of week. Calculation: interval count = active distinct CRN/day/start/end blocks whose meeting time overlaps that half-hour interval. Duplicate rows for the same CRN/day/start/end count once; the same CRN with a different day or different start/end counts as a distinct meeting block.';
    }
    const filtered = filterAnalysisRows({
      campusId: 'linechart-campus-select',
      divisionId: 'linechart-division-select',
      disciplineId: 'linechart-discipline-select',
      calGetcId: 'linechart-calgetc-select',
      courseChoices: lineCourseChoices,
      excludeTutoringId: 'linechart-exclude-tutoring-openlab'
    }).filter(r => {
      if (!r.Days.length || !r.Start_Time || !r.End_Time) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });

    const [minHour, maxHour] = getTimeRangeFromData(filtered);
    const hours = buildHalfHourSlots(minHour, maxHour);
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const counts = window.COSSectionModel?.buildHalfHourPresenceSeries
      ? window.COSSectionModel.buildHalfHourPresenceSeries(filtered, hours, {
          metric: isPresenceMetric ? 'presence' : 'count',
          daysOfWeek,
          excludeOnlineTba: true
        })
      : {};
    const ctx = chartDiv.getContext('2d');
    const labels = hours.map(formatHourLabel);
    const colorList = [
      "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2"
    ];
    const datasets = daysOfWeek.map((day, idx) => ({
      label: day,
      data: hours.map(h => counts[day+'-'+h]),
      fill: false,
      borderColor: colorList[idx % colorList.length],
      backgroundColor: colorList[idx % colorList.length],
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2
    }));
    let maxY = 0;
    datasets.forEach(ds => ds.data.forEach(v => { if (v > maxY) maxY = v; }));
    const niceTickStep = (maxValue) => {
      if (maxValue <= 5) return 1;
      const candidates = [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
      return candidates.find(step => Math.ceil(maxValue / step) <= 8) || 1000;
    };
    const stepSize = niceTickStep(maxY);
    const yMax = Math.max(stepSize, Math.ceil(maxY / stepSize) * stepSize);
    const tickCount = Math.min(9, Math.ceil(yMax / stepSize) + 1);
    lineChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`
            }
          }
        },
        layout: { padding: 0 },
        scales: {
          x: { title: { display: true, text: 'Time of Day' }, ticks: { font: { size: 10 } } },
          y: {
            min: 0,
            max: yMax,
            title: { display: true, text: isPresenceMetric ? 'Estimated Students Present' : 'Concurrent Courses' },
            beginAtZero: true,
            ticks: {
              stepSize: stepSize,
              maxTicksLimit: tickCount,
              padding: 2,
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  // --- FullCalendar weekly view with room filter and date span ---
  function renderFullCalendar() {
    if (!calendarEl) return;
    // Prepare events
    const daysMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    let data = currentData;
    const filt = calendarRoomFilter?.value || 'All';
    if (filt && filt !== 'All') {
      data = data.filter(i => getRoomKey(i) === filt);
    }
    // OMIT invalid rooms
    data = (data || []).filter(i => isValidRoom(i.Building || i.BUILDING, i.Room || i.ROOM));
    const events = [];
    (data || []).forEach(ev => {
      let daysArr = Array.isArray(ev.Days) ? ev.Days : (typeof ev.Days === "string" ? ev.Days.split(',') : []);
      daysArr = daysArr.map(d => d.trim()).filter(d => daysMap.hasOwnProperty(d));
      if (!daysArr.length) return;
      // Get date span
      let startDate = extractField(ev, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
      let endDate = extractField(ev, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
      if (!startDate || !endDate) return;
      // Normalize date format to YYYY-MM-DD
      startDate = (startDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
      endDate = (endDate || '').replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$1-$2');
      // If still not ISO, try to parse anyway
      let start = new Date(startDate);
      let end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      // Make end exclusive for FullCalendar
      end.setDate(end.getDate() + 1);
      // Compose event with extra info for popup
      const title = extractField(ev, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);
      const instructor = extractField(ev, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
      const subject_course = ev.Subject_Course || '';
      const crn = ev.CRN || '';
      const bldg_room = `${ev.Building || ''}-${ev.Room || ''}`;
      const displayTime = `${format12(ev.Start_Time)} - ${format12(ev.End_Time)}`;
      const startDateDisplay = startDate || 'N/A';
      const endDateDisplay = endDate || 'N/A';

      events.push({
        title: `${subject_course} CRN: ${crn}\n${bldg_room}`,
        startTime: ev.Start_Time,
        endTime: ev.End_Time,
        daysOfWeek: daysArr.map(d => daysMap[d]),
        startRecur: start.toISOString().slice(0,10),
        endRecur: end.toISOString().slice(0,10),
        extendedProps: {
          subject_course,
          crn,
          bldg_room,
          displayTime,
          instructor,
          title,
          dateRange: `${startDateDisplay} - ${endDateDisplay}`
        }
      });
    });
    // Snap to official term start date if available, else fallback to today
    const initialDate = termStartDates[currentTerm] || new Date().toISOString().slice(0, 10);
    if (calendarEl._fullCalendar) {
      calendarEl._fullCalendar.destroy();
      calendarEl.innerHTML = '';
    }
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      allDaySlot: false,
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      events: events,
      height: 700,
      initialDate: initialDate,
      eventDidMount: function(info) {
        // Show popup tile like snapshot grid
        info.el.addEventListener('mouseenter', function(e) {
          const props = info.event.extendedProps;
          const tooltip = document.getElementById('class-block-tooltip');
          setTooltipLines(tooltip, [
            { text: props.subject_course || '', bold: true },
            { text: props.title },
            { text: `CRN: ${props.crn || ''}` },
            { text: `Time: ${props.displayTime}` },
            { text: `Date Range: ${props.dateRange}` },
            { text: `Instructor: ${props.instructor || 'N/A'}` }
          ]);
          tooltip.style.display = 'block';
          tooltip.style.left = (e.pageX + 12) + 'px';
          tooltip.style.top  = (e.pageY + 12) + 'px';
        });
        info.el.addEventListener('mouseleave', function() {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.display = 'none';
        });
        info.el.addEventListener('mousemove', function(e) {
          const tooltip = document.getElementById('class-block-tooltip');
          tooltip.style.left = (e.pageX + 12) + 'px';
          tooltip.style.top  = (e.pageY + 12) + 'px';
        });
      },
      dayCellDidMount: function(arg) {
        // For timeGridWeek, arg.date is the cell date
        const iso = arg.date.toISOString().slice(0,10);
        if (holidaySet.has(iso)) {
          arg.el.style.backgroundColor = '#e0e0e0';
          arg.el.style.opacity = '0.7';
          arg.el.title = 'Holiday';
        }
      }
    });
    fullCalendarInstance.render();
    calendarEl._fullCalendar = fullCalendarInstance;
  }
});
