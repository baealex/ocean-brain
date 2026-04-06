import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import {
    Image as ImageComponent,
    PageLayout,
    Pagination,
    Skeleton,
    Empty,
    SurfaceCard
} from '~/components/shared';
import { Button, Text, useConfirm } from '~/components/ui';
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

    const getReferenceText = (count: number) => (
        count === 1 ? '1 reference' : `${count} references`
    );

    return (
        <PageLayout
            title="Images"
            variant="default"
            description="Manage uploaded images across your workspace.">
            <div ref={containerRef}>
                <QueryBoundary
                    fallback={(
                        <div className="grid-auto-cards grid gap-4">
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
                        render={({ images, totalCount }) => {
                            if (images.length === 0) {
                                return (
                                    <Empty
                                        title="There are no images"
                                        description="Drag and drop an image into a note to add it here."
                                    />
                                );
                            }
                            return (
                                <div className="flex flex-col gap-4">
                                    <Text as="p" variant="meta" weight="medium" tone="secondary">
                                        {totalCount === 1 ? '1 image' : `${totalCount} images`}
                                    </Text>
                                    <div className="grid-auto-cards grid gap-4">
                                        {images.map((image) => (
                                            <SurfaceCard key={image.id} flush>
                                                <Link
                                                    to={SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE}
                                                    params={{ id: image.id }}
                                                    className="focus-ring-soft block overflow-hidden rounded-t-[18px] outline-none">
                                                    <div className="flex h-48 items-center justify-center bg-muted/25 p-3">
                                                        <ImageComponent
                                                            className="h-full w-full rounded-[12px] object-contain transition-transform duration-200 hover:scale-[1.02]"
                                                            src={image.url}
                                                            alt={image.id}
                                                        />
                                                    </div>
                                                </Link>
                                                <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5">
                                                    <div className="flex min-w-0 items-center gap-2 text-fg-secondary">
                                                        <Icon.LinkIcon className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" />
                                                        <Text
                                                            as="span"
                                                            variant="meta"
                                                            weight="medium"
                                                            tone="secondary"
                                                            className="truncate">
                                                            {getReferenceText(image.referenceCount)}
                                                        </Text>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        disabled={image.referenceCount > 0}
                                                        onClick={() => handleDelete(image.id)}>
                                                        <Icon.TrashCan className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </SurfaceCard>
                                        ))}
                                    </div>
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
                                </div>
                            );
                        }}
                    />
                </QueryBoundary>
            </div>
        </PageLayout>
    );
};

export default ManageImage;
