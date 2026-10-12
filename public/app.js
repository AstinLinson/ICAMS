// app.js - Enhanced Frontend logic for Crowd Management Dashboard

const apiUrl = '/api/sensor-data';
const pollInterval = 2000; // 2 seconds
let demoMode = false;

// DOM Element Registry
const elems = {
  backendStatus: document.getElementById('backendStatus'),
  backendDot: document.getElementById('backendDot'),
  espStatus: document.getElementById('espStatus'),
  espDot: document.getElementById('espDot'),

  crowdCount: document.getElementById('crowdCount'),
  capacityFill: document.getElementById('capacityFill'),
  capacityPercent: document.getElementById('capacityPercent'),

  crowdStatus: document.getElementById('crowdStatus'),
  crowdStatusDesc: document.getElementById('crowdStatusDesc'),

  gateStatus: document.getElementById('gateStatus'),
  gateStatusDesc: document.getElementById('gateStatusDesc'),

  weight: document.getElementById('weight'),
  distance: document.getElementById('distance'),
  fsr: document.getElementById('fsr'),
  fsrMeter: document.getElementById('fsrMeter'),
  ir: document.getElementById('ir'),
  irIndicator: document.getElementById('irIndicator'),
  mpu: document.getElementById('mpu'),
  lastUpdated: document.getElementById('lastUpdated')
};

// Set pill status badges & accompanying contextual descriptions
function updateCrowdBadge(element, status, crowd) {
  element.className = 'badge status-pill';
  if (!status) {
    element.textContent = '-';
    element.classList.add('safe');
    return;
  }
  const upper = status.toUpperCase();
  element.textContent = upper;

  if (upper === 'SAFE') {
    element.classList.add('safe');
    if (elems.crowdStatusDesc) {
      elems.crowdStatusDesc.textContent = 'Facility occupancy is within safe parameters.';
    }
  } else if (upper === 'WARNING') {
    element.classList.add('warning');
    if (elems.crowdStatusDesc) {
      elems.crowdStatusDesc.textContent = 'High density detected. Approach threshold caution.';
    }
  } else if (upper === 'DANGER') {
    element.classList.add('danger');
    if (elems.crowdStatusDesc) {
      elems.crowdStatusDesc.textContent = 'CRITICAL OVERCROWDING: Turnstile locking engaged.';
    }
  } else {
    element.classList.add('safe');
  }
}

function updateGateBadge(element, status) {
  element.className = 'badge status-pill';
  if (!status) {
    element.textContent = '-';
    return;
  }
  const upper = status.toUpperCase();
  element.textContent = upper;

  if (upper === 'OPEN') {
    element.classList.add('gate-open');
    if (elems.gateStatusDesc) {
      elems.gateStatusDesc.textContent = 'Servo Angle 90°: Turnstile unlatched for safe passage.';
    }
  } else {
    element.classList.add('gate-closed');
    if (elems.gateStatusDesc) {
      elems.gateStatusDesc.textContent = 'Servo Angle 0°: Barrier locked shut to prevent entry.';
    }
  }
}

function updateUI(data) {
  // 1. Backend Server connectivity status
  if (elems.backendStatus) {
    elems.backendStatus.className = 'badge online';
    elems.backendStatus.textContent = 'ONLINE';
  }
  if (elems.backendDot) {
    elems.backendDot.className = 'pill-dot online';
  }

  // 2. ESP32-S3 Edge Node connectivity status
  if (data.espConnected) {
    elems.espStatus.className = 'badge online';
    elems.espStatus.textContent = 'CONNECTED';
    if (elems.espDot) elems.espDot.className = 'pill-dot online';
  } else {
    elems.espStatus.className = 'badge offline';
    elems.espStatus.textContent = 'DISCONNECTED';
    if (elems.espDot) elems.espDot.className = 'pill-dot offline';
  }

  // 3. Resolve active data source (live ESP32 feed or simulated demo mode)
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

  // 4. Crowd Count & Density Meter
  const crowdVal = source.crowd !== null && source.crowd !== undefined ? source.crowd : 0;
  elems.crowdCount.textContent = crowdVal;

  const maxCapacity = 15; // Benchmark capacity scale
  const percent = Math.min(100, Math.round((crowdVal / maxCapacity) * 100));
  if (elems.capacityPercent) elems.capacityPercent.textContent = `${percent}%`;
  if (elems.capacityFill) {
    elems.capacityFill.style.width = `${percent}%`;
    elems.capacityFill.className = 'progress-fill';
    if (crowdVal >= 10) {
      elems.capacityFill.classList.add('danger');
    } else if (crowdVal >= 5) {
      elems.capacityFill.classList.add('warning');
    } else {
      elems.capacityFill.classList.add('safe');
    }
  }

  // 5. Crowd & Gate Operational Status Badges
  updateCrowdBadge(elems.crowdStatus, source.crowdStatus, crowdVal);
  updateGateBadge(elems.gateStatus, source.gateStatus);

  // 6. Weight Platform
  const weightVal = source.weight !== null && source.weight !== undefined ? source.weight : '-';
  elems.weight.innerHTML = `${weightVal} <span class="unit">g</span>`;

  // 7. Distance (HC-SR04)
  if (source.distance === -1 || source.distance === '-1') {
    elems.distance.innerHTML = `<span style="color: #f59e0b; font-size: 1.4rem;">No Echo</span>`;
  } else if (source.distance !== null && source.distance !== undefined) {
    elems.distance.innerHTML = `${source.distance} <span class="unit">cm</span>`;
  } else {
    elems.distance.textContent = '-';
  }

  // 8. FSR 402 Force Resistor
  const fsrVal = source.fsr !== null && source.fsr !== undefined ? source.fsr : 0;
  elems.fsr.textContent = fsrVal;
  if (elems.fsrMeter) {
    const fsrPercent = Math.min(100, Math.max(2, Math.round((fsrVal / 4095) * 100)));
    elems.fsrMeter.style.width = `${fsrPercent}%`;
  }

  // 9. IR Optical Beam Sensor
  const irVal = source.ir ? String(source.ir).toUpperCase() : '-';
  elems.ir.textContent = irVal;
  if (elems.irIndicator) {
    if (irVal === 'DETECTED') {
      elems.irIndicator.className = 'indicator-chip detected';
      elems.irIndicator.innerHTML = '<span class="dot"></span> Beam Interrupted / Presence Detected';
    } else {
      elems.irIndicator.className = 'indicator-chip clear';
      elems.irIndicator.innerHTML = '<span class="dot"></span> Beam Pathway Clear';
    }
  }

  // 10. MPU6050 Motion Sensor
  elems.mpu.textContent = source.mpu !== null && source.mpu !== undefined ? source.mpu : '-';

  // 11. Transmission Heartbeat
  if (source.lastUpdated) {
    const dateObj = new Date(source.lastUpdated);
    elems.lastUpdated.textContent = dateObj.toLocaleTimeString();
  } else {
    elems.lastUpdated.textContent = '-';
  }
}

function fetchData() {
  fetch(apiUrl)
    .then(res => {
      if (res.status === 204) return null; // No data yet
      return res.json();
    })
    .then(data => {
      if (data) {
        updateUI(data);
      }
    })
    .catch(err => {
      // Backend unreachable – show offline badge
      if (elems.backendStatus) {
        elems.backendStatus.className = 'badge offline';
        elems.backendStatus.textContent = 'OFFLINE';
      }
      if (elems.backendDot) {
        elems.backendDot.className = 'pill-dot offline';
      }
      if (elems.espStatus) {
        elems.espStatus.className = 'badge offline';
        elems.espStatus.textContent = 'DISCONNECTED';
      }
      if (elems.espDot) {
        elems.espDot.className = 'pill-dot offline';
      }
    });
}

// Demo mode toggle button handler
const demoBtn = document.getElementById('demoToggle');
const demoText = document.getElementById('demoToggleText');

function updateDemoButton() {
  if (demoMode) {
    demoBtn.classList.add('active');
    if (demoText) demoText.textContent = 'Demo Mode: ON';
  } else {
    demoBtn.classList.remove('active');
    if (demoText) demoText.textContent = 'Demo Mode: OFF';
  }
}

if (demoBtn) {
  demoBtn.addEventListener('click', () => {
    demoMode = !demoMode;
    updateDemoButton();
    fetchData(); // Force immediate UI update
  });
}

// Initial Load
updateDemoButton();
fetchData();
setInterval(fetchData, pollInterval);
