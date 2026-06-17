import fs from 'fs';
import path from 'path';

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "ECU Digital Twin Server",
    description: "API schema for ECU Digital Twin frontend client generation",
    version: "1.0.0"
  },
  paths: {
    "/api/ecus": {
      get: {
        tags: ["ecus"],
        summary: "List registered ECUs",
        operationId: "list_ecus",
        responses: {
          200: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EcuResponse" }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ["ecus"],
        summary: "Register new ECU",
        operationId: "register_ecu",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterEcuRequest" }
            }
          }
        },
        responses: {
          201: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EcuResponse" }
              }
            }
          }
        }
      }
    },
    "/api/ecus/{ecu_id}": {
      get: {
        tags: ["ecus"],
        summary: "Get ECU details",
        operationId: "get_ecu",
        parameters: [
          {
            name: "ecu_id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EcuResponse" }
              }
            }
          }
        }
      }
    },
    "/api/ecus/{ecu_id}/state": {
      get: {
        tags: ["ecus"],
        summary: "Get latest ECU state",
        operationId: "get_latest_state",
        parameters: [
          {
            name: "ecu_id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LatestStateResponse" }
              }
            }
          }
        }
      }
    },
    "/api/runs": {
      get: {
        tags: ["runs"],
        summary: "List all engine runs",
        operationId: "list_runs",
        parameters: [
          {
            name: "ecu_id",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RunDetailResponse" }
                }
              }
            }
          }
        }
      }
    },
    "/api/runs/start": {
      post: {
        tags: ["runs"],
        summary: "Start recorded run",
        operationId: "start_run",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StartRunRequest" }
            }
          }
        },
        responses: {
          201: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StartRunResponse" }
              }
            }
          }
        }
      }
    },
    "/api/runs/{run_id}/end": {
      post: {
        tags: ["runs"],
        summary: "End active run",
        operationId: "end_run",
        parameters: [
          {
            name: "run_id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    run_id: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/runs/{run_id}/telemetry": {
      get: {
        tags: ["runs"],
        summary: "Get telemetry history",
        operationId: "get_telemetry",
        parameters: [
          {
            name: "run_id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1000 }
          }
        ],
        responses: {
          200: {
            description: "Successful Response",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/TelemetryStateEntry" }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      RegisterEcuRequest: {
        type: "object",
        required: ["serial_number", "hardware_revision"],
        properties: {
          serial_number: { type: "string" },
          hardware_revision: { type: "string" }
        }
      },
      EcuResponse: {
        type: "object",
        required: ["id", "serial_number", "hardware_revision", "created_at"],
        properties: {
          id: { type: "string", format: "uuid" },
          serial_number: { type: "string" },
          hardware_revision: { type: "string" },
          created_at: { type: "string", format: "date-time" }
        }
      },
      LatestStateResponse: {
        type: "object",
        required: ["ecu_id", "serial_number", "cached"],
        properties: {
          ecu_id: { type: "string", format: "uuid" },
          serial_number: { type: "string" },
          state: { type: "object", nullable: true },
          cached: { type: "boolean" }
        }
      },
      StartRunRequest: {
        type: "object",
        required: ["ecu_id"],
        properties: {
          ecu_id: { type: "string", format: "uuid" },
          firmware_version: { type: "string", nullable: true },
          map_version: { type: "string", nullable: true }
        }
      },
      StartRunResponse: {
        type: "object",
        required: ["run_id"],
        properties: {
          run_id: { type: "string", format: "uuid" }
        }
      },
      RunDetailResponse: {
        type: "object",
        required: ["id", "ecu_id", "status", "started_at", "last_committed_sequence", "batch_count"],
        properties: {
          id: { type: "string", format: "uuid" },
          ecu_id: { type: "string", format: "uuid" },
          status: { type: "string" },
          started_at: { type: "string", format: "date-time" },
          ended_at: { type: "string", format: "date-time", nullable: true },
          firmware_version: { type: "string", nullable: true },
          map_version: { type: "string", nullable: true },
          heartbeat: { type: "string", format: "date-time", nullable: true },
          last_committed_sequence: { type: "integer" },
          batch_count: { type: "integer" }
        }
      },
      TelemetryStateEntry: {
        type: "object",
        required: ["id", "run_id", "server_received_at", "ecu_collected_at_us", "snapshot_generation", "state_json", "overflow_json", "batch_seq"],
        properties: {
          id: { type: "string", format: "uuid" },
          run_id: { type: "string", format: "uuid" },
          server_received_at: { type: "string", format: "date-time" },
          ecu_collected_at_us: { type: "integer" },
          snapshot_generation: { type: "integer" },
          state_json: { type: "object" },
          overflow_json: { type: "object" },
          batch_seq: { type: "integer" }
        }
      }
    }
  }
};

const outputDir = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(
  path.join(outputDir, 'openapi.json'),
  JSON.stringify(openapi, null, 2)
);
console.log('Generated openapi.json successfully');

// Helper to get filepath of current module
function fileURLToPath(url) {
  return new URL(url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'); // Fix for Windows paths
}
