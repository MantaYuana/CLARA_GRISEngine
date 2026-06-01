/**
 * response.ts
 * Unified API response envelope helpers.
 *
 * Every route should use success() / error() so the front-end always receives
 * a consistent shape: { status, data?, meta?, code?, message?, details? }
 */

export interface SuccessResponse<T = unknown> {
    status: "success";
    data: T;
    meta?: Record<string, unknown>;
}

export interface ErrorResponse {
    status: "error";
    code: string;
    message: string;
    details?: unknown;
}

export function success<T>(data: T, meta?: Record<string, unknown>): SuccessResponse<T> {
    return { status: "success", data, ...(meta ? { meta } : {}) };
}

export function error(
    code: string,
    message: string,
    details?: unknown,
): ErrorResponse {
    return {
        status: "error",
        code,
        message,
        ...(details !== undefined ? { details } : {}),
    };
}
