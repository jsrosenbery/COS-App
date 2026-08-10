(function (root, factory) {
  const api = factory(root.COSSectionModel);
  root.COSRoomAvailabilityData = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (sectionModel) {
  'use strict';

  if (!sectionModel) throw new Error('COSSectionModel is required before COSRoomAvailabilityData.');

  const dayNames = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };

  function defaultValidRoom(building, room) {
    const b = String(building || '').trim().toUpperCase();
    const r = String(room || '').trim().toUpperCase();
    return Boolean(b && r && b !== 'ONLINE' && !['N/A', 'LIVE'].includes(r));
  }

  function normalizeRoomAvailabilityRow(rawRow, options = {}) {
    const canonical = sectionModel.normalizeSection(rawRow, { term: options.term });
    const days = (canonical.days || []).map(day => dayNames[day] || day).filter(Boolean);
    const uploadedAt = rawRow?.sourceUploadedAt || rawRow?.__uploadedAt || rawRow?.uploadedAt || '';
    return {
      ...rawRow,
      Term: canonical.term || options.term || '',
      CRN: canonical.crn || '',
      Subject: canonical.subject || '',
      Course: canonical.course || '',
      Subject_Course: canonical.courseCode || '',
      Title: canonical.title || '',
      Section: canonical.section || '',
      Building: canonical.building || '',
      Room: canonical.roomOnly || '',
      Campus: canonical.campus || '',
      Days: days,
      Start_Time: canonical.start || '',
      End_Time: canonical.end || '',
      Start_Date: canonical.startDate || '',
      End_Date: canonical.endDate || '',
      Instructional_Method: canonical.instructionalMethod || '',
      Schedule_Type: canonical.scheduleType || '',
      Instructor: canonical.instructor || '',
      Capacity: canonical.cap,
      Actual_Enroll: canonical.actual,
      Cross_List_ID: canonical.crossList || '',
      canonicalSection: canonical,
      sourceUploadedAt: uploadedAt,
      __uploadedAt: uploadedAt
    };
  }

  function meetingIdentity(meeting) {
    return [
      meeting.Term,
      meeting.CRN,
      meeting.Building,
      meeting.Room,
      (meeting.Days || []).join(','),
      meeting.Start_Time,
      meeting.End_Time,
      meeting.Start_Date,
      meeting.End_Date
    ].map(value => String(value || '').trim().toUpperCase()).join('|');
  }

  function buildRoomAvailabilityDataset(rows, options = {}) {
    const isValidRoom = options.isValidRoom || defaultValidRoom;
    const diagnostics = {
      sourceRows: (rows || []).length,
      normalizedMeetings: 0,
      validPhysicalRooms: 0,
      excludedOnline: 0,
      excludedWorkExperience: 0,
      excludedInvalidRoom: 0,
      excludedMissingDaysTimes: 0,
      duplicateMeetings: 0
    };
    const meetings = [];
    const seen = new Set();

    (rows || []).forEach(rawRow => {
      const meeting = normalizeRoomAvailabilityRow(rawRow, options);
      diagnostics.normalizedMeetings += 1;
      const modality = String(meeting.canonicalSection?.modality || '').toUpperCase();
      if (modality === 'ONLINE') {
        diagnostics.excludedOnline += 1;
        return;
      }
      if (modality === 'WORK EXPERIENCE') {
        diagnostics.excludedWorkExperience += 1;
        return;
      }
      if (!isValidRoom(meeting.Building, meeting.Room)) {
        diagnostics.excludedInvalidRoom += 1;
        return;
      }
      diagnostics.validPhysicalRooms += 1;
      if (!(meeting.Days || []).length || !meeting.Start_Time || !meeting.End_Time || meeting.Start_Time === meeting.End_Time) {
        diagnostics.excludedMissingDaysTimes += 1;
        return;
      }
      const key = meetingIdentity(meeting);
      if (seen.has(key)) {
        diagnostics.duplicateMeetings += 1;
        return;
      }
      seen.add(key);
      meetings.push(meeting);
    });

    return { meetings, diagnostics };
  }

  function roomSelectorRooms(meetings, roomCatalog = []) {
    if ((roomCatalog || []).length) {
      return [...new Set(roomCatalog.map(room => room.buildingRoom || [room.building, room.room].filter(Boolean).join('-')).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return [...new Set((meetings || []).map(meeting => [meeting.Building, meeting.Room].filter(Boolean).join('-')).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function sourceTimestamp(source = {}) {
    return source.uploadedAt || source.updatedAt || source.snapshotTimestamp || source.importedAt || source.filenameDate || '';
  }

  function selectLatestCurrentTermSource(sources, term) {
    return (sources || [])
      .filter(source => String(source?.term || '').trim().toUpperCase() === String(term || '').trim().toUpperCase())
      .filter(source => source.kind !== 'analytics-archive')
      .map((source, index) => ({ source, index, stamp: Date.parse(sourceTimestamp(source)) || 0 }))
      .sort((a, b) => b.stamp - a.stamp || b.index - a.index)[0]?.source || null;
  }

  return {
    normalizeRoomAvailabilityRow,
    meetingIdentity,
    buildRoomAvailabilityDataset,
    roomSelectorRooms,
    selectLatestCurrentTermSource,
    sourceTimestamp
  };
});
