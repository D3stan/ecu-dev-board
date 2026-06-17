/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TelemetryStateEntry = {
    id: string;
    run_id: string;
    server_received_at: string;
    ecu_collected_at_us: number;
    snapshot_generation: number;
    state_json: Record<string, any>;
    overflow_json: Record<string, any>;
    batch_seq: number;
};

