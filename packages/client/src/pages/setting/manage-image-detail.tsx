import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Image as ImageComponent, PageLayout } from '~/components/shared';
import { NoteListItem } from '~/components/note';
import { Button, Tooltip, useConfirm } from '~/components/ui';
import * as Icon from '~/components/icon';

import { deleteImage, fetchImage } from '~/apis/image.api';
import { fetchImageNotes } from '~/apis/note.api';
import { setServerCache } from '~/apis/server-cache.api';

const ManageImageDetail = () => {
    const confirm = useConfirm();
    const { id } = useParams();
    const navigation = useNavigate();
    const queryClient = useQueryClient();

    const { data: image } = useQuery({
        queryKey: ['image', id],
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
        queryKey: ['image', id, 'notes'],
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
            await deleteImage(id!);
            navigation('/setting/manage-image');
        }
    };

    return (
        <PageLayout title="Image Detail" variant="none">
            <Link
                to="/setting/manage-image"
                className="inline-flex items-center gap-1 text-sm font-bold text-fg-tertiary hover:text-accent-primary transition-colors mb-4">
                <Icon.ChevronLeft size={16} />
                Back to Images
            </Link>

            <div className="flex gap-6 flex-col lg:flex-row">
                {image && (
                    <div className="w-full lg:w-[400px] lg:flex-shrink-0">
                        <div className="bg-subtle rounded-[16px_5px_17px_4px/5px_13px_5px_15px] border-2 border-border shadow-sketchy overflow-hidden">
                            <div className="bg-muted/30 p-4 flex items-center justify-center">
                                <ImageComponent
                                    className="max-h-80 w-auto max-w-full object-contain rounded-sketchy-sm"
                                    src={image.url}
                                />
                            </div>
                            <div className="p-4 flex flex-col gap-3 border-t-2 border-dashed border-border-subtle">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon.LinkIcon size={14} className="text-fg-tertiary" />
                                        <span className="text-sm font-bold text-fg-secondary">
                                            {imageNotes?.length || 0} {(imageNotes?.length || 0) === 1 ? 'reference' : 'references'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Tooltip
                                        content={disabledDelete ? 'Cannot delete while referenced by notes' : 'Delete this image'}
                                        side="bottom">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            className="flex-1"
                                            disabled={disabledDelete}
                                            onClick={handleDelete}>
                                            <Icon.TrashCan size={16} />
                                            <span>Delete</span>
                                        </Button>
                                    </Tooltip>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1"
                                        onClick={async () => {
                                            await setServerCache('heroBanner', image.url);
                                            await queryClient.invalidateQueries({ queryKey: ['heroBanner'] });
                                        }}>
                                        <Icon.Heart size={16} className="fill-red-500 text-red-500" />
                                        <span>Set hero banner</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    {imageNotes && imageNotes.length > 0 ? (
                        <div className="bg-subtle rounded-[16px_5px_17px_4px/5px_13px_5px_15px] border-2 border-border shadow-sketchy p-4">
                            <p className="text-sm font-bold mb-2 pb-2 border-b-2 border-dashed border-border-subtle">
                                Referenced Notes
                            </p>
                            <ul className="flex flex-col">
                                {imageNotes.map((note) => (
                                    <li key={note.id}>
                                        <NoteListItem {...note} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-subtle rounded-[16px_5px_17px_4px/5px_13px_5px_15px] border-2 border-border p-8 flex flex-col items-center justify-center text-center">
                            <Icon.Image size={32} className="text-fg-disabled mb-2" />
                            <p className="text-sm font-bold text-fg-tertiary">No notes reference this image</p>
                            <p className="text-xs text-fg-placeholder mt-1">This image can be safely deleted</p>
                        </div>
                    )}
                </div>
            </div>
        </PageLayout>
    );
};

export default ManageImageDetail;
