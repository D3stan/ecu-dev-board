# Button-Triggered Fire Pulse Design

## Goal

When the active-low button on GPIO0 is pressed, produce one asynchronous,
active-high 100 microsecond pulse on GPIO4 and GPIO15. GPIO15 drives the LED
and must remain high for exactly the same interval as GPIO4. Mechanical button
bounce must not produce additional pulses.

## Target and Constraints

- Target: ESP32-S2 using ESP-IDF 5.5.4.
- GPIO0 is an active-low button input with the internal pull-up enabled.
- GPIO4 is the fire output and must idle low with its pull-down enabled.
- GPIO15 is an active-high LED output and must mirror GPIO4.
- Fire pulse duration: 100 microseconds.
- Button debounce interval: 20 milliseconds.
- One physical press produces one pulse; holding the button does not retrigger.
- GPIO interrupt work must remain minimal and ISR-safe.
- FreeRTOS scheduling may affect button-to-pulse latency, but not pulse width.
- Before any `idf.py` command, activate the ESP-IDF environment with `idf`.

GPIO0 is an ESP32-S2 strapping pin. Holding the button during reset may select
the ROM download boot mode; the board documentation must warn about this.

## Architecture

Two ESP-IDF RMT transmit channels generate the GPIO4 and GPIO15 waveforms. The
ESP32-S2 RMT synchronization manager starts both channels simultaneously. Each
channel runs at 1 MHz, making one RMT tick equal to one microsecond, and sends a
single symbol that holds the output high for 100 ticks before returning it low.
Both channels use idle-low output configuration.

A GPIO any-edge ISR handles the button by sending a direct task notification to
a dedicated high-priority FreeRTOS worker. The worker accepts a low level as a
press, queues the two RMT transmissions, waits for both to complete, resets the
synchronization manager, and then requires 20 milliseconds of continuous high
time before accepting another press. A monotonic ESP timer measures this
interval, and every bounce edge restarts it. This keeps the GPIO ISR short and
moves non-ISR-safe RMT queue operations into task context.

## Components

### Configuration header

`main/test-bench_config.h` contains compile-time macros for:

- GPIO0 button assignment.
- GPIO4 fire-output assignment.
- GPIO15 LED assignment.
- 100 microsecond fire duration.
- 20 millisecond debounce interval.
- 1 MHz RMT resolution.
- Worker task stack size and priority.

Compile-time assertions ensure the configured pulse duration converts exactly
to RMT ticks and fits in one RMT symbol duration field.

### Application source

`main/test-bench.c` contains:

- GPIO initialization and safe idle-state setup.
- Two RMT TX channels, one copy encoder per channel, and their synchronization
  manager.
- The static RMT pulse symbol and transmit configuration.
- The GPIO0 ISR and FreeRTOS pulse worker task.
- Debounce and stable-release re-arming logic.
- `app_main()` initialization orchestration.

All initialization calls that can fail use `ESP_ERROR_CHECK`. The runtime path
does not log from interrupt context.

### Pin documentation

`docs/esp32-s2-mini_pins.md` gains a board-specific assignment table documenting
GPIO0, GPIO4, and GPIO15, their direction and idle state, the 100 microsecond
pulse behavior, and the GPIO0 bootstrapping warning.

## Event Flow

1. GPIO0 receives an edge and the ISR notifies the worker task, yielding if a
   higher-priority task was awakened.
2. The worker ignores high release levels and accepts a low level as a press.
3. The worker queues the identical pulse symbol on GPIO4 and GPIO15. The RMT
   synchronization manager releases both channels together.
4. Hardware holds both outputs high for 100 microseconds and then drives them
   low.
5. The worker waits for both transmissions to finish and resets the RMT
   synchronization manager for the next press.
6. The worker waits for GPIO0 to be released, then uses `esp_timer_get_time()`
   and any-edge notifications to require 20 milliseconds of continuous high
   time. Every intervening edge restarts the interval.

GPIO0 remains interruptible during debounce, so short release bounces cannot be
missed between task samples. This guarantees one pulse per completed
press-and-release cycle.

## Verification

- Activate the ESP-IDF environment with `idf`, then build with `idf.py build`.
- Confirm compilation targets ESP32-S2 and ESP-IDF 5.5.4 without warnings from
  the application component.
- On hardware, use a logic analyzer or oscilloscope to verify that one button
  press creates one active-high 100 microsecond pulse on both GPIO4 and GPIO15.
- Verify the two rising edges and two falling edges are synchronized by the RMT
  hardware and both outputs return low after transmission.
- Verify contact bounce and holding GPIO0 low do not generate additional pulses.
- Verify a later press after a stable release generates the next pulse.

The project has no existing automated hardware test harness, so pulse width and
cross-channel synchronization require instrumented on-target acceptance testing.
