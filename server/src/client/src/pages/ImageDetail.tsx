import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Image as ImageComponent } from '~/components/shared';
import { NoteListItem } from '~/components/note';
import * as Icon from '~/components/icon';

import { deleteImage, fetchImage } from '~/apis/image.api';
import { fetchImageNotes } from '~/apis/note.api';
import { setServerCache } from '~/apis/server-cache.api';

export default function ImageDetail() {
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
            <div className="flex gap-10 flex-col items-start justify-center lg:flex-row">
                {image && (
                    <div className="flex flex-col gap-3">
                        <ImageComponent
                            className="w-full max-w-96 h-auto object-contain rounded-lg"
                            src={image.url}
                        />
                        <button disabled={disabledDelete} className="w-full h-10 bg-red-600 rounded-lg text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleDelete}>
                            <div className="flex items-center justify-center gap-1">
                                <Icon.TrashCan className="h-4 w-4" />
                                <span>Delete</span>
                            </div>
                        </button>
                        <button
                            className="w-full h-10 rounded-lg text-sm font-bold"
                            onClick={async () => {
                                await setServerCache('heroBanner', image.url);
                                await queryClient.invalidateQueries({ queryKey: ['heroBanner'] });
                            }}>
                            <div className="flex items-center justify-center gap-1">
                                <Icon.Heart className="h-4 w-4 fill-red-500" />
                                <span>Set hero banner</span>
                            </div>
                        </button>
                    </div>
                )}
                <div className="flex-1 w-full">
                    <p className="text-sm font-bold">
                        Referenced by {imageNotes?.length} {imageNotes?.length === 1 ? 'note' : 'notes'}
                    </p>
                    <ul className="flex flex-col gap-5">
                        {imageNotes?.map((note) => (
                            <li key={note.id} className="flex flex-col gap-2">
                                <NoteListItem {...note} />
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
}
