import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import {
    Image as ImageComponent,
    FallbackRender,
    PageLayout,
    Pagination,
    Skeleton,
    Empty
} from '~/components/shared';
import { Button, useConfirm } from '~/components/ui';
import * as Icon from '~/components/icon';

import { getImageNotesURL } from '~/modules/url';
import { useGridLimit } from '~/hooks/useGridLimit';

import { deleteImage } from '~/apis/image.api';
import { Suspense } from 'react';
import { Images } from '~/components/entities';

const IMAGE_MIN_WIDTH = 240;
const IMAGE_GAP = 20;
const IMAGE_ROWS = 4;

const ManageImage = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const [searchParams, setSearchParams] = useSearchParams();
    const { containerRef, limit } = useGridLimit({
        minItemWidth: IMAGE_MIN_WIDTH,
        gap: IMAGE_GAP,
        rows: IMAGE_ROWS
    });

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
        <PageLayout title="Images" variant="subtle" description="Manage images uploaded to your notes">
            <div ref={containerRef}>
                <Suspense
                    fallback={(
                        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
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
                                        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                                            {images.map((image) => (
                                                <div key={image.id} className="rounded-[12px_4px_13px_3px/4px_10px_4px_12px] overflow-hidden border-2 border-border shadow-sketchy hover:shadow-sketchy-lg hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-200">
                                                    <Link to={getImageNotesURL(image.id)}>
                                                        <ImageComponent className="h-48 w-full object-cover" src={image.url} alt={image.id} />
                                                    </Link>
                                                    <div className="flex p-2 justify-between items-center border-t-2 border-dashed border-border-subtle bg-subtle">
                                                        <span className="text-xs font-bold text-fg-secondary px-1">
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
            </div>
        </PageLayout>
    );
};

export default ManageImage;
