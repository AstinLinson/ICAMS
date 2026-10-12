// Using built‑in fetch (Node >=18) – no external dependency
const payload = {
  crowd: 7,
  weight: 5300,
  distance: 27,
  fsr: 812,
  ir: 'CLEAR',
  mpu: 'Stable'
};
fetch('http://localhost:3000/api/sensor-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => console.log('Response:', data))
  .catch(err => console.error('Error:', err));
