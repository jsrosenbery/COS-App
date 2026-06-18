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
  select.appendChild(new Option(allLabel, allValue));
  options.forEach(option => {
    if (option && typeof option === 'object') {
      select.appendChild(new Option(option.label, option.value));
    } else {
      select.appendChild(new Option(option, option));
    }
  });
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
  { code: 'IP', modality: 'In Person', omitted: false },
  { code: '02', modality: 'In Person', omitted: false },
  { code: '22', modality: 'In Person', omitted: false },
  { code: '022', modality: 'In Person', omitted: false },
  { code: '02H', modality: 'In Person', omitted: false },
  { code: '02O', modality: 'In Person', omitted: false },
  { code: '02S', modality: 'In Person', omitted: false },
  { code: '02T', modality: 'In Person', omitted: false },
  { code: '02N', modality: 'In Person', omitted: false },
  { code: '04', modality: 'In Person', omitted: false },
  { code: '06', modality: 'In Person', omitted: false },
  { code: '07', modality: 'In Person', omitted: false },
  { code: '08', modality: 'In Person', omitted: false },
  { code: '09', modality: 'In Person', omitted: false },
  { code: '12', modality: 'In Person', omitted: false },
  { code: 'XX', modality: 'In Person', omitted: false },
  { code: 'YY', modality: 'In Person', omitted: false },
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

function normalizeRoomCatalog(rawRooms) {
  return (rawRooms || [])
    .map(room => ({
      campus: String(room.campus || room.Campus || '').trim(),
      building: String(room.building || room.Building || '').trim(),
      room: String(room.room || room.Room || '').trim(),
      buildingRoom: String(room.buildingRoom || room['Building-Room'] || room.BuildingRoom || `${room.building || room.Building || ''}-${room.room || room.Room || ''}`).trim(),
      type: String(room.type || room.Type || room.roomType || room['Room Type'] || '').trim(),
      capacity: Number.isFinite(Number(room.capacity ?? room.Capacity ?? room.cap)) ? Number(room.capacity ?? room.Capacity ?? room.cap) : null
    }))
    .filter(room => room.building && room.room && room.buildingRoom);
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
  // Convert DAYS like "MW" to ["Monday","Wednesday"]
  const daysMap = {M:"Monday",T:"Tuesday",W:"Wednesday",R:"Thursday",F:"Friday",U:"Sunday",S:"Saturday"};
  const rawDays = extractField(r, [
    'DAYS', 'Days', 'Meeting Days', 'Meet Days', 'Day', 'Days Of Week',
    'Mtg Days', 'Meeting Pattern', 'Meeting_Pattern'
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
    start24 = to24(extractField(r, ['Start_Time', 'Start Time', 'Start', 'Begin Time', 'Begin_Time', 'Class Begin Time', 'Meeting Start', 'Mtg Start']));
    end24 = to24(extractField(r, ['End_Time', 'End Time', 'End', 'Stop Time', 'Stop_Time', 'Class End Time', 'Meeting End', 'Mtg End']));
  }

  return {
    ...r,
    Subject_Course: extractField(r, ['Subject_Course', 'Subject Course', 'Course', 'Course ID', 'Course Number', 'Subject']),
    CRN: extractField(r, ['CRN', 'Course Reference Number']),
    Title: extractField(r, ['Title', 'Course Title', 'Section Title']),
    Division: extractField(r, ['Division', 'Academic Division', 'Department Division', 'School', 'Area']),
    Discipline: getCourseParts(r).discipline,
    Course_Number: getCourseParts(r).courseNumber,
    Instructional_Method: extractField(r, ['Instructional Method', 'Instructional_Method', 'Instr Method', 'Instruction Method', 'Method', 'Modality']),
    Building: extractField(r, ['BUILDING', 'Building', 'Bldg', 'Bldg Code', 'Building Code', 'Facility Building']),
    Room: extractField(r, ['ROOM', 'Room', 'Room Number', 'Room No', 'Facility Room']),
    Days: daysArr,
    Start_Time: start24,
    End_Time: end24,
    Start_Date: extractField(r, ['Start_Date', 'Start Date', 'Start', 'Section Start Date']),
    End_Date: extractField(r, ['End_Date', 'End Date', 'End', 'Section End Date']),
    Instructor: extractField(r, ['Instructor', 'Faculty', 'Primary Instructor']),
    Campus: extractField(r, ['CAMPUS', 'Campus', 'Campus Code']),
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

document.addEventListener('DOMContentLoaded', () => {
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

  const BACKEND_BASE_URL = "https://app-backend-pp98.onrender.com";

  const tabs         = document.getElementById('term-tabs');
  const uploadDiv    = document.getElementById('upload-container');
  const tsDiv        = document.getElementById('upload-timestamp');
  const roomCatalogAdminDiv = document.getElementById('room-catalog-admin');
  const calGetcAdminDiv = document.getElementById('cal-getc-admin');
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
  const utilizationClearBtn = document.getElementById('utilization-clear-btn');
  const utilizationSummary = document.getElementById('utilization-summary');
  const utilizationMap = document.getElementById('utilization-map');
  const modalityCampusSelect = document.getElementById('modality-campus-select');
  const modalityDivisionSelect = document.getElementById('modality-division-select');
  const modalityDisciplineSelect = document.getElementById('modality-discipline-select');
  const modalityLevelSelect = document.getElementById('modality-level-select');
  const modalityCalGetcSelect = document.getElementById('modality-calgetc-select');
  const modalityClearBtn = document.getElementById('modality-clear-btn');
  const modalitySummary = document.getElementById('modality-summary');
  const modalityChart = document.getElementById('modality-chart');
  const modalityTable = document.getElementById('modality-table');
  const table        = document.getElementById('schedule-table');
  const container    = document.getElementById('schedule-container');
  const calendarContainer = document.getElementById('calendar-container');
  const calendarEl = document.getElementById('calendar');
  const roomHeaderDiv = document.getElementById('selected-room-header'); // NEW: header div

  let snapshotRoomFilter = null;
  let calendarRoomFilter = null;

  initHeatmap();
  initLineChartChoices();
  initAvailabilityAttributeFilters();
  setupRoomCatalogAdmin();
  setupCalGetcAdmin();
  loadRoomCatalogFromBackend();
  loadModalityDefinitionsFromBackend();
  loadCalGetcMappingFromBackend();

  window.COSScheduleApp = {
    getCurrentData: () => currentData,
    getCurrentTerm: () => currentTerm,
    renderUtilizationMap: () => renderUtilizationMap()
  };

  document.getElementById('courseSelect').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-campus-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-division-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-discipline-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('heatmap-calgetc-select').addEventListener('change', updateAllHeatmap);
  document.getElementById('linechart-campus-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-division-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-discipline-select').addEventListener('change', renderLineChart);
  document.getElementById('linechart-calgetc-select').addEventListener('change', renderLineChart);
  if (utilizationCampusSelect) utilizationCampusSelect.addEventListener('change', renderUtilizationMap);
  if (utilizationTypeSelect) utilizationTypeSelect.addEventListener('change', renderUtilizationMap);
  if (modalityCampusSelect) modalityCampusSelect.addEventListener('change', renderModalityTool);
  if (modalityDivisionSelect) modalityDivisionSelect.addEventListener('change', renderModalityTool);
  if (modalityDisciplineSelect) modalityDisciplineSelect.addEventListener('change', renderModalityTool);
  if (modalityLevelSelect) modalityLevelSelect.addEventListener('change', renderModalityTool);
  if (modalityCalGetcSelect) modalityCalGetcSelect.addEventListener('change', renderModalityTool);
  if (utilizationClearBtn) {
    utilizationClearBtn.onclick = () => {
      if (utilizationCampusSelect) utilizationCampusSelect.value = '';
      if (utilizationTypeSelect) utilizationTypeSelect.value = '';
      renderUtilizationMap();
    };
  }
  if (modalityClearBtn) {
    modalityClearBtn.onclick = () => {
      if (modalityCampusSelect) modalityCampusSelect.value = '';
      if (modalityDivisionSelect) modalityDivisionSelect.value = '';
      if (modalityDisciplineSelect) modalityDisciplineSelect.value = '';
      if (modalityLevelSelect) modalityLevelSelect.value = '';
      if (modalityCalGetcSelect) modalityCalGetcSelect.value = '';
      renderModalityTool();
    };
  }

  document.getElementById('heatmap-clear-btn').onclick = () => {
    if (hmChoices) hmChoices.removeActiveItems();
    ['heatmap-campus-select', 'heatmap-division-select', 'heatmap-discipline-select', 'heatmap-calgetc-select'].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.value = '';
    });
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

    roomCatalogAdminDiv.append(title, exportBtn, exportJsonBtn, importLabel, status);
    appendModalityDefinitionsAdmin(roomCatalogAdminDiv);

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

  function appendModalityDefinitionsAdmin(parent) {
    const wrap = document.createElement('div');
    wrap.className = 'modality-admin';

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
    parent.appendChild(wrap);

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

  function getRoomCatalogPassword(action) {
    const password = prompt(`Enter upload password to ${action} room catalog:`);
    if (!password) {
      alert('Room catalog action cancelled.');
      return null;
    }
    return password;
  }

  function getModalityImportPassword() {
    const password = prompt('Enter upload password to import modality definitions:');
    if (!password) {
      alert('Modality import cancelled.');
      return null;
    }
    return password;
  }

  function getCalGetcImportPassword() {
    const password = prompt('Enter upload password to import CAL-GETC mapping:');
    if (!password) {
      alert('CAL-GETC import cancelled.');
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
      'Room Type': room.type
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

  function exportRoomCatalog(format = 'csv') {
    const password = getRoomCatalogPassword('export');
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
    const password = getModalityImportPassword();
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
    feedHeatmapTool(currentData);
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
    const password = getCalGetcImportPassword();
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
    const password = getRoomCatalogPassword('import');
    if (!password) return;
    try {
      const parsedRooms = await parseRoomCatalogFile(file);
      const rooms = normalizeRoomCatalog(parsedRooms);
      if (!rooms.length) {
        throw new Error('No valid rooms found. Include Building and Room columns.');
      }
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
      alert(`Imported ${payload.count || rooms.length} rooms.`);
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
        feedHeatmapTool(currentData);
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
    label.append(`Upload CSV for ${currentTerm}: `);
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'file-input';
    input.accept = '.csv';
    label.appendChild(input);
    uploadDiv.appendChild(label);
    input.onchange = e => {
      const password = prompt('Enter upload password:');
      if (!password) {
        alert('Upload cancelled.');
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
    const campusValue = utilizationCampusSelect.value;
    const typeValue = utilizationTypeSelect.value;
    resetSelect(utilizationCampusSelect, campuses, 'All', '');
    resetSelect(utilizationTypeSelect, types, 'All', '');
    if (campuses.includes(campusValue)) utilizationCampusSelect.value = campusValue;
    if (types.includes(typeValue)) utilizationTypeSelect.value = typeValue;
  }

  function overlapMinutes(startMin, endMin, windowStart, windowEnd) {
    return Math.max(0, Math.min(endMin, windowEnd) - Math.max(startMin, windowStart));
  }

  function isUtilizationPeakDay(day) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday'].includes(day);
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
    if (room.score < 0.45) {
      return {
        label: 'Under Utilized',
        color: '#2563eb',
        reason: 'Low weighted use compared with the expected use for this room type and capacity.'
      };
    }
    if (room.score < 0.75) {
      return {
        label: 'Moderately Utilized',
        color: '#7c3aed',
        reason: 'Some use is present, but the room is below the preferred adjusted utilization range.'
      };
    }
    if (room.score >= 1.1) {
      return {
        label: 'Very Efficient',
        color: '#059669',
        reason: 'Strong use relative to the adjusted target for this room type and capacity.'
      };
    }
    return {
      label: 'Efficient',
      color: '#0d9488',
      reason: 'Weighted use is aligned with expectations for the room type and capacity.'
    };
  }

  function calculateRoomUtilization() {
    const rooms = getRoomCatalogEntries().filter(room => !isExcludedUtilizationRoom(room)).map(room => ({
      ...room,
      sections: 0,
      totalMinutes: 0,
      peakMinutes: 0,
      weightedMinutes: 0
    }));
    const roomMap = new Map(rooms.map(room => [room.buildingRoom, room]));
    currentData.forEach(section => {
      if (!isValidRoom(section.Building || section.BUILDING, section.Room || section.ROOM)) return;
      const key = getRoomKey(section);
      if (String(key || '').toUpperCase().startsWith('VISFSC-')) return;
      if (!roomMap.has(key)) {
        const fallback = { buildingRoom: key, campus: '', building: section.Building || '', room: section.Room || '', type: '', capacity: null, sections: 0, totalMinutes: 0, peakMinutes: 0, weightedMinutes: 0 };
        roomMap.set(key, fallback);
        rooms.push(fallback);
      }
      const room = roomMap.get(key);
      const days = Array.isArray(section.Days) ? section.Days : [];
      const startMin = parseTime(section.Start_Time || '');
      const endMin = parseTime(section.End_Time || '');
      if (!days.length || !Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return;
      const dailyMinutes = endMin - startMin;
      const peakMinutes = overlapMinutes(startMin, endMin, 9 * 60, 15 * 60);
      room.sections += 1;
      days.forEach(day => {
        const peakCreditMinutes = isUtilizationPeakDay(day) ? peakMinutes : 0;
        const offPeakMinutes = dailyMinutes - peakCreditMinutes;
        room.totalMinutes += dailyMinutes;
        room.peakMinutes += peakCreditMinutes;
        room.weightedMinutes += (peakCreditMinutes * 1.5) + offPeakMinutes;
      });
    });

    const weeklyWeightedAvailable = (4 * ((6 * 60 * 1.5) + (3 * 60))) + (9 * 60);
    return rooms
      .filter(room => room.buildingRoom && room.buildingRoom !== 'undefined-undefined')
      .map(room => {
        const capacity = getCapacityExpectation(room.capacity);
        const target = getRoomTypeTarget(room.type) * capacity.factor;
        const expectedWeightedMinutes = Math.max(weeklyWeightedAvailable * target, 1);
        const score = room.weightedMinutes / expectedWeightedMinutes;
        const totalHours = room.totalMinutes / 60;
        const peakHours = room.peakMinutes / 60;
        const weightedHours = room.weightedMinutes / 60;
        const expectedWeightedHours = expectedWeightedMinutes / 60;
        const peakShare = room.totalMinutes ? room.peakMinutes / room.totalMinutes : 0;
        const smallRoomCaution = room.capacity != null && room.capacity < 20 && totalHours >= 12;
        const enriched = { ...room, score, totalHours, peakHours, weightedHours, expectedWeightedHours, peakShare, target, capacityLabel: capacity.label, smallRoomCaution };
        return { ...enriched, status: getUtilizationStatus(enriched) };
      })
      .sort((a, b) => b.score - a.score || a.buildingRoom.localeCompare(b.buildingRoom, undefined, { numeric: true }));
  }

  function renderUtilizationMap() {
    if (!utilizationMap || !utilizationSummary) return;
    const selectedCampus = utilizationCampusSelect?.value || '';
    const selectedType = utilizationTypeSelect?.value || '';
    const rooms = calculateRoomUtilization()
      .filter(room => !selectedCampus || room.campus === selectedCampus)
      .filter(room => !selectedType || room.type === selectedType);
    const counts = rooms.reduce((acc, room) => {
      acc[room.status.label] = (acc[room.status.label] || 0) + 1;
      return acc;
    }, {});
    utilizationSummary.replaceChildren();
    [
      `Rooms: ${rooms.length}`,
      `Not Utilized: ${counts['Not Utilized'] || 0}`,
      `Very Efficient: ${counts['Very Efficient'] || 0}`,
      `Efficient: ${counts.Efficient || 0}`,
      `Moderately Utilized: ${counts['Moderately Utilized'] || 0}`,
      `Under Utilized: ${counts['Under Utilized'] || 0}`,
      `Small-room cautions: ${rooms.filter(room => room.smallRoomCaution).length}`
    ].forEach(text => {
      const pill = document.createElement('div');
      pill.className = 'utilization-pill';
      pill.textContent = text;
      utilizationSummary.appendChild(pill);
    });

    utilizationMap.replaceChildren();
    if (!rooms.length) {
      utilizationMap.textContent = 'No rooms match the selected filters.';
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
        ['Score', room.score.toFixed(2)],
        ['Weekly hours', room.totalHours.toFixed(1)],
        ['Peak hours', room.peakHours.toFixed(1)],
        ['Weighted hours', room.weightedHours.toFixed(1)],
        ['Expected weighted', room.expectedWeightedHours.toFixed(1)],
        ['Peak share', `${Math.round(room.peakShare * 100)}%`],
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
      reason.textContent = `${room.status.reason} ${room.capacityLabel}.${room.smallRoomCaution ? ' Small room caution applies because capacity is below 20 and weekly scheduled use is 12+ hours.' : ''}`;
      card.append(title, badge, details, reason);
      utilizationMap.appendChild(card);
    });
  }

  function getInstructionalMethod(section) {
    return extractField(section, [
      'Instructional_Method',
      'Instructional Method',
      'Instr Method',
      'Instruction Method',
      'InstructionalMethod',
      'Method',
      'Modality',
      'Schedule Type'
    ]);
  }

  function getModalityCategory(method) {
    const value = String(method || '').trim();
    const code = normalizeModalityCode(value);
    const normalized = value.toLowerCase();
    if (modalityDefinitionMap.has(code)) return modalityDefinitionMap.get(code);
    if (!value) return 'Unspecified';
    if (/(hybrid|blended|partially online|part online|partially distance)/.test(normalized)) return 'Hybrid';
    if (/(online|web|internet|distance|asynchronous|synchronous|remote|virtual)/.test(normalized)) return 'Online';
    if (/(in[ -]?person|face[ -]?to[ -]?face|on[ -]?campus|lecture|lab|activity|clinical|field)/.test(normalized)) return 'In Person';
    return 'Other';
  }

  function getSectionIdentity(section, index) {
    const crn = extractField(section, ['CRN', 'Course Reference Number']);
    if (crn) return `CRN:${crn}`;
    return [
      extractField(section, ['Subject_Course', 'Subject Course', 'Course']),
      extractField(section, ['Title', 'Course Title']),
      getInstructionalMethod(section),
      extractField(section, ['Start_Date', 'Start Date']),
      extractField(section, ['End_Date', 'End Date'])
    ].filter(Boolean).join('|') || `ROW:${index}`;
  }

  function getDivision(section) {
    return extractField(section, ['Division', 'Academic Division', 'Department Division', 'School', 'Area']);
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
    const campusValue = modalityCampusSelect.value;
    const divisionValue = modalityDivisionSelect.value;
    const disciplineValue = modalityDisciplineSelect.value;
    const levelValue = modalityLevelSelect.value;
    const calGetcValue = modalityCalGetcSelect?.value || '';
    const campuses = getUniqueCampuses(currentData);
    const divisions = [...new Set(currentData.map(getDivision).filter(Boolean))].sort();
    const disciplines = [...new Set(currentData.map(section => getCourseParts(section).discipline).filter(Boolean))].sort();
    const levels = [...new Set(currentData.map(section => getCourseLevel(getCourseParts(section).courseNumber)).filter(Boolean))]
      .sort((a, b) => getCourseLevelSort(a) - getCourseLevelSort(b));
    resetSelect(modalityCampusSelect, campuses, 'All', '');
    resetSelect(modalityDivisionSelect, divisions, 'All', '');
    resetSelect(modalityDisciplineSelect, disciplines, 'All', '');
    resetSelect(modalityLevelSelect, levels, 'All', '');
    if (modalityCalGetcSelect) resetSelect(modalityCalGetcSelect, calGetcFilterOptions, 'All', '');
    if (campuses.includes(campusValue)) modalityCampusSelect.value = campusValue;
    if (divisions.includes(divisionValue)) modalityDivisionSelect.value = divisionValue;
    if (disciplines.includes(disciplineValue)) modalityDisciplineSelect.value = disciplineValue;
    if (levels.includes(levelValue)) modalityLevelSelect.value = levelValue;
    if (calGetcFilterOptions.some(option => option.value === calGetcValue) && modalityCalGetcSelect) modalityCalGetcSelect.value = calGetcValue;
  }

  function calculateModalityBalance() {
    const selectedCampus = modalityCampusSelect?.value || '';
    const selectedDivision = modalityDivisionSelect?.value || '';
    const selectedDiscipline = modalityDisciplineSelect?.value || '';
    const selectedLevel = modalityLevelSelect?.value || '';
    const selectedCalGetc = modalityCalGetcSelect?.value || '';
    const seenSections = new Set();
    const categories = new Map();

    currentData.forEach((section, index) => {
      const campus = extractField(section, ['Campus', 'campus', 'CAMPUS']);
      const division = getDivision(section);
      const courseParts = getCourseParts(section);
      const courseLevel = getCourseLevel(courseParts.courseNumber);
      if (selectedCampus && campus !== selectedCampus) return;
      if (selectedDivision && division !== selectedDivision) return;
      if (selectedDiscipline && courseParts.discipline !== selectedDiscipline) return;
      if (selectedLevel && courseLevel !== selectedLevel) return;
      if (!sectionMatchesCalGetc(section, selectedCalGetc)) return;

      const identity = getSectionIdentity(section, index);
      if (seenSections.has(identity)) return;
      seenSections.add(identity);

      const rawMethod = getInstructionalMethod(section) || 'Unspecified';
      if (omittedModalityCodes.has(normalizeModalityCode(rawMethod))) return;
      const category = getModalityCategory(rawMethod);
      if (!categories.has(category)) {
        categories.set(category, {
          category,
          count: 0,
          methods: new Map()
        });
      }
      const bucket = categories.get(category);
      bucket.count += 1;
      bucket.methods.set(rawMethod, (bucket.methods.get(rawMethod) || 0) + 1);
    });

    const total = Array.from(categories.values()).reduce((sum, item) => sum + item.count, 0);
    const order = ['In Person', 'Online', 'Hybrid', 'Dual Enrollment', 'Flex', 'Other', 'Unspecified'];
    return Array.from(categories.values())
      .map(item => ({
        ...item,
        share: total ? item.count / total : 0,
        methodDetails: Array.from(item.methods.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      }))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
      .map(item => ({ ...item, total }));
  }

  function renderModalityTool() {
    if (!modalitySummary || !modalityChart || !modalityTable) return;
    const rows = calculateModalityBalance();
    const total = rows[0]?.total || 0;
    modalitySummary.replaceChildren();
    modalityChart.replaceChildren();
    const tbody = modalityTable.querySelector('tbody');
    if (tbody) tbody.replaceChildren();

    const summaryItems = [
      `Sections: ${total}`,
      `In Person: ${rows.find(row => row.category === 'In Person')?.count || 0}`,
      `Online: ${rows.find(row => row.category === 'Online')?.count || 0}`,
      `Hybrid: ${rows.find(row => row.category === 'Hybrid')?.count || 0}`,
      `Dual Enrollment: ${rows.find(row => row.category === 'Dual Enrollment')?.count || 0}`,
      `Flex: ${rows.find(row => row.category === 'Flex')?.count || 0}`,
      `Other/Unspecified: ${rows.filter(row => row.category === 'Other' || row.category === 'Unspecified').reduce((sum, row) => sum + row.count, 0)}`
    ];
    summaryItems.forEach(text => {
      const pill = document.createElement('div');
      pill.className = 'modality-pill';
      pill.textContent = text;
      modalitySummary.appendChild(pill);
    });

    if (!rows.length) {
      modalityChart.textContent = 'No modality data is available for the selected term.';
      return;
    }

    rows.forEach(row => {
      const bar = document.createElement('div');
      bar.className = 'modality-bar';
      const label = document.createElement('div');
      label.className = 'modality-bar-label';
      label.textContent = `${row.category} (${row.count}, ${Math.round(row.share * 100)}%)`;
      const track = document.createElement('div');
      track.className = 'modality-bar-track';
      const fill = document.createElement('div');
      fill.className = `modality-bar-fill ${row.category.toLowerCase().replace(/\s+/g, '-')}`;
      fill.style.width = `${Math.max(row.share * 100, 2)}%`;
      track.appendChild(fill);
      bar.append(label, track);
      modalityChart.appendChild(bar);

      if (tbody) {
        const tr = document.createElement('tr');
        [row.category, row.count, `${(row.share * 100).toFixed(1)}%`].forEach(value => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });
        const visualTd = document.createElement('td');
        const miniTrack = document.createElement('div');
        miniTrack.className = 'modality-table-track';
        const miniFill = document.createElement('div');
        miniFill.className = `modality-table-fill ${row.category.toLowerCase().replace(/\s+/g, '-')}`;
        miniFill.style.width = `${Math.max(row.share * 100, 2)}%`;
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
    let recDays = Array.isArray(days) ? days : (typeof days === 'string' ? days.split(',') : []);
    recDays = recDays.map(day => String(day || '').trim()).filter(Boolean);
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
        { title: 'Building', render: $.fn.dataTable.render.text() },
        { title: 'Room', render: $.fn.dataTable.render.text() },
        { title: 'Days', render: $.fn.dataTable.render.text() },
        { title: 'Time', render: $.fn.dataTable.render.text() }
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
    const days = normalizeMeetingDays(row[3]);
    if (!days.includes(filter.day)) return false;
    const startTime = row[4]?.split('-')[0]?.trim();
    const startHour = parseHour(startTime);
    if (!Number.isFinite(startHour)) return false;
    return Math.floor(startHour * 2) / 2 === filter.hour;
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
      const key = getCourseKey(r);
      const daysVal = normalizeMeetingDays(r.Days);

      const instructor = extractField(r, ['Instructor', 'Instructor1', 'Instructor(s)', 'Faculty', 'instructor']);
      const startDate = extractField(r, ['Start_Date', 'Start Date', 'Start', 'start_date', 'start']);
      const endDate = extractField(r, ['End_Date', 'End Date', 'End', 'end_date', 'end']);
      const title = extractField(r, ['Title', 'Course_Title', 'Course Title', 'title', 'course_title']);

      const building = r.Building || r.BUILDING || '';
      const room = r.Room || r.ROOM || '';

      let startTime = r.Start_Time || '';
      let endTime = r.End_Time || '';
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
        CRN: r.CRN || '',
        Building: building,
        Room: room,
        Days: daysVal,
        Start_Time: startTime,
        End_Time: endTime,
        Title: title,
        Start_Date: startDate,
        End_Date: endDate,
        Instructor: instructor,
        Campus: extractField(r, ['Campus', 'campus', 'CAMPUS']),
        Division: getDivision(r),
        Discipline: getCourseParts(r).discipline
      };
    }).filter(r => {
      // Omit if room is blank, N/A, LIVE, ONLINE
      if (!isValidRoom(r.Building, r.Room)) return false;
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

  function filterAnalysisRows({ campusId, divisionId, disciplineId, calGetcId, courseChoices }) {
    const selectedCampus = document.getElementById(campusId)?.value || '';
    const selectedDivision = document.getElementById(divisionId)?.value || '';
    const selectedDiscipline = document.getElementById(disciplineId)?.value || '';
    const selectedCalGetc = document.getElementById(calGetcId)?.value || '';
    const selectedCourses = courseChoices ? courseChoices.getValue(true) : [];
    const filterCourseCodes = buildCourseFilterSet(selectedCourses);

    return hmRaw.filter(r => {
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
    const rows = filterAnalysisRows({
      campusId: 'heatmap-campus-select',
      divisionId: 'heatmap-division-select',
      disciplineId: 'heatmap-discipline-select',
      calGetcId: 'heatmap-calgetc-select',
      courseChoices: hmChoices
    }).map(r => [r.key, r.Building, r.Room, Array.isArray(r.Days) ? r.Days.join(',') : '', r.Start_Time + '-' + r.End_Time]);
    hmTable.clear().rows.add(rows).draw();
  }

  function updateHeatmap() {
    const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
    const startHours = filtered
      .map(row => parseHour(row[4]?.split('-')[0]?.trim()))
      .filter(hour => Number.isFinite(hour));
    let minHour = startHours.length ? Math.floor(Math.min(...startHours) * 2) / 2 : 6;
    let maxHour = startHours.length ? (Math.ceil(Math.max(...startHours) * 2) / 2) + 0.5 : 22;
    if (minHour >= maxHour) { minHour = 6; maxHour = 22; }
    const hours = buildHalfHourSlots(minHour, maxHour);
    const counts = {};
    hmDays.forEach(d => counts[d] = hours.map(() => 0));
    filtered.forEach(row => {
      const [ course, bld, room, daysStr, timeStr ] = row;
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
        if (counts[d]) counts[d][startIndex]++;
      });
    });
    const maxC = Math.max(...Object.values(counts).flat());
    let html = '<table class="heatmap">';
    html += '<thead><tr><th>Day/Start Time</th>';
    hours.forEach(h=>{
      html+=`<th>${formatHourLabel(h)}</th>`;
    });
    html+='</tr></thead><tbody>';
    hmDays.forEach(d=>{
      html+=`<tr><th>${d}</th>`;
      counts[d].forEach((c, i)=>{
        const h = hours[i];
        const op=maxC?c/maxC:0;
        const level = op >= 0.8 ? 'high' : op >= 0.45 ? 'medium' : op > 0 ? 'low' : 'empty';
        const selected = heatmapCellFilter && heatmapCellFilter.day === d && heatmapCellFilter.hour === h ? ' is-selected' : '';
        html+=`<td class="heatmap-cell heatmap-${level}${selected}" data-day="${escapeHTML(d)}" data-hour="${h}" title="${escapeHTML(d)} ${escapeHTML(formatHourLabel(h))}: ${c} start${c === 1 ? '' : 's'}" style="--heat:${op.toFixed(3)}">${c||''}</td>`;
      });
      html+='</tr>';
    });
    html+='</tbody></table>';
    document.getElementById('heatmapContainer').innerHTML = html;
    attachHeatmapCellHandlers();
    setHeatmapCellFilterNote();
  }

  function renderLineChart() {
    const chartDiv = document.getElementById('lineChartCanvas');
    if (lineChartInstance) {
      lineChartInstance.destroy();
      lineChartInstance = null;
    }
    const filtered = filterAnalysisRows({
      campusId: 'linechart-campus-select',
      divisionId: 'linechart-division-select',
      disciplineId: 'linechart-discipline-select',
      calGetcId: 'linechart-calgetc-select',
      courseChoices: lineCourseChoices
    }).filter(r => {
      if (!r.Days.length || !r.Start_Time || !r.End_Time) return false;
      if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
      return true;
    });

    const [minHour, maxHour] = getTimeRangeFromData(filtered);
    const hours = buildHalfHourSlots(minHour, maxHour);
    const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    let counts = {};
    daysOfWeek.forEach(d => hours.forEach(h => counts[d+'-'+h] = 0));
    filtered.forEach(rec => {
      const recDays = normalizeMeetingDays(rec.Days);
      const startHour = parseHour(rec.Start_Time);
      const endHour = parseHour(rec.End_Time);
      if (startHour == null || endHour == null) return;
      if (startHour === endHour) return;
      recDays.forEach(day => {
        if (!day || !daysOfWeek.includes(day)) return;
        hours.forEach(h => {
          if (h >= Math.floor(startHour * 2) / 2 && h < endHour) {
            counts[day+'-'+h] += 1;
          }
        });
      });
    });
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
    let tickCount = Math.max(3, Math.min(6, maxY));
    let stepSize = 1;
    let yMax = 1;
    if (maxY <= 3) {
      tickCount = 3;
      yMax = 3;
      stepSize = 1;
    } else {
      stepSize = Math.ceil(maxY / (tickCount - 1));
      yMax = stepSize * (tickCount - 1);
      if (yMax < maxY) {
        yMax += stepSize;
      }
    }
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
            title: { display: true, text: 'Concurrent Courses' },
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
