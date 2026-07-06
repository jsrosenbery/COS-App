const test = require('node:test');
const assert = require('node:assert/strict');

const optimizer = require('../js/core/schedule-optimization.js');

const rooms = [
  { Campus: 'COS', Building: 'A', Room: '101', Capacity: 32, 'Room Type': 'Classroom', 'Room Priority': 'Lang & Comm' },
  { Campus: 'COS', Building: 'A', Room: '102', Capacity: 45, 'Room Type': 'Classroom', 'Room Priority': 'Language & Communication' },
  { Campus: 'COS', Building: 'SCI', Room: '201', Capacity: 40, 'Room Type': 'Science Lab', 'Room Priority': 'Science' },
  { Campus: 'COS', Building: 'B', Room: '110', Capacity: 50, 'Room Type': 'Classroom', 'Room Priority': 'Fine Arts Priority / Soc Sci Second' }
];

const sections = [
  { term: 'FALL 2026', crn: '12345', subject: 'ENGL', course: 'C1000', section: '001', campus: 'COS', building: 'A', room: '101', days: 'MW', start: '09:00', end: '10:15', actual: 28, cap: 40, division: 'Lang & Comm', roomType: 'Classroom', modality: 'In-Person' },
  { term: 'FALL 2026', crn: '54321', subject: 'MATH', course: '021', section: '001', campus: 'COS', building: 'A', room: '102', days: 'TR', start: '09:00', end: '10:15', actual: 18, cap: 35, division: 'Math', roomType: 'Classroom', modality: 'In-Person' },
  { term: 'FALL 2025', crn: '11111', subject: 'ENGL', course: 'C1000', section: '001', campus: 'COS', building: 'A', room: '102', days: 'MW', start: '09:00', end: '10:15', actual: 39, cap: 40, division: 'Language & Communication', roomType: 'Classroom', modality: 'In-Person' },
  { term: 'FALL 2024', crn: '22222', subject: 'ENGL', course: 'C1000', section: '001', campus: 'COS', building: 'A', room: '102', days: 'MW', start: '09:00', end: '10:15', actual: 41, cap: 42, division: 'Language & Communication', roomType: 'Classroom', modality: 'In-Person' }
];

test('room priority and division names normalize primary secondary and notes', () => {
  const priority = optimizer.normalizeRoomPriority('Administration (Priority: Social Science)');
  const split = optimizer.normalizeRoomPriority('Fine Arts Priority / Soc Sci Second');

  assert.equal(optimizer.normalizeDivisionName('Lang & Comm'), 'Language & Communication');
  assert.equal(optimizer.normalizeDivisionName('P.E.'), 'Physical Education');
  assert.equal(optimizer.normalizeDivisionName('C.F.S.'), 'Consumer/Family Studies');
  assert.equal(priority.primaryPriorityArea, 'Social Science');
  assert.match(priority.priorityNotes, /Priority: Social Science/);
  assert.equal(split.primaryPriorityArea, 'Fine Arts');
  assert.equal(split.secondaryPriorityArea, 'Social Science');
  assert.equal(split.priorityMatchConfidence, 'High');
});

test('room catalog compatibility preserves capacity room type and priority audit fields', () => {
  const normalized = optimizer.normalizeRoomCatalog([{ Campus: 'COS', Building: 'A', Room: '101', Capacity: '32', 'Room Type': 'Classroom', 'Room Priority': 'English' }]);
  const audit = optimizer.roomPriorityAudit(normalized);

  assert.equal(normalized[0].capacity, 32);
  assert.equal(normalized[0].roomType, 'Classroom');
  assert.equal(normalized[0].primaryPriorityArea, 'Language & Communication');
  assert.equal(audit[0].roomKey, 'A-101');
  assert.equal(audit[0].rawRoomPriority, 'English');
  assert.equal(audit[0].primaryPriorityArea, 'Language & Communication');
});

test('room fit flags historical cap section cap oversize and priority mismatch', () => {
  const small = optimizer.roomFitScore(sections[0], rooms[0], sections, { priorityBehavior: 'prefer' });
  const largeMismatch = optimizer.roomFitScore({ ...sections[1], actual: 10, cap: 15 }, rooms[3], sections, { priorityBehavior: 'prefer' });

  assert.ok(small.flags.includes('Room too small for historical cap'));
  assert.ok(small.flags.includes('Room too small for section cap'));
  assert.ok(largeMismatch.flags.includes('Room too large for expected enrollment'));
  assert.ok(largeMismatch.flags.includes('Priority mismatch'));
});

test('same-time room move recommends better available room without changing source data', () => {
  const currentRows = sections.filter(row => row.term === 'FALL 2026');
  const moves = optimizer.generateRoomMoveRecommendations(currentRows, rooms, { priorityBehavior: 'prefer', historyRows: sections });
  const move = moves.find(row => row.crn === '12345');

  assert.ok(move);
  assert.equal(move.currentRoom, 'A-101');
  assert.equal(move.suggestedRoom, 'A-102');
  assert.match(move.reason, /Move CRN 12345/);
  assert.equal(sections[0].room, '101');
});

test('room move current capacity matches catalog when section room repeats building code', () => {
  const catalog = [
    { Campus: 'TCC', Building: 'TCCB', Room: 'B120', Capacity: 20, 'Room Type': 'Classroom', 'Room Priority': 'Industry and Technology' },
    { Campus: 'TCC', Building: 'TCCB', Room: 'B110', Capacity: 40, 'Room Type': 'Classroom', 'Room Priority': 'Industry and Technology' }
  ];
  const active = [
    { term: 'FALL 2026', crn: '10248', subject: 'AGMT', course: '001', campus: 'TCC', building: 'TCCB', room: 'TCCB TCCB B120', days: 'MW', start: '09:00', end: '10:15', actual: 40, cap: 40, division: 'Industry and Technology', roomType: 'Classroom', modality: 'In-Person' }
  ];

  const normalized = optimizer.normalizeSection(active[0]);
  const moves = optimizer.generateRoomMoveRecommendations(active, catalog, { priorityBehavior: 'prefer', historyRows: active });

  assert.equal(normalized.room, 'B120');
  assert.equal(normalized.roomKey, 'TCCB-B120');
  assert.equal(moves[0]?.currentRoom, 'TCCB-B120');
  assert.equal(moves[0]?.currentCapacity, 20);
  assert.equal(moves[0]?.suggestedRoom, 'TCCB-B110');
});

test('schedule type compatibility maps lecture and lab codes defensibly', () => {
  assert.equal(optimizer.scheduleTypeCompatibility({ scheduleType: '02' }).normalizedInstructionalComponent, 'Lecture');
  assert.equal(optimizer.scheduleTypeCompatibility({ scheduleType: '2' }).normalizedInstructionalComponent, 'Lecture');
  assert.equal(optimizer.scheduleTypeCompatibility({ scheduleType: '04' }).normalizedInstructionalComponent, 'Lab');
  assert.equal(optimizer.scheduleTypeCompatibility({ scheduleType: '4' }).normalizedInstructionalComponent, 'Lab');
});

test('lecture sections are not recommended into labs and lab sections are not recommended into classrooms', () => {
  const catalog = [
    { Campus: 'COS', Building: 'C', Room: '101', Capacity: 40, 'Room Type': 'Classroom', 'Room Priority': 'Science' },
    { Campus: 'COS', Building: 'L', Room: '201', Capacity: 40, 'Room Type': 'Science Lab', 'Room Priority': 'Science' }
  ];
  const lecture = { term: 'FALL 2026', crn: '20001', subject: 'BIO', course: '010', campus: 'COS', building: 'C', room: '099', days: 'MW', start: '09:00', end: '10:00', actual: 30, cap: 35, division: 'Science', SCHD_CODE_SSRMEET: '02', modality: 'In-Person' };
  const lab = { ...lecture, crn: '20002', building: 'L', room: '099', SCHD_CODE_SSRMEET: '04' };

  const lectureCandidates = optimizer.candidateRoomsForSection(lecture, catalog);
  const labCandidates = optimizer.candidateRoomsForSection(lab, catalog);

  assert.equal(lectureCandidates.some(room => /Lab/.test(room.roomType)), false);
  assert.equal(lectureCandidates.some(room => /Classroom/.test(room.roomType)), true);
  assert.equal(labCandidates.some(room => /Classroom/.test(room.roomType)), false);
  assert.equal(labCandidates.some(room => /Lab/.test(room.roomType)), true);
});

test('unknown current room infers required room type from SCHD Code', () => {
  const catalog = [
    { Campus: 'COS', Building: 'C', Room: '101', Capacity: 40, 'Room Type': 'Classroom', 'Room Priority': 'Science' },
    { Campus: 'COS', Building: 'L', Room: '201', Capacity: 40, 'Room Type': 'Science Lab', 'Room Priority': 'Science' }
  ];
  const section = { term: 'FALL 2026', crn: '21001', subject: 'BIO', course: '010', campus: 'COS', building: '', room: 'N/A', days: 'MW', start: '09:00', end: '10:00', actual: 30, cap: 35, division: 'Science', SCHD_CODE_SSRMEET: '02', modality: 'In-Person' };
  const moves = optimizer.generateRoomMoveRecommendations([section], catalog, { priorityBehavior: 'prefer', historyRows: [section] });

  assert.equal(optimizer.inferredRequiredRoomType(optimizer.normalizeSection(section)), 'Lecture / Classroom');
  assert.equal(moves[0].suggestedRoom, 'C-101');
  assert.match(moves[0].tradeoffs, /Current room is unknown/);
  assert.equal(/Lab/.test(moves[0].suggestedRoom), false);
});

test('campus is a hard constraint unless cross-campus recommendations are enabled', () => {
  const catalog = [
    { Campus: 'COS', Building: 'A', Room: '101', Capacity: 20, 'Room Type': 'Classroom', 'Room Priority': 'Math' },
    { Campus: 'TCC', Building: 'T', Room: '101', Capacity: 40, 'Room Type': 'Classroom', 'Room Priority': 'Math' }
  ];
  const section = { term: 'FALL 2026', crn: '22001', subject: 'MATH', course: '001', campus: 'COS', building: 'A', room: '101', days: 'MW', start: '09:00', end: '10:00', actual: 35, cap: 35, division: 'Math', SCHD_CODE_SSRMEET: '02', modality: 'In-Person' };

  assert.equal(optimizer.candidateRoomsForSection(section, catalog).length, 0);
  const crossCampus = optimizer.generateRoomMoveRecommendations([section], catalog, { allowCrossCampusMoves: true, historyRows: [section] });
  assert.equal(crossCampus[0].suggestedRoom, 'T-101');
  assert.match(crossCampus[0].tradeoffs, /Cross-campus recommendation/);
});

test('priority violation appears as a tradeoff instead of no-major-tradeoff language', () => {
  const catalog = [
    { Campus: 'COS', Building: 'A', Room: '101', Capacity: 20, 'Room Type': 'Classroom', 'Room Priority': 'Science' },
    { Campus: 'COS', Building: 'B', Room: '101', Capacity: 40, 'Room Type': 'Classroom', 'Room Priority': 'Science' }
  ];
  const section = { term: 'FALL 2026', crn: '23001', subject: 'MATH', course: '001', campus: 'COS', building: 'A', room: '101', days: 'MW', start: '09:00', end: '10:00', actual: 35, cap: 35, division: 'Math', SCHD_CODE_SSRMEET: '02', modality: 'In-Person' };
  const moves = optimizer.generateRoomMoveRecommendations([section], catalog, { priorityBehavior: 'advisory', historyRows: [section] });

  assert.match(moves[0].roomPriorityComparison, /Violates priority/);
  assert.match(moves[0].tradeoffs, /not Math/);
  assert.doesNotMatch(moves[0].tradeoffs, /No major tradeoff/);
});

test('multi-meeting lecture lab section preserves component awareness', () => {
  const rows = [
    { term: 'FALL 2026', crn: '24001', subject: 'CHEM', course: '001', campus: 'COS', building: 'A', room: '101', days: 'M', start: '09:00', end: '10:00', actual: 20, cap: 24, division: 'Science', SCHD_CODE_SSRMEET: '02', modality: 'In-Person' },
    { term: 'FALL 2026', crn: '24001', subject: 'CHEM', course: '001', campus: 'COS', building: 'L', room: '100', days: 'M', start: '10:00', end: '12:00', actual: 20, cap: 24, division: 'Science', SCHD_CODE_SSRMEET: '04', modality: 'In-Person' }
  ];
  const catalog = [
    { Campus: 'COS', Building: 'A', Room: '101', Capacity: 30, 'Room Type': 'Classroom', 'Room Priority': 'Science' },
    { Campus: 'COS', Building: 'L', Room: '100', Capacity: 12, 'Room Type': 'Science Lab', 'Room Priority': 'Science' },
    { Campus: 'COS', Building: 'L', Room: '200', Capacity: 24, 'Room Type': 'Science Lab', 'Room Priority': 'Science' }
  ];
  const moves = optimizer.generateRoomMoveRecommendations(rows, catalog, { priorityBehavior: 'prefer', historyRows: rows });
  const labMove = moves.find(row => row.instructionalComponent === 'Lab');
  const shifts = optimizer.generateTimeShiftRecommendations(rows, catalog, { allowedShiftMinutes: 60, historyRows: rows });

  assert.ok(labMove);
  assert.equal(labMove.suggestedRoom, 'L-200');
  assert.equal(moves.some(row => row.instructionalComponent === 'Lecture' && /L-/.test(row.suggestedRoom)), false);
  assert.ok(shifts.every(row => row.crn !== '24001' || /Lecture\/lab relationship requires scheduler review|Review instructor/.test(row.tradeoffs)));
});

test('cross-listed shared meetings move as a unit using combined enrollment and capacity', () => {
  const rows = [
    { term: 'FALL 2026', crn: '25001', subject: 'HIST', course: '001', campus: 'COS', building: 'A', room: '101', days: 'TR', start: '11:00', end: '12:15', actual: 20, cap: 25, division: 'Social Science', SCHD_CODE_SSRMEET: '02', XLIST: 'XL1', instructor: 'Smith', modality: 'In-Person' },
    { term: 'FALL 2026', crn: '25002', subject: 'POLS', course: '001', campus: 'COS', building: 'A', room: '101', days: 'TR', start: '11:00', end: '12:15', actual: 18, cap: 20, division: 'Social Science', SCHD_CODE_SSRMEET: '02', XLIST: 'XL1', instructor: 'Smith', modality: 'In-Person' }
  ];
  const catalog = [
    { Campus: 'COS', Building: 'A', Room: '101', Capacity: 32, 'Room Type': 'Classroom', 'Room Priority': 'Social Science' },
    { Campus: 'COS', Building: 'B', Room: '110', Capacity: 50, 'Room Type': 'Classroom', 'Room Priority': 'Social Science' }
  ];
  const grouped = optimizer.groupedOptimizationSections(rows);
  const moves = optimizer.generateRoomMoveRecommendations(rows, catalog, { priorityBehavior: 'prefer', historyRows: rows });

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].enrollment, 38);
  assert.equal(grouped[0].sectionCap, 45);
  assert.equal(moves[0].affectedCrns, '25001/25002');
  assert.equal(moves[0].currentEnrollment, 38);
  assert.equal(moves[0].sectionCap, 45);
  assert.match(moves[0].reason, /shared meeting group CRNs 25001\/25002/);
});

test('cross-listed shared lecture can move as unit while separate labs remain separate', () => {
  const rows = [
    { term: 'FALL 2026', crn: '26001', subject: 'BIO', course: '001', campus: 'COS', building: 'A', room: '101', days: 'M', start: '09:00', end: '10:00', actual: 15, cap: 20, division: 'Science', SCHD_CODE_SSRMEET: '02', XLIST: 'XL2', instructor: 'Lee', modality: 'In-Person' },
    { term: 'FALL 2026', crn: '26002', subject: 'BIO', course: '001', campus: 'COS', building: 'A', room: '101', days: 'M', start: '09:00', end: '10:00', actual: 12, cap: 18, division: 'Science', SCHD_CODE_SSRMEET: '02', XLIST: 'XL2', instructor: 'Lee', modality: 'In-Person' },
    { term: 'FALL 2026', crn: '26001', subject: 'BIO', course: '001', campus: 'COS', building: 'L', room: '100', days: 'W', start: '09:00', end: '11:00', actual: 15, cap: 20, division: 'Science', SCHD_CODE_SSRMEET: '04', instructor: 'Lee', modality: 'In-Person' },
    { term: 'FALL 2026', crn: '26002', subject: 'BIO', course: '001', campus: 'COS', building: 'L', room: '101', days: 'W', start: '12:00', end: '14:00', actual: 12, cap: 18, division: 'Science', SCHD_CODE_SSRMEET: '04', instructor: 'Lee', modality: 'In-Person' }
  ];
  const grouped = optimizer.groupedOptimizationSections(rows);

  assert.equal(grouped.some(row => row.affectedCrns.join('/') === '26001/26002' && row.instructionalComponent === 'Lecture'), true);
  assert.equal(grouped.some(row => row.affectedCrns.join('/') === '26001' && row.instructionalComponent === 'Lab'), true);
  assert.equal(grouped.some(row => row.affectedCrns.join('/') === '26002' && row.instructionalComponent === 'Lab'), true);
});

test('time shift recommendations obey allowed tolerance', () => {
  const conflictSections = [
    { term: 'FALL 2026', crn: '1', subject: 'ART', course: '001', campus: 'COS', building: 'A', room: '101', days: 'MW', start: '09:00', end: '10:00', actual: 20, cap: 25, division: 'Fine Arts', roomType: 'Classroom', modality: 'In-Person' },
    { term: 'FALL 2026', crn: '2', subject: 'ART', course: '002', campus: 'COS', building: 'A', room: '101', days: 'MW', start: '10:00', end: '11:00', actual: 20, cap: 25, division: 'Fine Arts', roomType: 'Classroom', modality: 'In-Person' }
  ];
  const none = optimizer.generateTimeShiftRecommendations(conflictSections, rooms, { allowedShiftMinutes: 0 });
  const shifted = optimizer.generateTimeShiftRecommendations(conflictSections, rooms, { allowedShiftMinutes: 30 });

  assert.equal(none.length, 0);
  assert.ok(shifted.every(row => Math.abs(Number(row.timeShiftAmount.match(/-?\d+/)[0])) <= 30));
});

test('add-a-class placement finds available valid room and priority mode affects scoring', () => {
  const advisory = optimizer.addClassPlacement({ course: 'ENGL C1000', expectedEnrollment: 35, campus: 'COS', roomType: 'Classroom', preferredDayPattern: 'MW', preferredStart: '11:00', division: 'Language & Communication' }, sections, rooms, { priorityBehavior: 'advisory' });
  const strictScience = optimizer.addClassPlacement({ course: 'ENGL C1000', expectedEnrollment: 35, campus: 'COS', roomType: 'Classroom', preferredDayPattern: 'MW', preferredStart: '11:00', division: 'Science' }, sections, rooms, { priorityBehavior: 'strict' });

  assert.ok(advisory.length);
  assert.ok(advisory[0].bestRoom);
  assert.match(advisory[0].why, /available/);
  assert.ok(strictScience.every(row => /Science|No priority/.test(row.priorityAlignment) || row.bestRoom.startsWith('SCI')));
});

test('strict priority blocks mismatches while advisory allows warning rows', () => {
  const section = { ...sections[0], division: 'Math', room: '101', building: 'A', cap: 45 };
  const strict = optimizer.generateRoomMoveRecommendations([section], rooms, { priorityBehavior: 'strict', historyRows: sections });
  const advisory = optimizer.generateRoomMoveRecommendations([section], rooms, { priorityBehavior: 'advisory', historyRows: sections });

  assert.equal(strict.some(row => /Violates/.test(row.roomPriorityComparison)), false);
  assert.equal(advisory.some(row => /Violates|priority/.test(row.roomPriorityComparison)), true);
});

test('course profiles support add-a-class dropdown prefill from history', () => {
  const profiles = optimizer.courseProfiles(sections);
  const engl = profiles.find(profile => profile.courseCode === 'ENGL C1000');

  assert.ok(engl);
  assert.equal(engl.subject, 'ENGL');
  assert.equal(engl.division, 'Language & Communication');
  assert.equal(engl.historicalCap >= 40, true);
  assert.equal(engl.typicalEnrollment >= 28, true);
  assert.ok(engl.commonDayTimePatterns.some(pattern => /Monday\/Wednesday/.test(pattern.label)));
  assert.ok(engl.sections.some(section => section.crn === '12345'));
});

test('proposed faculty time evaluation reports data-backed comparison fields', () => {
  const activeRows = [
    ...sections.filter(row => row.term === 'FALL 2026'),
    { term: 'FALL 2026', crn: '77777', subject: 'ENGL', course: 'C1000', section: '002', campus: 'COS', building: 'B', room: '110', days: 'MW', start: '09:00', end: '10:15', actual: 30, cap: 35, division: 'Language & Communication', roomType: 'Classroom', modality: 'In-Person' }
  ];
  const evaluation = optimizer.evaluateProposedTime({
    course: 'ENGL C1000',
    expectedEnrollment: 35,
    campus: 'COS',
    roomType: 'Classroom',
    division: 'Language & Communication',
    proposedDayPattern: 'MW',
    proposedStart: '09:00',
    proposedEnd: '10:15'
  }, activeRows, rooms, { historyRows: sections });

  assert.equal(evaluation.course, 'ENGL C1000');
  assert.match(evaluation.proposedDayTime, /Monday\/Wednesday 9:00 AM-10:15 AM/);
  assert.equal(typeof evaluation.proposedTimeScore, 'number');
  assert.equal(evaluation.competingSections >= 1, true);
  assert.match(evaluation.historicalPerformance, /historical term/);
  assert.ok(Array.isArray(evaluation.roomOptions));
});

test('better-time recommendations compare proposed and recommended evidence', () => {
  const activeRows = [
    ...sections.filter(row => row.term === 'FALL 2026'),
    { term: 'FALL 2026', crn: '77777', subject: 'ENGL', course: 'C1000', section: '002', campus: 'COS', building: 'B', room: '110', days: 'MW', start: '09:00', end: '10:15', actual: 30, cap: 35, division: 'Language & Communication', roomType: 'Classroom', modality: 'In-Person' }
  ];
  const recs = optimizer.recommendBetterTimes({
    course: 'ENGL C1000',
    expectedEnrollment: 35,
    campus: 'COS',
    roomType: 'Classroom',
    division: 'Language & Communication',
    proposedDayPattern: 'MW',
    proposedStart: '09:00',
    proposedEnd: '10:15'
  }, activeRows, rooms, { historyRows: sections });

  assert.ok(recs.length);
  assert.ok(recs[0].recommendedTimeScore > recs[0].proposedTimeScore);
  assert.match(recs[0].whyThisIsBetter, /Compared with/);
  assert.equal(typeof recs[0].competingSectionsNearProposedTime, 'number');
  assert.equal(typeof recs[0].availableRoomCount, 'number');
});

test('optimization indexes and candidate pruning limit room scans', () => {
  const manyRooms = [
    ...rooms,
    { Campus: 'TCC', Building: 'T', Room: '1', Capacity: 40, 'Room Type': 'Classroom', 'Room Priority': 'Language & Communication' },
    { Campus: 'COS', Building: 'Tiny', Room: '1', Capacity: 10, 'Room Type': 'Classroom', 'Room Priority': 'Language & Communication' },
    { Campus: 'COS', Building: 'Huge', Room: '1', Capacity: 200, 'Room Type': 'Classroom', 'Room Priority': 'Language & Communication' },
    { Campus: 'COS', Building: 'Lab', Room: '1', Capacity: 40, 'Room Type': 'Science Lab', 'Room Priority': 'Science' }
  ];
  const active = sections.filter(row => row.term === 'FALL 2026');
  const indexes = optimizer.buildOptimizationIndexes({ activeRows: active, historyRows: sections, rooms: manyRooms });
  const candidates = optimizer.candidateRoomsForSection(active[0], indexes.rooms, {
    indexes,
    roomIndexes: indexes.roomIndexes,
    availability: indexes.availability,
    maxCandidateRoomsPerSection: 2
  });

  assert.equal(indexes.activeSections.length, 2);
  assert.equal(indexes.roomIndexes.byCampus.get('COS').length >= 4, true);
  assert.equal(indexes.historicalDemand.courseMetrics.has('ENGL C1000'), true);
  assert.equal(candidates.length <= 2, true);
  assert.equal(candidates.every(room => room.campus === 'COS'), true);
  assert.equal(candidates.every(room => room.capacity >= 40), true);
  assert.equal(candidates.every(room => /Classroom/.test(room.roomType)), true);
});

test('recommendation stats report evaluated candidates', () => {
  const stats = {};
  const indexes = optimizer.buildOptimizationIndexes({ activeRows: sections.filter(row => row.term === 'FALL 2026'), historyRows: sections, rooms });
  const moves = optimizer.generateRoomMoveRecommendations(indexes.activeSections, indexes.rooms, {
    indexes,
    historicalDemand: indexes.historicalDemand,
    maxCandidateRoomsPerSection: 1,
    stats
  });

  assert.ok(Array.isArray(moves));
  assert.equal(stats.sectionsEvaluated, indexes.activeSections.length);
  assert.equal(stats.candidateRoomsEvaluated <= indexes.activeSections.length, true);
  assert.equal(typeof stats.roomMoveRecommendations, 'number');
});

test('indexed historical demand objects do not trigger array map errors', () => {
  const active = sections.filter(row => row.term === 'FALL 2026');
  const historicalDemand = optimizer.buildHistoricalDemandIndex(sections);
  const indexes = optimizer.buildOptimizationIndexes({ activeRows: active, historyRows: sections, rooms });

  assert.doesNotThrow(() => optimizer.historyForSection(active[0], historicalDemand));
  assert.doesNotThrow(() => optimizer.roomFitScore(active[0], rooms[0], historicalDemand, { historicalDemand }));
  assert.doesNotThrow(() => optimizer.generateTimeShiftRecommendations(active, rooms, {
    allowedShiftMinutes: 30,
    historicalDemand,
    historyRows: historicalDemand
  }));
  assert.doesNotThrow(() => optimizer.evaluateProposedTime({
    course: 'ENGL C1000',
    expectedEnrollment: 35,
    campus: 'COS',
    roomType: 'Classroom',
    division: 'Language & Communication',
    proposedDayPattern: 'MW',
    proposedStart: '09:00',
    proposedEnd: '10:15'
  }, indexes, rooms, { indexes, historicalDemand }));
});
