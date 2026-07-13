### 2.3.5 Restrictions for GPIOs and RTC_GPIOs

All IO pins of ESP32-S2 have GPIO and some have RTC_GPIO pin functions. However, the IO pins are multiplexed and can be configured for different purposes based on the requirements. Some IOs have restrictions for usage. It is essential to consider the multiplexed nature and the limitations when using these IO pins.

In tables of this chapter, some pin functions are in **red** or **yellow**. These functions indicate pins that require extra caution when used as GPIO:

- **IO Pins** – allocated for communication with in-package flash/PSRAM and NOT recommended for other uses. For details, see Section 2.6 Pin Mapping Between Chip and Flash/PSRAM.
- **IO Pins** – have one of the following important functions:
  - Strapping pins – need to be at certain logic levels at startup. See Section 3 Boot Configurations.
    > **Note:** Strapping pins are highlighted by Pin Name or configurations At Reset, instead of the pin functions.
  - USB_D+/- – by default, connected to the USB OTG. To function as GPIOs, these pins need to be reconfigured.
  - JTAG interface – often used for debugging. See Table 2-2 Peripheral Signals Routed via IO MUX.
  - UART0 interface – often used for debugging. See Table 2-2 Peripheral Signals Routed via IO MUX.
  - 8-line SPI interface – no restrictions, unless the chip is connected to flash/PSRAM using 8-line SPI mode.

### 2.3.6 Peripheral Pin Assignment

Table 2-9 Peripheral Pin Assignment highlights which pins can be assigned to each peripheral interface according to the following priorities:

- **Priority 1 (P1)**: Fixed pins connected directly to peripheral signals via IO MUX or RTC IO MUX.  
  If a peripheral interface does not have priority 1 pins, such as UART2, it can be assigned to any GPIO pins from priority 2 to priority 4.
- Any GPIO pins mapping to peripheral signals via GPIO Matrix can be priority 2, 3, or 4:
  - **Priority 2 (P2)**: GPIO pins can be freely used without restrictions.
  - **Priority 3 (P3)**: GPIO pins should be used with caution, as they may conflict with the following important functions described in Section 2.3.5 Restrictions for GPIOs and RTC_GPIOs:
    - GPIO0, GPIO45, GPIO46: Strapping pins.
    - GPIO39, GPIO40, GPIO41, GPIO42: JTAG interface.
    - GPIO43, GPIO44: UART0 interface.
    - GPIO33, GPIO34, GPIO35, GPIO36, GPIO37: The higher 4 bits data line interface and DQS interface for the SPI0/1 interface in 8-line SPI mode, and can be GPIO pins if the chip is not connected to flash or PSRAM in 8-line SPI mode.
  - **Priority 4 (P4)**: GPIO pins already allocated or not recommended for use, as described in Section 2.3.5 Restrictions for GPIOs and RTC_GPIOs:
    - GPIO26, GPIO27, GPIO28, GPIO29, GPIO30, GPIO31, GPIO32: SPI0/1 interface connected to the in-package flash and PSRAM, or recommended for the off-package flash and PSRAM.

If a peripheral interface does not have priority 2 to 4 pins, such as USB Serial/JTAG, it means it can be assigned only to priority 1 pins.

**Board-specific note (ECU dev board):** GPIO18 has a 10K pullup resistor.

#### Test-bench firmware assignments

| GPIO | Assignment | Direction | Active/idle state | Notes |
|---:|---|---|---|---|
| GPIO0 | Manual fire button | Input | Active low; internal pull-up | Any-edge interrupt with 20 ms stable-release debounce. Manual firing is allowed only after 500 ms without a pickup edge. GPIO0 is a strapping pin: holding it low during reset may enter ROM download mode. |
| GPIO1 | TPS potentiometer | Input | ADC, nominally 0 V to 3.3 V | ADC1 input sampled at 30 Hz. The median of the latest five readings is used as TPS. |
| GPIO2 | MAX9924 pickup | Input | Falling-edge timing event; external pull-up | One event per crankshaft revolution. The initial reference is 40 degrees BTDC and is configurable. Rising edges are ignored. |
| GPIO4 | CDI fire output | Output | Active high; idle low | Produces the configured 500 microsecond GPTimer-controlled pulse. |
| GPIO15 | Fire LED | Output | Active high; idle low | Mirrors GPIO4 for the full fire pulse through the same dedicated GPIO write. |
| GPIO21 | RGB status red | Output | Active high | On for no pickup signal and during acquisition. |
| GPIO33 | RGB status green | Output | Active high | On during acquisition and synchronized running. Available with the current DIO flash and no-PSRAM configuration. |
| GPIO34 | RGB status blue | Output | Active high | Reserved and currently held low. Available with the current DIO flash and no-PSRAM configuration. |

| Pin No. | Pin Name | Pin Type | Pin Providing Power | Pin Settings At Reset | Pin Settings After Reset | RTC IO MUX Function | Analog Function | IO MUX Function |
|---:|---|---|---|---|---|---|---|---|
| 1 | VDDA | Power |  |  |  |  |  |  |
| 2 | LNA_IN | Analog |  |  |  |  |  |  |
| 3 | VDD3P3 | Power |  |  |  |  |  |  |
| 4 | VDD3P3 | Power |  |  |  |  |  |  |
| 5 | GPIO0 | IO | VDD3P3_RTC_IO | WPU, IE | WPU, IE | RTC_GPIO0; sar_i2c_scl_0 |  | GPIO0 (I/O/T); GPIO0 (I/O/T) |
| 6 | GPIO1 | IO | VDD3P3_RTC_IO | IE | IE | RTC_GPIO1; sar_i2c_sda_0 | TOUCH1; ADC1_CH0 | GPIO1 (I/O/T); GPIO1 (I/O/T) |
| 7 | GPIO2 | IO | VDD3P3_RTC_IO | IE | IE | RTC_GPIO2; sar_i2c_scl_1 | TOUCH2; ADC1_CH1 | GPIO2 (I/O/T); GPIO2 (I/O/T) |
| 8 | GPIO3 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO3; sar_i2c_sda_1 | TOUCH3; ADC1_CH2 | GPIO3 (I/O/T); GPIO3 (I/O/T) |
| 9 | GPIO4 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO4 | TOUCH4; ADC1_CH3 | GPIO4 (I/O/T); GPIO4 (I/O/T) |
| 10 | GPIO5 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO5 | TOUCH5; ADC1_CH4 | GPIO5 (I/O/T); GPIO5 (I/O/T) |
| 11 | GPIO6 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO6 | TOUCH6; ADC1_CH5 | GPIO6 (I/O/T); GPIO6 (I/O/T) |
| 12 | GPIO7 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO7 | TOUCH7; ADC1_CH6 | GPIO7 (I/O/T); GPIO7 (I/O/T) |
| 13 | GPIO8 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO8 | TOUCH8; ADC1_CH7 | GPIO8 (I/O/T); GPIO8 (I/O/T); SUBSPICS1 (O/T) |
| 14 | GPIO9 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO9 | TOUCH9; ADC1_CH8 | GPIO9 (I/O/T); GPIO9 (I/O/T); SUBSPIHD (I1/O/T); FSPIHD (I1/O/T) |
| 15 | GPIO10 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO10 | TOUCH10; ADC1_CH9 | GPIO10 (I/O/T); GPIO10 (I/O/T); FSPIIO4 (I1/O/T); SUBSPICS0 (O/T); FSPICS0 (I1/O/T) |
| 16 | GPIO11 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO11 | TOUCH11; ADC2_CH0 | GPIO11 (I/O/T); GPIO11 (I/O/T); FSPIIO5 (I1/O/T); SUBSPID (I1/O/T); FSPID (I1/O/T) |
| 17 | GPIO12 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO12 | TOUCH12; ADC2_CH1 | GPIO12 (I/O/T); GPIO12 (I/O/T); FSPIIO6 (I1/O/T); SUBSPICLK (O/T); FSPICLK (I1/O/T) |
| 18 | GPIO13 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO13 | TOUCH13; ADC2_CH2 | GPIO13 (I/O/T); GPIO13 (I/O/T); FSPIIO7 (I1/O/T); SUBSPIQ (I1/O/T); FSPIQ (I1/O/T) |
| 19 | GPIO14 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO14 | TOUCH14; ADC2_CH3 | GPIO14 (I/O/T); GPIO14 (I/O/T); FSPIDQS (O/T); SUBSPIWP (I1/O/T); FSPIWP (I1/O/T) |
| 20 | VDD3P3_RTC | Power |  |  |  |  |  |  |
| 21 | XTAL_32K_P | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO15 | XTAL_32K_P; ADC2_CH4 | GPIO15 (I/O/T); GPIO15 (I/O/T); U0RTS (O) |
| 22 | XTAL_32K_N | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO16 | XTAL_32K_N; ADC2_CH5 | GPIO16 (I/O/T); GPIO16 (I/O/T); U0CTS (I1) |
| 23 | DAC_1 | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO17 | DAC_1; ADC2_CH6 | GPIO17 (I/O/T); GPIO17 (I/O/T); U1TXD (O) |
| 24 | DAC_2 (10k PU) | IO | VDD3P3_RTC_IO | IE |  | RTC_GPIO18 | DAC_2; ADC2_CH7 | GPIO18 (I/O/T); GPIO18 (I/O/T); U1RXD (I1); CLK_OUT3 (O) |
| 25 | GPIO19 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO19 | USB_D-; ADC2_CH8 | GPIO19 (I/O/T); GPIO19 (I/O/T); U1RTS (O); CLK_OUT2 (O) |
| 26 | GPIO20 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO20 | USB_D+; ADC2_CH9 | GPIO20 (I/O/T); GPIO20 (I/O/T); U1CTS (I1); CLK_OUT1 (O) |
| 27 | VDD3P3_RTC_IO | Power |  |  |  |  |  |  |
| 28 | GPIO21 | IO | VDD3P3_RTC_IO |  |  | RTC_GPIO21 |  | GPIO21 (I/O/T); GPIO21 (I/O/T) |
| 29 | SPICS1 | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPICS1 (O/T); GPIO26 (I/O/T) |
| 30 | VDD_SPI | Power |  |  |  |  |  |  |
| 31 | SPIHD | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPIHD (I1/O/T); GPIO27 (I/O/T) |
| 32 | SPIWP | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPIWP (I1/O/T); GPIO28 (I/O/T) |
| 33 | SPICS0 | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPICS0 (O/T); GPIO29 (I/O/T) |
| 34 | SPICLK | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPICLK (O/T); GPIO30 (I/O/T) |
| 35 | SPIQ | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPIQ (I1/O/T); GPIO31 (I/O/T) |
| 36 | SPID | IO | VDD_SPI | WPU, IE | WPU, IE |  |  | SPID (I1/O/T); GPIO32 (I/O/T) |
| 37 | GPIO33 | IO | VDD_SPI/VDD3P3_CPU | IE |  |  |  | GPIO33 (I/O/T); GPIO33 (I/O/T); FSPIHD (I1/O/T); SUBSPIHD (I1/O/T); SPIIO4 (I1/O/T) |
| 38 | GPIO34 | IO | VDD_SPI/VDD3P3_CPU | IE |  |  |  | GPIO34 (I/O/T); GPIO34 (I/O/T); FSPICS0 (I1/O/T); SUBSPICS0 (O/T); SPIIO5 (I1/O/T) |
| 39 | GPIO35 | IO | VDD_SPI/VDD3P3_CPU | IE |  |  |  | GPIO35 (I/O/T); GPIO35 (I/O/T); FSPID (I1/O/T); SUBSPID (I1/O/T); SPIIO6 (I1/O/T) |
| 40 | GPIO36 | IO | VDD_SPI/VDD3P3_CPU | IE |  |  |  | GPIO36 (I/O/T); GPIO36 (I/O/T); FSPICLK (I1/O/T); SUBSPICLK (O/T); SPIIO7 (I1/O/T) |
| 41 | GPIO37 | IO | VDD_SPI/VDD3P3_CPU | IE |  |  |  | GPIO37 (I/O/T); GPIO37 (I/O/T); FSPIQ (I1/O/T); SUBSPIQ (I1/O/T); SPIDQS (I0/O/T) |
| 42 | GPIO38 | IO | VDD3P3_CPU | IE |  |  |  | GPIO38 (I/O/T); GPIO38 (I/O/T); FSPIWP (I1/O/T); SUBSPIWP (I1/O/T) |
| 43 | MTCK | IO | VDD3P3_CPU | IE |  |  |  | MTCK (I1); GPIO39 (I/O/T); CLK_OUT3 (O); SUBSPICS1 (O/T) |
| 44 | MTDO | IO | VDD3P3_CPU | IE |  |  |  | MTDO (O/T); GPIO40 (I/O/T); CLK_OUT2 (O) |
| 45 | VDD3P3_CPU | Power |  |  |  |  |  |  |
| 46 | MTDI | IO | VDD3P3_CPU | IE |  |  |  | MTDI (I1); GPIO41 (I/O/T); CLK_OUT1 (O) |
| 47 | MTMS | IO | VDD3P3_CPU | IE |  |  |  | MTMS (I0); GPIO42 (I/O/T) |
| 48 | U0TXD | IO | VDD3P3_CPU | WPU, IE | WPU, IE |  |  | U0TXD (O); GPIO43 (I/O/T); CLK_OUT1 (O) |
| 49 | U0RXD | IO | VDD3P3_CPU | WPU, IE | WPU, IE |  |  | U0RXD (I1); GPIO44 (I/O/T); CLK_OUT2 (O) |
| 50 | GPIO45 | IO | VDD3P3_CPU | WPD, IE | WPD, IE |  |  | GPIO45 (I/O/T); GPIO45 (I/O/T) |
| 51 | VDDA | Power |  |  |  |  |  |  |
| 52 | XTAL_N | Analog |  |  |  |  |  |  |
| 53 | XTAL_P | Analog |  |  |  |  |  |  |
| 54 | VDDA | Power |  |  |  |  |  |  |
| 55 | GPIO46 | IO | VDD3P3_CPU | WPD, IE | WPD, IE |  |  | GPIO46 (I); GPIO46 (I) |
| 56 | CHIP_PU | Analog | VDD3P3_RTC_IO |  |  |  |  |  |
