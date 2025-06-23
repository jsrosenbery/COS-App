// utils.js - Shared utility functions for the app

import { hmDays } from './constants.js';

// Parse a time string ("14:00", "2:00 PM") into hour in 24hr integer (e.g., 14)
export function parseHour(str) {
  if (!str) return null;
  let m = str.match(/^(\d{1,2}):(\d{2}) ?(AM|PM|am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  let ap = m[3] ? m[3].toUpperCase() : '';
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h;
}

// Return earliest and latest hour from a data array [{Start_Time, End_Time}, ...]
export function getTimeRangeFromData(data) {
  let minHour = 24, maxHour = 0;
  data.forEach(row => {
    const st = parseHour(row.Start_Time);
    const en = parseHour(row.End_Time);
    if (st !== null && st < minHour) minHour = st;
    if (en !== null && en > maxHour) maxHour = en;
  });
  if (minHour > maxHour) return [8, 18]; // default
  return [minHour, maxHour];
}

// Extract a field from a row, checking multiple possible keys
export function extractField(row, keys) {
  for (let key of keys) {
    if (row[key] !== undefined) return row[key];
    if (row[key.toLowerCase()] !== undefined) return row[key.toLowerCase()];
    if (row[key.toUpperCase()] !== undefined) return row[key.toUpperCase()];
  }
  return undefined;
}

// Check if a room is valid (not blank, not ONLINE, not N/A, not LIVE)
export function isValidRoom(bldg, room) {
  if (!room || !bldg) return false;
  if (room === 'N/A' || room === 'LIVE') return false;
  if (bldg === 'ONLINE') return false;
  return true;
}

// Format a 24hr time string ("14:30") as 12hr with AM/PM ("2:30 PM")
export function format12(str) {
  if (!str) return '';
  let m = str.match(/^(\d{1,2}):(\d{2}) ?(AM|PM|am|pm)?$/);
  if (!m) return str;
  let h = parseInt(m[1], 10);
  let min = m[2];
  let ap = m[3] ? m[3].toUpperCase() : '';
  if (!ap) {
    ap = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
  }
  return `${h}:${min} ${ap}`;
}

// Normalize a schedule row's fields to standard names/formats
export function normalizeRow(row) {
  // Map common field names to canonical names
  const mapping = {
    "building": "Building", "bldg": "Building",
    "room": "Room", "section": "Section",
    "days": "Days", "time": "Time", "start_time": "Start_Time", "end_time": "End_Time",
    "subject_course": "Subject_Course", "course": "Subject_Course",
    "instructor": "Instructor", "faculty": "Instructor",
    "start_date": "Start_Date", "end_date": "End_Date", "start": "Start_Date", "end": "End_Date",
    "campus": "Campus", "crn": "CRN", "title": "Title"
  };
  const out = {};
  Object.keys(row).forEach(k => {
    let stdKey = mapping[k.toLowerCase()] || k;
    out[stdKey] = row[k];
  });
  // Normalize Days
  if (typeof out.Days === 'string') {
    out.Days = out.Days.split(',').map(s => s.trim());
  }
  // Normalize Time
  if (out.Time && (!out.Start_Time || !out.End_Time)) {
    // Try to parse as "HH:MM-HH:MM"
    let m = out.Time.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (m) {
      out.Start_Time = m[1];
      out.End_Time = m[2];
    }
  }
  return out;
}

// Show/hide the calendar snapshot UI
export function showSnapshotUI(show) {
  const el = document.getElementById('snapshot-container');
  if (el) el.style.display = show ? 'block' : 'none';
}

// Show/hide the upload UI
export function showUploadUI(show) {
  const el = document.getElementById('upload-ui');
  if (el) el.style.display = show ? 'block' : 'none';
}

// Build term tabs and handle tab switching
// Now supports onTabsRendered callback for correct initialization order
export function setupTermTabs({ onTermChange, onUpload, onRoomDropdown, onTabsRendered }) {
  // Example: build tabs dynamically if needed
  const nav = document.getElementById('term-tabs');
  if (nav && !nav.querySelector('.tab')) {
    // Example: get terms from backend or config
    // This should be replaced with an actual dynamic terms list as needed
    const terms = window.AVAILABLE_TERMS || ['Spring 2025', 'Fall 2024', 'Spring 2024'];
    nav.innerHTML = terms.map((term, i) =>
      `<div class="tab${i === 0 ? ' active' : ''}">${term}</div>`
    ).join('');
  }
  const tabs = nav ? nav.querySelectorAll('.tab') : document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const term = tab.textContent;
      if (typeof onTermChange === 'function') onTermChange(term, onRoomDropdown);
    });
  });

  // File upload
  const uploadBtn = document.getElementById('upload-btn');
  const uploadInput = document.getElementById('upload-input');
  if (uploadBtn && uploadInput) {
    uploadBtn.onclick = () => uploadInput.click();
    uploadInput.onchange = function() {
      const term = document.querySelector('.tab.active')?.textContent || '';
      if (typeof onUpload === 'function') onUpload(term, uploadInput, onRoomDropdown);
    };
  }

  // New: call onTabsRendered after tabs are built
  if (typeof onTabsRendered === 'function') onTabsRendered();
}
