import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import {
    Image as ImageComponent,
    FallbackRender,
    Pagination,
    Skeleton,
    Empty
} from '~/components/shared';
import { Button, useConfirm } from '~/components/ui';
import * as Icon from '~/components/icon';

import { getImageNotesURL } from '~/modules/url';

import { deleteImage } from '~/apis/image.api';
import { Suspense } from 'react';
import { Images } from '~/components/entities';

const ManageImage = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 24;
    const page = Number(searchParams.get('page')) || 1;

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
                    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        <Skeleton height="200px"/>
                        <Skeleton height="200px"/>
                        <Skeleton height="200px"/>
                    </div>
                )}>
                <Images
                    searchParams={{
                        offset: (page - 1) * limit,
                        limit
                    }}
                    render={({ images, totalCount }) => (
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
                                    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                                        {images.map((image) => (
                                            <div key={image.id} className="relative rounded-[12px_4px_13px_3px/4px_10px_4px_12px] overflow-hidden border-2 border-border shadow-sketchy">
                                                <Link to={getImageNotesURL(image.id)}>
                                                    <ImageComponent className="h-48 w-full object-cover" src={image.url} alt={image.id} />
                                                </Link>
                                                <div className="absolute flex w-full p-2 justify-between bottom-0 left-0 bg-gradient-to-t from-black/70 to-transparent">
                                                    <span className="text-xs font-bold text-white bg-emphasis/80 rounded-full px-3 py-1">
                                                        {image.referenceCount} refs
                                                    </span>
                                                    <Button
                                                        variant="danger"
                                                        size="icon-sm"
                                                        disabled={image.referenceCount > 0}
                                                        onClick={() => handleDelete(image.id)}>
                                                        <Icon.TrashCan className="h-4 w-4" />
                                                    </Button>
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
                    )}
                />
            </Suspense>
        </>
    );
};

export default ManageImage;
