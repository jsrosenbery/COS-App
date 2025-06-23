// heatmap.js - Heatmap tool logic, filtering, rendering

import { hmDays } from './constants.js';
import { extractField, isValidRoom, parseHour, getTimeRangeFromData } from './utils.js';
import * as calgetc from './calgetc.js';

// Global for DataTable/Choices instances
let hmRaw = [];
let hmTable;
let hmChoices;

// Initialize heatmap UI and DataTable
export function initHeatmap() {
  hmChoices = new Choices('#courseSelect', {
    removeItemButton: true,
    searchEnabled: true,
    placeholderValue: 'Filter by discipline/course',
    callbackOnCreateTemplates: function(template) {
      return {
        choice: (classNames, data) => {
          return template(`
            <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled 
              ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="" data-choice 
              data-id="${data.id}" data-value="${data.value}" ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'} 
              role="option">
              <input type="checkbox" ${data.selected ? 'checked' : ''} tabindex="-1"/>
              <span>${data.label}</span>
            </div>
          `);
        }
      }
    }
  });
  if (hmTable) {
    hmTable.destroy();
    $('#dataTable').empty();
  }
  hmTable = $('#dataTable').DataTable({
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
  hmTable.on('search.dt', updateHeatmap);
}

// Accept fresh data for heatmap tool and populate filter options
export function feedHeatmapTool(dataArray) {
  hmRaw = dataArray.map(r => {
    const parts = (r.Subject_Course || '').trim().split(/\s+/);
    const key = parts.length >=2 ? (parts[0] + ' ' + parts[1]) : (r.Subject_Course || '').trim();
    let daysVal = r.Days;
    if (typeof daysVal === 'string') daysVal = daysVal.split(',').map(s => s.trim());

    return {
      ...r,
      key,
      Days: daysVal || [],
      Campus: extractField(r, ['Campus', 'campus', 'CAMPUS'])
    };
  }).filter(r => {
    if (!isValidRoom(r.Building, r.Room)) return false;
    let dayField = r.Days;
    if (Array.isArray(dayField)) dayField = dayField.join(',');
    if (typeof dayField !== 'string') dayField = '';
    const cleaned = dayField.replace(/\s/g, '');
    if (cleaned === 'X' || cleaned === 'XX') return false;
    if (/^(X,)+X$/.test(cleaned)) return false;
    if (parseHour(r.Start_Time) === parseHour(r.End_Time)) return false;
    return true;
  });

  // Populate campus dropdowns
  const campuses = [...new Set(hmRaw.map(r => r.Campus).filter(Boolean))].sort();
  const heatmapCampusSelect = document.getElementById('heatmap-campus-select');
  if (heatmapCampusSelect) {
    heatmapCampusSelect.innerHTML = '<option value="">All</option>' +
      campuses.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // CAL-GETC group options
  let uniqueKeys = Array.from(new Set(hmRaw.map(r => r.key).filter(k => k))).sort();
  let nonCalGetcItems = uniqueKeys
    .filter(k => !k.startsWith("CAL-GETC"))
    .map(k => ({ value: k, label: k }));

  let calGetcAreaOptions = [];
  let calGetcDivisionOptions = [];
  if (window.CAL_GETC_MAPPING) {
    const calGetcGroups = { areas: [], divisions: [] };
    window.CAL_GETC_MAPPING.forEach(row => {
      (row.areas || []).forEach(area => {
        if (!calGetcGroups.areas.includes(area)) calGetcGroups.areas.push(area);
      });
      (row.divisions || []).forEach(div => {
        if (!calGetcGroups.divisions.includes(div)) calGetcGroups.divisions.push(div);
      });
    });
    calGetcAreaOptions = calGetcGroups.areas;
    calGetcDivisionOptions = calGetcGroups.divisions;
  }
  const calGetcItems = [
    ...calGetcAreaOptions.map(area => ({ value: 'Z' + area, label: 'Z' + area })),
    ...calGetcDivisionOptions.map(div => ({ value: 'Z' + div, label: 'Z' + div }))
  ];
  let items = [...nonCalGetcItems, ...calGetcItems];

  if (hmChoices) hmChoices.setChoices(items, 'value', 'label', true);
  updateAllHeatmap();
}

// Update the heatmap DataTable based on filters
export function updateAllHeatmap() {
  const selectedCampus = document.getElementById('heatmap-campus-select')?.value || '';
  let filteredCampus = selectedCampus
    ? hmRaw.filter(r => r.Campus === selectedCampus)
    : hmRaw;

  const selected = hmChoices.getValue(true);

  // CAL-GETC group filtering
  let filterCourseCodes = new Set();
  selected.forEach(val => {
    if (calgetc.isCALGETCGroup(val)) {
      calgetc.getCourseCodesFromCALGETC(val).forEach(c => filterCourseCodes.add(c));
    } else {
      if (window.normalizeCALGETCCode) {
        filterCourseCodes.add(window.normalizeCALGETCCode(val));
      } else {
        filterCourseCodes.add(val);
      }
    }
  });

  const rows = filteredCampus.filter(r => {
    if(selected.length && !filterCourseCodes.has(window.normalizeCALGETCCode ? window.normalizeCALGETCCode(r.key) : r.key)) return false;
    if(!isValidRoom(r.Building, r.Room)) return false;
    return true;
  }).map(r => [r.key, r.Building, r.Room, Array.isArray(r.Days) ? r.Days.join(',') : '', r.Start_Time + '-' + r.End_Time]);
  hmTable.clear().rows.add(rows).draw();
}

// Update the visual heatmap grid based on DataTable search
export function updateHeatmap() {
  const filtered = hmTable.rows({ search: 'applied' }).data().toArray();
  const [minHour, maxHour] = getTimeRangeFromData(filtered.map(row => ({
    Start_Time: row[4]?.split('-')[0],
    End_Time: row[4]?.split('-')[1]
  })));
  const hours = Array.from({length: maxHour - minHour}, (_,i)=>i + minHour);
  const counts = {};
  hmDays.forEach(d => counts[d] = hours.map(() => 0));
  filtered.forEach(row => {
    const [ course, bld, room, daysStr, timeStr ] = row;
    const dayList = daysStr.split(',');
    const timeParts = timeStr.split('-');
    const st = timeParts[0]?.trim();
    const en = timeParts[1]?.trim();
    if (!st || !en) return;
    if (parseHour(st) === parseHour(en)) return;
    const m = st.match(/(\d{2}):(\d{2})/);
    if(!m) return;
    const hr = parseInt(m[1],10);
    dayList.forEach(d => {
      const hIndex = hours.indexOf(hr);
      if(hIndex>=0 && counts[d]) counts[d][hIndex]++;
    });
  });
  const maxC = Math.max(...Object.values(counts).flat());
  let html = '<table class="heatmap" style="border-collapse:collapse; margin-top:20px; width:100%;">';
  html += '<thead><tr><th style="background:#eee;border:1px solid #ccc;padding:4px;">Day/Time</th>';
  hours.forEach(h=>{ 
    const ap=h<12?'AM':'PM'; 
    const hh=h%12||12; 
    html+=`<th style="background:#eee;border:1px solid #ccc;padding:4px;">${hh} ${ap}</th>`; 
  });
  html+='</tr></thead><tbody>';
  hmDays.forEach(d=>{
    html+=`<tr><th style="background:#eee;border:1px solid #ccc;padding:4px;text-align:left;">${d}</th>`;
    counts[d].forEach(c=>{
      const op=maxC?c/maxC:0;
      const color = `rgba(255,102,0,${op*0.7+0.02})`;
      html+=`<td style="border:1px solid #ccc; background:${color}; color:#222; text-align:center;">${c||''}</td>`;
    });
    html+='</tr>';
  });
  html+='</tbody></table>';
  document.getElementById('heatmapContainer').innerHTML = html;
}

// Clear heatmap filter selections
export function clearHeatmapFilter() {
  if (hmChoices) hmChoices.removeActiveItems();
  if (document.getElementById('textSearch')) {
    document.getElementById('textSearch').value = '';
    hmTable.search('').draw();
  }
  updateAllHeatmap();
}

// Show/hide logic for heatmap panel
export function showHide(show) {
  document.getElementById('heatmap-tool').style.display = show ? 'block' : 'none';
}
