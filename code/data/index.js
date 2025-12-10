let ws;
let reconnectInterval;

function connect() {
    ws = new WebSocket('ws://' + window.location.hostname + '/ws');
    
    ws.onopen = function() {
        console.log('WebSocket connected');
        document.getElementById('wsStatus').classList.add('active');
        document.getElementById('wsStatus').classList.remove('inactive');
        document.getElementById('wsStatusText').textContent = 'Connected';
        clearInterval(reconnectInterval);
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        document.getElementById('wsStatus').classList.remove('active');
        document.getElementById('wsStatus').classList.add('inactive');
        document.getElementById('wsStatusText').textContent = 'Disconnected';
        
        // Attempt reconnection every 3 seconds
        reconnectInterval = setInterval(connect, 3000);
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        updateTelemetry(data);
    };
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
    if (data.hwid) {
        document.getElementById('hwid').textContent = data.hwid;
    }
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
        .then(response => response.json())
        .then(data => {
            // Load QS config
            document.getElementById('minRpm').value = data.qs.minRpm;
            document.getElementById('debounce').value = data.qs.debounce;
            
            // Load cut time map
            const mapContainer = document.getElementById('cutTimeMap');
            mapContainer.innerHTML = '';
            data.qs.cutTimeMap.forEach((value, index) => {
                const rpm = 5000 + (index * 1000);
                const entry = document.createElement('div');
                entry.className = 'map-entry';
                entry.innerHTML = `
                    <label>${rpm/1000}k</label>
                    <input type="number" id="map${index}" value="${value}" min="0" max="500" step="5">
                `;
                mapContainer.appendChild(entry);
            });
            
            // Load telemetry config
            document.getElementById('updateRate').value = data.telemetry.updateRate;
            
            // Load network config
            const staMode = data.network.staMode || false;
            if (staMode) {
                document.getElementById('modeSTA').checked = true;
                document.getElementById('staSsid').value = data.network.staSsid || '';
            } else {
                document.getElementById('modeAP').checked = true;
                document.getElementById('apSsid').value = data.network.apSsid || 'rspqs';
            }
            updateWifiModeFields();
            updateWifiModeFields();
            
            // Display error if present
            if (data.lastError) {
                document.getElementById('errorMessage').textContent = data.lastError;
                document.getElementById('errorSection').classList.add('visible');
            } else {
                document.getElementById('errorSection').classList.remove('visible');
            }
        });
}

function saveQsConfig() {
    const cutTimeMap = [];
    for (let i = 0; i < 11; i++) {
        cutTimeMap.push(parseInt(document.getElementById('map' + i).value));
    }
    
    const config = {
        type: 'config',
        minRpm: parseInt(document.getElementById('minRpm').value),
        debounce: parseInt(document.getElementById('debounce').value),
        cutTimeMap: cutTimeMap
    };
    
    ws.send(JSON.stringify(config));
    alert('QuickShifter configuration saved!');
}

function saveTelemetryConfig() {
    const config = {
        type: 'telemetry',
        updateRate: parseInt(document.getElementById('updateRate').value)
    };
    
    ws.send(JSON.stringify(config));
    alert('Telemetry configuration saved!');
}

function saveNetworkConfig() {
    const staMode = document.getElementById('modeSTA').checked;
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
    
    ws.send(JSON.stringify(config));
    alert('Network configuration saved! Click Reboot to apply changes.');
}

function updateWifiModeFields() {
    const staMode = document.getElementById('modeSTA').checked;
    const apMode = document.getElementById('modeAP').checked;
    const staSection = document.getElementById('staConfigSection');
    const apSection = document.getElementById('apConfigSection');
    
    if (staMode) {
        staSection.style.display = 'block';
        apSection.style.display = 'none';
    } else if (apMode) {
        staSection.style.display = 'none';
        apSection.style.display = 'block';
    } else {
        staSection.style.display = 'none';
        apSection.style.display = 'none';
    }
}

function startOta() {
    if (confirm('Start OTA firmware update? Device will reboot after update.')) {
        const msg = { type: 'ota' };
        ws.send(JSON.stringify(msg));
        alert('OTA update started. Device will reboot automatically.');
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

// Initialize
connect();
loadConfig();