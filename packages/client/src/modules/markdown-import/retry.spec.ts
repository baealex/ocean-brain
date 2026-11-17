import { retryImportRequest } from './retry';

afterEach(() => vi.useRealTimers());

it('respects an HTTP-date Retry-After header', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T00:00:00Z'));
    const operation = vi
        .fn()
        .mockRejectedValueOnce({
            isAxiosError: true,
            response: { status: 429, headers: { 'retry-after': 'Sun, 08 Nov 2026 00:00:05 GMT' } },
        })
        .mockResolvedValue('saved');
    const wait = vi.fn((_milliseconds: number) => Promise.resolve());

    await retryImportRequest(operation, wait, vi.fn());

    expect(wait).toHaveBeenCalledWith(5000);
    expect(operation).toHaveBeenCalledTimes(2);
});

it('backs off without Retry-After and stops after six retries', async () => {
    const error = { isAxiosError: true, response: { status: 429, headers: {} } };
    const operation = vi.fn().mockRejectedValue(error);
    const wait = vi.fn((_milliseconds: number) => Promise.resolve());

    await expect(retryImportRequest(operation, wait, vi.fn())).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(7);
    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
});
