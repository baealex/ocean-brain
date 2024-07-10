import { Helmet } from 'react-helmet';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import type { Tag as TagInterface } from '~/models/Tag';

import { fetchTags } from '~/apis/tag.api';
import { getRandomBackground } from '~/modules/color';

export default function Tag() {
    const { data } = useQuery<TagInterface[]>('tags', () => {
        return fetchTags();
    });

    return (
        <>
            <Helmet>
                <title>Tags | Ocean Brain</title>
            </Helmet>
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {data?.map((tag) => (
                    <Link to={`/tag/${tag.id}`} className="text-zinc-700 dark:text-zinc-300">
                        <div key={tag.id} className={`${getRandomBackground(tag.name)} p-4 border shadow-md border-solid border-black dark:border-zinc-500`}>
                            {tag.name} ({tag.referenceCount})
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}
