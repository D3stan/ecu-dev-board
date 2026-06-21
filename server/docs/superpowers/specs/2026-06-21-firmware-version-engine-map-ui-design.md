# Firmware Version and Engine Map UI Design

## Objective

Populate each recorded run's firmware value from the version embedded in the running ESP-IDF application, and remove Engine Map from the Engine Runs and Telemetry Viewer interfaces. Build date is out of scope, and the existing `map_version` persistence and API fields remain unchanged.

## Scope

This change spans two project areas in the same worktree:

- ECU firmware and embedded WebUI: `C:/Users/puddu/Documents/Github/ecu-server/idf`
- Digital-twin server and frontend: `C:/Users/puddu/Documents/Github/ecu-server/server`

No database migration, server request-schema change, generated OpenAPI change, build-date field, or engine-map implementation is required.

## Approaches Considered

### Selected: extend the existing capabilities device object

Add `firmware_version` to the capabilities frame's existing `device` object. This follows the established hardware-metadata path and maps directly to the server's existing `firmware_version` run-start field.

### Rejected: add a nested top-level firmware object

A `firmware: { version, build_date, ... }` object is extensible, but it adds schema and adapter complexity without a current need for additional firmware metadata.

### Rejected: use the embedded WebUI package version

The WebUI asset version identifies the frontend bundle, not the running ECU application. Reporting it as firmware would be semantically incorrect.

## ECU Firmware Design

The telemetry server will call `esp_app_get_description()` and copy the returned descriptor's `version` into its runtime device identity. ESP-IDF currently derives this project version from Git, producing values such as `1.0.0-125-gfb81dde`; therefore the value identifies the source commit used for a clean build.

The runtime identity and serializer configuration will gain a `firmware_version` string. The capabilities frame will include it alongside the existing identity fields:

```json
{
  "device": {
    "hwid": "esp32s3-010203040506",
    "hardware_revision": "ESP32-S3FH4R2",
    "chip_model": "ESP32-S3",
    "flash_size_bytes": 4194304,
    "firmware_version": "1.0.0-125-gfb81dde"
  }
}
```

If the descriptor version is empty, the ECU will serialize an empty string. The browser bridge will convert that empty value to `null` rather than inventing a version.

Dirty builds retain ESP-IDF's `-dirty` suffix. That suffix warns that the commit alone cannot reconstruct local modifications; this change does not introduce a clean-worktree build policy.

## Embedded WebUI Design

The capabilities adapter will normalize and store `device.firmware_version`. The digital-twin bridge will send that stored value as `firmware_version` in `POST /api/runs/start`, using `null` when it is absent or empty.

No build date will be read, stored, sent, or displayed. `map_version` will continue to be sent as `null` because the ECU does not implement versioned engine maps.

## Server and Frontend Design

The backend already accepts, persists, and returns `firmware_version`, so it requires no behavioral change.

The Engine Runs table will retain the Firmware column and remove the Engine Map column. The Telemetry Viewer metadata row will retain the Firmware card and remove the Engine Map card.

The existing `map_version` database column, domain fields, request/response fields, OpenAPI schema, and generated client property remain intact. They are not repurposed for build date or any other value.

## Data Flow

1. ESP-IDF embeds the application version in `esp_app_desc_t`.
2. The ECU telemetry server reads `esp_app_get_description()->version`.
3. The capabilities frame publishes `device.firmware_version`.
4. The embedded WebUI adapter stores the value.
5. The digital-twin bridge posts it as `firmware_version` when starting a run.
6. The existing server path persists and returns the value.
7. Engine Runs and Telemetry Viewer display the persisted firmware version.

## Error Handling

- The ESP-IDF descriptor pointer is expected to be valid for the running application.
- An empty descriptor version becomes an empty capabilities value and then `null` in the server request.
- Existing server behavior renders an absent firmware version as `N/A`.
- Firmware metadata failure must not prevent telemetry connection or run recording.

## Testing

### ECU serializer

Update the host serializer contract test to assert that the capabilities `device` object includes `firmware_version`.

### Embedded WebUI

Update the adapter contract test to prove that `firmware_version` reaches the connection store. Update the digital-twin bridge test to prove the same value is posted to `/api/runs/start`, while `map_version` remains `null`.

### Server frontend

Add assertions that:

- Engine Runs renders the received firmware version and does not render an Engine Map header.
- Telemetry Viewer renders the received firmware version and does not render an Engine Map metadata label.

Run the focused tests first, then the complete ECU WebUI test suite, ECU host tests/build checks available in the worktree, and server frontend test/build suite.

## Acceptance Criteria

- A clean firmware build exposes a Git-derived application version through the capabilities frame.
- Starting a digital-twin run sends that version through the existing `firmware_version` field.
- Recorded runs display the firmware version in both server frontend views.
- Neither server frontend view displays Engine Map.
- No code stores build date in `map_version`.
- Existing `map_version` persistence and API compatibility remain intact.
