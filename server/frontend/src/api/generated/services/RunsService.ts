/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RunDetailResponse } from '../models/RunDetailResponse';
import type { StartRunRequest } from '../models/StartRunRequest';
import type { StartRunResponse } from '../models/StartRunResponse';
import type { TelemetryStateEntry } from '../models/TelemetryStateEntry';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RunsService {
    /**
     * List all engine runs
     * @param ecuId
     * @returns RunDetailResponse Successful Response
     * @throws ApiError
     */
    public static listRuns(
        ecuId?: string,
    ): CancelablePromise<Array<RunDetailResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/runs',
            query: {
                'ecu_id': ecuId,
            },
        });
    }
    /**
     * Start recorded run
     * @param requestBody
     * @returns StartRunResponse Successful Response
     * @throws ApiError
     */
    public static startRun(
        requestBody: StartRunRequest,
    ): CancelablePromise<StartRunResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/runs/start',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * End active run
     * @param runId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static endRun(
        runId: string,
    ): CancelablePromise<{
        status?: string;
        run_id?: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/runs/{run_id}/end',
            path: {
                'run_id': runId,
            },
        });
    }
    /**
     * Get telemetry history
     * @param runId
     * @param limit
     * @returns TelemetryStateEntry Successful Response
     * @throws ApiError
     */
    public static getTelemetry(
        runId: string,
        limit: number = 1000,
    ): CancelablePromise<Array<TelemetryStateEntry>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/runs/{run_id}/telemetry',
            path: {
                'run_id': runId,
            },
            query: {
                'limit': limit,
            },
        });
    }
}
