import { confirm } from '@baejino/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import {
    Image as ImageComponent,
    FallbackRender,
    Pagination,
    Skeleton,
    Empty
} from '~/shared/ui';
import * as Icon from '~/shared/ui/icon';

import { getImageNotesURL } from '~/shared/lib/url';

import { deleteImage, useImages } from '~/entities/image';
import { Suspense } from 'react';

const ManageImage = () => {
    const queryClient = useQueryClient();

    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 24;
    const page = Number(searchParams.get('page')) || 1;

    const { data } = useImages({
        offset: (page - 1) * limit,
        limit
    });

    const { images = [], totalCount = 0 } = data || {};

    const deleteImageMutation = useMutation({
        mutationFn: deleteImage,
        onSuccess: (response) => {
            if (response.type === 'error') {
                throw response;
            }
            queryClient.invalidateQueries({ queryKey: ['images'] });
        }
    });

    const handleDelete = async (id: string) => {
        if (await confirm('Are you really sure?')) {
            deleteImageMutation.mutate(id);
        }
    };

    return (
        <>
            <Helmet>
                <title>Images | Ocean Brain</title>
            </Helmet>
            <Suspense
                fallback={(
                    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        <Skeleton height="256px"/>
                        <Skeleton height="256px"/>
                        <Skeleton height="256px"/>
                    </div>
                )}>
                <FallbackRender
                    fallback={(
                        <Empty
                            icon="🖼️"
                            title="There are no images"
                            description="Try drag and drop an image on the note editor."
                        />
                    )}>
                    {images.length > 0 && (
                                <>
                                    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                                        {images.map((image) => (
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
                        </FallbackRender>
            </Suspense>
        </>
    );
};

export default ManageImage;
