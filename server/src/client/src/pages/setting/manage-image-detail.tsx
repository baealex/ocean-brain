import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Image as ImageComponent } from '~/components/shared';
import { NoteListItem } from '~/components/note';
import { Button, useConfirm } from '~/components/ui';
import * as Icon from '~/components/icon';

import { deleteImage, fetchImage } from '~/apis/image.api';
import { fetchImageNotes } from '~/apis/note.api';
import { setServerCache } from '~/apis/server-cache.api';

const ManageImageDetail =  () => {
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
            navigation('/manage-image');
        }
    };

    return (
        <>
            <Helmet>
                <title>Image | Ocean Brain</title>
            </Helmet>
            <div className="flex gap-8 flex-col items-start justify-center lg:flex-row">
                {image && (
                    <div className="flex flex-col gap-3 w-full max-w-96">
                        <div className="border-2 border-zinc-800 dark:border-zinc-700 rounded-[16px_5px_17px_4px/5px_13px_5px_15px] overflow-hidden shadow-sketchy">
                            <ImageComponent
                                className="w-full h-auto object-contain"
                                src={image.url}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="danger"
                                size="sm"
                                className="flex-1"
                                disabled={disabledDelete}
                                onClick={handleDelete}>
                                <Icon.TrashCan size={16} />
                                <span>Delete</span>
                            </Button>
                            <Button
                                variant="secondary"
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
                )}
                <div className="flex-1 w-full">
                    <p className="text-sm font-bold mb-3">
                        Referenced by {imageNotes?.length || 0} {imageNotes?.length === 1 ? 'note' : 'notes'}
                    </p>
                    <ul className="flex flex-col">
                        {imageNotes?.map((note) => (
                            <li key={note.id}>
                                <NoteListItem {...note} />
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
};

export default ManageImageDetail;
