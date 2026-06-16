// Keep Common Course Numbering values like C1000 intact for CAL-GETC matching.
(function () {
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
})();
