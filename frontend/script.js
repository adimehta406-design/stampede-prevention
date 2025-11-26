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

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
logDebug(`Attempting connection to: ${wsUrl}`);
const ws = new WebSocket(wsUrl);
const crowdCountEl = document.getElementById('crowd-count');
const riskLevelEl = document.getElementById('risk-level');
const fpsCounterEl = document.getElementById('fps-counter');
const connectionStatusEl = document.getElementById('connection-status');

// Video Elements
const videoCanvas = document.getElementById('video-canvas');
const videoCtx = videoCanvas.getContext('2d');
const webcamVideo = document.getElementById('webcam-video');
let streaming = false;
let isProcessing = false;
let lastFrameTime = 0;

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

// Send Frames to Server
function sendFrames() {
    if (!streaming) return;

    // Flow Control: Don't send if already processing a frame (prevents lag buildup)
    if (isProcessing) {
        requestAnimationFrame(sendFrames);
        return;
    }

    const now = Date.now();
    const elapsed = now - lastFrameTime;
    const fpsInterval = 1000 / 30; // Target 30 FPS

    if (elapsed > fpsInterval) {
        lastFrameTime = now - (elapsed % fpsInterval);

        if (ws.readyState === WebSocket.OPEN) {
            isProcessing = true; // Lock

            // Safety Timeout: Reset lock if no response after 1 second
            setTimeout(() => {
                if (isProcessing) {
                    console.warn("Frame processing timed out, resetting lock");
                    isProcessing = false;
                }
            }, 1000);

            // Draw video frame to canvas
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 480;
            offscreenCanvas.height = 360;
            const ctx = offscreenCanvas.getContext('2d');
            ctx.drawImage(webcamVideo, 0, 0, 480, 360);

            // Convert to JPEG
            const jpegData = offscreenCanvas.toDataURL('image/jpeg', 0.6);

            // Send to server
            ws.send(JSON.stringify({
                action: "process_frame",
                image: jpegData
            }));
        }
    }

    requestAnimationFrame(sendFrames);
}

// Start Webcam
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        webcamVideo.srcObject = stream;
        webcamVideo.play();
        streaming = true;
        logDebug("Webcam access granted");

        // Start sending frames
        sendFrames();
    } catch (err) {
        logDebug(`Webcam Error: ${err}`, 'error');
        alert("Please allow camera access to use this application.");
    }
}

ws.onopen = () => {
    connectionStatusEl.textContent = `System Online (${protocol})`;
    connectionStatusEl.style.color = "#22c55e";
    logDebug("WebSocket Connected Successfully");
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
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Check if it's a processed frame
    if (data.processed_frame) {
        isProcessing = false; // Unlock flow control
        const img = new Image();
        img.onload = () => {
            videoCtx.drawImage(img, 0, 0, videoCanvas.width, videoCanvas.height);
        };
        img.src = "data:image/jpeg;base64," + data.processed_frame;
    }

    // Update Stats
    if (data.count !== undefined) {
        crowdCountEl.textContent = data.count;
        fpsCounterEl.textContent = `${data.fps} FPS`;

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

// Button Interactions
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const featureName = btn.textContent;
        const isActive = btn.classList.contains('active');

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: "toggle_feature",
                feature: featureName,
                value: isActive
            }));
            logDebug(`Toggled ${featureName}: ${isActive}`);
        } else {
            logDebug("Cannot toggle feature: WS not open", 'error');
        }
    });
});
