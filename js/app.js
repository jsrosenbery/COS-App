
// Combined calendar, upload, and heatmap logic
document.addEventListener('DOMContentLoaded', () => {
  // Existing calendar/scheduling logic should be here...
  // -------------------------------------------------
  // For brevity, assume existing functions: renderTermTabs(), selectTerm(), renderSchedule(), setupUpload()
  // and global variable: currentData (array of parsed rows for active term)

  // HEATMAP & TABLE LOGIC BELOW

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const hours = Array.from({length:17}, (_, i) => i + 6); // 6 AM–10 PM

  let rawData = [];
  let dataTableInstance;
  let choiceInstance;

  // Initialize Choices.js & DataTable for heatmap
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
        { title: 'Start_Time' },
        { title: 'End_Time' }
      ],
      destroy: true,
      searching: true
    });
    dataTableInstance.on('search.dt', updateHeatmap);
  }

  // Feed parsed CSV rows (from parser.js) into heatmap
  function feedHeatmapTool(parsedRows) {
    // parsedRows have: Subject_Course, CRN, Building, Room, Days (array), Start_Time ("HH:MM"), End_Time ("HH:MM")
    rawData = parsedRows.map(r => {
      const parts = (r.Subject_Course||'').trim().split(/\s+/);
      const key = parts.length >= 2 ? (parts[0] + ' ' + parts[1]) : (r.Subject_Course||'').trim();
      return {
        key,
        Building: r.Building || '',
        Room: r.Room || '',
        Days: Array.isArray(r.Days) ? r.Days : [],
        Start_Time: r.Start_Time || '',
        End_Time: r.End_Time || ''
      };
    });

    const uniqueKeys = Array.from(new Set(rawData.map(r => r.key).filter(k => k))).sort();
    const choiceItems = uniqueKeys.map(k => ({ value: k, label: k }));
    choiceInstance.setChoices(choiceItems, 'value', 'label', true);

    updateAllHeatmapViews();
  }

  // Update the DataTable based on filters
  function updateAllHeatmapViews() {
    const selectedCourses = choiceInstance.getValue(true);
    const tableRows = rawData
      .filter(r => {
        if (selectedCourses.length && !selectedCourses.includes(r.key)) {
          return false;
        }
        // Exclude if Building/Room blank (already filtered by parser)
        if (!r.Building || !r.Room) return false;
        // Parse start hour
        const startParts = r.Start_Time.split(':');
        if (startParts.length < 1) return false;
        const hr = parseInt(startParts[0]);
        if (isNaN(hr) || hr < 6 || hr > 22) return false;
        return true;
      })
      .map(r => [ r.key, r.Building, r.Room, r.Days.join(','), r.Start_Time, r.End_Time ]);

    dataTableInstance.clear().rows.add(tableRows).draw();
  }

  // Build or update the heatmap HTML
  function updateHeatmap() {
    const filteredData = dataTableInstance.rows({ search: 'applied' }).data().toArray();
    const counts = {};
    days.forEach(d => counts[d] = hours.map(() => 0));

    filteredData.forEach(([course, bld, rm, daysStr, start, end]) => {
      const dayArr = daysStr.split(',').map(d => d.trim());
      const hr = parseInt(start.split(':')[0]);
      dayArr.forEach(d => {
        if (counts[d] !== undefined) {
          const hIndex = hours.indexOf(hr);
          if (hIndex >= 0) {
            counts[d][hIndex]++;
          }
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
    document.getElementById('heatmapContainer').innerHTML = html;
  }

  // Toggle between calendar and heatmap views
  function initViewToggle() {
    document.getElementById('viewSelect').addEventListener('change', function() {
      if (this.value === 'heatmap') {
        document.getElementById('schedule-container').style.display = 'none';
        document.getElementById('availability-ui').style.display = 'none';
        document.getElementById('room-filter').style.display = 'none';
        document.getElementById('upload-container').style.display = 'none';
        document.getElementById('upload-timestamp').style.display = 'none';
        document.getElementById('heatmap-tool').style.display = 'block';
        // Feed heatmap with current term data
        feedHeatmapTool(currentData || []);
      } else {
        document.getElementById('heatmap-tool').style.display = 'none';
        document.getElementById('schedule-container').style.display = 'block';
        document.getElementById('availability-ui').style.display = 'block';
        document.getElementById('room-filter').style.display = 'block';
        document.getElementById('upload-container').style.display = 'block';
        document.getElementById('upload-timestamp').style.display = 'block';
      }
    });
  }

  // Initialize heatmap tool and view toggle
  initHeatmapTool();
  initViewToggle();

  // Whenever a new term is selected (after renderSchedule), call feedHeatmapTool
  const oldSelectTerm = selectTerm;
  selectTerm = function(term) {
    oldSelectTerm(term);
    if (document.getElementById('viewSelect').value === 'heatmap') {
      feedHeatmapTool(currentData || []);
    }
  };

  // After setting up upload parse callback, also feed heatmap
  const oldSetupUpload = setupUpload;
  setupUpload = function() {
    oldSetupUpload();
    if (document.getElementById('viewSelect').value === 'heatmap') {
      feedHeatmapTool(currentData || []);
    }
  };
});
