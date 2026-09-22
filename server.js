// server.js - Express backend for Crowd Management System

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// In‑memory store for the latest sensor payload
let latestData = null; // raw payload from ESP32
let lastTimestamp = null; // timestamp of last POST

// Helper to compute status values based on crowd count
function computeStatus(data) {
  const crowd = data.crowd ?? 0;
  let crowdStatus = 'SAFE';
  if (crowd >= 10) crowdStatus = 'DANGER';
  else if (crowd >= 5) crowdStatus = 'WARNING';

  const gateStatus = (crowdStatus === 'SAFE' || crowdStatus === 'WARNING') ? 'OPEN' : 'CLOSED';
  const espConnected = lastTimestamp && (Date.now() - lastTimestamp) <= 5000; // 5 s stale threshold

  return { crowdStatus, gateStatus, espConnected };
}

// POST endpoint for ESP32 sensor data
app.post('/api/sensor-data', (req, res) => {
  const payload = req.body;
  // Validate required fields
  const required = ['crowd', 'weight', 'distance', 'fsr', 'ir', 'mpu'];
  const missing = required.filter(k => !(k in payload));
  if (missing.length) {
    return res.status(400).json({ error: 'Missing fields', missing });
  }
  latestData = payload;
  lastTimestamp = Date.now();
  res.json({ status: 'ok' });
});

// GET endpoint for the dashboard (supports demo mode via query param)
app.get('/api/sensor-data', (req, res) => {
  const demo = req.query.demo === 'true';
  if (demo) {
    const demoData = {
      crowd: 3,
      weight: 5500.0,
      distance: 120.5,
      fsr: 320,
      ir: 'DETECTED',
      mpu: 'FAKE_VALUE'
    };
    const { crowdStatus, gateStatus, espConnected } = computeStatus(demoData);
    return res.json({
      ...demoData,
      crowdStatus,
      gateStatus,
      espConnected,
      lastUpdated: new Date().toISOString()
    });
  }

  if (!latestData) {
    return res.status(204).send(); // No data yet
  }
  const { crowdStatus, gateStatus, espConnected } = computeStatus(latestData);
  res.json({
    ...latestData,
    crowdStatus,
    gateStatus,
    espConnected,
    lastUpdated: new Date(lastTimestamp).toISOString()
  });
});

// Error handling for malformed JSON bodies
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
