const assert = require('node:assert/strict');
const test = require('node:test');

global.COSCsvNormalizer = require('../js/core/csv-normalizer.js');
global.COSModalityNormalizer = require('../js/core/modality-normalizer.js');
global.COSSectionModel = require('../js/core/section-model.js');
const roomData = require('../js/core/room-availability-data.js');

function allColumns(overrides = {}) {
  return {
    TERM: 'FALL 2026', CRN: '12345', SUBJECT: 'CHEM', COURSE: '001', COURSE_TITLE: 'General Chemistry',
    SECTION_NUMB: '01', CAMPUS: 'COS', BUILDING: 'VIS', ROOM: '101', DAYS: 'MW', STARTTIME: '0900',
    ENDTIME: '0950', START_DATE: '08/17/2026', END_DATE: '12/18/2026', INSTRUCTIONAL_METHOD_CODE: 'IP',
    SCHD_CODE_SSRMEET: 'LEC', FACULTY_NAME: 'Ada Lovelace', MAX_ENROLL: '30', ACTUAL_ENROLL: '24', XLIST: 'X1',
    ...overrides
  };
}

test('All Columns physical rows preserve distinct CRN meetings and deduplicate identical rows', () => {
  const lecture = allColumns();
  const lab = allColumns({ ROOM: '205', DAYS: 'F', STARTTIME: '1000', ENDTIME: '1150', SCHD_CODE_SSRMEET: 'LAB' });
  const result = roomData.buildRoomAvailabilityDataset([lecture, lab, { ...lecture }]);
  assert.equal(result.meetings.length, 2);
  assert.equal(result.diagnostics.duplicateMeetings, 1);
  assert.deepEqual(result.meetings.map(row => row.Room), ['101', '205']);
  assert.deepEqual(result.meetings.map(row => row.Schedule_Type), ['LEC', 'LAB']);
  assert.equal(result.meetings[0].Subject_Course, 'CHEM 001');
});

test('eligibility keeps physical hybrid FLX and unknown rows while excluding non-room methods', () => {
  const rows = [
    allColumns({ CRN: '1', INSTRUCTIONAL_METHOD_CODE: 'IP' }),
    allColumns({ CRN: '2', INSTRUCTIONAL_METHOD_CODE: 'HYB' }),
    allColumns({ CRN: '3', INSTRUCTIONAL_METHOD_CODE: 'FLX' }),
    allColumns({ CRN: '4', INSTRUCTIONAL_METHOD_CODE: 'UNMAPPED' }),
    allColumns({ CRN: '5', INSTRUCTIONAL_METHOD_CODE: 'ONL' }),
    allColumns({ CRN: '6', INSTRUCTIONAL_METHOD_CODE: '20' }),
    allColumns({ CRN: '7', ROOM: '' }), allColumns({ CRN: '8', ROOM: 'N/A' }),
    allColumns({ CRN: '9', BUILDING: 'ONLINE' })
  ];
  const result = roomData.buildRoomAvailabilityDataset(rows);
  assert.deepEqual(result.meetings.map(row => row.CRN), ['1', '2', '3', '4']);
  assert.equal(result.diagnostics.excludedOnline, 1);
  assert.equal(result.diagnostics.excludedWorkExperience, 1);
  assert.equal(result.diagnostics.excludedInvalidRoom, 3);
});

test('Room Catalog remains authoritative and includes occupied and empty rooms', () => {
  const result = roomData.buildRoomAvailabilityDataset([allColumns({ CRN: '1' }), allColumns({ CRN: '2', ROOM: '205', SCHD_CODE_SSRMEET: 'LAB' })]);
  const rooms = roomData.roomSelectorRooms(result.meetings, [
    { buildingRoom: 'VIS-101' },
    { buildingRoom: 'VIS-205' },
    { buildingRoom: 'VIS-999' }
  ]);
  const calendarMeetings = result.meetings.filter(row => row.Days.length && row.Start_Time && row.End_Time);
  assert.deepEqual(rooms, ['VIS-101', 'VIS-205', 'VIS-999']);
  assert.equal(result.meetings.filter(row => `${row.Building}-${row.Room}` === 'VIS-101').length, 1);
  assert.equal(result.meetings.filter(row => `${row.Building}-${row.Room}` === 'VIS-999').length, 0);
  assert.equal(calendarMeetings.length, result.meetings.length);
});

test('room selector falls back to occupied Section Seating rooms without Room Catalog', () => {
  const result = roomData.buildRoomAvailabilityDataset([allColumns({ ROOM: '101' }), allColumns({ CRN: '2', ROOM: '205' })]);
  assert.deepEqual(roomData.roomSelectorRooms(result.meetings, []), ['VIS-101', 'VIS-205']);
});

test('incomplete meeting rows are diagnostics and never valid occupancy', () => {
  const result = roomData.buildRoomAvailabilityDataset([
    allColumns({ CRN: '1', DAYS: '' }),
    allColumns({ CRN: '2', STARTTIME: '' }),
    allColumns({ CRN: '3', ENDTIME: '' }),
    allColumns({ CRN: '4' })
  ]);
  assert.deepEqual(result.meetings.map(row => row.CRN), ['4']);
  assert.equal(result.diagnostics.excludedMissingDaysTimes, 3);
  assert.equal(result.diagnostics.validPhysicalRooms, 4);
});

test('legacy simple rows remain compatible and valid All Columns rows cannot normalize empty', () => {
  const legacy = { Term: 'FALL 2026', CRN: '44', Subject_Course: 'MATH 010', Building: 'VIS', Room: '300', Days: ['Monday'], Start_Time: '13:00', End_Time: '14:00', Instructional_Method: 'IP' };
  assert.equal(roomData.buildRoomAvailabilityDataset([legacy]).meetings.length, 1);
  const allColumnsResult = roomData.buildRoomAvailabilityDataset([allColumns()]);
  assert.equal(allColumnsResult.meetings.length, 1);
  assert.ok(allColumnsResult.meetings[0].Days.length);
});

test('latest current-term source uses authoritative timestamps and ignores analytics archives', () => {
  const selected = roomData.selectLatestCurrentTermSource([
    { term: 'FALL 2026', kind: 'section-seating', filename: 'misleading-new-name.csv', uploadedAt: '2026-08-08T10:00:00Z' },
    { term: 'FALL 2026', kind: 'analytics-archive', updatedAt: '2026-08-10T10:00:00Z' },
    { term: 'FALL 2026', kind: 'section-seating', filename: 'older-name.csv', updatedAt: '2026-08-09T16:42:00Z' }
  ], 'Fall 2026');
  assert.equal(selected.filename, 'older-name.csv');
  assert.equal(selected.updatedAt, '2026-08-09T16:42:00Z');
});
