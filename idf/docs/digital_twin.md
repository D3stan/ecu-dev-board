# ECU Digital Twin Architecture

## 1. Purpose

This document defines the high-level architecture of a digital-twin system composed of:

1. The physical ECU
2. The end-user client
3. The main server and digital twin

The physical ECU remains responsible for real-time engine control.

The client provides the user interface and connects the ECU to the server.

The main server maintains the persistent digital representation of the ECU, its configuration and its operating history.

---

## 2. System Overview

```text
Physical engine
      │
      ▼
┌──────────────────────┐
│         ECU          │
│                      │
│ Sensor acquisition   │
│ Engine control       │
│ Actuator control     │
│ Telemetry generation │
└──────────┬───────────┘
           │ Local connection
           ▼
┌──────────────────────────┐
│     End-User Client      │
│                          │
│ Live monitoring          │
│ User interaction         │
│ ECU configuration        │
│ Server gateway           │
└────────────┬─────────────┘
             │ Internet
             ▼
┌──────────────────────────┐
│       Main Server        │
│                          │
│ ECU data storage         │
│ Configuration history    │
│ Digital twin             │
│ Replay and simulation    │
│ Diagnostics and analysis │
└──────────────────────────┘
```

The ECU does not have a direct internet connection. Communication between the ECU and the main server therefore passes through the end-user client.

---

## 3. Physical ECU

The ECU is the authoritative representation of the physical engine and its real-time state.

It is responsible for:

* Reading physical sensors
* Tracking engine position and synchronization
* Executing engine-control strategies
* Scheduling ignition and actuator operations
* Applying safety and protection strategies
* Receiving user commands and configuration changes
* Producing telemetry describing relevant inputs, decisions, outputs, events and faults

The ECU shall remain fully operational without the client, the server or the digital twin.

The digital twin shall not participate directly in time-critical engine-control decisions.

---

## 4. End-User Client

The client is the application used to interact with the physical ECU.

It is responsible for:

* Displaying the current ECU and engine state
* Showing faults, events and diagnostic information
* Sending user commands to the ECU
* Selecting, editing and programming maps
* Applying configuration changes
* Supporting calibration and diagnostic operations
* Forwarding relevant ECU information to the main server

The client communicates locally with the ECU and remotely with the main server.

It acts as the communication bridge between them but is not the permanent owner of the digital twin or its historical data.

---

## 5. Main Server

The main server provides the persistent services associated with each ECU.

It is responsible for:

* Registering physical ECUs
* Storing ECU identity and hardware information
* Storing firmware, map, configuration and calibration revisions
* Storing recorded engine runs
* Maintaining the persistent digital twin
* Reconstructing ECU and engine behavior from recorded information
* Replaying recorded runs
* Evaluating alternative maps and parameters
* Performing historical analysis
* Producing diagnostic and estimation results
* Providing digital-twin information to the end user

The server should preserve the relationship between every recorded run and the exact ECU software, maps, configuration and calibration used during that run.

---

## 6. Telemetry and Digital-Twin Input

The ECU produces telemetry representing relevant engine and ECU behavior.

The client receives this telemetry and forwards it to the main server.

The server uses the received telemetry, together with configuration and revision information, to update the digital twin and reconstruct recorded engine runs.

Detailed telemetry transport, buffering, compression, reliability and storage mechanisms are outside the scope of this document.

---

## 7. Digital Twin Definition

A persistent digital twin exists on the main server for each registered physical ECU.

```text
EcuDigitalTwin
 ├── ECU identity
 ├── Hardware revision
 ├── Firmware history
 ├── Current configuration
 ├── Configuration history
 ├── Map history
 ├── Calibration history
 ├── Latest known operating state
 ├── Recorded runs
 ├── Fault and event history
 ├── Replay capabilities
 ├── Simulation capabilities
 ├── Diagnostic models
 └── Estimation models
```

The digital twin is more than a copy of the most recent sensor values.

It combines:

* The known structure and capabilities of the ECU
* The software and configuration installed on the ECU
* Recorded engine and ECU behavior
* ECU control decisions
* Actuator commands
* Historical observations
* Simulation and estimation models

---

## 8. Digital-Twin Information Categories

Values represented by the digital twin should retain their origin and meaning.

### Measured

Directly acquired from a physical sensor.

Examples:

* Throttle position
* Exhaust-gas temperature
* Battery voltage
* Pickup timing

### Derived

Calculated deterministically from other values.

Examples:

* Engine speed
* Revolution period
* Throttle movement rate
* Knock index

### Decided

Produced by ECU control logic.

Examples:

* Base ignition angle
* Applied ignition corrections
* Power Jet target
* Exhaust-valve target

### Commanded

Sent by the ECU to an actuator or timing peripheral.

Examples:

* Ignition trigger command
* Power Jet duty command
* Exhaust-valve motor command

### Estimated

Produced by a model when no direct measurement exists.

Examples:

* Estimated engine load
* Estimated thermal stress
* Estimated exhaust-valve position
* Estimated knock risk

### Simulated

Produced by replaying recorded inputs with modified maps, parameters or models.

Examples:

* Ignition angle generated by an alternative map
* Simulated Power Jet target
* Simulated safety intervention

The client should clearly distinguish measured, derived, decided, commanded, estimated and simulated values.

---

## 9. Initial Digital-Twin Use Cases

### 9.1 Current ECU representation

The twin represents the latest known state of the physical ECU, including:

* ECU identity
* Hardware revision
* Installed firmware
* Active maps
* Configuration
* Calibration
* Latest operating state
* Active and historical faults

The latest known state is not necessarily the current physical state when the ECU is disconnected.

### 9.2 Recorded-run reconstruction

The twin reconstructs a recorded engine run as a timeline of ECU inputs, decisions and outputs.

A reconstructed run may include:

* Sensor observations
* Engine speed and synchronization
* Active maps and control modes
* Control-strategy decisions
* Applied corrections
* Actuator targets and commands
* Faults and events
* User actions
* Configuration changes

### 9.3 Revolution-by-revolution replay

The twin can replay a recorded run one revolution at a time.

For each revolution, it may show:

* Available sensor inputs
* Engine synchronization state
* Map lookup inputs
* Base control outputs
* Applied corrections
* Final requested outputs
* Final commanded outputs
* Active limiters and safety strategies
* Faults and relevant events

### 9.4 ECU decision explanation

The twin can explain how an ECU output was produced.

Example:

```text
Base ignition angle:       18.0°
Knock correction:          -2.0°
EGT correction:            -1.0°
User trim:                 +0.5°
Requested ignition angle:  15.5°
Applied ignition angle:    15.0°
```

This requires the ECU recording enough intermediate control information to reconstruct or explain the decision.

### 9.5 Alternative-map evaluation

A recorded run can be evaluated using an alternative map or parameter set.

The result may compare:

* Recorded ECU output
* Recomputed original output
* Simulated alternative output
* Difference between original and alternative behavior
* Operating regions affected by the change

Initially, this represents a comparison of control strategies.

It does not inherently predict changes in torque, power, combustion quality or engine safety.

### 9.6 Configuration and run comparison

The twin can compare runs performed with different:

* Firmware versions
* Maps
* Calibrations
* Control parameters
* Safety thresholds
* Hardware revisions

### 9.7 Root-cause analysis

The twin can reconstruct the operating context surrounding events such as:

* Knock detection
* Excessive exhaust-gas temperature
* Unexpected ignition cut
* Engine synchronization loss
* Quick Shifter activation
* Exhaust-valve malfunction
* Power Jet malfunction
* ECU reset

### 9.8 Historical diagnostics

The twin may analyze multiple runs to identify changes and recurring behavior.

Examples include:

* Sensor calibration drift
* Increasing knock activity
* Temperature changes in comparable operating conditions
* Battery-voltage instability
* Pickup timing irregularity
* Actuator degradation
* Repeated faults
* Abnormal control behavior

Initially, these should be treated as diagnostic indicators rather than guaranteed failure predictions.

### 9.9 Virtual sensors and estimation

The twin may later estimate values that are not directly measured.

Potential estimates include:

* Engine load
* Thermal stress
* Knock risk
* Combustion stability
* Exhaust-valve position
* Sensor confidence
* Actuator health

Every estimate should identify the model and model version that produced it.

---

## 10. Replay and Simulation Boundaries

The architecture should distinguish between three different operations.

### Recorded playback

Displays the information originally received from the physical ECU.

No ECU behavior is recalculated.

### Deterministic replay

Runs a server-side implementation of ECU control logic using recorded inputs.

Its purpose is to verify that the same inputs, configuration and software logic reproduce the recorded ECU decisions.

### Alternative simulation

Runs modified maps, parameters, strategies or models using recorded inputs.

Its purpose is to compare possible control behavior with the behavior recorded from the physical ECU.

These operations should produce separate outputs and should never overwrite the original recorded data.

---

## 11. Digital-Twin State

The digital twin may contain different forms of state:

### Physical identity state

Relatively stable information about the physical ECU:

* ECU identifier
* Hardware revision
* Supported sensors
* Supported actuators
* Manufacturing information

### Configuration state

Versioned information that determines ECU behavior:

* Firmware
* Maps
* Calibration
* Control parameters
* Feature configuration
* Safety thresholds

### Latest known operating state

The most recent operating information received from the ECU.

This state should include the time at which it was observed so that disconnected or stale state is not presented as current.

### Historical state

Recorded runs, faults, events, commands and configuration changes.

### Derived twin state

Information produced by server-side processing:

* Run summaries
* Comparisons
* Diagnostic indicators
* Estimated values
* Simulation results
* Model outputs

---

## 12. Separation of Responsibilities

### ECU

Owns:

* Physical sensor acquisition
* Real-time engine state
* Real-time control
* Safety-critical decisions
* Actuator commands

### Client

Owns:

* User interaction
* Live presentation
* ECU command interface
* Map and configuration editing
* Communication between ECU and server
* Presentation of twin results

### Server and digital twin

Own:

* Persistent ECU representation
* Revision history
* Recorded runs
* Historical analysis
* Replay
* Simulation
* Diagnostics
* Estimation models

The same control concepts may be represented on both the ECU and server, but the physical ECU remains the authority for what actually occurred.

---

## 13. Suggested Server-Side Modules

The first implementation may use modules inside a single server application.

```text
EcuRegistry
 ├── ECU identity
 ├── Hardware information
 └── Ownership and access

ConfigurationRegistry
 ├── Firmware revisions
 ├── Map revisions
 ├── Configuration revisions
 └── Calibration revisions

RunRepository
 ├── Recorded runs
 ├── Run metadata
 ├── Events and faults
 └── Recorded ECU decisions

TwinStateService
 ├── Latest known ECU state
 ├── Current known configuration
 └── Physical-to-digital association

ReplayService
 ├── Recorded playback
 ├── Deterministic control replay
 └── Revolution-level inspection

SimulationService
 ├── Alternative maps
 ├── Alternative parameters
 ├── Alternative strategies
 └── Simulated outputs

AnalysisService
 ├── Run statistics
 ├── Run comparison
 ├── Fault correlation
 ├── Diagnostic indicators
 └── Historical trends
```

These modules do not initially need to be separate microservices.

---

## 14. Data Provenance

Every important digital-twin result should be traceable to its origin.

A result should identify, where applicable:

* Physical ECU
* Recorded run
* Observation time
* Firmware revision
* Map revision
* Configuration revision
* Calibration revision
* Replay or simulation version
* Analysis-model version
* Whether the result was measured, derived, decided, commanded, estimated or simulated

Original recorded information should remain distinguishable from server-generated results.

---

## 16. Initial Implementation Direction

The first digital twin should be descriptive and replay-oriented.

### Stage 1: ECU representation

Implement:

* ECU registration
* Hardware identity
* Firmware history
* Map history
* Configuration history
* Calibration history
* Latest known ECU state

### Stage 2: Recorded runs

Implement:

* Run storage
* Run metadata
* Fault and event history
* Run timeline reconstruction
* Association with exact ECU revisions

### Stage 3: Replay

Implement:

* Recorded playback
* Revolution-by-revolution inspection
* Map lookup visualization
* Control-decision explanation
* Comparison between recorded and recomputed outputs

### Stage 4: Alternative control evaluation

Implement:

* Alternative ignition-map evaluation
* Alternative Power Jet-map evaluation
* Alternative exhaust-valve-map evaluation
* Parameter comparison
* Output-difference visualization

### Stage 5: Advanced models

Potential later additions include:

* Thermal models
* Knock-risk models
* Engine-load estimation
* Actuator-degradation models
* Comparative performance models
* Predictive diagnostic models

Advanced models should not be considered reliable until they have been validated against suitable physical data.

---

The initial digital twin is:

> A persistent server-side representation of a physical ECU that combines its identity, software, maps, configuration, calibration and recorded operating history. It reconstructs what the ECU observed, decided and commanded, supports detailed replay, and allows recorded behavior to be compared with alternative maps or control parameters.

The physical ECU remains the sole authority for real-time and safety-critical engine control.
