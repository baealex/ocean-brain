import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Container, Highlight, Pagination } from '~/components/shared';

import useNotes from '~/hooks/resource/useNotes';
import { getNoteURL } from '~/modules/url';

export default function Search() {
    const [searchParams] = useSearchParams();

    const limit = 10;
    const page = Number(searchParams.get('page')) || 1;
    const query = searchParams.get('query') || '';

    const { data } = useNotes({
        query,
        limit,
        offset: (page - 1) * limit,
        fields: ['content']
    });

    return (
        <>
            <Helmet>
                <title>Search "{query}" | Ocean Brain</title>
            </Helmet>
            <Container>
                {data?.notes.map((note) => (
                    <div key={note.id} className="mb-5">
                        <div className="font-semibold text-lg mb-1">
                            <Link to={getNoteURL(note.id)}>
                                <Highlight match={query}>
                                    {note.title}
                                </Highlight>
                            </Link>
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg">
                            {(JSON.parse(note.content) as object[]).filter(item => JSON.stringify(item).includes(query)).map((item) => (
                                <Highlight match={query}>
                                    {JSON.stringify(item)}
                                </Highlight>
                            ))}
                        </div>
                    </div>
                ))}
                {data?.totalCount && limit < data.totalCount && (
                    <Pagination
                        limit={limit}
                        currentPage={page}
                        totalEntries={data.totalCount}
                    />
                )}
            </Container>
        </>
    );
}
