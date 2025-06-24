// js/app.js
const API_BASE = window.BACKEND_BASE_URL || 'https://app-backend-pp98.onrender.com';
let scheduleData = [];

// Setup term tabs and initial load
document.addEventListener('DOMContentLoaded', () => {
  setupTermTabs();
  setupUpload();
  setupAvailability();
});

function setupTermTabs() {
  const terms = ['Summer 2025','Fall 2025','Spring 2026','Summer 2026','Fall 2026','Spring 2027','Summer 2027','Fall 2027','Spring 2028'];
  const tabs = document.getElementById('term-tabs');
  terms.forEach((term, idx) => {
    const btn = document.createElement('button');
    btn.textContent = term;
    btn.classList.toggle('active', idx === 0);
    btn.onclick = () => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      loadSchedule(term);
    };
    tabs.appendChild(btn);
  });
  loadSchedule(terms[0]);
}

async function loadSchedule(term) {
  try {
    const res = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(term)}`);
    scheduleData = await res.json();
    renderSchedule();
  } catch (err) {
    console.error('Failed to load schedule:', err);
  }
}

function renderSchedule() {
  const table = document.getElementById('schedule-table');
  table.innerHTML = '';
  scheduleData.forEach(r => {
    const tr = document.createElement('tr');
    ['Building','Room','Days','Start_Time','End_Time'].forEach(key => {
      const td = document.createElement('td');
      td.textContent = Array.isArray(r[key]) ? r[key].join(',') : r[key];
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}

function setupUpload() {
  document.getElementById('scheduleUpload').addEventListener('change', async e => {
    const file = e.target.files[0];
    const password = prompt('Enter upload password:');
    if (!password) return alert('Password required');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('password', password);
    try {
      const res = await fetch(`${API_BASE}/api/schedule`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      await loadSchedule();
      alert('Upload successful');
    } catch (err) {
      alert(err.message);
    }
  });
}

function setupAvailability() {
  document.getElementById('avail-check-btn').addEventListener('click', () => {
    // your availability logic here
  });
}
