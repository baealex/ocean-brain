import { createAppError } from '~/modules/error-handler.js';
import { isRecord } from './manifest.js';

export function parseStatusUpdate(value: unknown) {
    if (
        !isRecord(value) ||
        (value.state !== 'running' && value.state !== 'succeeded' && value.state !== 'failed') ||
        typeof value.message !== 'string' ||
        !value.message.trim() ||
        value.message.length > 300 ||
        [...value.message].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    ) {
        throw createAppError(
            400,
            'INVALID_INTEGRATION_STATUS',
            'Provide a running, succeeded, or failed state and a message of 1–300 characters without control characters.',
        );
    }
    return { state: value.state, message: value.message.trim() };
}

export function readStatusReport(value: string | null) {
    if (!value) return null;
    const report: unknown = JSON.parse(value);
    if (!isRecord(report) || typeof report.reportedAt !== 'string') return null;
    return { ...parseStatusUpdate(report), reportedAt: report.reportedAt };
}
