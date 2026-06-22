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

// Load supplemental report modules after the main app has attached its own
// startup handlers. The module also supports being loaded after DOMContentLoaded.
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.BACKEND_BASE_URL = window.BACKEND_BASE_URL || window.COS_APP_CONFIG?.backendBaseUrl || 'https://app-backend-pp98.onrender.com';
    if (!window.__cosAnalyticsTermsShim) {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url === `${window.BACKEND_BASE_URL}/terms`) {
          const terms = Array.from(document.querySelectorAll('#term-tabs .tab'))
            .map(tab => tab.textContent.trim())
            .filter(Boolean);
          return Promise.resolve(new Response(JSON.stringify(terms), {
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        if (url.startsWith(`${window.BACKEND_BASE_URL}/schedule/`)) {
          const term = url.slice(`${window.BACKEND_BASE_URL}/schedule/`.length);
          return nativeFetch(`${window.BACKEND_BASE_URL}/api/schedule/${term}`, init)
            .then(response => response.json())
            .then(payload => new Response(JSON.stringify(Array.isArray(payload) ? payload : payload.data || []), {
              headers: { 'Content-Type': 'application/json' }
            }));
        }
        return nativeFetch(input, init);
      };
      window.__cosAnalyticsTermsShim = true;
    }
    const loadScriptOnce = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') resolve();
        else existing.addEventListener('load', resolve, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
    loadScriptOnce('js/enrollment/metrics.js')
      .then(() => loadScriptOnce('js/enrollment/filters.js'))
      .then(() => loadScriptOnce('js/enrollment/consolidation.js'))
      .then(() => loadScriptOnce('js/enrollment/dashboard.js'))
      .then(() => loadScriptOnce('js/enrollment-analytics.js'))
      .catch(err => console.error('Enrollment analytics failed to load:', err));
  }, 0);
});
