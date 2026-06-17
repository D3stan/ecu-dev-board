/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RunDetailResponse = {
    id: string;
    ecu_id: string;
    status: string;
    started_at: string;
    ended_at?: string | null;
    firmware_version?: string | null;
    map_version?: string | null;
    heartbeat?: string | null;
    last_committed_sequence: number;
    batch_count: number;
};

