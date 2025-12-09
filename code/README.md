# ESP32-S2 QuickShifter System

Component-based architecture for motorcycle quickshifter with web interface and OTA updates.

## Architecture Overview

The system follows a **Component-Based Object-Oriented** architecture with **Dependency Injection**:

### Core Components

1. **QuickShifterEngine** (`include/QuickShifterEngine.hpp`)
   - Hard real-time ignition cut logic
   - RPM calculation from pickup coil
   - Shift sensor debouncing
   - Hardware timer management
   - ISR handling with IRAM optimization

2. **NetworkManager** (`include/NetworkManager.hpp`)
   - WiFi AP/STA mode management
   - Async HTTP server
   - WebSocket telemetry broadcasting
   - OTA firmware updates
   - Hardware ID generation

3. **StorageHandler** (`include/StorageHandler.hpp`)
   - LittleFS persistence layer
   - Atomic file writes (power-loss safe)
   - JSON configuration serialization
   - Separate config domains (QS, Network, Telemetry)

4. **LedController** (`include/LedController.hpp`)
   - Hardware abstraction for LEDs
   - Status indication (signal, cut, WiFi, errors)
   - Blinking effects

## Pin Configuration

See `include/pins.hpp` for complete pin mapping. Key pins:

- **SPARK_CDI** (GPIO 11): Pickup coil input for RPM measurement
- **QS_SW** (GPIO 9): Shift sensor input
- **QS_SCR** (GPIO 16): Ignition cut output
- **R_LED/G_LED/B_LED** (GPIO 21/33/34): RGB status LED

## Configuration

### Default Values

```cpp
minRpmThreshold = 3000 RPM      // Minimum RPM to enable quickshift
debounceTimeMs = 50 ms          // Shift sensor debounce
cutTimeMap = [80ms × 11]        // Cut time for 5k-15k RPM (1k steps)
telemetryUpdateRate = 100 ms    // WebSocket broadcast rate
```

### WiFi

- **Default AP Mode**: SSID `rspqs`, no password
- **IP Address**: 42.42.42.42 (custom IP to allow iOS cellular data to remain active)
- **Captive Portal**: DNS server redirects all requests to the web interface
- **iOS Compatibility**: Gateway configured to keep cellular data active while connected
- STA mode credentials stored persistently after first configuration

## Building and Flashing

### 1. Install Dependencies

The required libraries are already configured in `platformio.ini`:
- `esphome/ESPAsyncWebServer-esphome@^3.2.2`
- `bblanchon/ArduinoJson@^7.2.1`

### 2. Build Firmware

```bash
pio run
```

### 3. Upload Firmware

```bash
pio run --target upload
```

### 4. Upload Web Interface to LittleFS

```bash
pio run --target uploadfs
```

**Note**: If `uploadfs` is not available, you can upload the HTML file via the web interface or serial monitor once the system is running.

## Web Interface

Access the web interface:
- AP Mode: http://42.42.42.42
- STA Mode: http://[device-ip]

### Features

- **Live Telemetry**: Real-time RPM display via WebSocket
- **Configuration**: Adjust all parameters from browser
  - Min RPM threshold
  - Debounce time
  - Cut time map (11 points: 5k-15k RPM)
  - Telemetry update rate
  - WiFi credentials
- **OTA Updates**: Trigger firmware update from configured server
- **System Info**: Hardware ID, uptime, connection status

## Usage

### 1. First Boot

1. Power on the device
2. Connect to WiFi AP `rspqs`
3. Navigate to http://42.42.42.42 (or wait for captive portal to auto-open)
4. Configure quickshift parameters
5. (Optional) Configure WiFi STA credentials and reboot

### 2. Tuning Cut Time Map

The cut time map is a 1D array representing RPM ranges:

| Index | RPM Range | Default Cut Time |
|-------|-----------|------------------|
| 0     | 5k-6k     | 80ms             |
| 1     | 6k-7k     | 80ms             |
| 2     | 7k-8k     | 80ms             |
| ...   | ...       | ...              |
| 10    | 14k-15k   | 80ms             |

Typical tuning:
- Lower RPM: Longer cut time (e.g., 100ms at 5k RPM)
- Higher RPM: Shorter cut time (e.g., 60ms at 14k RPM)

### 3. Monitoring

Serial output provides debug information:
```
[Status] RPM: 8500, Signal: Active, Cut: Inactive
```

LED Status:
- **Red**: No pickup signal
- **Green**: Normal operation
- **Blue**: Ignition cut active
- **Yellow**: WiFi AP mode
- **Cyan**: WiFi STA mode
- **Magenta**: OTA update in progress
- **Red Blinking**: System error

## OTA Updates

1. Configure the OTA server URL in `NetworkManager.cpp`:
   ```cpp
   static constexpr const char* OTA_UPDATE_URL = "http://your-server.com/firmware.bin";
   ```

2. The device sends its Hardware ID as a query parameter:
   ```
   http://your-server.com/firmware.bin?hwid=XXXX
   ```

3. Server can validate/provision specific firmware based on HWID

4. Trigger update from web interface or send JSON via WebSocket:
   ```json
   {"type": "ota"}
   ```

## Memory Safety

- **Static Allocation**: No dynamic memory allocation in critical paths
- **JsonDocument**: Dynamic JSON buffers with automatic memory management (ArduinoJson v7)
- **std::array**: Fixed-size containers for RPM map
- **Critical Sections**: `noInterrupts()`/`interrupts()` for thread-safe reads
- **IRAM Attributes**: ISRs reside in RAM to prevent cache misses

## Future Enhancements

1. **Wasted Spark Support**: Add RPM multiplier configuration for multi-cylinder engines
2. **Cut Time Interpolation**: Linear interpolation between map points
3. **Data Logging**: Store shift events with timestamps to LittleFS
4. **Launch Control**: Additional mode for standing starts
5. **Kill Switch Integration**: Safety cutoff input

## Troubleshooting

### No Serial Output
- Check baud rate: 115200
- Verify USB connection

### Cannot Connect to WiFi
- Default SSID: `rspqs`
- No password required
- Check if device is in AP mode (yellow LED)

### QuickShift Not Triggering
- Verify RPM > minRpmThreshold
- Check shift sensor wiring (GPIO 9)
- Monitor serial output for RPM readings

### OTA Update Fails
- Ensure device is in STA mode with internet access
- Verify OTA_UPDATE_URL is accessible
- Check server returns valid firmware binary

## Technical Details

### Interrupt Priorities

1. **Highest**: Pickup coil ISR (RPM calculation)
2. **High**: Shift sensor ISR (debounced)
3. **Normal**: Main loop (telemetry, UI)

### Timer Usage

- **FreeRTOS Software Timer**: Ignition cut duration (non-blocking)
- Period dynamically adjusted based on RPM map lookup

### File System Layout

```
/config.json       - System configuration (JSON)
/config.tmp        - Temporary file for atomic writes
/index.html        - Web interface (served via HTTP)
```

## License

[Your License Here]

## Credits

Architecture designed following best practices for automotive embedded systems with real-time constraints.
