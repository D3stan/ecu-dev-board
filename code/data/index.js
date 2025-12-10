let ws;
let reconnectInterval;
let graphPoints = [];
let selectedPointIndex = -1;
let isDragging = false;
let canvas;
let ctx;
let telemetryUpdateTimer = null;
let isOfflineMode = false;
let offlineData = {
    rpm: 0,
    signalActive: false,
    cutActive: false,
    uptime: 0
};

function connect() {
    try {
        ws = new WebSocket('ws://' + window.location.hostname + '/ws');
        
        ws.onopen = function() {
            if (isOfflineMode) {
                console.log('WebSocket reconnected');
            }
            isOfflineMode = false;
            document.getElementById('wsStatus').classList.add('active');
            document.getElementById('wsStatus').classList.remove('inactive');
            document.getElementById('wsStatusText').textContent = 'Connected';
            clearInterval(reconnectInterval);
        };
        
        ws.onclose = function() {
            if (!isOfflineMode) {
                console.log('WebSocket disconnected');
            }
            document.getElementById('wsStatus').classList.remove('active');
            document.getElementById('wsStatus').classList.add('inactive');
            document.getElementById('wsStatusText').textContent = 'Disconnected';
            
            // Attempt reconnection every 3 seconds only if not in offline mode
            if (!isOfflineMode) {
                reconnectInterval = setInterval(connect, 3000);
            }
        };
        
        ws.onerror = function(error) {
            if (!isOfflineMode) {
                console.log('WebSocket error, switching to offline mode');
                isOfflineMode = true;
                clearInterval(reconnectInterval);
            }
        };
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            updateTelemetry(data);
        };
    } catch (error) {
        if (!isOfflineMode) {
            console.log('Failed to create WebSocket, running in offline mode');
            isOfflineMode = true;
        }
        document.getElementById('wsStatus').classList.remove('active');
        document.getElementById('wsStatus').classList.add('inactive');
        document.getElementById('wsStatusText').textContent = 'Offline Mode';
        clearInterval(reconnectInterval);
    }
}

function updateTelemetry(data) {
    // Update RPM display
    document.getElementById('rpmDisplay').textContent = data.rpm || 0;
    
    // Update signal status
    const signalStatus = document.getElementById('signalStatus');
    const signalText = document.getElementById('signalText');
    if (data.signalActive) {
        signalStatus.classList.add('active');
        signalStatus.classList.remove('inactive');
        signalText.textContent = 'Active';
    } else {
        signalStatus.classList.remove('active');
        signalStatus.classList.add('inactive');
        signalText.textContent = 'No Signal';
    }
    
    // Update cut status
    const cutStatus = document.getElementById('cutStatus');
    const cutText = document.getElementById('cutText');
    if (data.cutActive) {
        cutStatus.classList.add('active');
        cutStatus.classList.remove('inactive');
        cutText.textContent = 'Active';
    } else {
        cutStatus.classList.remove('active');
        cutStatus.classList.add('inactive');
        cutText.textContent = 'Inactive';
    }
    
    // Update hardware ID and uptime
    if (data.uptime) {
        const seconds = Math.floor(data.uptime / 1000);
        document.getElementById('uptime').textContent = formatUptime(seconds);
    }
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}

function loadConfig() {
    fetch('/api/config')
        .then(response => {
            if (!response.ok) throw new Error('Config fetch failed');
            return response.json();
        })
        .then(data => {
            // Load QS config - store in variables for modal
            window.currentQsConfig = {
                minRpm: data.qs.minRpm,
                debounce: data.qs.debounce,
                cutTimeMap: data.qs.cutTimeMap
            };
            
            // Update display summary
            updateConfigSummary();
            
            // Load telemetry config
            const updateRate = data.telemetry.updateRate || 100;
            document.getElementById('updateRateSlider').value = updateRate;
            document.getElementById('updateRateValue').textContent = updateRate + ' ms';
            
            // Load network config
            const staMode = data.network.staMode || false;
            if (staMode) {
                selectWifiMode('sta');
                document.getElementById('staSsid').value = data.network.staSsid || '';
                document.getElementById('staPassword').value = data.network.staPassword || '';
            } else {
                selectWifiMode('ap');
                document.getElementById('apSsid').value = data.network.apSsid || 'rspqs';
                document.getElementById('apPassword').value = data.network.apPassword || '';
            }
            
            // Display error if present
            if (data.lastError) {
                document.getElementById('errorMessage').textContent = data.lastError;
                document.getElementById('errorSection').classList.add('visible');
            } else {
                document.getElementById('errorSection').classList.remove('visible');
            }
        })
        .catch(error => {
            console.log('Failed to load config, using defaults:', error);
            isOfflineMode = true;
            // Set default config for offline mode
            window.currentQsConfig = {
                minRpm: 3000,
                debounce: 50,
                cutTimeMap: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]
            };
            updateConfigSummary();
            
            // Set default telemetry
            document.getElementById('updateRateSlider').value = 100;
            document.getElementById('updateRateValue').textContent = '100 ms';
            
            // Set default network config
            selectWifiMode('ap');
            document.getElementById('apSsid').value = 'rspqs';
        });
}

function updateConfigSummary() {
    const config = window.currentQsConfig;
    document.getElementById('minRpmDisplay').textContent = config.minRpm + ' RPM';
    document.getElementById('debounceDisplay').textContent = config.debounce + ' ms';
    document.getElementById('cutTimePointsDisplay').textContent = config.cutTimeMap.length + ' points';
}

function saveQsConfigFromModal() {
    // Build cut time map from graph points
    const cutTimeMap = buildCutTimeMapFromPoints();
    
    const config = {
        type: 'config',
        minRpm: parseInt(document.getElementById('minRpmSlider').value),
        debounce: parseInt(document.getElementById('debounceSlider').value),
        cutTimeMap: cutTimeMap
    };
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(config));
    } else {
        console.log('Offline mode: Config saved locally', config);
    }
    
    // Update current config
    window.currentQsConfig = {
        minRpm: config.minRpm,
        debounce: config.debounce,
        cutTimeMap: cutTimeMap
    };
    updateConfigSummary();
    
    closeQsConfigModal();
    alert('QuickShifter configuration saved!');
}

function buildCutTimeMapFromPoints() {
    // Sort points by RPM
    const sorted = [...graphPoints].sort((a, b) => a.rpm - b.rpm);
    
    // Generate map from 5000 to 15000 RPM in 1000 RPM steps (11 points)
    const map = [];
    for (let rpm = 5000; rpm <= 15000; rpm += 1000) {
        // Find interpolated value
        let value = 80; // default
        
        if (sorted.length === 0) {
            value = 80;
        } else if (rpm <= sorted[0].rpm) {
            value = sorted[0].cutTime;
        } else if (rpm >= sorted[sorted.length - 1].rpm) {
            value = sorted[sorted.length - 1].cutTime;
        } else {
            // Linear interpolation
            for (let i = 0; i < sorted.length - 1; i++) {
                if (rpm >= sorted[i].rpm && rpm <= sorted[i + 1].rpm) {
                    const t = (rpm - sorted[i].rpm) / (sorted[i + 1].rpm - sorted[i].rpm);
                    value = sorted[i].cutTime + t * (sorted[i + 1].cutTime - sorted[i].cutTime);
                    break;
                }
            }
        }
        
        map.push(Math.round(value));
    }
    
    return map;
}
function updateTelemetryRate() {
    const value = document.getElementById('updateRateSlider').value;
    document.getElementById('updateRateValue').textContent = value + ' ms';
    
    // Clear existing timer
    if (telemetryUpdateTimer) {
        clearTimeout(telemetryUpdateTimer);
    }
    
    // Set new timer to save after 1 second of no changes
    telemetryUpdateTimer = setTimeout(() => {
        const config = {
            type: 'telemetry',
            updateRate: parseInt(value)
        };
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(config));
            console.log('Telemetry rate updated:', value + 'ms');
        } else {
            console.log('Offline mode: Telemetry rate saved locally:', value + 'ms');
        }
    }, 1000);
}

function saveNetworkConfig() {
    const staMode = document.getElementById('modeSTABtn').classList.contains('active');
    const config = {
        type: 'network',
        staMode: staMode,
        apSsid: document.getElementById('apSsid').value || 'rspqs',
        apPassword: document.getElementById('apPassword').value || '',
        staSsid: document.getElementById('staSsid').value || '',
        staPassword: document.getElementById('staPassword').value || ''
    };
    
    // Validate based on mode
    if (staMode) {
        if (!config.staSsid) {
            alert('Please enter a WiFi SSID for STA mode.');
            return;
        }
    } else {
        if (!config.apSsid) {
            alert('Please enter an AP SSID for AP mode.');
            return;
        }
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(config));
    } else {
        console.log('Offline mode: Network config saved locally', config);
    }
    alert('Network configuration saved! Click Reboot to apply changes.');
}

function selectWifiMode(mode) {
    const apBtn = document.getElementById('modeAPBtn');
    const staBtn = document.getElementById('modeSTABtn');
    const apSection = document.getElementById('apConfigSection');
    const staSection = document.getElementById('staConfigSection');
    
    if (mode === 'ap') {
        apBtn.classList.add('active');
        staBtn.classList.remove('active');
        apSection.style.display = 'block';
        staSection.style.display = 'none';
    } else {
        staBtn.classList.add('active');
        apBtn.classList.remove('active');
        staSection.style.display = 'block';
        apSection.style.display = 'none';
    }
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    if (field.type === 'password') {
        field.type = 'text';
    } else {
        field.type = 'password';
    }
}

function startOta() {
    if (confirm('Start OTA firmware update? Device will reboot after update.')) {
        const msg = { type: 'ota' };
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
            alert('OTA update started. Device will reboot automatically.');
        } else {
            alert('Cannot start OTA update in offline mode.');
        }
    }
}

function reboot() {
    if (confirm('Reboot device?')) {
        fetch('/api/reboot', { method: 'POST' });
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
}

// Modal functions
function openQsConfigModal() {
    const modal = document.getElementById('qsConfigModal');
    modal.style.display = 'block';
    
    // Load current values into modal
    const config = window.currentQsConfig;
    document.getElementById('minRpmSlider').value = config.minRpm;
    document.getElementById('debounceSlider').value = config.debounce;
    updateSliderValue('minRpm');
    updateSliderValue('debounce');
    
    // Initialize graph
    initGraph(config.cutTimeMap);
}

function closeQsConfigModal() {
    const modal = document.getElementById('qsConfigModal');
    modal.style.display = 'none';
}

function updateSliderValue(type) {
    if (type === 'minRpm') {
        const value = document.getElementById('minRpmSlider').value;
        document.getElementById('minRpmValue').textContent = value + ' RPM';
    } else if (type === 'debounce') {
        const value = document.getElementById('debounceSlider').value;
        document.getElementById('debounceValue').textContent = value + ' ms';
    }
}

// Graph functions
function initGraph(cutTimeMap) {
    canvas = document.getElementById('cutTimeGraph');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Convert cutTimeMap to points (if 11 values, create 4 representative points)
    if (cutTimeMap && cutTimeMap.length === 11) {
        // Create 4 evenly spaced points from the map
        graphPoints = [
            { rpm: 5000, cutTime: cutTimeMap[0] },
            { rpm: 8333, cutTime: cutTimeMap[3] },
            { rpm: 11666, cutTime: cutTimeMap[7] },
            { rpm: 15000, cutTime: cutTimeMap[10] }
        ];
    } else {
        // Default to flat 80ms curve with 4 points
        graphPoints = [
            { rpm: 5000, cutTime: 80 },
            { rpm: 8333, cutTime: 80 },
            { rpm: 11666, cutTime: 80 },
            { rpm: 15000, cutTime: 80 }
        ];
    }
    
    updateGraphPointCount();
    drawGraph();
    
    // Add event listeners (remove old ones first to prevent duplicates)
    canvas.removeEventListener('mousedown', onGraphMouseDown);
    canvas.removeEventListener('mousemove', onGraphMouseMove);
    canvas.removeEventListener('mouseup', onGraphMouseUp);
    canvas.removeEventListener('mouseleave', onGraphMouseUp);
    
    canvas.addEventListener('mousedown', onGraphMouseDown);
    canvas.addEventListener('mousemove', onGraphMouseMove);
    canvas.addEventListener('mouseup', onGraphMouseUp);
    canvas.addEventListener('mouseleave', onGraphMouseUp);
}

function resetGraph() {
    graphPoints = [
        { rpm: 5000, cutTime: 80 },
        { rpm: 8333, cutTime: 80 },
        { rpm: 11666, cutTime: 80 },
        { rpm: 15000, cutTime: 80 }
    ];
    updateGraphPointCount();
    if (ctx && canvas) {
        drawGraph();
    }
}

function addGraphPoint() {
    if (graphPoints.length >= 10) {
        alert('Maximum 10 points allowed');
        return;
    }
    
    // Add point in the middle of the RPM range
    const avgRpm = (5000 + 15000) / 2;
    const avgCutTime = graphPoints.reduce((sum, p) => sum + p.cutTime, 0) / graphPoints.length;
    
    graphPoints.push({ rpm: avgRpm, cutTime: avgCutTime });
    updateGraphPointCount();
    drawGraph();
}

function removeGraphPoint() {
    if (graphPoints.length <= 2) {
        alert('Minimum 2 points required');
        return;
    }
    
    // Remove the last point
    graphPoints.pop();
    updateGraphPointCount();
    drawGraph();
}

function updateGraphPointCount() {
    document.getElementById('graphPointCount').textContent = graphPoints.length;
}

function drawGraph() {
    if (!ctx || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (RPM)
    for (let i = 0; i <= 10; i++) {
        const x = padding + (i / 10) * graphWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }
    
    // Horizontal grid lines (Cut Time)
    for (let i = 0; i <= 5; i++) {
        const y = padding + (i / 5) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw labels
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    // RPM labels (X-axis)
    for (let rpm = 5000; rpm <= 15000; rpm += 2500) {
        const x = padding + ((rpm - 5000) / 10000) * graphWidth;
        ctx.fillText(rpm / 1000 + 'k', x, height - padding + 20);
    }
    
    // Cut Time labels (Y-axis)
    ctx.textAlign = 'right';
    for (let cutTime = 0; cutTime <= 200; cutTime += 40) {
        const y = height - padding - (cutTime / 200) * graphHeight;
        ctx.fillText(cutTime + 'ms', padding - 10, y + 4);
    }
    
    // Axis labels
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RPM', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Cut Time (ms)', 0, 0);
    ctx.restore();
    
    // Sort points for drawing
    const sorted = [...graphPoints].sort((a, b) => a.rpm - b.rpm);
    
    // Draw interpolated curve
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let rpm = 5000; rpm <= 15000; rpm += 50) {
        const x = padding + ((rpm - 5000) / 10000) * graphWidth;
        let cutTime = 80;
        
        if (sorted.length === 1) {
            cutTime = sorted[0].cutTime;
        } else if (rpm <= sorted[0].rpm) {
            cutTime = sorted[0].cutTime;
        } else if (rpm >= sorted[sorted.length - 1].rpm) {
            cutTime = sorted[sorted.length - 1].cutTime;
        } else {
            for (let i = 0; i < sorted.length - 1; i++) {
                if (rpm >= sorted[i].rpm && rpm <= sorted[i + 1].rpm) {
                    const t = (rpm - sorted[i].rpm) / (sorted[i + 1].rpm - sorted[i].rpm);
                    cutTime = sorted[i].cutTime + t * (sorted[i + 1].cutTime - sorted[i].cutTime);
                    break;
                }
            }
        }
        
        const y = height - padding - (cutTime / 200) * graphHeight;
        
        if (rpm === 5000) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw control points
    graphPoints.forEach((point, index) => {
        const x = padding + ((point.rpm - 5000) / 10000) * graphWidth;
        const y = height - padding - (point.cutTime / 200) * graphHeight;
        
        // Draw point
        ctx.fillStyle = index === selectedPointIndex ? '#ff4444' : '#00ff88';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(point.rpm) + ' / ' + Math.round(point.cutTime) + 'ms', x, y - 15);
    });
}

function onGraphMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a point
    const padding = 40;
    const graphWidth = canvas.width - 2 * padding;
    const graphHeight = canvas.height - 2 * padding;
    
    for (let i = 0; i < graphPoints.length; i++) {
        const point = graphPoints[i];
        const px = padding + ((point.rpm - 5000) / 10000) * graphWidth;
        const py = canvas.height - padding - (point.cutTime / 200) * graphHeight;
        
        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (distance < 12) {
            selectedPointIndex = i;
            isDragging = true;
            break;
        }
    }
    
    drawGraph();
}

function onGraphMouseMove(e) {
    if (!isDragging || selectedPointIndex < 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = 40;
    const graphWidth = canvas.width - 2 * padding;
    const graphHeight = canvas.height - 2 * padding;
    
    // Convert to RPM and cutTime
    let rpm = 5000 + ((x - padding) / graphWidth) * 10000;
    let cutTime = 200 - ((y - padding) / graphHeight) * 200;
    
    // Clamp values
    rpm = Math.max(5000, Math.min(15000, rpm));
    cutTime = Math.max(0, Math.min(200, cutTime));
    
    graphPoints[selectedPointIndex].rpm = Math.round(rpm);
    graphPoints[selectedPointIndex].cutTime = Math.round(cutTime);
    
    drawGraph();
}

function onGraphMouseUp() {
    isDragging = false;
    selectedPointIndex = -1;
    drawGraph();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('qsConfigModal');
    if (event.target === modal) {
        closeQsConfigModal();
    }
}

// Testing function - call from console with seed() to populate with realistic test data
window.seed = function() {
    console.log('🌱 Seeding interface with test data...');
    
    // Simulate telemetry data
    let testRpm = 5000;
    let rpmDirection = 1;
    let testUptime = 0;
    
    const simulateTelemetry = () => {
        // Vary RPM between 3000 and 12000
        testRpm += (Math.random() * 500 - 250) * rpmDirection;
        if (testRpm > 12000) {
            rpmDirection = -1;
            testRpm = 12000;
        } else if (testRpm < 3000) {
            rpmDirection = 1;
            testRpm = 3000;
        }
        
        testUptime += 100;
        
        const testData = {
            rpm: Math.round(testRpm),
            signalActive: testRpm > 2500,
            cutActive: testRpm > 8000 && Math.random() > 0.7,
            uptime: testUptime
        };
        
        updateTelemetry(testData);
    };
    
    // Start simulation
    const intervalId = setInterval(simulateTelemetry, 100);
    console.log('✅ Test data simulation started! RPM and telemetry updating every 100ms.');
    console.log('💡 Call seed.stop() to stop the simulation');
    
    // Return stop function
    window.seed.stop = function() {
        clearInterval(intervalId);
        console.log('⏹️ Test data simulation stopped');
    };
    
    // Run first update immediately
    simulateTelemetry();
};

// Initialize
connect();
loadConfig();