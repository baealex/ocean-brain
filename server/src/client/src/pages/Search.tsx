import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import {
    Empty,
    FallbackRender,
    Highlight,
    Pagination
} from '~/components/shared';
import { Notes } from '~/components/entities';

import { getNoteURL } from '~/modules/url';
import { Suspense } from 'react';

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 10;
    const page = Number(searchParams.get('page')) || 1;
    const query = searchParams.get('query') || '';

    return (
        <>
            <Helmet>
                <title>Search "{query}" | Ocean Brain</title>
            </Helmet>
            <main className="mx-auto max-w-[896px]">
                <Suspense fallback={null}>
                    <Notes
                        searchParams={{
                            query,
                            limit,
                            offset: (page - 1) * limit,
                            fields: ['content']
                        }}
                        render={({ notes, totalCount }) => (
                            <>
                                <FallbackRender
                                    fallback={(
                                        <Empty
                                            icon="👀"
                                            title="No results found"
                                            description="Try searching for something else."
                                        />
                                    )}>
                                    {notes.length > 0 && notes.map((note) => (
                                        <div key={note.id} className="mb-5">
                                            <div className="font-semibold text-lg mb-1">
                                                <Link to={getNoteURL(note.id)}>
                                                    <Highlight match={query}>
                                                        {note.title}
                                                    </Highlight>
                                                </Link>
                                            </div>
                                            <div className="bg-muted p-3 rounded-lg">
                                                {(JSON.parse(note.content) as object[]).filter(item => JSON.stringify(item).includes(query)).map((item) => (
                                                    <Highlight match={query}>
                                                        {JSON.stringify(item)}
                                                    </Highlight>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </FallbackRender>
                                <FallbackRender fallback={null}>
                                    {totalCount && limit < totalCount && (
                                        <Pagination
                                            page={page}
                                            last={Math.ceil(totalCount / limit)}
                                            onChange={(page) => {
                                                setSearchParams(searchParams => {
                                                    searchParams.set('page', page.toString());
                                                    return searchParams;
                                                });
                                            }}
                                        />
                                    )}
                                </FallbackRender>
                            </>
                        )}
                    />
                </Suspense>
            </main>
        </>
    );
}
