import { Helmet } from 'react-helmet';
import { useQuery } from 'react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { fetchTags } from '~/apis/tag.api';
import { FallbackRender, Pagination } from '~/components/shared';
import { getRandomBackground } from '~/modules/color';

export default function Tag() {
    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 60;
    const page = Number(searchParams.get('page')) || 1;

    const { data } = useQuery(['tags', page], async () => {
        const response = await fetchTags({
            offset: (page - 1) * limit,
            limit
        });
        if (response.type === 'error') {
            throw response;
        }
        return response.allTags;
    });

    return (
        <>
            <Helmet>
                <title>Tags | Ocean Brain</title>
            </Helmet>
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {data?.tags && data.tags.map((tag) => (
                    <Link to={`/tag/${tag.id}`} className="text-zinc-700 dark:text-zinc-300">
                        <div key={tag.id} className={`${getRandomBackground(tag.name)} p-4 relative rounded-2xl`}>
                            {tag.name} ({tag.referenceCount})
                        </div>
                    </Link>
                ))}
            </div>
            <FallbackRender fallback={null}>
                {data?.totalCount && limit < data.totalCount && (
                    <Pagination
                        page={page}
                        last={Math.ceil(data.totalCount / limit)}
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
    );
}
