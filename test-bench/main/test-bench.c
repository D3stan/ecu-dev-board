#include "test-bench_config.h"

_Static_assert(BUTTON_GPIO == GPIO_NUM_0, "button must use GPIO0");
_Static_assert(FIRE_OUTPUT_GPIO == GPIO_NUM_4, "fire output must use GPIO4");
_Static_assert(FIRE_LED_GPIO == GPIO_NUM_15, "LED must use GPIO15");
_Static_assert(FIRE_DURATION_US == 100U, "fire pulse must be 100 us");
_Static_assert(BUTTON_DEBOUNCE_MS == 20U, "debounce must be 20 ms");

void app_main(void)
{
}
