// app.js - Frontend logic for Crowd Management Dashboard

const apiUrl = '/api/sensor-data'; // relative to same origin
const pollInterval = 2000; // 2 seconds
let demoMode = false;

const elems = {
  backendStatus: document.getElementById('backendStatus'),
  espStatus: document.getElementById('espStatus'),
  crowdCount: document.getElementById('crowdCount'),
  crowdStatus: document.getElementById('crowdStatus'),
  gateStatus: document.getElementById('gateStatus'),
  weight: document.getElementById('weight'),
  distance: document.getElementById('distance'),
  fsr: document.getElementById('fsr'),
  ir: document.getElementById('ir'),
  mpu: document.getElementById('mpu'),
  lastUpdated: document.getElementById('lastUpdated')
};

function setBadge(element, status) {
  element.className = 'badge';
  if (!status) { element.textContent = '-'; return; }
  const lower = status.toLowerCase();
  if (lower === 'safe') element.classList.add('safe');
  else if (lower === 'warning') element.classList.add('warning');
  else if (lower === 'danger') element.classList.add('danger');
  else element.classList.add('neutral');
  element.textContent = status;
}

function updateUI(data) {
  // Backend is always online if we got a response
  elems.backendStatus.className = 'badge online';
  elems.backendStatus.textContent = 'ONLINE';

  // ESP32 connection status based on espConnected flag
  if (data.espConnected) {
    elems.espStatus.className = 'badge online';
    elems.espStatus.textContent = 'CONNECTED';
  } else {
    elems.espStatus.className = 'badge offline';
    elems.espStatus.textContent = 'DISCONNECTED';
  }

  // Populate fields – if demoMode, override with static values
  const source = demoMode ? {
    crowd: 47,
    weight: 5300,
    distance: 34,
    fsr: 350,
    ir: 'DETECTED',
    mpu: 'Stable',
    crowdStatus: 'WARNING',
    gateStatus: 'OPEN',
    lastUpdated: new Date().toISOString()
  } : data;

  elems.crowdCount.textContent = source.crowd !== null ? source.crowd : '-';
  setBadge(elems.crowdStatus, source.crowdStatus);
  setBadge(elems.gateStatus, source.gateStatus);

  // Weight (always demo label)
  elems.weight.innerHTML = `${source.weight !== null ? source.weight : '-'} g <span class="note">DEMO / FAKE VALUE</span>`;

  // Distance handling
  if (source.distance === -1) {
    elems.distance.textContent = 'No Echo';
  } else {
    elems.distance.textContent = source.distance !== null ? `${source.distance} cm` : '-';
  }

  elems.fsr.textContent = source.fsr !== null ? source.fsr : '-';
  elems.ir.textContent = source.ir !== null ? source.ir : '-';
  elems.mpu.innerHTML = `${source.mpu !== null ? source.mpu : '-'} <span class="note">DEMO / FAKE VALUE</span>`;

  elems.lastUpdated.textContent = source.lastUpdated ? new Date(source.lastUpdated).toLocaleTimeString() : '-';
}

function fetchData() {
  fetch(apiUrl)
    .then(res => res.json())
    .then(data => {
      updateUI(data);
    })
    .catch(err => {
      // Backend unreachable – show offline badge
      elems.backendStatus.className = 'badge offline';
      elems.backendStatus.textContent = 'OFFLINE';
    });
}

// Demo mode toggle button
const demoBtn = document.getElementById('demoToggle');
function updateDemoButton() {
  demoBtn.textContent = `Demo Mode: ${demoMode ? 'ON' : 'OFF'}`;
  demoBtn.style.background = demoMode ? '#ff9800' : 'var(--primary-color)';
}

demoBtn.addEventListener('click', () => {
  demoMode = !demoMode;
  updateDemoButton();
  // Force immediate UI refresh
  fetchData();
});

// Initial load
updateDemoButton();
fetchData();
setInterval(fetchData, pollInterval);
