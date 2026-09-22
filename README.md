# Crowd Management System

A lightweight local dashboard that receives sensor data from an ESP32‑S3, calculates crowd and gate status, and displays the information in a clean web UI.

---

## 1. Prerequisites

1. **Node.js** (v14 or later) – download and install from the official site if you don't have it:
   ```
   https://nodejs.org/
   ```

2. **Wi‑Fi network** – both your laptop and the ESP32 must be on the same local network.

---

## 2. Project Setup

Open a terminal (PowerShell) and navigate to the project folder:

```powershell
cd "C:\Users\Astin Linson\OneDrive\Desktop\ADDONAI\crowd-management"
```

Install the required npm packages:

```powershell
npm install
```

---

## 3. Running the Dashboard

Start the backend server:

```powershell
npm start
```

The server will listen on **port 3000** and bind to `0.0.0.0` so the ESP32 can reach it.

Open a browser and go to:

```
http://localhost:3000
```

You should see the dashboard UI.

---

## 4. Find Your Laptop’s IP Address (Windows)

In a PowerShell window run:

```powershell
ipconfig
```

Look for the **IPv4 Address** under the network adapter that is connected to your Wi‑Fi. It will be something like `192.168.1.105`.

---

## 5. Update the ESP32 Arduino Sketch

In the Arduino sketch locate the line defining `BACKEND_URL` and replace `YOUR-LAPTOP-IP` with the IPv4 address you retrieved:

```cpp
const char* BACKEND_URL = "http://192.168.1.105:3000/api/sensor-data";
```

Upload the sketch to the ESP32. The board will now POST sensor data to the Node.js server.

---

## 6. Firewall Configuration (Windows)

If the ESP32 cannot reach the server, ensure Windows Firewall allows Node.js (node.exe) on **Private networks**:
1. Open *Windows Defender Firewall with Advanced Security*.
2. Choose **Inbound Rules → New Rule…**
3. Rule Type: **Program** → Path: `C:\Program Files\nodejs\node.exe` (adjust if installed elsewhere).
4. Allow the connection on **Private** (and optionally **Domain**) networks.
5. Name the rule (e.g., *Node.js ESP32*).

---

## 7. Dashboard Features

- **Live updates** (≈2 s) via simple polling.
- **Connection status** indicators for Backend and ESP32.
- Visual crowd status badges (SAFE – green, WARNING – yellow, DANGER – red).
- Gate status (OPEN – green, CLOSED – red).
- Weight and MPU values are marked as **DEMO / FAKE VALUE**.
- Distance shows **“No Echo”** when the sensor returns `-1`.
- **Demo Mode** button (always visible) lets you test the UI with sample data.

---

## 8. Testing the API Manually

You can simulate a sensor POST with `curl`:

```powershell
curl -X POST http://localhost:3000/api/sensor-data \
     -H "Content-Type: application/json" \
     -d '{"crowd":47,"weight":5300,"distance":34,"fsr":350,"ir":"DETECTED","mpu":"Stable"}'
```

Refresh the dashboard (or wait 2 s) and you should see the new values.

---

## 9. Stopping the Server

Press `Ctrl+C` in the terminal where `npm start` is running.

---

Enjoy the demo!
