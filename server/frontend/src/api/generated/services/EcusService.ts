/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EcuResponse } from '../models/EcuResponse';
import type { LatestStateResponse } from '../models/LatestStateResponse';
import type { RegisterEcuRequest } from '../models/RegisterEcuRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class EcusService {
    /**
     * List registered ECUs
     * @returns EcuResponse Successful Response
     * @throws ApiError
     */
    public static listEcus(): CancelablePromise<Array<EcuResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ecus',
        });
    }
    /**
     * Register new ECU
     * @param requestBody
     * @returns EcuResponse Successful Response
     * @throws ApiError
     */
    public static registerEcu(
        requestBody: RegisterEcuRequest,
    ): CancelablePromise<EcuResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/ecus',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get ECU details
     * @param ecuId
     * @returns EcuResponse Successful Response
     * @throws ApiError
     */
    public static getEcu(
        ecuId: string,
    ): CancelablePromise<EcuResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ecus/{ecu_id}',
            path: {
                'ecu_id': ecuId,
            },
        });
    }
    /**
     * Get latest ECU state
     * @param ecuId
     * @returns LatestStateResponse Successful Response
     * @throws ApiError
     */
    public static getLatestState(
        ecuId: string,
    ): CancelablePromise<LatestStateResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ecus/{ecu_id}/state',
            path: {
                'ecu_id': ecuId,
            },
        });
    }
}
