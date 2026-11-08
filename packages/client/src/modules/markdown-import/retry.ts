import axios from 'axios';

/** Retry only throttling responses; the caller's wait keeps cancellation responsive. */
export async function retryImportRequest<T>(
    operation: () => Promise<T>,
    wait: (milliseconds: number) => Promise<void>,
    onRetry: () => void,
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (!axios.isAxiosError(error) || error.response?.status !== 429 || attempt >= 6) throw error;
            const header = error.response.headers?.['retry-after'];
            const seconds = header === undefined ? NaN : Number(header);
            const date = typeof header === 'string' ? Date.parse(header) : NaN;
            const retryAfter = Number.isFinite(seconds)
                ? Math.max(0, seconds * 1000)
                : Number.isFinite(date)
                  ? Math.max(0, date - Date.now())
                  : 0;
            onRetry();
            await wait(Math.max(Math.min(30_000, 1000 * 2 ** attempt), retryAfter));
        }
    }
}
