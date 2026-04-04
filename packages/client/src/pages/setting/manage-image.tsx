import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import {
    Image as ImageComponent,
    FallbackRender,
    PageLayout,
    Pagination,
    Skeleton,
    Empty,
    SurfaceCard
} from '~/components/shared';
import { Button, useConfirm } from '~/components/ui';
import * as Icon from '~/components/icon';

import {
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE
} from '~/modules/url';
import { useGridLimit } from '~/hooks/useGridLimit';

import { deleteImage } from '~/apis/image.api';
import { Images } from '~/components/entities';
import { queryKeys } from '~/modules/query-key-factory';

const IMAGE_MIN_WIDTH = 240;
const IMAGE_GAP = 20;
const IMAGE_ROWS = 4;
const Route = getRouteApi(SETTINGS_MANAGE_IMAGE_ROUTE);

const ManageImage = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const navigate = Route.useNavigate();
    const { page } = Route.useSearch();
    const { containerRef, limit } = useGridLimit({
        minItemWidth: IMAGE_MIN_WIDTH,
        gap: IMAGE_GAP,
        rows: IMAGE_ROWS
    });

    const deleteImageMutation = useMutation({
        mutationFn: deleteImage,
        onSuccess: (response) => {
            if (response.type === 'error') {
                throw response;
            }
            queryClient.invalidateQueries({
                queryKey: queryKeys.images.listAll(),
                exact: false
            });
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
                <QueryBoundary
                    fallback={(
                        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                            <Skeleton height="200px"/>
                            <Skeleton height="200px"/>
                            <Skeleton height="200px"/>
                        </div>
                    )}
                    errorTitle="Failed to load images"
                    errorDescription="Retry loading uploaded image metadata."
                    resetKeys={[page, limit]}>
                    <Images
                        searchParams={{
                            offset: (page - 1) * limit,
                            limit
                        }}
                        render={({ images, totalCount }) => (
                            <FallbackRender
                                fallback={(
                                    <Empty
                                        title="There are no images"
                                        description="Try drag and drop an image on the note editor."
                                    />
                                )}>
                                {images.length > 0 && (
                                    <>
                                        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                                            {images.map((image) => (
                                                <SurfaceCard key={image.id} className="overflow-hidden p-0">
                                                    <Link
                                                        to={SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE}
                                                        params={{ id: image.id }}>
                                                        <ImageComponent className="h-48 w-full object-cover" src={image.url} alt={image.id} />
                                                    </Link>
                                                    <div className="flex items-center justify-between border-t border-border-subtle bg-[color:color-mix(in_srgb,var(--elevated)_72%,transparent)] px-3 py-2.5">
                                                        <span className="px-1 text-xs font-medium text-fg-secondary">
                                                            {image.referenceCount} refs
                                                        </span>
                                                        <Button
                                                            variant="soft-danger"
                                                            size="icon-sm"
                                                            disabled={image.referenceCount > 0}
                                                            onClick={() => handleDelete(image.id)}>
                                                            <Icon.TrashCan className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </SurfaceCard>
                                            ))}
                                        </div>
                                        <FallbackRender fallback={null}>
                                            {totalCount && limit < totalCount && (
                                                <Pagination
                                                    page={page}
                                                    last={Math.ceil(totalCount / limit)}
                                                    onChange={(page) => {
                                                        navigate({
                                                            search: prev => ({
                                                                ...prev,
                                                                page
                                                            })
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
                </QueryBoundary>
            </div>
        </PageLayout>
    );
};

export default ManageImage;
