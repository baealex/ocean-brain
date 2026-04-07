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
const IMAGE_PREVIEW_HEIGHT = 192;
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
        if (await confirm('Delete this image? It is not referenced by any notes.')) {
            deleteImageMutation.mutate(id);
        }
    };

    const getReferenceText = (count: number) => (
        count === 1 ? '1 reference' : `${count} references`
    );

    return (
        <div ref={containerRef}>
            <QueryBoundary
                fallback={(
                    <PageLayout
                        title="Images"
                        variant="default"
                        heading={<Skeleton width={136} height={24} className="rounded-full" />}
                        description={<Skeleton width={232} height={16} className="rounded-full" />}>
                        <div className="flex flex-col gap-4">
                            <div className="grid-auto-cards grid gap-4">
                                {Array.from({ length: 3 }, (_, index) => (
                                    <SurfaceCard key={index} flush>
                                        <div
                                            className="flex items-center justify-center bg-muted/25 p-3"
                                            style={{ height: IMAGE_PREVIEW_HEIGHT }}>
                                            <Skeleton
                                                width="100%"
                                                height={IMAGE_PREVIEW_HEIGHT - 24}
                                                className="rounded-[12px]"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5">
                                            <Skeleton width={92} height={14} className="rounded-full" />
                                            <Skeleton width={32} height={32} className="rounded-[12px]" />
                                        </div>
                                    </SurfaceCard>
                                ))}
                            </div>
                        </div>
                    </PageLayout>
                )}
                errorTitle="Failed to load images"
                errorDescription="Retry loading uploaded image metadata"
                resetKeys={[page, limit]}>
                <Images
                    searchParams={{
                        offset: (page - 1) * limit,
                        limit
                    }}
                    render={({ images, totalCount }) => {
                        const heading = totalCount > 0 ? `Images (${totalCount})` : undefined;
                        const description = 'Review and manage the images you uploaded inside notes';

                        if (images.length === 0) {
                            return (
                                <PageLayout
                                    title="Images"
                                    variant="default"
                                    heading={heading}
                                    description={description}>
                                    <Empty
                                        title="There are no images"
                                        description="Upload an image in any note and it will appear here"
                                    />
                                </PageLayout>
                            );
                        }

                        return (
                            <PageLayout
                                title="Images"
                                variant="default"
                                heading={heading}
                                description={description}>
                                <div className="flex flex-col gap-4">
                                    <div className="grid-auto-cards grid gap-4">
                                        {images.map((image) => (
                                            <SurfaceCard key={image.id} flush>
                                                <Link
                                                    to={SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE}
                                                    params={{ id: image.id }}
                                                    className="focus-ring-soft block overflow-hidden rounded-t-[18px] outline-none">
                                                    <div
                                                        className="flex items-center justify-center bg-muted/25 p-3"
                                                        style={{ height: IMAGE_PREVIEW_HEIGHT }}>
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
                            </PageLayout>
                        );
                    }}
                />
            </QueryBoundary>
        </div>
    );
};

export default ManageImage;
