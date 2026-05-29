# Simulator MCU Core Specification

The **MCU Core** of the Simulator orchestrates the kinematics of the engine, models thermodynamic behaviors, processes manual control overrides, and manages system state. It is designed to run in a single-threaded non-blocking superloop to maximize timing predictability and simplify execution.

---

## Non-Blocking Superloop & Pragmatic Concurrency

To ensure sub-microsecond pulse timing accuracy and maximal execution determinism, the Simulator MCU Core operates on a strict **time-sliced, poll-based loop**. 

### Concurrency Model:
1. **Asynchronous Web Interface**: Network handling (HTTP requests, WebSocket frames) runs entirely asynchronously in the background, powered by the `ESPAsyncWebServer` library. 
2. **Pragmatic Thread-Safety**: WebSocket callback handlers directly update volatile parameter fields (such as manual overrides or slider values) in the simulator state. Heavy-overhead locking mechanisms (e.g., mutexes, semaphores) are intentionally avoided as absolute thread safety in 100% of edge cases is not required for these non-critical operator control values.
3. **Queue Draining**: The function `sim_net_poll()` is run at the start of each superloop iteration to process queued command structures or state updates passed from the asynchronous network thread.

### Main Loop Template
```c
void app_main(void) {
    // 1. Hardware Initialization (Configured via macros in pins.h)
    sim_io_init();
    
    // 2. Network Initialization (Starts ESPAsyncWebServer on background thread)
    sim_net_init();

    uint64_t last_sim_tick = esp_timer_get_time();
    uint64_t last_telemetry_tick = esp_timer_get_time();

    const uint64_t SIM_TICK_INTERVAL_US = 10000;      // 10ms Simulation Tick
    const uint64_t TELEMETRY_INTERVAL_US = 100000;    // 100ms Telemetry Stream

    while (1) {
        uint64_t now = esp_timer_get_time();

        // Process asynchronous network commands drained from ESPAsyncWebServer callbacks
        sim_net_poll();

        // Engine Kinematics & Thermodynamic updates (100 Hz)
        if (now - last_sim_tick >= SIM_TICK_INTERVAL_US) {
            run_engine_simulation(SIM_TICK_INTERVAL_US / 1000000.0f);
            last_sim_tick = now;
        }

        // Live telemetry framing & web updates (10 Hz)
        if (now - last_telemetry_tick >= TELEMETRY_INTERVAL_US) {
            broadcast_simulator_telemetry();
            last_telemetry_tick = now;
        }
        
        // Fast hardware polling (e.g., analog knob sampling and passive monitoring)
        sim_io_fast_poll();
    }
}
```

---

## Kinematics & Thermodynamic Models

The core models two main physical characteristics in real time:

### 1. Engine Inertia & RPM Calculation
- **Physical input**: Throttle Position Sensor (TPS) percentage.
- **Engine RPM dynamics**: Calculated by integrating throttle input. The engine acts as a first-order system with simulated mechanical drag and rotational inertia:
  
  $$\text{RPM}_{\text{target}} = \text{RPM}_{\text{idle}} + \text{TPS} \times (\text{RPM}_{\text{redline}} - \text{RPM}_{\text{idle}})$$
  
  $$\text{RPM}_{t} = \text{RPM}_{t-\Delta t} + \frac{\text{RPM}_{\text{target}} - \text{RPM}_{t-\Delta t}}{\tau_{\text{inertia}}} \times \Delta t$$
  
  *Where $\tau_{\text{inertia}}$ is the simulated engine responsiveness (e.g., 0.5s for a light-flywheel racing monocylinder).*

### 2. EGT (Exhaust Gas Temperature) Simulation
- Exhaust gas temperature changes dynamically based on current RPM and throttle loading.
- EGT increases when engine loads (high RPM/TPS) and slowly decays towards ambient temperature when the engine decelerates or cuts ignition.
- **Thermal Model Formula**:
  
  $$\text{EGT}_{\text{target}} = \text{EGT}_{\text{ambient}} + (\text{TPS} \times C_{\text{load}}) + (\text{RPM} \times C_{\text{speed}})$$
  
  $$\text{EGT}_{t} = \text{EGT}_{t-\Delta t} + \frac{\text{EGT}_{\text{target}} - \text{EGT}_{t-\Delta t}}{\tau_{\text{thermal}}} \times \Delta t$$
  
  - If **Ignition Cut (QS)** is detected from the ECU (measured spark timing disappears), $EGT_{target}$ drops immediately to simulate cold fresh air entering the exhaust during fuel-cut/ignition-cut cycles.

---

## Overrides & Fault Injection

The core includes a unified memory model for **Control Parameters**, which can either be bound to physical hardware (ADCs/timers) or overridden by virtual commands received via the Web UI/WebSocket.

```c
typedef struct {
    float physical_val;   // Read directly from hardware ADC/potentiometer
    float virtual_val;    // Overridden value from Web UI slider
    bool is_overridden;   // Override active flag
} sim_parameter_t;

typedef struct {
    sim_parameter_t tps;
    sim_parameter_t egt;
    sim_parameter_t rpm;  // Allowing manual RPM lock (bypassing throttle)
    bool fault_egt_overheat; // Artificially force EGT above ALARM threshold (>800°C)
} sim_state_t;
```

When `fault_egt_overheat` is set to `true`, the thermodynamic simulator forces EGT to ramp up rapidly to **850°C** regardless of current engine RPM or TPS. This lets developers test the ECU's high-temperature safety shutdown (`ALARM` FSM state) without physical heat guns.

---

## Telemetry Serializer

At 10 Hz, the core formats a structured JSON telemetry string containing the simulator state. This frame is pushed simultaneously out of the Hardware UART (Serial debug console) and broadcasted to any connected WebSocket clients.

### Output JSON Format
```json
{
  "type": "sim_telemetry",
  "data": {
    "rpm": 8450,
    "tps": 42.5,
    "egt": 685,
    "ecu_advance": 28.5,
    "spark_detected": true,
    "overrides": {
      "tps": false,
      "egt": false,
      "egt_fault": false
    }
  }
}
```
Using flat, compact key mappings minimizes processing overhead during standard string serialization inside the superloop.
