import { purgeTrashedNote } from '~/apis/note.api';
import { graphQuery } from '~/modules/graph-query';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('note.api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends trashed note purge requests through GraphQL variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            purgeTrashedNote: true,
        } as never);

        const response = await purgeTrashedNote('7');

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('mutation PurgeTrashedNote'), { id: '7' });
        expect(response).toEqual({
            type: 'success',
            purgeTrashedNote: true,
        });
    });
});
