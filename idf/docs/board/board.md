S3 MINI
================

==================  ==================  
 |TOP_IMG|_           |BOTTOM_IMG|_  
==================  ==================

.. |TOP_IMG| image:: ../_static/boards/s3_mini_v1.0.0_1_16x16.jpg
.. _TOP_IMG: ../_static/boards/s3_mini_v1.0.0_1_16x16.jpg

.. |BOTTOM_IMG| image:: ../_static/boards/s3_mini_v1.0.0_2_16x16.jpg
.. _BOTTOM_IMG: ../_static/boards/s3_mini_v1.0.0_2_16x16.jpg

WiFi & Bluetooth 5 (LE) boards based ESP32-S3FH4R2. 
`[Buy it]`_

.. _[Buy it]: https://www.aliexpress.com/item/3256805262904443.html

Features
------------------
* based ESP32-S3FH4R2
* 2.4 GHz Wi-Fi
* Bluetooth LE
* 4MB Flash
* 2MB PSRAM
* 27x IO
* 1x RGB LED (IO47)
* ADC, DAC, I2C, SPI, UART, USB OTG
* Compatible with MicroPython, Arduino and ESP-IDF
* Default firmware: MicroPython

Tutorials
----------------------

* :doc:`../tutorials/s3/get_started_with_micropython_s3`
* :doc:`../tutorials/s3/get_started_with_arduino_s3`

Documentation
----------------------

* `Schematic V1.0.0[PDF] <../_static/files/sch_s3_mini_v1.0.0.pdf>`_
* `Dimension V1.0.0[PDF] <../_static/files/dim_s3_mini_v1.0.0.pdf>`_
* `ESP32-S3 Datasheet <https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf>`_


Technical specs
----------------------

+----------------------+------------+
| Operating Voltage    | 3.3V       |
+----------------------+------------+
| Digital I/O Pins     | 27         |
+----------------------+------------+
| Clock Speed          | 240MHz     |
+----------------------+------------+
| Flash                | 4M Bytes   |
+----------------------+------------+
| PSRAM                | 2M Bytes   |
+----------------------+------------+
| Size                 | 34.3*25.4mm|
+----------------------+------------+
| Weight               | 3g         |
+----------------------+------------+

Pin
----------------------

.. image:: ../_static/boards/s3_mini_v1.0.0_4_16x9.jpg
   :target: ../_static/boards/s3_mini_v1.0.0_4_16x9.jpg

Certification
----------------------

.. image:: ../_static/logo/CE.png
   :target: ../_static/files/certification/EMC_s3_mini.pdf

.. image:: ../_static/logo/EUDOC.png
   :target: ../_static/files/certification/doc_s3_mini.pdf

.. image:: ../_static/logo/ROHS.png
   :target: ../_static/files/certification/RoHS_s3_mini.pdf





2.3.4 Restrictions for GPIOs and RTC_GPIOs
All IO pins of ESP32-S3 have GPIO and some have RTC_GPIO pin functions. However, the IO pins are
multiplexed and can be configured for different purposes based on the requirements. Some IOs have
restrictions for usage. It is essential to consider the multiplexed nature and the limitations when using these IO
pins.
In tables of this chapter, some pin functions are in
red or
yellow . These functions indicate pins that require
extra caution when used as
GPIO /
GPIO :
• IO
Pins– allocated for communication with in-package flash/PSRAM and NOT recommended for other
uses. For details, see Section 2.6 Pin Mapping Between Chip and Flash/PSRAM.
• IO
Pins– have one of the following important functions:– Strapping pins– need to be at certain logic levels at startup. See Section 3 Boot Configurations.
Note:
Strapping pins are highlighted by Pin Name or configurations At Reset, instead of the pin functions.– USB_D+/-– by default, connected to the USB Serial/JTAG Controller. To function as GPIOs, these
pins need to be reconfigured via the IO_MUX_MCU_SEL bit (see
ESP32-S3 Technical Reference Manual > Chapter IO MUX and GPIO Matrix for details).– JTAGinterface– often used for debugging. See Table 2-4 IO MUX Functions. To free these pins
up, the pin functions USB_D+/- of the USB Serial/JTAG Controller can be used instead. See also
Section 3.4 JTAG Signal Source Control.– UART0interface– often used for debugging. See Table 2-4 IO MUX Functions.– 8-line SPI interface– no restrictions, unless the chip is connected to flash/PSRAM using 8-line SPI
mode.
For more information about assigning pins, please see Section 2.3.5 Peripheral Pin Assignment and ESP32-S3
Consolidated Pin Overview.
Espressif Systems
25
Submit Documentation Feedback
ESP32-S3 Series Datasheet v2.2
2 Pins
2.3.5 Peripheral Pin Assignment
Table 2-9 Peripheral Pin Assignment highlights which pins can be assigned to each peripheral interface
according to the following priorities:
• Priority
1 (P1) : Fixed pins connected directly to peripheral signals via IO MUX or RTC IO MUX.
If a peripheral interface does not have priority 1 pins, such as UART2, it can be assigned to any GPIO pins
from priority 2 to priority 4.
• Any GPIO pins mapping to peripheral signals via GPIO Matrix, can be priority 2, 3, or 4.–Priority
2 (P2) : GPIO pins can be freely used without restrictions.–Priority
3 (P3) : GPIO pins should be used with caution, as they may conflict with the following
important functions described in Section 2.3.4 Restrictions for GPIOs and RTC_GPIOs:
* GPIO0
, GPIO3, GPIO45, GPIO46 : Strapping pins.
* GPIO19
, GPIO20 : USB Serial/JTAG interface.
* GPIO3
9, GPIO40, GPIO41, GPIO42 : JTAG interface.
* GPIO43
, GPIO44 : UART0 interface.
* GPIO33
, GPIO34, GPIO35, GPIO36, GPIO37 : The higher 4 bits data line interface and DQS
interface for the SPI0/1 interface in 8-line SPI mode, and can be GPIO pins if the chip is not
connected to flash or PSRAM in 8-line SPI mode.–Priority
4 (P4) : GPIO pins already allocated or not recommended for use, as described in Section
2.3.4 Restrictions for GPIOs and RTC_GPIOs:
* GPIO2
6, GPIO27, GPIO28, GPIO29, GPIO30, GPIO31, GPIO32 : SPI0/1 interface connected to
the in-package flash and PSRAM, or recommended for the off-package flash and PSRAM.
If a peripheral interface does not have priority 2 to 4 pins, such as USB Serial/JTAG, it means it can be
assigned only to priority 1 pins