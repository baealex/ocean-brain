import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Image as ImageComponent, PageLayout, SurfaceCard } from '~/components/shared';
import { NoteListItem } from '~/components/note';
import { Button, Tooltip, useConfirm, useToast } from '~/components/ui';
import * as Icon from '~/components/icon';

import { deleteImage, fetchImage } from '~/apis/image.api';
import { fetchImageNotes } from '~/apis/note.api';
import { setServerCache } from '~/apis/server-cache.api';
import { queryKeys } from '~/modules/query-key-factory';
import {
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE
} from '~/modules/url';

const Route = getRouteApi(SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE);

const ManageImageDetail = () => {
    const confirm = useConfirm();
    const toast = useToast();
    const { id } = Route.useParams();
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();

    const { data: image } = useQuery({
        queryKey: queryKeys.images.detail(id ?? ''),
        async queryFn() {
            const response = await fetchImage(id!);
            if (response.type === 'error') {
                throw response;
            }
            return response.image;
        },
        enabled: !!id
    });

    const { data: imageNotes } = useQuery({
        queryKey: queryKeys.images.notes(id ?? ''),
        async queryFn() {
            const response = await fetchImageNotes(image!.url);
            if (response.type === 'error') {
                throw response;
            }
            return response.imageNotes;
        },
        enabled: !!image
    });

    const disabledDelete = !imageNotes || (imageNotes?.length || 0) > 0;

    const handleDelete = async () => {
        if (disabledDelete) {
            return;
        }
        if (await confirm('Are you really sure?')) {
            const response = await deleteImage(id!);
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            if (!response.deleteImage) {
                toast('Failed to delete image');
                return;
            }
            navigate({
                to: SETTINGS_MANAGE_IMAGE_ROUTE,
                search: { page: 1 }
            });
        }
    };

    return (
        <PageLayout title="Image Detail" variant="none">
            <Link
                to={SETTINGS_MANAGE_IMAGE_ROUTE}
                search={{ page: 1 }}
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-fg-secondary transition-colors hover:text-fg-default">
                <Icon.ChevronLeft size={16} />
                Back to Images
            </Link>

            <div className="flex flex-col gap-6 lg:flex-row">
                {image && (
                    <div className="w-full lg:w-[400px] lg:flex-shrink-0">
                        <SurfaceCard className="overflow-hidden p-0">
                            <div className="flex items-center justify-center bg-muted/20 p-4">
                                <ImageComponent
                                    className="max-h-80 w-auto max-w-full rounded-[14px] object-contain"
                                    src={image.url}
                                />
                            </div>
                            <div className="flex flex-col gap-3 border-t border-border-subtle p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon.LinkIcon size={14} className="text-fg-tertiary" />
                                        <span className="text-sm font-medium text-fg-secondary">
                                            {imageNotes?.length || 0} {(imageNotes?.length || 0) === 1 ? 'reference' : 'references'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Tooltip
                                        content={disabledDelete ? 'Cannot delete while referenced by notes' : 'Delete this image'}
                                        side="bottom">
                                        <Button
                                            variant="soft-danger"
                                            size="sm"
                                            className="flex-1"
                                            disabled={disabledDelete}
                                            onClick={handleDelete}>
                                            <Icon.TrashCan size={16} />
                                            <span>Delete</span>
                                        </Button>
                                    </Tooltip>
                                    <Button
                                        variant="subtle"
                                        size="sm"
                                        className="flex-1"
                                        onClick={async () => {
                                            await setServerCache('heroBanner', image.url);
                                            await queryClient.invalidateQueries({
                                                queryKey: queryKeys.ui.heroBanner(),
                                                exact: true
                                            });
                                        }}>
                                        <Icon.Heart size={16} className="fill-red-500 text-red-500" />
                                        <span>Set hero banner</span>
                                    </Button>
                                </div>
                            </div>
                        </SurfaceCard>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    {imageNotes && imageNotes.length > 0 ? (
                        <SurfaceCard className="p-4">
                            <p className="mb-3 border-b border-border-subtle pb-2 text-sm font-semibold text-fg-default">
                                Referenced Notes
                            </p>
                            <ul className="flex flex-col">
                                {imageNotes.map((note) => (
                                    <li key={note.id}>
                                        <NoteListItem {...note} />
                                    </li>
                                ))}
                            </ul>
                        </SurfaceCard>
                    ) : (
                        <SurfaceCard className="flex flex-col items-center justify-center p-8 text-center">
                            <Icon.Image size={32} className="mb-2 text-fg-disabled" />
                            <p className="text-sm font-semibold text-fg-secondary">No notes reference this image</p>
                            <p className="mt-1 text-xs text-fg-placeholder">This image can be safely deleted</p>
                        </SurfaceCard>
                    )}
                </div>
            </div>
        </PageLayout>
    );
};

export default ManageImageDetail;
