// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const Papa = require('papaparse');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer();

let scheduleData = [];

// Schedule upload
app.post('/api/schedule', upload.single('file'), (req, res) => {
  const password = req.body.password;
  if (password !== 'Upload2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const csv = req.file.buffer.toString('utf-8');
  const rows = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
  scheduleData = rows;
  return res.json({ success: true });
});

// Serve schedule for any term
app.get(['/api/schedule', '/api/schedule/:term'], (req, res) => {
  return res.json(scheduleData);
});

// Room metadata endpoints unchanged
let roomMetadata = [];
app.post('/api/rooms/metadata', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { range: 3 });
    roomMetadata = raw.map(r => ({
      campus: r.Campus,
      building: r.Building,
      room: r['Room #'].toString(),
      type: r.Type,
      capacity: Number(r['# of Desks in Room'])
    }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/rooms/metadata', (req, res) => {
  res.json(roomMetadata);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
