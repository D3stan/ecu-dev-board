# Button-Triggered Fire Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one synchronized, active-high 100 microsecond pulse on GPIO4 and GPIO15 for each debounced active-low GPIO0 button press.

**Architecture:** A minimal GPIO ISR disables further button interrupts and notifies a high-priority FreeRTOS task. The task queues identical symbols on two ESP32-S2 RMT TX channels managed by the RMT synchronization manager, then performs stable-release debounce before re-enabling GPIO0.

**Tech Stack:** C11, ESP-IDF 5.5.4, ESP32-S2 GPIO driver, RMT TX driver, FreeRTOS task notifications, CMake.

## Global Constraints

- GPIO0 is an active-low button input with its internal pull-up enabled.
- GPIO4 is the fire output, idles low, and has its pull-down enabled.
- GPIO15 is an active-high LED output and mirrors GPIO4.
- The synchronized high interval is exactly 100 microseconds at a 1 MHz RMT resolution.
- Debounce is 20 milliseconds and one press-and-release cycle produces one pulse.
- RMT calls execute in task context, not in the GPIO ISR.
- GPIO0's ESP32-S2 bootstrapping risk is documented.
- Run `idf` before every `idf.py` command. In non-interactive automation, use `zsh -ic 'idf; idf.py <command>'` so the alias from `~/.zshrc` is available.
- The repository has no automated on-target timing harness; timing acceptance requires an oscilloscope or logic analyzer.

---

## File Structure

- Create `main/test-bench_config.h`: board assignments and timing/task macros.
- Modify `main/test-bench.c`: GPIO setup, ISR, FreeRTOS worker, synchronized RMT pulse, and debounce.
- Modify `main/CMakeLists.txt`: explicit GPIO and RMT component dependencies.
- Modify `docs/esp32-s2-mini_pins.md`: board-specific assignment and bootstrap warning.

### Task 1: Configuration Contract

**Files:**
- Create: `main/test-bench_config.h`
- Modify: `main/test-bench.c`

**Interfaces:**
- Consumes: ESP-IDF `gpio_num_t` constants from `driver/gpio_types.h`.
- Produces: `BUTTON_GPIO`, `FIRE_OUTPUT_GPIO`, `FIRE_LED_GPIO`, `FIRE_DURATION_US`, `BUTTON_DEBOUNCE_MS`, `RMT_RESOLUTION_HZ`, `RMT_MEM_BLOCK_SYMBOLS`, `RMT_QUEUE_DEPTH`, `FIRE_TASK_STACK_SIZE`, and `FIRE_TASK_PRIORITY`.

- [ ] **Step 1: Add the compile-time contract before the header exists**

Replace `main/test-bench.c` temporarily with:

```c
#include "test-bench_config.h"

_Static_assert(BUTTON_GPIO == GPIO_NUM_0, "button must use GPIO0");
_Static_assert(FIRE_OUTPUT_GPIO == GPIO_NUM_4, "fire output must use GPIO4");
_Static_assert(FIRE_LED_GPIO == GPIO_NUM_15, "LED must use GPIO15");
_Static_assert(FIRE_DURATION_US == 100U, "fire pulse must be 100 us");
_Static_assert(BUTTON_DEBOUNCE_MS == 20U, "debounce must be 20 ms");

void app_main(void)
{
}
```

- [ ] **Step 2: Build and verify the contract fails because the header is missing**

Run: `zsh -ic 'idf; idf.py build'`

Expected: FAIL with `fatal error: test-bench_config.h: No such file or directory`.

- [ ] **Step 3: Create the minimal configuration header**

Create `main/test-bench_config.h`:

```c
#pragma once

#include "driver/gpio_types.h"

#define BUTTON_GPIO             GPIO_NUM_0
#define FIRE_OUTPUT_GPIO        GPIO_NUM_4
#define FIRE_LED_GPIO           GPIO_NUM_15

#define FIRE_DURATION_US        100U
#define BUTTON_DEBOUNCE_MS      20U

#define RMT_RESOLUTION_HZ       1000000U
#define RMT_MEM_BLOCK_SYMBOLS   64U
#define RMT_QUEUE_DEPTH         1U

#define FIRE_TASK_STACK_SIZE    3072U
#define FIRE_TASK_PRIORITY      10U
```

- [ ] **Step 4: Rebuild and verify the configuration contract passes**

Run: `zsh -ic 'idf; idf.py build'`

Expected: PASS and produce `build/test-bench.bin`.

- [ ] **Step 5: Commit the configuration contract**

```bash
git add main/test-bench_config.h main/test-bench.c
git commit -m "feat: define fire pulse configuration"
```

### Task 2: Asynchronous Synchronized RMT Driver

**Files:**
- Modify: `main/test-bench.c`
- Modify: `main/CMakeLists.txt`

**Interfaces:**
- Consumes: all macros from `main/test-bench_config.h`.
- Produces: `app_main()` that initializes the driver and a runtime path where one GPIO0 falling edge schedules one synchronized GPIO4/GPIO15 pulse.

- [ ] **Step 1: Record the pre-implementation baseline**

Run: `zsh -ic 'idf; idf.py build'`

Expected: PASS, but the application only contains configuration assertions and cannot respond to GPIO0. This embedded integration has no host-side behavioral harness; Tasks 2 and 3 use compiler checks followed by on-target acceptance.

- [ ] **Step 2: Implement the GPIO, RMT, ISR, task, and debounce behavior**

Replace `main/test-bench.c` with:

```c
#include <stdbool.h>
#include <stdint.h>

#include "driver/gpio.h"
#include "driver/rmt_encoder.h"
#include "driver/rmt_tx.h"
#include "esp_check.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "hal/rmt_types.h"

#include "test-bench_config.h"

#define US_PER_SECOND 1000000U
#define FIRE_DURATION_TICKS \
    ((RMT_RESOLUTION_HZ / US_PER_SECOND) * FIRE_DURATION_US)
#define RMT_DURATION_MAX 32767U

_Static_assert((RMT_RESOLUTION_HZ % US_PER_SECOND) == 0U,
               "RMT resolution must convert microseconds exactly");
_Static_assert(FIRE_DURATION_TICKS > 0U,
               "fire duration must be at least one RMT tick");
_Static_assert(FIRE_DURATION_TICKS <= RMT_DURATION_MAX,
               "fire duration must fit in one RMT symbol phase");

static TaskHandle_t s_fire_task_handle;
static rmt_channel_handle_t s_fire_channel;
static rmt_channel_handle_t s_led_channel;
static rmt_encoder_handle_t s_fire_encoder;
static rmt_encoder_handle_t s_led_encoder;
static rmt_sync_manager_handle_t s_sync_manager;

static const rmt_symbol_word_t s_fire_symbol = {
    .level0 = 1,
    .duration0 = FIRE_DURATION_TICKS,
    .level1 = 0,
    .duration1 = 1,
};

static const rmt_transmit_config_t s_transmit_config = {
    .loop_count = 0,
    .flags.eot_level = 0,
    .flags.queue_nonblocking = 0,
};

static void button_isr_handler(void *arg)
{
    (void)arg;
    BaseType_t higher_priority_task_woken = pdFALSE;

    gpio_intr_disable(BUTTON_GPIO);
    vTaskNotifyGiveFromISR(s_fire_task_handle, &higher_priority_task_woken);
    if (higher_priority_task_woken == pdTRUE) {
        portYIELD_FROM_ISR();
    }
}

static void transmit_fire_pulse(void)
{
    ESP_ERROR_CHECK(rmt_transmit(s_fire_channel, s_fire_encoder,
                                 &s_fire_symbol, sizeof(s_fire_symbol),
                                 &s_transmit_config));
    ESP_ERROR_CHECK(rmt_transmit(s_led_channel, s_led_encoder,
                                 &s_fire_symbol, sizeof(s_fire_symbol),
                                 &s_transmit_config));
    ESP_ERROR_CHECK(rmt_tx_wait_all_done(s_fire_channel, -1));
    ESP_ERROR_CHECK(rmt_tx_wait_all_done(s_led_channel, -1));
    ESP_ERROR_CHECK(rmt_sync_reset(s_sync_manager));
}

static void wait_for_stable_button_release(void)
{
    const TickType_t debounce_ticks = pdMS_TO_TICKS(BUTTON_DEBOUNCE_MS);

    vTaskDelay(debounce_ticks);
    for (;;) {
        while (gpio_get_level(BUTTON_GPIO) == 0) {
            vTaskDelay(debounce_ticks);
        }

        vTaskDelay(debounce_ticks);
        if (gpio_get_level(BUTTON_GPIO) != 0) {
            return;
        }
    }
}

static void fire_task(void *arg)
{
    (void)arg;

    for (;;) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        transmit_fire_pulse();
        wait_for_stable_button_release();
        ESP_ERROR_CHECK(gpio_intr_enable(BUTTON_GPIO));
    }
}

static void configure_output_gpio(void)
{
    const gpio_config_t fire_config = {
        .pin_bit_mask = 1ULL << FIRE_OUTPUT_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    const gpio_config_t led_config = {
        .pin_bit_mask = 1ULL << FIRE_LED_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    ESP_ERROR_CHECK(gpio_config(&fire_config));
    ESP_ERROR_CHECK(gpio_config(&led_config));
    ESP_ERROR_CHECK(gpio_set_level(FIRE_OUTPUT_GPIO, 0));
    ESP_ERROR_CHECK(gpio_set_level(FIRE_LED_GPIO, 0));
}

static void configure_rmt(void)
{
    rmt_tx_channel_config_t channel_config = {
        .gpio_num = FIRE_OUTPUT_GPIO,
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = RMT_RESOLUTION_HZ,
        .mem_block_symbols = RMT_MEM_BLOCK_SYMBOLS,
        .trans_queue_depth = RMT_QUEUE_DEPTH,
        .flags.init_level = 0,
    };
    const rmt_copy_encoder_config_t encoder_config = {};

    ESP_ERROR_CHECK(rmt_new_tx_channel(&channel_config, &s_fire_channel));
    channel_config.gpio_num = FIRE_LED_GPIO;
    ESP_ERROR_CHECK(rmt_new_tx_channel(&channel_config, &s_led_channel));

    ESP_ERROR_CHECK(rmt_new_copy_encoder(&encoder_config, &s_fire_encoder));
    ESP_ERROR_CHECK(rmt_new_copy_encoder(&encoder_config, &s_led_encoder));

    ESP_ERROR_CHECK(rmt_enable(s_fire_channel));
    ESP_ERROR_CHECK(rmt_enable(s_led_channel));

    const rmt_channel_handle_t channels[] = {
        s_fire_channel,
        s_led_channel,
    };
    const rmt_sync_manager_config_t sync_config = {
        .tx_channel_array = channels,
        .array_size = sizeof(channels) / sizeof(channels[0]),
    };
    ESP_ERROR_CHECK(rmt_new_sync_manager(&sync_config, &s_sync_manager));
}

static void configure_button(void)
{
    const gpio_config_t button_config = {
        .pin_bit_mask = 1ULL << BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_NEGEDGE,
    };

    ESP_ERROR_CHECK(gpio_config(&button_config));
    ESP_ERROR_CHECK(gpio_install_isr_service(0));
    ESP_ERROR_CHECK(gpio_isr_handler_add(BUTTON_GPIO, button_isr_handler, NULL));
}

void app_main(void)
{
    configure_output_gpio();
    configure_rmt();

    BaseType_t task_created = xTaskCreate(fire_task, "fire_pulse",
                                          FIRE_TASK_STACK_SIZE, NULL,
                                          FIRE_TASK_PRIORITY,
                                          &s_fire_task_handle);
    ESP_ERROR_CHECK(task_created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);

    configure_button();
}
```

- [ ] **Step 3: Declare explicit component dependencies**

Replace `main/CMakeLists.txt` with:

```cmake
idf_component_register(
    SRCS "test-bench.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_driver_gpio esp_driver_rmt
)
```

- [ ] **Step 4: Build the completed driver**

Run: `zsh -ic 'idf; idf.py build'`

Expected: PASS, producing `build/test-bench.bin` with no warnings emitted for `main/test-bench.c`.

- [ ] **Step 5: Inspect the application diff for unsafe ISR work and timing drift**

Run: `git diff --check && rg -n "button_isr_handler|rmt_transmit|FIRE_DURATION_TICKS|gpio_intr_(disable|enable)" main/test-bench.c`

Expected: `git diff --check` prints nothing; `rmt_transmit` appears only in `transmit_fire_pulse`, not in `button_isr_handler`; both interrupt disable and re-enable paths are present.

- [ ] **Step 6: Commit the driver**

```bash
git add main/test-bench.c main/CMakeLists.txt
git commit -m "feat: add synchronized button fire pulse"
```

### Task 3: Board Pin Documentation and Hardware Acceptance

**Files:**
- Modify: `docs/esp32-s2-mini_pins.md`

**Interfaces:**
- Consumes: pin and timing assignments from `main/test-bench_config.h`.
- Produces: an operator-facing board assignment table and hardware acceptance record.

- [ ] **Step 1: Add the board-specific pin assignment table**

Immediately after `**Board-specific note (ECU dev board):** GPIO18 has a 10K pullup resistor.`, add:

```markdown

#### Test-bench firmware assignments

| GPIO | Assignment | Direction | Active/idle state | Notes |
|---:|---|---|---|---|
| GPIO0 | Push button | Input | Active low; internal pull-up | Falling-edge interrupt with 20 ms debounce. GPIO0 is a strapping pin: holding it low during reset may enter ROM download mode. |
| GPIO4 | Fire output | Output | Active high; idle low with pull-down | Produces one 100 microsecond hardware-timed pulse per debounced button press. |
| GPIO15 | Fire LED | Output | Active high; idle low | Mirrors GPIO4 for the full 100 microsecond pulse. |
```

- [ ] **Step 2: Verify documentation and final build**

Run: `git diff --check && zsh -ic 'idf; idf.py build'`

Expected: PASS; no whitespace errors and `build/test-bench.bin` is regenerated successfully.

- [ ] **Step 3: Perform on-target acceptance with an oscilloscope or logic analyzer**

Flash using the project's selected serial port, then monitor GPIO4 and GPIO15 while pressing GPIO0.

Acceptance criteria:

- One press produces one pulse on each output.
- Both outputs rise together, remain high for 100 microseconds, and return low together.
- Contact bounce and holding GPIO0 low produce no extra pulses.
- A new press after a stable release produces the next pulse.
- GPIO4 and GPIO15 are low after boot and between pulses.

- [ ] **Step 4: Commit the pin documentation**

```bash
git add docs/esp32-s2-mini_pins.md
git commit -m "docs: record test-bench pin assignments"
```

### Task 4: Final Verification

**Files:**
- Verify: `main/test-bench_config.h`
- Verify: `main/test-bench.c`
- Verify: `main/CMakeLists.txt`
- Verify: `docs/esp32-s2-mini_pins.md`

**Interfaces:**
- Consumes: completed firmware and documentation.
- Produces: clean build evidence and a reviewable final diff.

- [ ] **Step 1: Run final static and build verification**

Run: `git diff --check && zsh -ic 'idf; idf.py fullclean; idf.py build'`

Expected: PASS; full clean ESP32-S2 build produces `build/test-bench.bin`.

- [ ] **Step 2: Review repository state and commit history**

Run: `git status --short && git log -4 --oneline`

Expected: no uncommitted implementation files; the configuration, driver, and documentation commits follow the design-spec commit.
