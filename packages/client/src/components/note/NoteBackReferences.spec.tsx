import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchBackReferenceDetails } from '~/apis/note.api';
import NoteBackReferences from './NoteBackReferences';

vi.mock('~/apis/note.api', () => ({ fetchBackReferenceDetails: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({
        params,
        search,
        children,
        ...props
    }: {
        params: { id: string };
        search?: { block?: string };
        children: React.ReactNode;
    }) => (
        <a href={`/${params.id}${search?.block ? `?block=${encodeURIComponent(search.block)}` : ''}`} {...props}>
            {children}
        </a>
    ),
}));

const reference = (id = '8', title = '주간 회의록', blockId: string | null = 'meeting-decision') => ({
    id,
    title,
    hasMoreContexts: false,
    contexts: [
        {
            blockId,
            segments: [
                { text: '다른 팀의 로그인 개편과 달리 ', isTarget: false },
                { text: 'Old title', isTarget: true },
                { text: '은 다음 달로 미룬다.', isTarget: false },
            ],
        },
    ],
});
const renderBacklinks = () =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
            <NoteBackReferences noteId="7" targetTitle="로그인 개편" />
        </QueryClientProvider>,
    );

beforeEach(() => vi.resetAllMocks());

it('shows the reference sentence with the current target title and links to its source block', async () => {
    vi.mocked(fetchBackReferenceDetails).mockResolvedValue({
        type: 'success',
        backReferenceDetails: { references: [reference()], hasMore: false, nextOffset: null },
    });

    renderBacklinks();

    const excerpt = await screen.findByRole('link', { name: /^다른 팀의 로그인 개편과 달리/ });
    expect(excerpt).toHaveAttribute('href', '/8?block=meeting-decision');
    expect(excerpt).toHaveTextContent('다른 팀의 로그인 개편과 달리 로그인 개편은 다음 달로 미룬다.');
    expect(screen.getByText('로그인 개편', { selector: 'strong' })).toBeVisible();
    expect(screen.queryByRole('link', { name: '로그인 개편', exact: true })).not.toBeInTheDocument();
});

it('keeps earlier references visible when the next page is requested', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchBackReferenceDetails)
        .mockResolvedValueOnce({
            type: 'success',
            backReferenceDetails: { references: [reference()], hasMore: true, nextOffset: 20 },
        })
        .mockResolvedValueOnce({
            type: 'success',
            backReferenceDetails: { references: [reference('9', '작업 계획')], hasMore: false, nextOffset: null },
        });
    renderBacklinks();
    await screen.findByRole('link', { name: '주간 회의록', exact: true });

    await user.click(screen.getByRole('button', { name: 'Load more references' }));

    expect(await screen.findByRole('link', { name: '작업 계획', exact: true })).toBeVisible();
    expect(screen.getByRole('link', { name: '주간 회의록', exact: true })).toBeVisible();
    expect(fetchBackReferenceDetails).toHaveBeenLastCalledWith({ id: '7', limit: 20, offset: 20 });
});

it('opens the source note when a legacy mention has no saved block ID', async () => {
    vi.mocked(fetchBackReferenceDetails).mockResolvedValue({
        type: 'success',
        backReferenceDetails: { references: [reference('8', '주간 회의록', null)], hasMore: false, nextOffset: null },
    });

    renderBacklinks();

    expect(await screen.findByRole('link', { name: /다른 팀의/ })).toHaveAttribute('href', '/8');
});
