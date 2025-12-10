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
    activeMapIndex: 0,
    mapCount: 1,
    maps: []
};

let currentMapIndex = 0; // Currently displayed map in editor

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
    
    let pointClicked = false;
    
    // Check if clicking/touching a point
    for (let i = 0; i < graphPoints.length; i++) {
        const point = graphPoints[i];
        const px = padding + ((point.rpm - 5000) / 10000) * graphWidth;
        const py = canvas.height - padding - (point.cutTime / 200) * graphHeight;
        
        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        const hitRadius = 20; // Larger hit area for touch
        
        if (distance < hitRadius) {
            selectedPointIndex = i;
            showingTooltipIndex = i; // Show tooltip for this point
            isDragging = true;
            pointClicked = true;
            drawGraph();
            return;
        }
    }
    
    // If clicked somewhere else, hide all tooltips
    if (!pointClicked) {
        showingTooltipIndex = -1;
        drawGraph();
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
    // Keep tooltip visible after dragging
    drawGraph();
}

// Get padding based on canvas size
function getPadding() {
    return Math.max(30, Math.min(50, canvas.width * 0.08));
}

// Draw graph
function drawGraph() {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0 || !graphPoints || graphPoints.length === 0) return;
    
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
    
    // Draw tick marks and labels
    const fontSize = Math.max(10, Math.min(14, width * 0.018));
    ctx.fillStyle = '#888';
    ctx.font = `${fontSize}px sans-serif`;
    
    // RPM tick marks and labels (X-axis)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    const rpmStep = graphWidth < 400 ? 5000 : 2500;
    ctx.textAlign = 'center';
    
    for (let rpm = 5000; rpm <= 15000; rpm += rpmStep) {
        const x = padding + ((rpm - 5000) / 10000) * graphWidth;
        
        // Draw tick mark
        ctx.beginPath();
        ctx.moveTo(x, height - padding);
        ctx.lineTo(x, height - padding + 8);
        ctx.stroke();
        
        // Draw label only if there's enough space
        if (width > 350) {
            ctx.fillText(rpm / 1000 + 'k', x, height - padding + fontSize + 10);
        }
    }
    
    // Cut Time tick marks and labels (Y-axis)
    const cutTimeStep = graphHeight < 300 ? 80 : 40;
    ctx.textAlign = 'right';
    
    for (let cutTime = 0; cutTime <= 200; cutTime += cutTimeStep) {
        const y = height - padding - (cutTime / 200) * graphHeight;
        
        // Draw tick mark
        ctx.beginPath();
        ctx.moveTo(padding - 8, y);
        ctx.lineTo(padding, y);
        ctx.stroke();
        
        // Draw label only if there's enough space
        if (height > 250) {
            ctx.fillText(cutTime + 'ms', padding - 12, y + fontSize / 3);
        }
    }
    
    // Sort points for drawing
    if (!graphPoints || graphPoints.length === 0) {
        return; // Exit early if no points to draw
    }
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
        
        // Draw tooltip only for the selected point
        if (index === showingTooltipIndex) {
            const tooltipText = Math.round(point.rpm) + ' RPM / ' + Math.round(point.cutTime) + ' ms';
            const tooltipFontSize = Math.max(11, Math.min(13, width * 0.016));
            ctx.font = `bold ${tooltipFontSize}px sans-serif`;
            
            // Measure text
            const textMetrics = ctx.measureText(tooltipText);
            const textWidth = textMetrics.width;
            const tooltipPadding = 8;
            const tooltipHeight = tooltipFontSize + tooltipPadding * 2;
            const tooltipWidth = textWidth + tooltipPadding * 2;
            
            // Position tooltip above point
            let tooltipX = x - tooltipWidth / 2;
            let tooltipY = y - pointRadius - tooltipHeight - 10;
            
            // Keep tooltip within bounds
            if (tooltipX < padding) tooltipX = padding;
            if (tooltipX + tooltipWidth > width - padding) tooltipX = width - padding - tooltipWidth;
            if (tooltipY < padding) tooltipY = y + pointRadius + 10; // Show below if no space above
            
            // Draw tooltip background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
            ctx.fill();
            ctx.stroke();
            
            // Draw tooltip text - centered in the tooltip box
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tooltipText, tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2);
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
    
    // Calculate average cut time
    const avgCutTime = graphPoints.reduce((sum, p) => sum + p.cutTime, 0) / graphPoints.length;
    
    // Find a good RPM position that doesn't overlap with existing points
    const sorted = [...graphPoints].sort((a, b) => a.rpm - b.rpm);
    let newRpm = (5000 + 15000) / 2; // Start with middle
    
    // Try to find the largest gap between existing points
    let largestGap = 0;
    let gapMidpoint = newRpm;
    
    for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].rpm - sorted[i].rpm;
        if (gap > largestGap) {
            largestGap = gap;
            gapMidpoint = (sorted[i].rpm + sorted[i + 1].rpm) / 2;
        }
    }
    
    // Check gap before first point
    const gapBefore = sorted[0].rpm - 5000;
    if (gapBefore > largestGap && gapBefore > 500) {
        largestGap = gapBefore;
        gapMidpoint = (5000 + sorted[0].rpm) / 2;
    }
    
    // Check gap after last point
    const gapAfter = 15000 - sorted[sorted.length - 1].rpm;
    if (gapAfter > largestGap && gapAfter > 500) {
        gapMidpoint = (sorted[sorted.length - 1].rpm + 15000) / 2;
    }
    
    newRpm = gapMidpoint;
    
    // Ensure at least 500 RPM from any existing point
    let tooClose = true;
    let offset = 0;
    while (tooClose && offset < 5000) {
        tooClose = false;
        for (let point of graphPoints) {
            if (Math.abs(newRpm - point.rpm) < 500) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) {
            offset += 500;
            newRpm = gapMidpoint + (offset % 2 === 0 ? offset : -offset);
            // Keep within bounds
            if (newRpm < 5000) newRpm = 5000 + offset;
            if (newRpm > 15000) newRpm = 15000 - offset;
        }
    }
    
    // Clamp to bounds
    newRpm = Math.max(5000, Math.min(15000, newRpm));
    
    graphPoints.push({ rpm: Math.round(newRpm), cutTime: Math.round(avgCutTime) });
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
                activeMapIndex: data.qs.activeMapIndex || 0,
                mapCount: data.qs.mapCount || 1,
                maps: JSON.parse(JSON.stringify(data.qs.maps || [{name: "Default Map", cutTimeMap: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]}]))
            };
            
            // Only add default names if maps array doesn't have enough entries
            while (currentConfig.maps.length < currentConfig.mapCount) {
                currentConfig.maps.push({
                    name: `Map ${currentConfig.maps.length + 1}`,
                    cutTimeMap: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]
                });
            }
            
            // Set current map index to active map
            currentMapIndex = currentConfig.activeMapIndex;
            
            // Update sliders
            document.getElementById('minRpmSlider').value = currentConfig.minRpm;
            document.getElementById('minRpmValue').textContent = currentConfig.minRpm + ' RPM';
            document.getElementById('debounceSlider').value = currentConfig.debounce;
            document.getElementById('debounceValue').textContent = currentConfig.debounce + ' ms';
            
            // Populate map selector
            populateMapSelector();
            
            // Initialize graph with current map
            initGraphPoints(currentConfig.maps[currentMapIndex].cutTimeMap);
            drawGraph();
            
            showLoading(false);
        })
        .catch(error => {
            console.log('Using default config:', error);
            
            // Use defaults
            currentConfig = {
                minRpm: 3000,
                debounce: 50,
                activeMapIndex: 0,
                mapCount: 1,
                maps: [{name: "Default Map", cutTimeMap: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]}]
            };
            
            currentMapIndex = 0;
            populateMapSelector();
            initGraphPoints(currentConfig.maps[0].cutTimeMap);
            drawGraph();
            
            showLoading(false);
            showToast('Running in offline mode', 2000);
        });
}

// Save configuration
function saveConfiguration() {
    const cutTimeMap = buildCutTimeMapFromPoints();
    
    // Update current map with new cut time data
    currentConfig.maps[currentMapIndex].cutTimeMap = cutTimeMap;
    
    // Update global config values
    currentConfig.minRpm = parseInt(document.getElementById('minRpmSlider').value);
    currentConfig.debounce = parseInt(document.getElementById('debounceSlider').value);
    
    const config = {
        type: 'config',
        minRpm: currentConfig.minRpm,
        debounce: currentConfig.debounce,
        activeMapIndex: currentConfig.activeMapIndex,
        mapCount: currentConfig.mapCount,
        maps: JSON.parse(JSON.stringify(currentConfig.maps))
    };
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(config));
        showToast('Configuration saved and synced!', 2000);
        
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    } else {
        showToast('Configuration saved locally (offline)', 2000);
        
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
}

// Populate map selector dropdown
function populateMapSelector() {
    const selector = document.getElementById('mapSelector');
    selector.innerHTML = '';
    
    for (let i = 0; i < currentConfig.mapCount; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = currentConfig.maps[i].name || `Map ${i + 1}`;
        if (i === currentMapIndex) {
            option.selected = true;
        }
        selector.appendChild(option);
    }
}

// Switch between maps
function switchMap() {
    // Save current graph data before switching
    if (currentMapIndex < currentConfig.mapCount) {
        currentConfig.maps[currentMapIndex].cutTimeMap = buildCutTimeMapFromPoints();
    }
    
    // Switch to selected map
    const selector = document.getElementById('mapSelector');
    currentMapIndex = parseInt(selector.value);
    
    // Ensure index is valid
    if (currentMapIndex >= currentConfig.mapCount) {
        currentMapIndex = 0;
    }
    
    // Load new map into graph
    initGraphPoints(currentConfig.maps[currentMapIndex].cutTimeMap);
    drawGraph();
    
    showToast(`Switched to ${currentConfig.maps[currentMapIndex].name}`, 1500);
}

// Add new map
function addNewMap() {
    if (currentConfig.mapCount >= 10) {
        showToast('Maximum 10 maps allowed', 2000);
        return;
    }
    
    const mapName = prompt('Enter name for new map:', `Map ${currentConfig.mapCount + 1}`);
    if (!mapName || mapName.trim() === '') {
        showToast('Map name cannot be empty', 2000);
        return;
    }
    
    // Create new map with default values
    const newMap = {
        name: mapName.trim(),
        cutTimeMap: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]
    };
    
    // Send to server
    const config = {
        type: 'config',
        operation: 'addMap',
        mapName: newMap.name,
        cutTimeMap: newMap.cutTimeMap
    };
    
    // Add locally
    currentConfig.maps.push(newMap);
    currentConfig.mapCount++;
    
    // Switch to new map
    currentMapIndex = currentConfig.mapCount - 1;
    populateMapSelector();
    initGraphPoints(newMap.cutTimeMap);
    drawGraph();
    
    // Send to server if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(config));
        showToast(`Map "${mapName}" created and synced`, 2000);
    } else {
        showToast(`Map "${mapName}" created (offline)`, 2000);
    }
}

// Rename current map
function renameCurrentMap() {
    const currentName = currentConfig.maps[currentMapIndex].name;
    const newName = prompt('Enter new name for map:', currentName);
    
    if (!newName || newName.trim() === '') {
        showToast('Map name cannot be empty', 2000);
        return;
    }
    
    if (newName.trim() === currentName) {
        return; // No change
    }
    
    currentConfig.maps[currentMapIndex].name = newName.trim();
    
    // Update selector
    populateMapSelector();
    
    // Will be saved when user saves configuration
    showToast(`Map renamed to "${newName.trim()}"`, 2000);
}

// Delete current map
function deleteCurrentMap() {
    if (currentConfig.mapCount <= 1) {
        showToast('Cannot delete the last map', 2000);
        return;
    }
    
    const mapName = currentConfig.maps[currentMapIndex].name;
    if (!confirm(`Delete map "${mapName}"?`)) {
        return;
    }
    
    const config = {
        type: 'config',
        operation: 'deleteMap',
        mapIndex: currentMapIndex
    };
    
    // Remove locally
    currentConfig.maps.splice(currentMapIndex, 1);
    currentConfig.mapCount--;
    
    // Adjust current index if needed
    if (currentMapIndex >= currentConfig.mapCount) {
        currentMapIndex = currentConfig.mapCount - 1;
    }
    
    // Update active index if needed
    if (currentConfig.activeMapIndex >= currentConfig.mapCount) {
        currentConfig.activeMapIndex = currentConfig.mapCount - 1;
    }
    
    populateMapSelector();
    initGraphPoints(currentConfig.maps[currentMapIndex].cutTimeMap);
    drawGraph();
    
    // Send to server if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(config));
        showToast(`Map "${mapName}" deleted and synced`, 2000);
    } else {
        showToast(`Map "${mapName}" deleted (offline)`, 2000);
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