import { confirm } from '@baejino/ui';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Image as ImageComponent, FallbackRender, Pagination } from '~/components/shared';
import * as Icon from '~/components/icon';

import { getImageNotesURL } from '~/modules/url';

import { deleteImage, fetchImages } from '~/apis/image.api';

const Image = () => {
    const queryClient = useQueryClient();

    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 24;
    const page = Number(searchParams.get('page')) || 1;

    const { data } = useQuery(['images', page], async () => {
        const response = await fetchImages({
            offset: (page - 1) * limit,
            limit
        });
        if (response.type === 'error') {
            throw response;
        }
        return response.allImages;
    });

    const handleDelete = async (id: string) => {
        if (await confirm('Are you really sure?')) {
            await deleteImage(id);
            queryClient.invalidateQueries('images');
        }
    };

    return (
        <>
            <Helmet>
                <title>Images | Ocean Brain</title>
            </Helmet>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {data?.images && data.images.map((image) => (
                    <div key={image.id} className="relative bg-black">
                        <Link to={getImageNotesURL(image.id)}>
                            <ImageComponent className="h-64 w-full object-cover" src={image.url} alt={image.id} />
                        </Link>
                        <div className="absolute flex w-full p-2 justify-between bottom-0 left-0">
                            <p className="text-sm text-gray-100 bg-black rounded-full px-4 py-1">{image.referenceCount}</p>
                            <button disabled={image.referenceCount > 0} className="bg-red-500 text-gray-100 px-2 rounded-md flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleDelete(image.id)}>
                                <Icon.TrashCan className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
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
};

export default Image;
