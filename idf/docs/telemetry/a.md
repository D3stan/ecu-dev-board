# Telemetry Subsystem High-Level Architecture

## 1. Purpose

The telemetry subsystem transfers information from the physical ECU to the end-user client without interfering with real-time engine control.

The design shall support incremental development. The first version may expose only basic sensor values, while later versions add:

* Derived engine state
* Faults and events
* Revolution-level records
* ECU control decisions
* Actuator commands
* Recorded-run data
* Diagnostic information

New telemetry categories should be added without redesigning the underlying communication architecture.

---

## 2. Scope

The telemetry subsystem is responsible for:

* Receiving telemetry information published by ECU domains
* Classifying and timestamping that information
* Associating information with runs and revolutions where applicable
* Preparing live and recorded telemetry
* Transferring telemetry to the client
* Detecting and reporting telemetry gaps
* Managing congestion without affecting engine control

The subsystem does not own:

* Sensor acquisition
* Engine-state calculations
* Control decisions
* Safety decisions
* Actuator scheduling
* Digital-twin processing
* Permanent server storage

Telemetry records results produced by those domains without recalculating them.

---

## 3. System Context

```text
Sensors and input domains
          │
          ▼
Engine state and control domains
          │
          ▼
Telemetry publication boundary
          │
          ▼
Bounded ECU telemetry buffers
          │
          ▼
Telemetry communication service
          │
       WebSocket
          │
          ▼
End-user client
          │
          ├── Live dashboard
          ├── Local recording and buffering
          └── Forwarding to main server
```

The engine-control path shall only publish bounded telemetry records. It shall never wait for the WebSocket, the client or the server.

---

## 4. Stable Telemetry Paths

The communication architecture should define a small number of logical telemetry paths from the beginning.

These paths may share one physical WebSocket connection but have different semantics and priorities.

### 4.1 State Path

The state path represents the latest known ECU state.

Examples:

* Current RPM
* Current TPS
* Current EGT
* Current water temperature
* Synchronization state
* Current active map
* Current actuator targets

Characteristics:

* Latest value is more important than every intermediate update
* Updates may be downsampled for the user interface
* A newer unsent value may replace an older one
* Each value retains the timestamp of the original ECU observation
* The client must be able to determine whether the state is stale

This should be the first telemetry path implemented.

---

### 4.2 Event Path

The event path represents discrete occurrences and state transitions.

Examples:

* Engine started or stopped
* Synchronization acquired or lost
* Quick-shifter activated
* Effective map changed
* Fault activated or cleared
* Safety limiter entered or exited
* Configuration changed
* ECU reset

Characteristics:

* Events must preserve ordering
* Events must not be silently replaced by newer events
* Each event carries a sequence number and timestamp
* Important events should be retained until delivered or explicitly reported as lost

This path can be introduced after the initial live sensor state.

---

### 4.3 Revolution Path

The revolution path represents high-frequency crank-synchronous information.

Examples:

* Pickup timestamp
* Revolution identifier
* Revolution period
* RPM
* Synchronization status
* Knock-window result
* Ignition decision
* Ignition command

Characteristics:

* One logical record may exist for every valid revolution
* Multiple revolution records should be grouped into telemetry batches
* Recorded resolution is preserved even when live dashboard updates are reduced
* Missing revolutions must be detectable
* The path is intended primarily for recorded-run reconstruction and replay

RPM therefore appears in two forms:

* Downsampled latest RPM on the state path
* Full revolution timing on the revolution path

---

### 4.4 Diagnostic Path

The diagnostic path carries optional high-detail information.

Examples:

* Raw ADC values
* Sensor noise statistics
* Pickup timing diagnostics
* TPIC8101 configuration and intermediate values
* Communication and buffer statistics
* Development-only control traces

Characteristics:

* Explicitly enabled
* Rate-limited
* Lower priority than normal telemetry
* Not required for normal ECU operation
* May be disabled automatically during congestion

Diagnostic telemetry shall not be mixed into the mandatory recorded-run contract.

---

## 5. Common Telemetry Record Context

All paths should use a common record context so new telemetry types can be added without changing the general architecture.

A telemetry record should be able to identify:

* ECU identifier
* Run identifier
* ECU monotonic timestamp
* Record sequence number
* Record type
* Schema version
* Producing ECU domain
* Data origin
* Validity or quality state
* Revolution identifier when applicable
* Configuration epoch when applicable

Data origin should distinguish:

* Measured
* Derived
* Decided
* Commanded
* Estimated
* Telemetry-derived

This prevents a sensor value, ECU calculation, control decision and actuator command from being interpreted as equivalent information.

---

## 6. Telemetry Publication Boundary

Each ECU domain should publish information through a stable telemetry-facing contract.

Examples:

```text
Sensor domain
    publishes validated sensor state and health

Engine-state domain
    publishes RPM, synchronization and revolution identity

Control domain
    publishes decisions and applied corrections

Safety domain
    publishes interventions and reason codes

Actuator domain
    publishes requested and commanded outputs
```

The telemetry subsystem should depend on these published contracts rather than accessing domain internals.

This allows new telemetry coverage to be introduced incrementally:

```text
Existing domain result
        │
        ▼
New telemetry publication adapter
        │
        ▼
Existing telemetry path
```

Adding a new value should normally require defining its meaning and placing it on an existing path, not introducing a new transport mechanism.

---

## 7. ECU-to-Client Transfer Model

Telemetry records should be accumulated into small batches before transmission.

```text
Telemetry records
      │
      ├── state updates
      ├── events
      └── revolution records
              │
              ▼
       Telemetry batch
              │
              ▼
       WebSocket frame
```

Batching reduces:

* WebSocket frame overhead
* Task wake-ups
* Memory-copy operations
* Serialization operations
* Network-stack processing

A batch may contain several record types while preserving the identity and sequence of every contained record.

The client should acknowledge or track recorded batches independently from replaceable live-state updates.

---

## 8. Priority and Congestion Behaviour

Telemetry must use bounded resources.

When the client or connection cannot keep up, the subsystem should apply the following priority:

1. Preserve fault, safety and lifecycle events
2. Preserve mandatory recorded revolution data
3. Preserve configuration and map changes
4. Reduce live-state update frequency
5. Remove repeated or unchanged state
6. Disable optional diagnostics
7. Report explicit telemetry gaps when mandatory data cannot be preserved

The subsystem must never protect telemetry completeness by delaying engine control.

Live telemetry may degrade in visual refresh rate. Recorded telemetry may only degrade through an explicitly detectable gap.

---

## 9. Incremental Development Plan

### Stage 1: Communication Foundation

Establish:

* ECU-client WebSocket connection
* Connection and session identity
* Common record context
* Schema versioning
* Sequence numbering
* Heartbeat and stale-state detection
* Telemetry capability declaration

The capability declaration tells the client which telemetry record types the current firmware supports.

---

### Stage 2: Basic Live Sensor State

Add the state path with:

* RPM
* TPS
* EGT
* Water temperature
* Pickup synchronization state
* Sensor validity and health

The client initially displays only the latest state.

Fast-changing values such as RPM are transmitted at a controlled display rate rather than once per revolution.

---

### Stage 3: Faults and Discrete Events

Add the event path with:

* Sensor fault transitions
* Synchronization transitions
* Engine start and stop
* Quick-shifter events
* Map-switch events
* ECU resets

This establishes reliable ordered telemetry without yet requiring complete run recording.

---

### Stage 4: Revolution-Level Recording

Add:

* Run identifier
* Revolution identifier
* Pickup timestamp
* Revolution period
* Full-resolution RPM history
* Revolution continuity detection
* Batched transfer of revolution records

At this stage, the client can reconstruct the engine-speed timeline even if the live dashboard receives downsampled updates.

---

### Stage 5: ECU Decision Telemetry

Extend the revolution and event paths with:

* Active map
* Base control result
* Applied corrections
* Active limiters
* Fallback decisions
* Final requested outputs
* Decision reason codes

This stage enables the digital twin to explain how the ECU produced an output.

---

### Stage 6: Commanded Output Telemetry

Add actuator-domain information:

* Scheduled ignition command
* Executed or suppressed ignition event
* Power Jet command
* Exhaust-valve command
* Output clipping or saturation
* Scheduling or execution faults

Requested and commanded outputs must remain distinguishable.

---

### Stage 7: Complete Recorded Runs

Add:

* Run-start context
* Firmware revision
* Map revision
* Configuration revision
* Calibration revision
* Configuration epochs
* Run termination reason
* Run completeness status

The client can then assemble complete runs and forward them to the server.

---

### Stage 8: Optional Diagnostics

Add explicitly enabled diagnostic records without altering the normal telemetry contract.

Diagnostic additions may include raw values, development traces and temporary calibration data.

---

## 10. Schema Evolution

Telemetry records should evolve independently.

Each record type should have its own schema identity and version.

The client should:

* Ignore unsupported optional record types
* Reject incompatible mandatory schemas
* Preserve unknown recorded records when possible
* Use the ECU capability declaration to configure available views
* Avoid assuming every firmware publishes every telemetry category

This allows older clients to continue showing basic state when a newer ECU adds decision or diagnostic telemetry.

---

## 11. Recommended Initial Record Families

The initial architecture should reserve record families for:

```text
Session and capability
Run lifecycle
Latest sensor state
Engine state
Fault and event
Revolution
Control decision
Actuator command
Configuration change
Telemetry health
Diagnostic
```

Not all families need to be implemented immediately.

Defining them early provides stable extension points for future telemetry development.

---

## 12. Resulting Architecture

The proposed architecture separates telemetry by meaning rather than by individual sensor.

```text
State path
    latest state for monitoring

Event path
    ordered discrete occurrences

Revolution path
    complete high-frequency run history

Diagnostic path
    optional development information
```

Development can begin with the state path and basic sensor records.

Later firmware versions can populate the existing event and revolution paths with decisions, commands and detailed run context without replacing the ECU-client communication model.
