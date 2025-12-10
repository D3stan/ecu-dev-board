// WebSocket connection
let ws = null;
let reconnectInterval = null;

// Graph variables
let canvas;
let ctx;
let graphPoints = [];
let selectedPointIndex = -1;
let isDragging = false;
let lastCanvasSize = { width: 0, height: 0 };
let showingTooltipIndex = -1; // Index of point showing tooltip

// Touch tracking
let touchStartX = 0;
let touchStartY = 0;

// Configuration state
let currentConfig = {
    minRpm: 3000,
    debounce: 50,
    cutTimeMap: []
};

// Initialize
function init() {
    canvas = document.getElementById('cutTimeGraph');
    ctx = canvas.getContext('2d');
    
    // Setup canvas size
    resizeCanvas();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Setup graph event listeners
    setupGraphEventListeners();
    
    // Connect WebSocket
    connectWebSocket();
    
    // Load configuration
    loadConfig();
}

// Handle resize with debouncing
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
        drawGraph();
    }, 100);
}

// Handle orientation change
function handleOrientationChange() {
    // Wait for orientation to complete
    setTimeout(() => {
        resizeCanvas();
        drawGraph();
    }, 200);
}

// Resize canvas to match container
function resizeCanvas() {
    const wrapper = canvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    
    // Set canvas size to match container
    const newWidth = rect.width;
    const newHeight = rect.height;
    
    // Only update if size changed significantly
    if (Math.abs(newWidth - lastCanvasSize.width) > 5 || 
        Math.abs(newHeight - lastCanvasSize.height) > 5) {
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        lastCanvasSize.width = newWidth;
        lastCanvasSize.height = newHeight;
        
        console.log('Canvas resized:', newWidth, 'x', newHeight);
    }
}

// Setup graph event listeners
function setupGraphEventListeners() {
    // Mouse events
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    
    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

// Touch event handlers
function onTouchStart(e) {
    e.preventDefault(); // Prevent scrolling
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        onPointerDown({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

function onTouchMove(e) {
    e.preventDefault(); // Prevent scrolling
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        onPointerMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    onPointerUp();
}

// Unified pointer handlers
function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const padding = getPadding();
    const graphWidth = canvas.width - 2 * padding;
    const graphHeight = canvas.height - 2 * padding;
    
    // Check if clicking/touching a point
    for (let i = 0; i < graphPoints.length; i++) {
        const point = graphPoints[i];
        const px = padding + ((point.rpm - 5000) / 10000) * graphWidth;
        const py = canvas.height - padding - (point.cutTime / 200) * graphHeight;
        
        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        const hitRadius = 20; // Larger hit area for touch
        
        if (distance < hitRadius) {
            selectedPointIndex = i;
            isDragging = true;
            drawGraph();
            return;
        }
    }
}

function onPointerMove(e) {
    if (!isDragging || selectedPointIndex < 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const padding = getPadding();
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

function onPointerUp() {
    isDragging = false;
    selectedPointIndex = -1;
    drawGraph();
}

// Get padding based on canvas size
function getPadding() {
    return Math.max(30, Math.min(50, canvas.width * 0.08));
}

// Draw graph
function drawGraph() {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = getPadding();
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
        const x = padding + (i / 10) * graphWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding + (i / 5) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw labels
    const fontSize = Math.max(10, Math.min(14, width * 0.018));
    ctx.fillStyle = '#888';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    
    // RPM labels (X-axis)
    const rpmStep = graphWidth < 400 ? 5000 : 2500;
    for (let rpm = 5000; rpm <= 15000; rpm += rpmStep) {
        const x = padding + ((rpm - 5000) / 10000) * graphWidth;
        ctx.fillText(rpm / 1000 + 'k', x, height - padding + fontSize + 5);
    }
    
    // Cut Time labels (Y-axis)
    ctx.textAlign = 'right';
    const cutTimeStep = graphHeight < 300 ? 80 : 40;
    for (let cutTime = 0; cutTime <= 200; cutTime += cutTimeStep) {
        const y = height - padding - (cutTime / 200) * graphHeight;
        ctx.fillText(cutTime + 'ms', padding - 8, y + fontSize / 3);
    }
    
    // Axis labels
    ctx.fillStyle = '#00ff88';
    ctx.font = `bold ${fontSize + 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('RPM', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(fontSize, height / 2);
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
    const pointRadius = Math.max(8, Math.min(12, width * 0.015));
    graphPoints.forEach((point, index) => {
        const x = padding + ((point.rpm - 5000) / 10000) * graphWidth;
        const y = height - padding - (point.cutTime / 200) * graphHeight;
        
        // Draw point
        ctx.fillStyle = index === selectedPointIndex ? '#ff4444' : '#00ff88';
        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw label (only if enough space)
        if (width > 500) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(
                Math.round(point.rpm) + ' / ' + Math.round(point.cutTime) + 'ms',
                x,
                y - pointRadius - 5
            );
        }
    });
}

// Initialize graph points
function initGraphPoints(cutTimeMap) {
    if (cutTimeMap && cutTimeMap.length >= 11) {
        graphPoints = [
            { rpm: 5000, cutTime: cutTimeMap[0] },
            { rpm: 8333, cutTime: cutTimeMap[3] },
            { rpm: 11666, cutTime: cutTimeMap[7] },
            { rpm: 15000, cutTime: cutTimeMap[10] }
        ];
    } else {
        graphPoints = [
            { rpm: 5000, cutTime: 80 },
            { rpm: 8333, cutTime: 80 },
            { rpm: 11666, cutTime: 80 },
            { rpm: 15000, cutTime: 80 }
        ];
    }
    updateGraphPointCount();
}

// Add graph point
function addGraphPoint() {
    if (graphPoints.length >= 10) {
        showToast('Maximum 10 points allowed', 2000);
        return;
    }
    
    const avgRpm = (5000 + 15000) / 2;
    const avgCutTime = graphPoints.reduce((sum, p) => sum + p.cutTime, 0) / graphPoints.length;
    
    graphPoints.push({ rpm: avgRpm, cutTime: avgCutTime });
    updateGraphPointCount();
    drawGraph();
}

// Remove graph point
function removeGraphPoint() {
    if (graphPoints.length <= 2) {
        showToast('Minimum 2 points required', 2000);
        return;
    }
    
    graphPoints.pop();
    updateGraphPointCount();
    drawGraph();
}

// Reset graph
function resetGraph() {
    graphPoints = [
        { rpm: 5000, cutTime: 80 },
        { rpm: 8333, cutTime: 80 },
        { rpm: 11666, cutTime: 80 },
        { rpm: 15000, cutTime: 80 }
    ];
    updateGraphPointCount();
    drawGraph();
}

// Update point count display
function updateGraphPointCount() {
    document.getElementById('graphPointCount').textContent = graphPoints.length;
}

// Build cut time map from points
function buildCutTimeMapFromPoints() {
    const sorted = [...graphPoints].sort((a, b) => a.rpm - b.rpm);
    const map = [];
    
    for (let i = 0; i < 11; i++) {
        const rpm = 5000 + (i * 1000);
        let cutTime = 80;
        
        if (sorted.length === 1) {
            cutTime = sorted[0].cutTime;
        } else if (rpm <= sorted[0].rpm) {
            cutTime = sorted[0].cutTime;
        } else if (rpm >= sorted[sorted.length - 1].rpm) {
            cutTime = sorted[sorted.length - 1].cutTime;
        } else {
            for (let j = 0; j < sorted.length - 1; j++) {
                if (rpm >= sorted[j].rpm && rpm <= sorted[j + 1].rpm) {
                    const t = (rpm - sorted[j].rpm) / (sorted[j + 1].rpm - sorted[j].rpm);
                    cutTime = sorted[j].cutTime + t * (sorted[j + 1].cutTime - sorted[j].cutTime);
                    break;
                }
            }
        }
        
        map.push(Math.round(cutTime));
    }
    
    return map;
}

// Update slider values
function updateSliderValue(type) {
    if (type === 'minRpm') {
        const value = document.getElementById('minRpmSlider').value;
        document.getElementById('minRpmValue').textContent = value + ' RPM';
    } else if (type === 'debounce') {
        const value = document.getElementById('debounceSlider').value;
        document.getElementById('debounceValue').textContent = value + ' ms';
    }
}

// WebSocket connection
function connectWebSocket() {
    try {
        ws = new WebSocket('ws://' + window.location.hostname + '/ws');
        
        ws.onopen = function() {
            updateConnectionStatus(true);
            showToast('Connected to QuickShifter', 1500);
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
            }
        };
        
        ws.onclose = function() {
            updateConnectionStatus(false);
            if (!reconnectInterval) {
                reconnectInterval = setInterval(connectWebSocket, 3000);
            }
        };
        
        ws.onerror = function() {
            updateConnectionStatus(false);
        };
    } catch (error) {
        updateConnectionStatus(false);
    }
}

// Update connection status
function updateConnectionStatus(connected) {
    const indicator = document.getElementById('wsStatus');
    const text = document.getElementById('wsStatusText');
    
    if (connected) {
        indicator.classList.add('active');
        indicator.classList.remove('inactive');
        text.textContent = 'Connected';
    } else {
        indicator.classList.remove('active');
        indicator.classList.add('inactive');
        text.textContent = 'Offline';
    }
}

// Load configuration
function loadConfig() {
    showLoading(true);
    
    fetch('/api/config')
        .then(response => {
            if (!response.ok) throw new Error('Config fetch failed');
            return response.json();
        })
        .then(data => {
            currentConfig = {
                minRpm: data.qs.minRpm,
                debounce: data.qs.debounce,
                cutTimeMap: data.qs.cutTimeMap
            };
            
            // Update sliders
            document.getElementById('minRpmSlider').value = currentConfig.minRpm;
            document.getElementById('minRpmValue').textContent = currentConfig.minRpm + ' RPM';
            document.getElementById('debounceSlider').value = currentConfig.debounce;
            document.getElementById('debounceValue').textContent = currentConfig.debounce + ' ms';
            
            // Initialize graph
            initGraphPoints(currentConfig.cutTimeMap);
            drawGraph();
            
            showLoading(false);
        })
        .catch(error => {
            console.log('Using default config:', error);
            
            // Use defaults
            currentConfig = {
                minRpm: 3000,
                debounce: 50,
                cutTimeMap: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]
            };
            
            initGraphPoints(currentConfig.cutTimeMap);
            drawGraph();
            
            showLoading(false);
            showToast('Running in offline mode', 2000);
        });
}

// Save configuration
function saveConfiguration() {
    const cutTimeMap = buildCutTimeMapFromPoints();
    
    const config = {
        type: 'config',
        minRpm: parseInt(document.getElementById('minRpmSlider').value),
        debounce: parseInt(document.getElementById('debounceSlider').value),
        cutTimeMap: cutTimeMap
    };
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(config));
        showToast('Configuration saved!', 2000);
        
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    } else {
        showToast('Cannot save: Not connected to device', 3000);
    }
}

// Go back
function goBack() {
    window.location.href = '/';
}

// Show toast
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Show/hide loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);