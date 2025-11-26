// Debug Logger
function logDebug(msg, type = 'info') {
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        const entry = document.createElement('div');
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        entry.style.color = type === 'error' ? '#ef4444' : '#22c55e';
        logEl.appendChild(entry);
        logEl.scrollTop = logEl.scrollHeight;
    }
    console.log(msg);
}

// Error Overlay
function showError(msg) {
    const overlay = document.getElementById('alert-overlay');
    if (overlay) {
        overlay.innerHTML = `<div style="background:rgba(0,0,0,0.8); padding:20px; border:2px solid red; color:white; text-align:center;">
            <h2>⚠️ SYSTEM ERROR</h2>
            <p>${msg}</p>
            <button onclick="location.reload()" style="padding:10px 20px; margin-top:10px; cursor:pointer;">RELOAD SYSTEM</button>
        </div>`;
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
    }
}

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
let ws;
let connectionTimeout;

function connectWebSocket() {
    logDebug(`Attempting connection to: ${wsUrl}`);
    connectionStatusEl.textContent = "Connecting...";
    connectionStatusEl.style.color = "#fbbf24"; // Yellow

    ws = new WebSocket(wsUrl);

    // Connection Timeout (5 seconds)
    connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
            logDebug("Connection timed out. Retrying...", 'error');
            ws.close();
            showError("Connection Timed Out. Retrying...");
            setTimeout(connectWebSocket, 3000);
        }
    }, 5000);

    ws.onopen = () => {
        clearTimeout(connectionTimeout);
        connectionStatusEl.textContent = `System Online (${protocol}) - v2.3 (Stable)`;
        connectionStatusEl.style.color = "#22c55e";
        logDebug("WebSocket Connected Successfully");

        // Hide error overlay if it was shown
        const overlay = document.getElementById('alert-overlay');
        if (overlay) overlay.style.display = 'none';

        startWebcam();
    };

    ws.onerror = (error) => {
        logDebug(`WebSocket Error: ${JSON.stringify(error)}`, 'error');
        connectionStatusEl.textContent = "Connection Error";
        connectionStatusEl.style.color = "#ef4444";
    };

    ws.onclose = (event) => {
        logDebug(`WebSocket Closed: Code ${event.code}, Reason: ${event.reason}`, 'error');
        connectionStatusEl.textContent = "Disconnected";
        connectionStatusEl.style.color = "#ef4444";

        // Auto-reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Update Detection Data (Async)
        if (data.detections) {
            lastDetectionData = data;
        }

        // Update Stats
        if (data.count !== undefined) {
            crowdCountEl.textContent = data.count;
            fpsCounterEl.textContent = `60 FPS (Client)`; // Always smooth

            // Update Risk Level
            if (data.status && data.status.includes("WARNING")) {
                riskLevelEl.textContent = "CRITICAL";
                riskLevelEl.style.color = "#ef4444";
                document.querySelector('.video-wrapper').style.border = "2px solid #ef4444";
            } else {
                riskLevelEl.textContent = "NORMAL";
                riskLevelEl.style.color = "#22c55e";
                document.querySelector('.video-wrapper').style.border = "none";
            }

            // Update Chart
            const now = new Date().toLocaleTimeString();
            if (densityChart.data.labels.length > 20) {
                densityChart.data.labels.shift();
                densityChart.data.datasets[0].data.shift();
            }
            densityChart.data.labels.push(now);
            densityChart.data.datasets[0].data.push(data.count);
            densityChart.update('none'); // 'none' for performance
        }
    };
}

// Initial Connection
connectWebSocket();

// Video Elements
const videoCanvas = document.getElementById('video-canvas');
const videoCtx = videoCanvas.getContext('2d');
const webcamVideo = document.getElementById('webcam-video');
let streaming = false;
let lastDetectionData = {
    detections: [],
    features: {},
    count: 0,
    status: "Normal"
};
let lastInferenceTime = 0;

// Chart Setup
const ctx = document.getElementById('densityChart').getContext('2d');
const densityChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Crowd Density',
            data: [],
            borderColor: '#3b82f6',
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(59, 130, 246, 0.1)'
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
            x: { grid: { display: false } }
        }
    }
});

// HUD Drawing Functions
function drawHUD(ctx, width, height) {
    const color = '#00FFFF'; // Cyan
    const t = 2; // thickness
    const l = 30; // length

    ctx.strokeStyle = color;
    ctx.lineWidth = t;

    // Corners
    // TL
    ctx.beginPath(); ctx.moveTo(10, 10 + l); ctx.lineTo(10, 10); ctx.lineTo(10 + l, 10); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(width - 10 - l, 10); ctx.lineTo(width - 10, 10); ctx.lineTo(width - 10, 10 + l); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(10, height - 10 - l); ctx.lineTo(10, height - 10); ctx.lineTo(10 + l, height - 10); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(width - 10 - l, height - 10); ctx.lineTo(width - 10, height - 10); ctx.lineTo(width - 10, height - 10 - l); ctx.stroke();

    // Crosshair
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = '#00FF00';
    ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.font = '12px monospace';
    ctx.fillText(`SYS.T: ${new Date().toLocaleTimeString()}`, 20, height - 20);
    ctx.fillText("CAM-01 [ACTIVE]", width - 150, height - 20);
}

function drawDetections(ctx, detections) {
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#00FF00';
    ctx.font = '12px monospace';

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det;

        // Draw corners
        const l = 15;
        ctx.beginPath();
        // TL
        ctx.moveTo(x1, y1 + l); ctx.lineTo(x1, y1); ctx.lineTo(x1 + l, y1);
        // TR
        ctx.moveTo(x2 - l, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + l);
        // BL
        ctx.moveTo(x1, y2 - l); ctx.lineTo(x1, y2); ctx.lineTo(x1 + l, y2);
        // BR
        ctx.moveTo(x2 - l, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - l);
        ctx.stroke();

        ctx.fillText("HUMAN", x1, y1 - 5);
    });
}

function drawFeatures(ctx, width, height, features) {
    // Night Vision
    if (features["Night Vision Mode"]) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#00FF00';
        ctx.fillText("NIGHT VISION: ON", 10, 50);
    }

    // ROI
    if (features["Region of Interest"]) {
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(width / 4, height / 4, width / 2, height / 2);
        ctx.fillStyle = 'rgba(255, 100, 0, 0.1)';
        ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
        ctx.fillStyle = '#FF6400';
        ctx.fillText("ROI MONITORING", width / 4, height / 4 - 10);
    }

    // Audio Panic
    if (features["Audio Panic Sensor"]) {
        ctx.fillStyle = '#FF00FF';
        ctx.fillText("AUDIO: OK", width - 100, 80);
        // Simulated wave
        ctx.beginPath();
        ctx.moveTo(width - 50, 50);
        ctx.lineTo(width - 50, 70);
        ctx.stroke();
    }

    // Siren
    if (features["Siren Trigger"]) {
        if (Math.floor(Date.now() / 250) % 2 === 0) {
            ctx.fillStyle = 'red';
            ctx.font = 'bold 24px monospace';
            ctx.fillText("!!! SIREN ACTIVE !!!", 120, 180);
        }
    }
}

// Main Render Loop (60 FPS)
function renderLoop() {
    if (!streaming) return;

    // 1. Draw Video Frame (Zero Latency)
    videoCtx.drawImage(webcamVideo, 0, 0, videoCanvas.width, videoCanvas.height);

    // 2. Draw HUD & Visuals
    drawHUD(videoCtx, videoCanvas.width, videoCanvas.height);
    drawDetections(videoCtx, lastDetectionData.detections);
    drawFeatures(videoCtx, videoCanvas.width, videoCanvas.height, lastDetectionData.features);

    // 3. Status Warning
    if (lastDetectionData.status.includes("WARNING")) {
        if (Math.floor(Date.now() / 200) % 2 === 0) {
            videoCtx.strokeStyle = 'red';
            videoCtx.lineWidth = 10;
            videoCtx.strokeRect(0, 0, videoCanvas.width, videoCanvas.height);
        }
        videoCtx.fillStyle = 'red';
        videoCtx.font = 'bold 20px monospace';
        videoCtx.fillText("WARNING: HIGH DENSITY", 120, 30);
    }

    // 4. Async Inference (Throttle to ~5 FPS to save CPU/Bandwidth)
    const now = Date.now();
    if (now - lastInferenceTime > 200 && ws.readyState === WebSocket.OPEN) {
        lastInferenceTime = now;

        // Send low-res frame for inference (320x240 is enough for YOLO)
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = 320;
        offscreenCanvas.height = 240;
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(webcamVideo, 0, 0, 320, 240);

        // Low quality JPEG for speed
        const jpegData = offscreenCanvas.toDataURL('image/jpeg', 0.4);

        ws.send(JSON.stringify({
            action: "process_frame",
            image: jpegData
        }));
    }

    requestAnimationFrame(renderLoop);
}

// Start Webcam
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        webcamVideo.srcObject = stream;

        // Ensure video plays
        await webcamVideo.play();
        streaming = true;
        logDebug("Webcam access granted and playing");

        // Start rendering loop
        renderLoop();
    } catch (err) {
    } else {
        logDebug("Cannot toggle feature: WS not open", 'error');
    }
});
});
