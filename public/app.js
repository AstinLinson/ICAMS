// app.js - Enhanced Frontend logic for Crowd Management Dashboard with Interactive Simulation

const apiUrl = '/api/sensor-data';
const pollInterval = 2000; // 2 seconds
let demoMode = false;

// Simulated State (modifiable in Demo Mode)
const simState = {
  crowd: 7,
  fsr: 650,
  distance: 35,
  ir: 'CLEAR',
  weight: 5300,
  mpu: 'Stable'
};

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
  lastUpdated: document.getElementById('lastUpdated'),

  // Demo Control Panel
  demoControlPanel: document.getElementById('demoControlPanel'),
  demoToggle: document.getElementById('demoToggle'),
  demoToggleText: document.getElementById('demoToggleText'),

  // Voice Announcement System
  voiceTestBtn: document.getElementById('voiceTestBtn'),
  paAlertBanner: document.getElementById('paAlertBanner'),
  paAlertBannerTimeout: null,

  // Simulation Controls
  simCrowd: document.getElementById('simCrowd'),
  simCrowdVal: document.getElementById('simCrowdVal'),
  simFsr: document.getElementById('simFsr'),
  simFsrVal: document.getElementById('simFsrVal'),
  simDistance: document.getElementById('simDistance'),
  simDistanceVal: document.getElementById('simDistanceVal'),
  btnNoEcho: document.getElementById('btnNoEcho'),
  simIrVal: document.getElementById('simIrVal'),
  btnIrClear: document.getElementById('btnIrClear'),
  btnIrDetected: document.getElementById('btnIrDetected'),
  simWeight: document.getElementById('simWeight'),
  simWeightVal: document.getElementById('simWeightVal'),
  simMpu: document.getElementById('simMpu'),

  // Preset Buttons
  presetSafe: document.getElementById('presetSafe'),
  presetWarning: document.getElementById('presetWarning'),
  presetDanger: document.getElementById('presetDanger')
};

// ===================================================================
// Voice Announcement System (Web Speech API)
// ===================================================================
let lastVoiceBroadcastTime = 0;
const VOICE_COOLDOWN_MS = 12000; // Broadcast at most once every 12 seconds while in danger

function speakAnnouncement(customPhrase = null, forced = false) {
  if (!('speechSynthesis' in window)) return;
  const now = Date.now();
  if (!forced && (now - lastVoiceBroadcastTime < VOICE_COOLDOWN_MS)) return;
  lastVoiceBroadcastTime = now;

  const phrase = customPhrase || "The crowd is not moving.";

  // Update banner message if present
  const paMsgElem = document.getElementById('paAlertMessage');
  if (paMsgElem) {
    paMsgElem.textContent = `"${phrase}"`;
  }

  // Show emergency broadcast banner
  if (elems.paAlertBanner) {
    elems.paAlertBanner.style.display = 'flex';
    clearTimeout(elems.paAlertBannerTimeout);
    elems.paAlertBannerTimeout = setTimeout(() => {
      elems.paAlertBanner.style.display = 'none';
    }, 7000);
  }

  // Cancel any ongoing speech so the announcement plays immediately
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.rate = 0.95; // Authoritative, crisp Public Address pace
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Prefer English locale voice if available
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;

  window.speechSynthesis.speak(utterance);
}

// Compute status flags from simulated data (Rule: No danger until FSR > 1000)
function getSimulatedPayload() {
  const crowd = simState.crowd;
  const fsr = simState.fsr;

  let crowdStatus = 'SAFE';
  // Show no danger until FSR reaches above 1000
  if (fsr > 1000) {
    crowdStatus = 'DANGER';
  } else if (crowd >= 5) {
    crowdStatus = 'WARNING';
  } else {
    crowdStatus = 'SAFE';
  }

  const gateStatus = (crowdStatus === 'DANGER') ? 'CLOSED' : 'OPEN';

  return {
    ...simState,
    crowdStatus,
    gateStatus,
    espConnected: true,
    lastUpdated: new Date().toISOString()
  };
}

// Set status badges & descriptions
function updateCrowdBadge(element, status, crowd, fsr) {
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
      elems.crowdStatusDesc.textContent = 'Facility occupancy and surface pressure are normal.';
    }
  } else if (upper === 'WARNING') {
    element.classList.add('warning');
    if (elems.crowdStatusDesc) {
      elems.crowdStatusDesc.textContent = 'High density detected. FSR is ≤ 1000 — gate remains open.';
    }
  } else if (upper === 'DANGER') {
    element.classList.add('danger');
    if (elems.crowdStatusDesc) {
      elems.crowdStatusDesc.textContent = 'CRITICAL FORCE: FSR exceeded 1000 threshold. Barrier locked.';
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

  // 3. Resolve active source: In Demo Mode, use interactive simState; otherwise use real ESP32 feed
  const source = demoMode ? getSimulatedPayload() : data;

  // 4. Crowd Count & Density Meter
  const crowdVal = source.crowd !== null && source.crowd !== undefined ? source.crowd : 0;
  elems.crowdCount.textContent = crowdVal;

  const maxCapacity = 15;
  const percent = Math.min(100, Math.round((crowdVal / maxCapacity) * 100));
  if (elems.capacityPercent) elems.capacityPercent.textContent = `${percent}%`;
  if (elems.capacityFill) {
    elems.capacityFill.style.width = `${percent}%`;
    elems.capacityFill.className = 'progress-fill';
    if (source.crowdStatus === 'DANGER') {
      elems.capacityFill.classList.add('danger');
    } else if (source.crowdStatus === 'WARNING') {
      elems.capacityFill.classList.add('warning');
    } else {
      elems.capacityFill.classList.add('safe');
    }
  }

  // 5. Crowd & Gate Operational Status Badges
  updateCrowdBadge(elems.crowdStatus, source.crowdStatus, crowdVal, source.fsr);
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

  // 12. Public Address Voice Alert Trigger
  // Rule: When FSR > 1000 and IR is NOT being detected -> Speak "The crowd is not moving."
  // When IR IS detected while FSR > 1000 -> Say nothing (quiet).
  const fsrValNum = Number(source.fsr);
  const isIrDetected = (String(source.ir).toUpperCase() === 'DETECTED');

  if (fsrValNum > 1000) {
    if (!isIrDetected) {
      speakAnnouncement("The crowd is not moving.", false);
    }
  }
}

function fetchData() {
  if (demoMode) {
    // In Demo Mode, render user-controlled simulated values immediately
    updateUI(getSimulatedPayload());
    return;
  }

  fetch(apiUrl)
    .then(res => {
      if (res.status === 204) return null;
      return res.json();
    })
    .then(data => {
      if (data && !demoMode) {
        updateUI(data);
      }
    })
    .catch(err => {
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

// Synchronize simulation control inputs with current simState
function syncSimControlsToUI() {
  if (elems.simCrowd) {
    elems.simCrowd.value = simState.crowd;
    elems.simCrowdVal.textContent = simState.crowd;
  }
  if (elems.simFsr) {
    elems.simFsr.value = simState.fsr;
    elems.simFsrVal.textContent = simState.fsr;
  }
  if (elems.simDistance) {
    elems.simDistance.value = simState.distance;
    elems.simDistanceVal.textContent = simState.distance === -1 ? 'No Echo (-1)' : `${simState.distance} cm`;
  }
  if (elems.simIrVal) {
    elems.simIrVal.textContent = simState.ir;
    if (simState.ir === 'CLEAR') {
      elems.btnIrClear.classList.add('active');
      elems.btnIrDetected.classList.remove('active');
    } else {
      elems.btnIrClear.classList.remove('active');
      elems.btnIrDetected.classList.add('active');
    }
  }
  if (elems.simWeight) {
    elems.simWeight.value = simState.weight;
    elems.simWeightVal.textContent = `${simState.weight} g`;
  }
  if (elems.simMpu) {
    elems.simMpu.value = simState.mpu;
  }
}

// Apply scenario presets
function applyPreset(preset) {
  if (preset === 'safe') {
    simState.crowd = 2;
    simState.fsr = 180;
    simState.distance = 85;
    simState.ir = 'CLEAR';
    simState.weight = 4600;
    simState.mpu = 'Stable';
  } else if (preset === 'warning') {
    simState.crowd = 7;
    simState.fsr = 850;
    simState.distance = 28;
    simState.ir = 'DETECTED';
    simState.weight = 5300;
    simState.mpu = 'Motion Detected';
  } else if (preset === 'danger') {
    simState.crowd = 14;
    simState.fsr = 2600;
    simState.distance = 10;
    simState.ir = 'DETECTED';
    simState.weight = 7400;
    simState.mpu = 'Vibration Alert';
  }
  syncSimControlsToUI();
  updateUI(getSimulatedPayload());
}

// Bind Interactive Simulation Inputs
function setupSimulationListeners() {
  // 1. Crowd slider
  if (elems.simCrowd) {
    elems.simCrowd.addEventListener('input', (e) => {
      simState.crowd = parseInt(e.target.value, 10);
      elems.simCrowdVal.textContent = simState.crowd;
      updateUI(getSimulatedPayload());
    });
  }

  // 2. FSR slider
  if (elems.simFsr) {
    elems.simFsr.addEventListener('input', (e) => {
      simState.fsr = parseInt(e.target.value, 10);
      elems.simFsrVal.textContent = simState.fsr;
      updateUI(getSimulatedPayload());
    });
  }

  // 3. Distance slider
  if (elems.simDistance) {
    elems.simDistance.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      simState.distance = val;
      elems.simDistanceVal.textContent = val === -1 ? 'No Echo (-1)' : `${val} cm`;
      updateUI(getSimulatedPayload());
    });
  }

  // 4. "No Echo" Button
  if (elems.btnNoEcho) {
    elems.btnNoEcho.addEventListener('click', () => {
      simState.distance = -1;
      elems.simDistance.value = -1;
      elems.simDistanceVal.textContent = 'No Echo (-1)';
      updateUI(getSimulatedPayload());
    });
  }

  // 5. IR Clear / Detected buttons
  if (elems.btnIrClear) {
    elems.btnIrClear.addEventListener('click', () => {
      simState.ir = 'CLEAR';
      elems.simIrVal.textContent = 'CLEAR';
      elems.btnIrClear.classList.add('active');
      elems.btnIrDetected.classList.remove('active');
      updateUI(getSimulatedPayload());
    });
  }
  if (elems.btnIrDetected) {
    elems.btnIrDetected.addEventListener('click', () => {
      simState.ir = 'DETECTED';
      elems.simIrVal.textContent = 'DETECTED';
      elems.btnIrDetected.classList.add('active');
      elems.btnIrClear.classList.remove('active');
      updateUI(getSimulatedPayload());
    });
  }

  // 6. Weight slider
  if (elems.simWeight) {
    elems.simWeight.addEventListener('input', (e) => {
      simState.weight = parseInt(e.target.value, 10);
      elems.simWeightVal.textContent = `${simState.weight} g`;
      updateUI(getSimulatedPayload());
    });
  }

  // 7. MPU select
  if (elems.simMpu) {
    elems.simMpu.addEventListener('change', (e) => {
      simState.mpu = e.target.value;
      updateUI(getSimulatedPayload());
    });
  }

  // 8. Scenario Presets
  if (elems.presetSafe) elems.presetSafe.addEventListener('click', () => applyPreset('safe'));
  if (elems.presetWarning) elems.presetWarning.addEventListener('click', () => applyPreset('warning'));
  if (elems.presetDanger) elems.presetDanger.addEventListener('click', () => applyPreset('danger'));

  // 9. Manual Voice Test Trigger
  if (elems.voiceTestBtn) {
    elems.voiceTestBtn.addEventListener('click', () => {
      speakAnnouncement("The crowd is not moving.", true);
    });
  }
}

// Toggle Demo Mode Switch
function updateDemoButton() {
  if (demoMode) {
    elems.demoToggle.classList.add('active');
    if (elems.demoToggleText) elems.demoToggleText.textContent = 'Demo Mode: ON';
    if (elems.demoControlPanel) elems.demoControlPanel.style.display = 'block';
    syncSimControlsToUI();
    updateUI(getSimulatedPayload());
  } else {
    elems.demoToggle.classList.remove('active');
    if (elems.demoToggleText) elems.demoToggleText.textContent = 'Demo Mode: OFF';
    if (elems.demoControlPanel) elems.demoControlPanel.style.display = 'none';
    fetchData(); // Return immediately to real ESP32 stream
  }
}

if (elems.demoToggle) {
  elems.demoToggle.addEventListener('click', () => {
    demoMode = !demoMode;
    updateDemoButton();
  });
}

// Setup & Initialization
setupSimulationListeners();
updateDemoButton();
fetchData();
setInterval(fetchData, pollInterval);
