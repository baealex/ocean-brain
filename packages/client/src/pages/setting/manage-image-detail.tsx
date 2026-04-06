import {
    useMutation,
    useQueryClient,
    useSuspenseQuery
} from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import * as Icon from '~/components/icon';
import { NoteListItem } from '~/components/note';
import {
    Image as ImageComponent,
    PageLayout,
    Skeleton,
    SurfaceCard
} from '~/components/shared';
import {
    Button,
    Text,
    Tooltip,
    useConfirm,
    useToast
} from '~/components/ui';
import { deleteImage, fetchImage } from '~/apis/image.api';
import { fetchImageNotes } from '~/apis/note.api';
import { setServerCache } from '~/apis/server-cache.api';
import { queryKeys } from '~/modules/query-key-factory';
import {
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE
} from '~/modules/url';

const Route = getRouteApi(SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE);
const DETAIL_PREVIEW_HEIGHT = 352;

const backLinkClassName = 'mb-4 inline-flex items-center gap-1 text-fg-secondary transition-colors hover:text-fg-default';
const sectionHeaderClassName = 'mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3';
const sectionTextClassName = 'space-y-1';

const getReferenceText = (count: number) => (
    count === 1 ? '1 reference' : `${count} references`
);

const getErrorMessage = (error: unknown, fallback: string) => {
    if (
        typeof error === 'object'
        && error !== null
        && 'errors' in error
        && Array.isArray(error.errors)
        && typeof error.errors[0]?.message === 'string'
    ) {
        return error.errors[0].message;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

const ManageImageDetailSkeleton = () => (
    <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-[400px] lg:flex-shrink-0">
            <SurfaceCard flush>
                <div
                    className="flex items-center justify-center bg-muted/20 p-4"
                    style={{ height: DETAIL_PREVIEW_HEIGHT }}>
                    <Skeleton
                        width="100%"
                        height={DETAIL_PREVIEW_HEIGHT - 32}
                        className="rounded-[14px]"
                    />
                </div>
                <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
                    <Skeleton width={96} height={14} className="rounded-full" />
                    <div className="flex gap-2">
                        <Skeleton height={32} className="flex-1 rounded-[12px]" />
                        <Skeleton height={32} className="flex-1 rounded-[12px]" />
                    </div>
                </div>
            </SurfaceCard>
        </div>
        <div className="flex-1 min-w-0">
            <SurfaceCard>
                <div className={sectionHeaderClassName}>
                    <div className={sectionTextClassName}>
                        <Skeleton width={140} height={18} />
                        <Skeleton width={220} height={14} className="rounded-full" />
                    </div>
                    <Skeleton width={84} height={14} className="rounded-full" />
                </div>
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={index} height={72} className="rounded-[16px]" />
                    ))}
                </div>
            </SurfaceCard>
        </div>
    </div>
);

interface ManageImageDetailContentProps {
    id: string;
}

const ManageImageDetailContent = ({ id }: ManageImageDetailContentProps) => {
    const confirm = useConfirm();
    const toast = useToast();
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();

    const { data: image } = useSuspenseQuery({
        queryKey: queryKeys.images.detail(id),
        queryFn: async () => {
            const response = await fetchImage(id);
            if (response.type === 'error') {
                throw response;
            }
            return response.image;
        }
    });

    const { data: imageNotes } = useSuspenseQuery({
        queryKey: queryKeys.images.notes(id),
        queryFn: async () => {
            const response = await fetchImageNotes(image.url);
            if (response.type === 'error') {
                throw response;
            }
            return response.imageNotes;
        }
    });

    const referenceCount = imageNotes.length;
    const referenceText = getReferenceText(referenceCount);
    const canDelete = referenceCount === 0;

    const deleteImageMutation = useMutation({
        mutationFn: async () => {
            const response = await deleteImage(id);
            if (response.type === 'error') {
                throw response;
            }
            if (!response.deleteImage) {
                throw new Error('Failed to delete image');
            }
            return response.deleteImage;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.images.listAll(),
                exact: false
            });
            toast('Image deleted');
            navigate({
                to: SETTINGS_MANAGE_IMAGE_ROUTE,
                search: { page: 1 }
            });
        },
        onError: (error) => {
            toast(getErrorMessage(error, 'Failed to delete image'));
        }
    });

    const setHeroBannerMutation = useMutation({
        mutationFn: async () => {
            const response = await setServerCache('heroBanner', image.url);
            if (response.type === 'error') {
                throw response;
            }
            return response.cache.value;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.ui.heroBanner(),
                exact: true
            });
            toast('Hero banner updated');
        },
        onError: (error) => {
            toast(getErrorMessage(error, 'Failed to update hero banner'));
        }
    });

    const handleDelete = async () => {
        if (!canDelete || deleteImageMutation.isPending) {
            return;
        }

        if (await confirm('Are you really sure?')) {
            deleteImageMutation.mutate();
        }
    };

    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            <div className="w-full lg:w-[400px] lg:flex-shrink-0">
                <SurfaceCard flush>
                    <div
                        className="flex items-center justify-center bg-muted/20 p-4"
                        style={{ height: DETAIL_PREVIEW_HEIGHT }}>
                        <ImageComponent
                            className="max-h-full w-auto max-w-full rounded-[14px] object-contain"
                            src={image.url}
                            alt={`Image ${image.id}`}
                        />
                    </div>
                    <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Icon.LinkIcon size={14} className="text-fg-tertiary" />
                                <Text as="span" variant="meta" weight="medium" tone="secondary">
                                    {referenceText}
                                </Text>
                            </div>
                            {!canDelete && (
                                <Text as="span" variant="label" weight="medium" tone="tertiary">
                                    In use
                                </Text>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Tooltip
                                content={canDelete ? 'Delete this image' : 'Cannot delete while referenced by notes'}
                                side="bottom">
                                <Button
                                    variant="soft-danger"
                                    size="sm"
                                    className="flex-1"
                                    disabled={!canDelete}
                                    isLoading={deleteImageMutation.isPending}
                                    onClick={handleDelete}>
                                    <Icon.TrashCan size={16} />
                                    <Text as="span" weight="medium" className="text-current">
                                        Delete
                                    </Text>
                                </Button>
                            </Tooltip>
                            <Button
                                variant="primary"
                                size="sm"
                                className="flex-1"
                                isLoading={setHeroBannerMutation.isPending}
                                onClick={() => setHeroBannerMutation.mutate()}>
                                <Icon.Heart size={16} className="text-fg-secondary" />
                                <Text as="span" weight="medium" className="text-current">
                                    Set hero banner
                                </Text>
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
            <div className="flex-1 min-w-0">
                {referenceCount > 0 ? (
                    <SurfaceCard>
                        <div className={sectionHeaderClassName}>
                            <div className={sectionTextClassName}>
                                <Text as="h2" variant="subheading" weight="medium" tracking="tight">
                                    Referenced Notes
                                </Text>
                                <Text as="p" variant="meta" tone="secondary">
                                    Notes currently using this image
                                </Text>
                            </div>
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {referenceText}
                            </Text>
                        </div>
                        <ul className="flex flex-col">
                            {imageNotes.map((note) => (
                                <li key={note.id}>
                                    <NoteListItem {...note} />
                                </li>
                            ))}
                        </ul>
                    </SurfaceCard>
                ) : (
                    <SurfaceCard padding="roomy" className="flex flex-col items-center justify-center text-center">
                        <Icon.Image size={28} className="mb-2 text-fg-disabled" />
                        <Text as="p" variant="subheading" weight="medium" tone="secondary">
                            No notes reference this image
                        </Text>
                        <Text as="p" variant="meta" tone="secondary" className="mt-1">
                            This image can be safely deleted or reused
                        </Text>
                    </SurfaceCard>
                )}
            </div>
        </div>
    );
};

const ManageImageDetail = () => {
    const { id } = Route.useParams();

    return (
        <PageLayout
            title="Image Detail"
            variant="default"
            description="See which notes use this uploaded image and whether you can remove it">
            <Link
                to={SETTINGS_MANAGE_IMAGE_ROUTE}
                search={{ page: 1 }}
                className={backLinkClassName}>
                <Icon.ChevronLeft size={16} />
                <Text as="span" variant="meta" weight="medium" className="text-current">
                    Back to Images
                </Text>
            </Link>
            <QueryBoundary
                fallback={<ManageImageDetailSkeleton />}
                errorTitle="Failed to load image detail"
                errorDescription="Retry loading the image preview and its referenced notes"
                resetKeys={[id]}>
                <ManageImageDetailContent id={id} />
            </QueryBoundary>
        </PageLayout>
    );
};

export default ManageImageDetail;
