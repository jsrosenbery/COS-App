const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const facultyUtils = require('../js/core/faculty-utils.js');
const facultyModel = require('../js/core/faculty-model.js');
const facultyParser = require('../js/core/faculty-parser.js');

const sampleCsv = [
  '"FACULTYID","FacultyName","FCNT_CODE","DIVISIONID","DEPARTMENTID","SUBJ_COURSE","COURSE","CRN","DAYS","CAMPUS","BUILDING","ROOM","STARTTIME","ENDTIME","SCHD_CODE_SSRMEET","ActualEnroll","MaxEnroll","INSM_CODE_SSBSECT","LHE","XLIST"',
  '@00071987,"Abee,  Charles",FT,AG,PLSI,"PLSI 108","Ag Water Management",10833,R,TCC,TCCB,B116,2:10PM,3:00PM,02,24,24,IP,3,ABC',
  '@00071987,"Abee,  Charles",FT,AG,PLSI,"PLSI 108","Ag Water Management",10833,T,TCC,TCCB,B116,1:10PM,3:00PM,02,24,24,IP,3,ABC',
  '@00071987,"Abee,  Charles",FT,AG,PLSI,"PLSI 108","Ag Water Management",10833,R,TCC,TCCB,B116,1:10PM,2:00PM,04,24,24,IP,1,ABC',
  '@00071987,"Abee,  Charles",FT,AG,PLSI,"PLSI 108","Ag Water Management",10833,R,TCC,TCCB,B116,1:10PM,2:00PM,04,24,24,IP,1,ABC',
  '@00071988,"Parttimer, Pat",JP,ART,ART,"ART 001","Drawing",21001,MW,COS,ART,101,9:00AM,10:15AM,XX,20,25,IP,2,',
  '@00071989,"Excluded, Person",AE,AG,WEXP,"WEXP 193F","Agriculture Work Exp",11158,XX,TCC,TCCA,N/A,12:00AM,12:00AM,20,0,10,20,0,',
  '@00071990,"Mystery, Morgan",ZZ,SCI,BIOL,"BIOL 010","Biology",30001,F,HAC,HACEDU,12,8:00AM,9:00AM,07,12,30,IP,1.5,'
].join('\n');

test('faculty utilities map faculty and meeting types', () => {
  assert.equal(facultyUtils.facultyTypeFromFcnt('JP'), 'PART_TIME');
  assert.equal(facultyUtils.facultyTypeFromFcnt('FT'), 'FULL_TIME');
  assert.equal(facultyUtils.facultyTypeFromFcnt('TE'), 'FULL_TIME');
  assert.equal(facultyUtils.facultyTypeFromFcnt('AE'), 'OMIT');
  assert.equal(facultyUtils.facultyTypeFromFcnt('X'), 'OMIT');
  assert.equal(facultyUtils.facultyTypeFromFcnt('ZZ'), 'UNKNOWN');

  assert.equal(facultyUtils.meetingTypeFromSchd('2'), 'Lecture');
  assert.equal(facultyUtils.meetingTypeFromSchd('02'), 'Lecture');
  assert.equal(facultyUtils.meetingTypeFromSchd('4'), 'Lab');
  assert.equal(facultyUtils.meetingTypeFromSchd('04'), 'Lab');
  assert.equal(facultyUtils.meetingTypeFromSchd('XX'), 'Activity');
  assert.equal(facultyUtils.meetingTypeFromSchd('07'), 'Other');
});

test('faculty utilities normalize time and multi-day patterns', () => {
  assert.equal(facultyUtils.normalizeTime('2:10PM'), '14:10');
  assert.equal(facultyUtils.normalizeTime('12:00AM'), '00:00');
  assert.equal(facultyUtils.normalizeTime('9:05 AM'), '09:05');
  assert.deepEqual(facultyUtils.normalizeDays('MW'), ['MO', 'WE']);
  assert.deepEqual(facultyUtils.normalizeDays('TR'), ['TU', 'TH']);
  assert.deepEqual(facultyUtils.normalizeDays('XX'), []);
  assert.equal(facultyUtils.dayPattern(['MO', 'WE']), 'MW');
});

test('faculty parser reads quoted CSV and normalizes requested fields', () => {
  const parsed = facultyParser.parseFacultyScheduleCsv(sampleCsv);
  assert.equal(parsed.rowCount, 7);
  assert.equal(parsed.meetingCount, 6);

  const lecture = parsed.meetings.find(row => row.crn === '10833' && row.dayPattern === 'R' && row.startTime === '14:10');
  assert.ok(lecture);
  assert.equal(lecture.facultyId, '@00071987');
  assert.equal(lecture.facultyName, 'Abee, Charles');
  assert.equal(lecture.fcntCode, 'FT');
  assert.equal(lecture.facultyType, 'FULL_TIME');
  assert.equal(lecture.divisionId, 'AG');
  assert.equal(lecture.departmentId, 'PLSI');
  assert.equal(lecture.subjCourse, 'PLSI 108');
  assert.equal(lecture.subject, 'PLSI');
  assert.equal(lecture.course, '108');
  assert.equal(lecture.courseCode, 'PLSI 108');
  assert.equal(lecture.campus, 'TCC');
  assert.equal(lecture.building, 'TCCB');
  assert.equal(lecture.room, 'B116');
  assert.equal(lecture.actualEnroll, 24);
  assert.equal(lecture.maxEnroll, 24);
  assert.equal(lecture.lhe, 3);
  assert.equal(lecture.insmCode, 'IP');
  assert.equal(lecture.schdCode, '02');
  assert.equal(lecture.schdCodeNormalized, '2');
  assert.equal(lecture.meetingType, 'Lecture');
  assert.equal(lecture.xlist, 'ABC');
});

test('faculty model counts each CRN once unless meeting times differ', () => {
  const parsed = facultyParser.parseFacultyScheduleCsv(sampleCsv);
  const rows10833 = parsed.meetings.filter(row => row.crn === '10833');
  assert.equal(rows10833.length, 3);
  assert.ok(rows10833.some(row => row.dayPattern === 'R' && row.startTime === '14:10' && row.meetingType === 'Lecture'));
  assert.ok(rows10833.some(row => row.dayPattern === 'T' && row.startTime === '13:10' && row.meetingType === 'Lecture'));
  assert.ok(rows10833.some(row => row.dayPattern === 'R' && row.startTime === '13:10' && row.meetingType === 'Lab'));
});

test('faculty model preserves activity, omit, and unknown classifications', () => {
  const parsed = facultyParser.parseFacultyScheduleCsv(sampleCsv);
  const activity = parsed.meetings.find(row => row.crn === '21001');
  assert.equal(activity.facultyType, 'PART_TIME');
  assert.equal(activity.meetingType, 'Activity');
  assert.deepEqual(activity.days, ['MO', 'WE']);

  const omitted = parsed.meetings.find(row => row.crn === '11158');
  assert.equal(omitted.facultyType, 'OMIT');
  assert.equal(omitted.meetingType, 'Other');
  assert.deepEqual(omitted.days, []);

  const unknown = parsed.meetings.find(row => row.crn === '30001');
  assert.equal(unknown.facultyType, 'UNKNOWN');
  assert.equal(unknown.meetingType, 'Other');
});

test('faculty modules expose browser-compatible APIs', () => {
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  [
    'js/core/csv-normalizer.js',
    'js/core/faculty-utils.js',
    'js/core/faculty-model.js',
    'js/core/faculty-parser.js'
  ].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  assert.equal(typeof context.window.COSFacultyUtils.normalizeTime, 'function');
  assert.equal(typeof context.window.COSFacultyModel.normalizeFacultyScheduleRow, 'function');
  assert.equal(typeof context.window.COSFacultyParser.parseFacultyScheduleCsv, 'function');
  const parsed = context.window.COSFacultyParser.parseFacultyScheduleCsv(sampleCsv);
  assert.equal(parsed.meetingCount, 6);
});

test('faculty heatmap inputs support interval, faculty, enrollment, seats, and LHE metrics', () => {
  const parsed = facultyParser.parseFacultyScheduleCsv(sampleCsv);
  const reportable = parsed.meetings.filter(row => row.facultyType !== 'OMIT');
  const mondayNine = reportable.filter(row => row.days.includes('MO') && row.startTime < '09:30' && row.endTime > '09:00');
  const thursdayOne = reportable.filter(row => row.days.includes('TH') && row.startTime < '13:30' && row.endTime > '13:00');

  assert.equal(mondayNine.length, 1);
  assert.equal(new Set(mondayNine.map(row => row.facultyId)).size, 1);
  assert.equal(mondayNine.reduce((total, row) => total + row.actualEnroll, 0), 20);
  assert.equal(mondayNine.reduce((total, row) => total + row.maxEnroll, 0), 25);
  assert.equal(mondayNine.reduce((total, row) => total + row.lhe, 0), 2);

  assert.equal(thursdayOne.length, 1);
  assert.equal(thursdayOne[0].meetingType, 'Lab');
  assert.equal(thursdayOne[0].facultyType, 'FULL_TIME');
  assert.equal(thursdayOne[0].actualEnroll, 24);
  assert.equal(thursdayOne[0].maxEnroll, 24);
  assert.equal(thursdayOne[0].lhe, 1);
});
