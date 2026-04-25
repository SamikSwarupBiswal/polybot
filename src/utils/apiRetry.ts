import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger.js';

/**
 * Shared API call wrapper with exponential backoff retry.
 * Retries on 429, 500, 502, 503, 504, and network errors.
 *
 * @param config - Axios request configuration
 * @param opts - Retry options
 * @returns AxiosResponse on success, or null after all retries exhausted
 */
export async function apiCallWithRetry<T = any>(
    config: AxiosRequestConfig,
    opts?: {
        maxRetries?: number;
        baseDelayMs?: number;
        label?: string;
    }
): Promise<AxiosResponse<T> | null> {
    const maxRetries = opts?.maxRetries ?? 3;
    const baseDelayMs = opts?.baseDelayMs ?? 500;
    const label = opts?.label ?? config.url ?? 'API call';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await axios(config);
        } catch (error: any) {
            const status = error.response?.status;
            const isRetryable =
                !error.response ||                  // Network error (no response)
                status === 429 ||                   // Rate limited
                status === 500 ||                   // Server error
                status === 502 ||                   // Bad gateway
                status === 503 ||                   // Service unavailable
                status === 504;                     // Gateway timeout

            if (!isRetryable || attempt === maxRetries) {
                if (attempt > 0) {
                    logger.warn(`[API Retry] ${label} failed after ${attempt + 1} attempts: ${error.message}`);
                }
                // Return null instead of throwing — callers already handle null/empty results
                return null;
            }

            const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
            logger.debug(
                `[API Retry] ${label} attempt ${attempt + 1}/${maxRetries + 1} failed (${status || 'network error'}). ` +
                `Retrying in ${Math.round(delayMs)}ms...`
            );
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    return null;
}
