import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import { graphQuery } from '~/modules/graph-query';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('server-cache.api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a GraphQL error response when setCache payload is missing', async () => {
        vi.mocked(graphQuery).mockResolvedValue({ type: 'success' } as never);

        const response = await setServerCache('heroBanner', 'https://example.com/hero.jpg');

        expect(response).toEqual({
            type: 'error',
            category: 'graphql',
            errors: [{
                code: 'INVALID_RESPONSE_SHAPE',
                message: 'GraphQL response field "setCache" is missing or invalid',
                details: { type: 'success' }
            }]
        });
    });

    it('encodes values before sending the mutation and returns the validated payload', async () => {
        const encodedValue = encodeURIComponent('https://example.com/hero.jpg');

        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            setCache: { value: encodedValue }
        } as never);

        const response = await setServerCache('heroBanner', 'https://example.com/hero.jpg');

        expect(graphQuery).toHaveBeenCalledWith(
            expect.stringContaining('mutation SetServerCache'),
            {
                key: 'heroBanner',
                value: encodedValue
            }
        );
        expect(response).toEqual({
            type: 'success',
            setCache: { value: encodedValue }
        });
    });

    it('falls back to an empty string when cache query payload is invalid', async () => {
        vi.mocked(graphQuery).mockResolvedValue({ type: 'success' } as never);

        await expect(getServerCache('heroBanner')).resolves.toBe('');
    });
});
