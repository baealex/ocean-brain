import { backfillStaleNoteSearchText } from './note-search-backfill.js';

export interface DataMaintenanceJobResult {
    key: string;
    processedCount: number;
}

interface DataMaintenanceSchedulerOptions {
    intervalMs?: number;
    onError?: (error: unknown) => void;
    onResults?: (results: DataMaintenanceJobResult[]) => void;
    runInBackground?: (limit?: number) => Promise<DataMaintenanceJobResult[]>;
}

interface DataMaintenanceJob {
    key: string;
    run: (limit?: number) => Promise<number>;
}

interface DataMaintenanceService {
    runNow: (limit?: number) => Promise<DataMaintenanceJobResult[]>;
    runInBackground: (limit?: number) => Promise<DataMaintenanceJobResult[]>;
}

let activeDataMaintenanceTimer: ReturnType<typeof setInterval> | null = null;
const DEFAULT_DATA_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;

export const createDataMaintenanceService = (
    jobs: DataMaintenanceJob[]
): DataMaintenanceService => {
    let activeDataMaintenancePromise: Promise<DataMaintenanceJobResult[]> | null = null;

    const runNow = async (limit?: number) => {
        const results: DataMaintenanceJobResult[] = [];

        for (const job of jobs) {
            const processedCount = await job.run(limit);

            if (processedCount > 0) {
                results.push({
                    key: job.key,
                    processedCount
                });
            }
        }

        return results;
    };

    const runInBackground = (limit?: number) => {
        if (activeDataMaintenancePromise) {
            return activeDataMaintenancePromise;
        }

        activeDataMaintenancePromise = runNow(limit)
            .finally(() => {
                activeDataMaintenancePromise = null;
            });

        return activeDataMaintenancePromise;
    };

    return {
        runNow,
        runInBackground
    };
};

const defaultDataMaintenanceService = createDataMaintenanceService([
    {
        key: 'note-search-projection',
        run: backfillStaleNoteSearchText
    }
]);

export const runDataMaintenance = async (limit?: number) => {
    return defaultDataMaintenanceService.runNow(limit);
};

export const runDataMaintenanceInBackground = (limit?: number) => {
    return defaultDataMaintenanceService.runInBackground(limit);
};

export const startDataMaintenanceScheduler = (
    options: DataMaintenanceSchedulerOptions = {}
) => {
    if (activeDataMaintenanceTimer) {
        return () => {};
    }

    const intervalMs = options.intervalMs ?? DEFAULT_DATA_MAINTENANCE_INTERVAL_MS;

    const tick = () => {
        const runInBackground = options.runInBackground ?? runDataMaintenanceInBackground;

        void runInBackground()
            .then((results) => {
                options.onResults?.(results);
            })
            .catch((error) => {
                options.onError?.(error);
            });
    };

    tick();

    activeDataMaintenanceTimer = setInterval(tick, intervalMs);
    activeDataMaintenanceTimer.unref?.();

    return () => {
        if (!activeDataMaintenanceTimer) {
            return;
        }

        clearInterval(activeDataMaintenanceTimer);
        activeDataMaintenanceTimer = null;
    };
};
