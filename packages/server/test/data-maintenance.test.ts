import assert from 'node:assert/strict';
import test from 'node:test';

import { createDataMaintenanceService, startDataMaintenanceScheduler } from '../src/modules/data-maintenance.js';

test('data maintenance service runs registered jobs and returns non-zero work only', async () => {
    const calls: string[] = [];
    const service = createDataMaintenanceService([
        {
            key: 'note-search-projection',
            run: async () => {
                calls.push('note-search-projection');
                return 3;
            },
        },
        {
            key: 'noop-job',
            run: async () => {
                calls.push('noop-job');
                return 0;
            },
        },
    ]);

    const results = await service.runNow(50);

    assert.deepEqual(calls, ['note-search-projection', 'noop-job']);
    assert.deepEqual(results, [
        {
            key: 'note-search-projection',
            processedCount: 3,
        },
    ]);
});

test('data maintenance service deduplicates concurrent background runs', async () => {
    let runCount = 0;
    const service = createDataMaintenanceService([
        {
            key: 'note-search-projection',
            run: async () => {
                runCount += 1;
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, 10);
                });
                return 2;
            },
        },
    ]);

    const [left, right] = await Promise.all([service.runInBackground(), service.runInBackground()]);

    assert.equal(runCount, 1);
    assert.deepEqual(left, [
        {
            key: 'note-search-projection',
            processedCount: 2,
        },
    ]);
    assert.deepEqual(right, left);
});

test('data maintenance scheduler triggers an immediate run and can be stopped', async () => {
    let runs = 0;
    const service = createDataMaintenanceService([
        {
            key: 'note-search-projection',
            run: async () => {
                runs += 1;
                return 1;
            },
        },
    ]);

    const observedResults: Array<Array<{ key: string; processedCount: number }>> = [];
    const stop = startDataMaintenanceScheduler({
        intervalMs: 1000,
        runInBackground: service.runInBackground,
        onResults: (results) => {
            observedResults.push(results);
        },
    });

    await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
    });
    stop();

    assert.equal(runs >= 1, true);
    assert.deepEqual(observedResults[0], [
        {
            key: 'note-search-projection',
            processedCount: 1,
        },
    ]);
});
