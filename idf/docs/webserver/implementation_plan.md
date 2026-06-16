# WebSocket Telemetry Server V1 Implementation Plan

## Goal

Implement the firmware-side WebSocket telemetry contract for the rewritten Web
UI without reading or depending on the current `webui` folder.

## Architecture

The existing `telemetry` component remains transport-neutral. A new
`telemetry_server` component adapts `TelemetryBatch` objects to WebSocket JSON
frames and owns the WiFi/HTTP/WebSocket runtime.

The design follows single-responsibility boundaries:

| Unit | Responsibility |
| --- | --- |
| `SensorTelemetryCollector` | Produce typed telemetry batches from `SensorDataStore`. Already implemented in `components/telemetry`. |
| `TelemetryJsonSerializer` | Convert capabilities and telemetry batches to contract JSON. |
| `ITelemetryTransport` | Abstract send-capable WebSocket transport for tests and pump logic. |
| `TelemetryPump` | Decide when to collect, serialize, and send without draining events during disconnect/backpressure. |
| `EspWebSocketTransport` | Own active WebSocket client, send lifetime, and transport counters. |
| `WifiStation` | Initialize NVS, netif/event loop, and WiFi STA mode. |
| `TelemetryServerApplication` | Compose WiFi, HTTP server, WebSocket URI, transport, serializer, and pump task. |

Static web asset hosting is intentionally deferred. V1 still needs the ESP-IDF
large single-app partition table because WiFi and WebSocket support push the
firmware past the default 1 MB factory app slot. A tracked `sdkconfig.defaults`
selects `partitions_singleapp_large.csv`, which keeps the project compatible
with the current 2 MB flash setting while avoiding a custom static-asset
partition.

## Implementation Tasks

1. Add `docs/webserver/websocket_contract.md` and this implementation plan.
2. Add host tests for `TelemetryJsonSerializer` and `TelemetryPump`.
3. Add `components/telemetry_server`:
   - public header `include/telemetry_server/telemetry_server.hpp`
   - testable headers for serializer, pump, and transport interfaces
   - ESP-IDF runtime implementation guarded inside component sources
4. Make `SensorDataStore` safe for cross-task access by adding short locking
   around publish, snapshot, overflow, and pop operations.
5. Rewire `main` so one application-owned `SensorDataStore` is shared by the
   sensor harness task and telemetry server.
6. Disable harness CSV event/knock draining while telemetry server is enabled,
   because the telemetry collector must be the only event-draining consumer in
   that mode.
7. Add Kconfig options for enabling the server, WiFi credentials, HTTP port,
   state rate, and events per batch.
8. Verify host tests and ESP-IDF build from the ESP-IDF environment using the
   large single-app partition layout.

## JSON Contract Defaults

| Setting | V1 default |
| --- | --- |
| Schema | `ecu.telemetry.v1` |
| Schema version | `1` |
| WebSocket path | `/ws` |
| HTTP port | `80` |
| State rate | `10 Hz` |
| Events per batch | `8` |
| Active clients | One, newest wins |

## Testing

Host tests must cover:

- capabilities frame fields.
- telemetry state serialization including metadata and enum strings.
- `knock: null` and populated knock state.
- quick-shift, map-switch, and fault-transition events.
- source overflow counters and transport counters.
- pump behavior while disconnected, backpressured, and connected.

Runtime verification:

- Configure WiFi STA SSID/password.
- Flash firmware and connect to `ws://<ecu-ip>/ws`.
- Confirm one capabilities frame followed by approximately 10 telemetry frames
  per second.
- Disconnect and reconnect the client; telemetry resumes and event collection
  does not drain while disconnected.

## Assumptions

- V1 is observability only. No Web UI command channel is added.
- V1 does not host static Web UI files.
- V1 does not add revolution-history or recorded-run completeness semantics.
- `SensorDataStore` is used from tasks, not from ISRs.
- The firmware is built with `PARTITION_TABLE_SINGLE_APP_LARGE` or a larger
  custom app partition.
- Host tests exercise portable serializer and pump logic; ESP-IDF networking is
  verified by `idf.py build` and hardware/runtime checks.
