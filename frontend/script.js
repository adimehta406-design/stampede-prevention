// Debug Logger
function logDebug(msg, type = 'info') {
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        const entry = document.createElement('div');
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        entry.style.color = type === 'error' ? '#ef4444' : '#22c55e';
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
