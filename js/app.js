// Heatmap & Table logic
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dayMap = {'U':'Sunday','M':'Monday','T':'Tuesday','W':'Wednesday','R':'Thursday','F':'Friday','S':'Saturday'};
const hours = Array.from({length:17}, (_, i) => i + 6); // 6 AM–10 PM

let rawData = [];
let dataTableInstance;
let choiceInstance;

function initHeatmapTool() {
  choiceInstance = new Choices('#courseSelect', {
    removeItemButton: true,
    searchEnabled: true,
    placeholderValue: 'Filter by discipline/course',
  });
  dataTableInstance = $('#dataTable').DataTable({
    data: [],
    columns: [
      { title: 'Course' },
      { title: 'Building' },
      { title: 'Room' },
      { title: 'Days' },
      { title: 'Time' }
    ],
    destroy: true,
    searching: true
  });
  dataTableInstance.on('search.dt', updateHeatmap);
}

function feedHeatmapTool(parsedRows) {
  rawData = parsedRows.map(r => {
    const subjCourse = (r.Subject_Course||'').trim().split(/\s+/);
    const key = subjCourse.length >= 2 ? (subjCourse[0] + ' ' + subjCourse[1]) : (r.Subject_Course||'').trim();
    return {
      key,
      BUILDING: (r.BUILDING || '').trim(),
      ROOM: (r.ROOM || '').trim(),
      DAYS: (r.DAYS || '').trim(),
      Time: (r.Time || '').trim(),
    };
  });
  const uniqueKeys = Array.from(new Set(rawData.map(r => r.key).filter(k => k))).sort();
  const choiceItems = uniqueKeys.map(k => ({ value: k, label: k }));
  choiceInstance.setChoices(choiceItems, 'value', 'label', true);
  updateAllHeatmapViews();
}

function updateAllHeatmapViews() {
  const selectedCourses = choiceInstance.getValue(true);
  const tableRows = rawData
    .filter(r => {
      if (selectedCourses.length && !selectedCourses.includes(r.key)) {
        return false;
      }
      const bld = (r.BUILDING||'').toUpperCase();
      const rm = (r.ROOM||'').toUpperCase();
      if (!bld || !rm || bld === 'N/A' || rm === 'N/A' || bld === 'ONLINE') {
        return false;
      }
      const m = (r.Time || '').split('-')[0].trim().match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!m) return false;
      const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
      return hr >= 6 && hr <= 22;
    })
    .map(r => [ r.key, r.BUILDING, r.ROOM, r.DAYS, r.Time ]);
  dataTableInstance.clear().rows.add(tableRows).draw();
}

function updateHeatmap() {
  const filteredData = dataTableInstance.rows({ search: 'applied' }).data().toArray();
  const counts = {};
  days.forEach(d => counts[d] = hours.map(() => 0));
  filteredData.forEach(([course, bld, rm, daysStr, timeStr]) => {
    const dayCodes = (daysStr || '').split('');
    const m = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/);
    if (!m) return;
    const hr = (parseInt(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
    dayCodes.forEach(dc => {
      const weekday = dayMap[dc];
      const hIndex = hours.indexOf(hr);
      if (weekday && hIndex >= 0) {
        counts[weekday][hIndex]++;
      }
    });
  });
  const maxCount = Math.max(...Object.values(counts).flat());
  let html = `<table class="heatmap" style="border-collapse:collapse; margin-top:20px; width:100%;">`;
  html += `<thead><tr><th style="background:#eee; border:1px solid #ccc; padding:4px;">Day/Time</th>`;
  hours.forEach(h => {
    const ap = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 || 12;
    html += `<th style="background:#eee; border:1px solid #ccc; padding:4px;">${hh} ${ap}</th>`;
  });
  html += `</tr></thead><tbody>`;
  days.forEach(d => {
    html += `<tr><th style="background:#eee; border:1px solid #ccc; padding:4px; text-align:left;">${d}</th>`;
    counts[d].forEach(c => {
      const opacity = maxCount ? (c / maxCount) : 0;
      html += `<td style="border:1px solid #ccc; padding:4px; background:rgba(0,100,200,${opacity});">${c}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  $('#heatmapContainer').html(html);
}

function initViewToggle() {
  $('#viewSelect').on('change', function() {
    if (this.value === 'heatmap') {
      $('#schedule-container, #availability-ui, #room-filter, #upload-container, #upload-timestamp').hide();
      $('#heatmap-tool').show();
    } else {
      $('#heatmap-tool').hide();
      $('#schedule-container, #availability-ui, #room-filter, #upload-container, #upload-timestamp').show();
    }
  });
}

function initFileUploadListener() {
  $('#fileInput').on('change', function() {
    const file = this.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        feedHeatmapTool(results.data);
      }
    });
  });
}

$(document).ready(() => {
  initHeatmapTool();
  initViewToggle();
  initFileUploadListener();
  $('#courseSelect').on('change', updateAllHeatmapViews);
  $('#textSearch').on('input', function() {
    dataTableInstance.search(this.value).draw();
  });
});
