// parser.js
// Parses raw CSV file and normalizes parsed rows.
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (err) => reject(err)
    });
  });
}

// Normalize raw rows (from CSV or server) into app data.
const dayMap = {
  'M': 'Monday','T': 'Tuesday','W': 'Wednesday','R': 'Thursday',
  'F': 'Friday','U': 'Sunday','S': 'Saturday'
};
function normalizeRows(rows) {
  return rows
    .filter(r => r.ROOM && !['', 'N/A', 'LIVE'].includes(r.ROOM.toUpperCase()))
    .filter(r => !(r.BUILDING && r.BUILDING.toUpperCase()==='ONLINE'))
    .map(r => ({
      Building: r.BUILDING || '',
      Room: r.ROOM || '',
      Days: (r.DAYS||'').split('').map(d=>dayMap[d]||d),
      Start_Time: r.Time?.split('-')[0].trim()||'',
      End_Time:   r.Time?.split('-')[1].trim()||'',
      Start_Date: r.Start_Date||'',
      End_Date:   r.End_Date||'',
      CRN:        r.CRN||'',
      SUBJECT:    r.SUBJECT||'',
      COURSE:     r.COURSE||''
    }));
}

window.parseCSVFile = parseCSVFile;
window.normalizeRows = normalizeRows;

// app.js currently drops the leading C from catalog numbers such as ENGL C1000
// when deriving analytics keys. Patch the global functions before app.js runs
// its DOMContentLoaded initialization so CAL-GETC filters match those courses.
document.addEventListener('DOMContentLoaded', () => {
  if (typeof extractField !== 'function' || typeof normalizeCourseNumber !== 'function') return;

  function patchedGetCourseParts(section) {
    const subjectCourse = extractField(section, ['Subject_Course', 'Subject Course', 'Course', 'Course ID', 'Course Number']);
    const discipline = extractField(section, ['Discipline', 'DISCIPLINE', 'Subject', 'SUBJECT', 'Subject Code']) ||
      (subjectCourse.match(/^([A-Za-z]+)/)?.[1] || '');
    const courseNumber = extractField(section, ['Course_Number', 'Course Number', 'COURSE', 'Course_No', 'Course No']) ||
      (subjectCourse.match(/[A-Za-z]+\s*([A-Za-z]?[0-9]{1,4}[A-Za-z]?)/)?.[1] || '');
    return {
      subjectCourse,
      discipline: discipline.toUpperCase(),
      courseNumber: normalizeCourseNumber(courseNumber)
    };
  }

  function patchedGetCourseKey(section) {
    const { subjectCourse, discipline, courseNumber } = patchedGetCourseParts(section);
    if (discipline && courseNumber) return `${discipline} ${courseNumber}`.trim();
    return String(subjectCourse || '').trim();
  }

  window.getCourseParts = patchedGetCourseParts;
  window.getCourseKey = patchedGetCourseKey;
  try {
    getCourseParts = patchedGetCourseParts;
    getCourseKey = patchedGetCourseKey;
  } catch (err) {
    console.warn('Course key patch could not update global bindings:', err);
  }
});
