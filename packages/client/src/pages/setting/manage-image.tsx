import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { deleteImage } from '~/apis/image.api';
import { QueryBoundary } from '~/components/app';
import { Images } from '~/components/entities';
import * as Icon from '~/components/icon';
import { Empty, Image as ImageComponent, PageLayout, Pagination, Skeleton, SurfaceCard } from '~/components/shared';
import { Button, Text, useConfirm, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE, SETTINGS_MANAGE_IMAGE_ROUTE } from '~/modules/url';
import { getImageDeleteConfirmation } from './image-delete-confirmation';

const IMAGE_PAGE_LIMIT = 28;
const IMAGE_PREVIEW_HEIGHT = 192;
const Route = getRouteApi(SETTINGS_MANAGE_IMAGE_ROUTE);

const ManageImage = () => {
    const confirm = useConfirm();
    const toast = useToast();
    const queryClient = useQueryClient();

    const navigate = Route.useNavigate();
    const { page } = Route.useSearch();

    const deleteImageMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await deleteImage(id);
            if (response.type === 'error') {
                throw new Error(response.errors[0]?.message ?? 'Failed to delete image');
            }

            if (!response.deleteImage) {
                throw new Error('Failed to delete image');
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.images.listAll(),
                exact: false,
            });
            toast('Image deleted');
        },
        onError: (error) => {
            toast(error instanceof Error ? error.message : 'Failed to delete image');
        },
    });

    const handleDelete = async (id: string, referenceCount: number) => {
        if (await confirm(getImageDeleteConfirmation(referenceCount))) {
            deleteImageMutation.mutate(id);
        }
    };

    const getReferenceText = (count: number) => {
        if (count === 0) return 'Unused';
        return count === 1 ? '1 reference' : `${count} references`;
    };

    return (
        <div className="w-full">
            <QueryBoundary
                fallback={
                    <PageLayout
                        title="Images"
                        variant="default"
                        heading={<Skeleton width={136} height={24} className="rounded-full" />}
                        description={<Skeleton width={232} height={16} className="rounded-full" />}
                    >
                        <div className="flex flex-col gap-4">
                            <div className="grid-auto-cards grid gap-4">
                                {Array.from({ length: 3 }, (_, index) => (
                                    <SurfaceCard key={index} flush>
                                        <div
                                            className="flex items-center justify-center bg-muted/25 p-3"
                                            style={{ height: IMAGE_PREVIEW_HEIGHT }}
                                        >
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
                }
                errorTitle="Failed to load images"
                errorDescription="Retry loading uploaded image metadata"
                resetKeys={[page]}
            >
                <Images
                    searchParams={{
                        offset: (page - 1) * IMAGE_PAGE_LIMIT,
                        limit: IMAGE_PAGE_LIMIT,
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
                                    description={description}
                                >
                                    <Empty
                                        title="There are no images"
                                        description="Upload an image in any note and it will appear here"
                                    />
                                </PageLayout>
                            );
                        }

                        return (
                            <PageLayout title="Images" variant="default" heading={heading} description={description}>
                                <div className="flex flex-col gap-4">
                                    <div className="grid-auto-cards grid gap-4">
                                        {images.map((image) => (
                                            <SurfaceCard key={image.id} flush>
                                                <Link
                                                    to={SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE}
                                                    params={{ id: image.id }}
                                                    search={{ page }}
                                                    className="focus-ring-soft block overflow-hidden rounded-t-[18px] outline-none"
                                                >
                                                    <div
                                                        className="flex items-center justify-center bg-muted/25 p-3"
                                                        style={{ height: IMAGE_PREVIEW_HEIGHT }}
                                                    >
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
                                                            className="truncate"
                                                        >
                                                            {getReferenceText(image.referenceCount)}
                                                        </Text>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        disabled={deleteImageMutation.isPending}
                                                        aria-label={`Delete image ${image.id}`}
                                                        onClick={() => handleDelete(image.id, image.referenceCount)}
                                                    >
                                                        <Icon.TrashCan className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </SurfaceCard>
                                        ))}
                                    </div>
                                    {totalCount > IMAGE_PAGE_LIMIT && (
                                        <Pagination
                                            page={page}
                                            last={Math.ceil(totalCount / IMAGE_PAGE_LIMIT)}
                                            onChange={(page) => {
                                                navigate({
                                                    search: (prev) => ({
                                                        ...prev,
                                                        page,
                                                    }),
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
